// X (Twitter) exports from Analytics, as CSV:
//
//   posts     account_analytics_content_<from>_<to>.csv: one row per post, with its figures
//   overview  account_overview_analytics.csv: the account's figures per day
//
// X's "Engagements" counts clicks too (like LinkedIn's engagement rate), so it is kept but the
// comparable measures are likes, replies, reposts, bookmarks and shares.

import { ExportError, cleanCell, exportDate, exportNumber, num, titleOf } from './common';
import { decodeText, looksLikeCsv, parseCsv } from './csv';
import { NO_MEASURES, type CleanedExport, type DailyRow, type Value } from './rows';

export type XFile = 'posts' | 'overview';

/** The post's ID from an X or Twitter link: /<account>/status/123…. */
export function xKey(url: string): string | null {
  const m = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+\/status(?:es)?\/(\d{5,25})/i.exec(url);
  return m ? `x:${m[1]}` : null;
}

/** The account from an X link: https://x.com/EmkayInvestment/status/… → "EmkayInvestment". */
const handleOf = (url: string) => /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status/i.exec(url)?.[1] ?? null;

const POST = {
  id: 'Post id', date: 'Date', text: 'Post text', link: 'Post Link', impressions: 'Impressions', likes: 'Likes',
  engagements: 'Engagements', bookmarks: 'Bookmarks', shares: 'Shares', follows: 'New follows', replies: 'Replies',
  reposts: 'Reposts', clicks: 'URL Clicks'
};

export function xFileOf(bytes: Uint8Array): XFile | null {
  if (!looksLikeCsv(bytes)) return null;
  const headers = parseCsv(decodeText(bytes).text)[0] ?? [];
  if (headers.includes(POST.id) && headers.includes(POST.link) && headers.includes(POST.impressions)) return 'posts';
  if (headers[0] === 'Date' && headers.includes('New follows') && headers.includes('Unfollows')) return 'overview';
  return null;
}

export function readXExport(bytes: Uint8Array, fileName = ''): CleanedExport {
  const file = xFileOf(bytes);
  if (!file) throw new ExportError('This is not an X analytics export.');
  const { text, resaved } = decodeText(bytes);
  const [headers, ...body] = parseCsv(text);
  const out: CleanedExport = {
    platform: 'x', file, account: null, from: '', to: '', postFigures: 'lifetime',
    posts: [], daily: [], audience: null, benchmark: [], totals: null, skipped: [], notes: []
  };
  if (resaved) out.notes.push('This file seems to have been opened and re-saved in Excel, which can damage it. Next time, upload it straight from the download.');

  if (file === 'overview') {
    out.daily = body
      .map((r) => ({ date: exportDate(r[0]), values: Object.fromEntries(headers.slice(1).map((h, i) => [h, exportNumber(r[i + 1])])) }))
      .filter((d): d is DailyRow => d.date !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  } else {
    body.forEach((row, i) => {
      const columns: Record<string, Value> = Object.fromEntries(headers.map((h, c) => [h, cleanCell(h, row[c])]));
      const link = String(columns[POST.link] ?? '');
      const id = String(columns[POST.id] ?? '');
      const postId = xKey(link) ?? (/^\d{5,25}$/.test(id) ? `x:${id}` : null);
      const date = columns[POST.date];
      if (!postId) {
        out.skipped.push(`Row ${i + 2}: no recognisable post link or ID.`);
        return;
      }
      out.posts.push({
        ...NO_MEASURES,
        postId,
        link,
        title: titleOf(columns[POST.text]),
        created: typeof date === 'string' && /^\d{4}-/.test(date) ? date.slice(0, 10) : null,
        sponsored: false,
        campaign: null,
        campaignId: null,
        contentType: null,
        account: handleOf(link),
        impressions: num(columns, POST.impressions),
        reactions: num(columns, POST.likes),
        comments: num(columns, POST.replies),
        reposts: num(columns, POST.reposts),
        shares: num(columns, POST.shares),
        saves: num(columns, POST.bookmarks),
        follows: num(columns, POST.follows),
        clicks: num(columns, POST.clicks),
        columns
      });
    });
    out.account = out.posts.map((p) => p.account).find(Boolean) ?? null;
  }

  const m = /(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/.exec(fileName);
  const dates = [...out.daily.map((d) => d.date), ...out.posts.map((p) => p.created).filter((d): d is string => !!d)].sort();
  out.from = (file === 'posts' && m?.[1]) || dates[0] || '';
  out.to = (file === 'posts' && m?.[2]) || dates.at(-1) || '';
  if (!out.posts.length && !out.daily.length) throw new ExportError('This X export has no data in it. Check the date range you picked.');
  return out;
}
