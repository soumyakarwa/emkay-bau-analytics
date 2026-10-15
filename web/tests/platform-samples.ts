// Made-up YouTube, Instagram and X exports, laid out exactly like the platforms' own (file
// names, headers, date formats, title lines), for the tests.

import { strToU8, zipSync } from 'fflate';

const csv = (rows: (string | number | null)[][]) =>
  rows.map((r) => r.map((v) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n') + '\n';

const DAY = 86400000;
export const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = Date.parse(from); d <= Date.parse(to); d += DAY) out.push(new Date(d).toISOString().slice(0, 10));
  return out;
};
const nextDay = (iso: string) => new Date(Date.parse(iso) + DAY).toISOString().slice(0, 10);

export interface SampleVideo {
  id: string;
  title: string;
  published: string; // "Sep 24, 2026"
  views: number | null;
  likes?: number;
  impressions?: number;
}

/** A YouTube Studio Content export: the zip and the name YouTube gives it. */
export function youTubeContentZip(from: string, to: string, videos: SampleVideo[], channel = 'Emkay Global Financial Services Ltd.'): { name: string; bytes: Uint8Array } {
  const headers = ['Content', 'Video title', 'Video publish time', 'Duration', 'Likes', 'Subscribers gained', 'Subscribers lost', 'Shares',
    'Comments added', 'Average percentage viewed (%)', 'Views', 'Watch time (hours)', 'Subscribers', 'Average view duration', 'Thumbnail impressions', 'Thumbnail click-through rate (%)'];
  const total = videos.reduce((a, v) => a + (v.views ?? 0), 0);
  const table = [headers, ['Total', '', '', '', 5, 3, 1, 2, 1, 16.46, total, 12.5, 2, '0:02:10', 9000, 2.03],
    ...videos.map((v) => v.views === null
      ? [v.id, v.title, v.published, 120, ...Array(10).fill(''), 2, 0]
      : [v.id, v.title, v.published, 120, v.likes ?? 0, 1, 0, 0, 0, 28.48, v.views, 1.3, 0, '0:01:16', v.impressions ?? 1000, 2.97])];
  const totals = [['Date', 'Views'], ...daysBetween(from, to).map((d) => [d, 10])];
  const chart = [['Date', 'Content', 'Video title', 'Video publish time', 'Duration', 'Views'], ...daysBetween(from, to).map((d) => [d, videos[0].id, videos[0].title, videos[0].published, 120, 1])];
  return {
    name: `Content ${from}_${nextDay(to)} ${channel}.zip`,
    bytes: zipSync({ 'Table data.csv': strToU8(csv(table)), 'Chart data.csv': strToU8(csv(chart)), 'Totals.csv': strToU8(csv(totals)) })
  };
}

/** A YouTube Studio Traffic source export. */
export function youTubeTrafficZip(from: string, to: string): { name: string; bytes: Uint8Array } {
  const table = [['Traffic source', 'Views', 'Watch time (hours)', 'Average view duration', 'Thumbnail impressions', 'Thumbnail click-through rate (%)'],
    ['Total', 300, 5, '0:01:00', 4000, 2], ['YouTube search', 200, 3, '0:01:18', 3000, 2.93], ['External', 100, 2, '0:00:40', '', '']];
  const totals = [['Date', 'Views'], ...daysBetween(from, to).map((d) => [d, 10])];
  return {
    name: `Traffic source ${from}_${nextDay(to)} Emkay Global Financial Services Ltd.-2.zip`,
    bytes: zipSync({ 'Table data.csv': strToU8(csv(table)), 'Chart data.csv': strToU8(csv([['Date', 'Traffic source', 'Views']])), 'Totals.csv': strToU8(csv(totals)) })
  };
}

export interface SampleInstagramPost {
  code: string;
  published: string; // "10/14/2026 05:10"
  views: number;
  reach: number;
  likes: number;
  username?: string;
  type?: string;
  text?: string;
}

const IG_HEADERS = ['Post ID', 'Account ID', 'Account username', 'Account name', 'Description', 'Duration (sec)', 'Publish time', 'Permalink',
  'Post type', 'Data comment', 'Date', 'Views', 'Reach', 'Likes', 'Shares', 'Follows', 'Comments', 'Saves'];

/** A Meta Business Suite content export. `resaved` mimics a file opened and saved again in Excel. */
export function instagramPostsCsv(posts: SampleInstagramPost[], opts: { resaved?: boolean } = {}): Uint8Array {
  const rows = [IG_HEADERS, ...posts.map((p, i) => [
    opts.resaved ? '1.79E+16' : `1790000000000000${i}`, '17800000000000000', p.username ?? 'emkayinvestmentmanagers', 'Emkay Investment Managers Limited',
    p.text ?? `Post ${p.code} — “growth” ™`, 60, p.published, `https://www.instagram.com/${p.type === 'IG carousel' ? 'p' : 'reel'}/${p.code}/`, p.type ?? 'IG reel', '', 'Lifetime',
    p.views, p.reach, p.likes, 1, 0, 2, 3
  ])];
  const text = csv(rows);
  if (!opts.resaved) return strToU8(text);
  // Windows-1252, as Excel saves it: "™" is byte 0x99, the curly quotes and dash single bytes.
  const map: Record<string, number> = { '™': 0x99, '“': 0x93, '”': 0x94, '—': 0x97 };
  return Uint8Array.from([...text].map((c) => map[c] ?? c.charCodeAt(0)));
}

export function instagramSummaryCsv(kind: 'Overview' | 'Posts', page = 'Emkay Wealth', from = 'Oct-14-2025', to = 'Oct-14-2026'): Uint8Array {
  const title = `${kind} summary for Instagram page ${page} for the period ${from} to ${to}`;
  const body = kind === 'Overview'
    ? [['Key', 'Name', 'Value Current Period', 'Description'], ['reach', 'Reach', 6358, 'The number of unique accounts'], ['follower_count', 'New Followers', 29, 'The number of followers, in this period.']]
    : [['Name', 'Value Current Period'], ['Posts', 88], ['Reach', 6358], ['Reels Skip Rate', 78.83]];
  return strToU8(`${title}\n${csv(body)}`);
}

export function xPostsCsv(posts: { id: string; date: string; impressions: number; likes: number; text?: string }[], handle = 'EmkayInvestment'): Uint8Array {
  const headers = ['Post id', 'Date', 'Post text', 'Post Link', 'Impressions', 'Likes', 'Engagements', 'Bookmarks', 'Shares', 'New follows',
    'Replies', 'Reposts', 'Profile visits', 'Detail Expands', 'URL Clicks', 'Hashtag Clicks', 'Permalink Clicks'];
  return strToU8(csv([headers, ...posts.map((p) => [p.id, p.date, p.text ?? 'A post, with a comma', `https://x.com/${handle}/status/${p.id}`,
    p.impressions, p.likes, p.likes + 2, 1, 0, 0, 1, 1, 0, 0, 2, 0, 0])]));
}

export function xOverviewCsv(days: string[]): Uint8Array {
  const headers = ['Date', 'Impressions', 'Likes', 'Engagements', 'Bookmarks', 'Shares', 'New follows', 'Unfollows', 'Replies', 'Reposts', 'Profile visits', 'Create Post', 'Video views', 'Media views'];
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return strToU8(csv([headers, ...[...days].reverse().map((d) => [fmt(d), 100, 2, 3, 0, 0, 1, 0, 1, 0, 2, 0, 0, 0])]));
}
