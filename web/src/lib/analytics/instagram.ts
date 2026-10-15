// Instagram exports from Meta Business Suite (Insights → export), as CSV:
//
//   posts          one row per post, with its lifetime figures (views, reach, likes, comments,
//                  shares, saves, follows). The one matched to the calendar.
//   overview       "Overview summary for Instagram page …": the account's totals for the period
//   posts-summary  "Posts summary for Instagram page …": totals across its posts for the period
//
// A file opened and re-saved in Excel is still read, but loses detail: long post IDs become
// 1.79E+16 and emoji become "??". The post link survives, so posts can still be matched.

import { ExportError, cleanCell, exportDate, exportNumber, num, titleOf } from './common';
import { decodeText, looksLikeCsv, parseCsv } from './csv';
import { NO_MEASURES, type CleanedExport, type PostRow, type Value } from './rows';

export type InstagramFile = 'posts' | 'overview' | 'posts-summary';

/** The post's shortcode from an Instagram link: /p/…, /reel/…, /tv/…. */
export function instagramKey(url: string): string | null {
  const m = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/i.exec(url);
  return m ? `ig:${m[1]}` : null;
}

const POST = {
  id: 'Post ID', username: 'Account username', name: 'Account name', text: 'Description', published: 'Publish time',
  link: 'Permalink', type: 'Post type', views: 'Views', reach: 'Reach', likes: 'Likes', shares: 'Shares',
  follows: 'Follows', comments: 'Comments', saves: 'Saves'
};

const SUMMARY = /^(Overview|Posts) summary for Instagram page (.+?) for the period (.+?) to (.+?)\s*$/i;

function rowsOf(bytes: Uint8Array): { rows: string[][]; resaved: boolean } {
  const { text, resaved } = decodeText(bytes);
  return { rows: parseCsv(text), resaved };
}

export function instagramFileOf(bytes: Uint8Array): InstagramFile | null {
  if (!looksLikeCsv(bytes)) return null;
  const { rows } = rowsOf(bytes);
  const first = rows[0] ?? [];
  const summary = SUMMARY.exec(first[0] ?? '');
  if (summary) return summary[1].toLowerCase() === 'overview' ? 'overview' : 'posts-summary';
  return first.includes(POST.link) && first.includes(POST.reach) && first.includes(POST.username) ? 'posts' : null;
}

/** "Oct-15-2025_Oct-14-2026_123.csv" → the period, when the file name still has it. */
function periodFromName(fileName: string): { from: string; to: string } | null {
  const m = /([A-Za-z]{3}-\d{1,2}-\d{4})_([A-Za-z]{3}-\d{1,2}-\d{4})/.exec(fileName);
  const from = m && exportDate(m[1]);
  const to = m && exportDate(m[2]);
  return from && to ? { from, to } : null;
}

export function readInstagramExport(bytes: Uint8Array, fileName = ''): CleanedExport {
  const file = instagramFileOf(bytes);
  if (!file) throw new ExportError('This is not an Instagram export from Meta Business Suite.');
  const { rows, resaved } = rowsOf(bytes);
  const out: CleanedExport = {
    platform: 'instagram', file, account: null, from: '', to: '', postFigures: 'lifetime',
    posts: [], daily: [], audience: null, benchmark: [], totals: null, skipped: [], notes: []
  };
  if (resaved) out.notes.push('This file seems to have been opened and re-saved in Excel, which damages it (emoji become "??", long numbers are rounded). Next time, upload it straight from the download.');

  if (file !== 'posts') {
    const [, , page, fromText, toText] = SUMMARY.exec(rows[0][0])!;
    out.account = page.trim();
    out.from = exportDate(fromText) ?? '';
    out.to = exportDate(toText) ?? '';
    const headers = rows[1] ?? [];
    const nameCol = headers.indexOf('Name');
    const valueCol = headers.findIndex((h) => /^Value/i.test(h));
    if (nameCol < 0 || valueCol < 0) throw new ExportError('This Instagram summary has no Name and Value columns. Upload it exactly as Meta Business Suite exports it.');
    out.totals = Object.fromEntries(rows.slice(2).filter((r) => r[nameCol]).map((r) => [r[nameCol].trim(), exportNumber(r[valueCol])]));
    if (!out.from || !out.to) throw new ExportError('This Instagram summary does not say which period it covers.');
    return out;
  }

  const [headers, ...body] = rows;
  const missing = [POST.link, POST.published, POST.views, POST.reach, POST.likes, POST.comments].filter((h) => !headers.includes(h));
  if (missing.length) throw new ExportError(`This Instagram export is missing ${missing.map((m) => `"${m}"`).join(', ')}. Export it again from Meta Business Suite.`);
  let roundedIds = false;
  body.forEach((row, i) => {
    const columns: Record<string, Value> = Object.fromEntries(headers.map((h, c) => [h, cleanCell(h, row[c])]));
    if (/^\d(\.\d+)?E\+\d+$/i.test(String(columns[POST.id] ?? ''))) roundedIds = true;
    const link = String(columns[POST.link] ?? '');
    const postId = instagramKey(link);
    if (!postId) {
      out.skipped.push(`Row ${i + 2}: no recognisable post link.`);
      return;
    }
    const published = columns[POST.published];
    const views = num(columns, POST.views);
    const post: PostRow = {
      ...NO_MEASURES,
      postId,
      link,
      title: titleOf(columns[POST.text]),
      created: typeof published === 'string' && /^\d{4}-/.test(published) ? published.slice(0, 10) : null,
      sponsored: false,
      campaign: null,
      campaignId: null,
      contentType: String(columns[POST.type] ?? '').replace(/^IG\s+/i, '') || null,
      account: (columns[POST.username] as string | null) ?? null,
      // Instagram counts views where it used to count impressions: each time the post was shown.
      impressions: views,
      views,
      reach: num(columns, POST.reach),
      reactions: num(columns, POST.likes),
      comments: num(columns, POST.comments),
      shares: num(columns, POST.shares),
      saves: num(columns, POST.saves),
      follows: num(columns, POST.follows),
      columns
    };
    out.posts.push(post);
  });
  if (roundedIds) out.notes.push('Post IDs were rounded (e.g. 1.79E+16), which happens when the file is re-saved in Excel. Posts are matched by their links instead.');
  const accounts = [...new Set(out.posts.map((p) => p.account).filter(Boolean))] as string[];
  // The account is the one most posts belong to; collab posts can be another account's.
  out.account = accounts.sort((a, b) => out.posts.filter((p) => p.account === b).length - out.posts.filter((p) => p.account === a).length)[0] ?? null;

  const period = periodFromName(fileName);
  const dates = out.posts.map((p) => p.created).filter((d): d is string => !!d).sort();
  out.from = period?.from ?? dates[0] ?? '';
  out.to = period?.to ?? dates.at(-1) ?? '';
  if (!period && dates.length) out.notes.push("The file name does not say which period it covers (it may have been renamed), so the period is taken from the posts' dates.");
  if (!out.posts.length) throw new ExportError('This Instagram export has no posts in it. Check the date range you picked.');
  return out;
}
