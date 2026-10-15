// LinkedIn page analytics exports, read exactly as LinkedIn gives them (Page admin view →
// Analytics → a tab → Export). Four kinds of file, told apart by their sheets:
//
//   content      .xls  "All posts" (one row per post, and per campaign for boosted posts) and
//                      "Metrics" (the page's figures per day)
//   followers    .xls  "New followers" per day, and who follows the page on the export day
//   visitors     .xls  "Visitor metrics" per day, and who visited over the period
//   competitors  .xlsx the page against the peers it tracks, over the period (optional)
//
// Every column is kept. Cleaning: the header row is found by name (some sheets have a note line
// above it), US-style dates (month first) become YYYY-MM-DD, numbers become numbers, blanks stay
// blank, and LinkedIn's "Total" rows (organic + sponsored, which can be recalculated) are left out.

import { normalise } from '../workbook/contract';
import { readXls, isXls } from '../workbook/xls';
import { readXlsx, type Sheet } from '../workbook/xlsx';
import type { Audience, BenchmarkRow, CleanedExport, DailyRow, LinkedInFile, PostRow, Value } from './rows';

const FILE_SHEETS: [LinkedInFile, string][] = [
  ['content', 'All posts'],
  ['followers', 'New followers'],
  ['visitors', 'Visitor metrics'],
  ['competitors', 'Competitors']
];

const sheetNamed = (sheets: Sheet[], name: string) => sheets.find((s) => normalise(s.name) === normalise(name)) ?? null;

/** Which LinkedIn export this is, or null for anything else (such as a calendar workbook). */
export function linkedInFileOf(sheets: Sheet[]): LinkedInFile | null {
  return FILE_SHEETS.find(([, name]) => sheetNamed(sheets, name))?.[0] ?? null;
}

export function readSheets(bytes: Uint8Array): Sheet[] {
  return isXls(bytes) ? readXls(bytes) : readXlsx(bytes);
}

/** "emkayinvestmentmanagers_content_1791966587478.xls" → "emkayinvestmentmanagers" */
export function pageFromFileName(fileName: string): string | null {
  return /^(.+?)_(content|followers|visitors)_\d+\.xlsx?$/i.exec(fileName.split(/[\\/]/).pop() ?? '')?.[1].toLowerCase() ?? null;
}

/**
 * The post's ID from any LinkedIn post link: /feed/update/urn:li:activity:123…,
 * /posts/name_slug-activity-123…-abcd, and the same with ugcPost or share. Null for other links,
 * including lnkd.in short links, which do not carry the ID.
 */
export function linkedInKey(url: string): string | null {
  if (!/^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(url)) return null;
  const m = /(?:urn(?::|%3A)li(?::|%3A)|[-_])(activity|ugcPost|share)(?::|%3A|-)(\d{15,22})/i.exec(url);
  if (!m) return null;
  const kind = m[1].toLowerCase() === 'ugcpost' ? 'ugcPost' : m[1].toLowerCase();
  return `${kind}:${m[2]}`;
}

export const isShortLinkedInLink = (url: string) => /^https?:\/\/(www\.)?lnkd\.in\//i.test(url);

/** "10/13/2025" (US style: month first, as LinkedIn writes it) or an Excel date number → "2025-10-13". */
export function exportDate(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? '').trim());
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

export function exportNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s.endsWith('%') ? s.slice(0, -1) : s);
  return Number.isFinite(n) ? (s.endsWith('%') ? n / 100 : n) : null;
}

class ExportError extends Error {}

export function isExportError(e: unknown): e is Error {
  return e instanceof ExportError;
}

interface Table {
  headers: string[];
  rows: unknown[][];
}

/** The table on a sheet: its header row is the first of the top ten rows to start with `firstHeader`. */
function table(sheet: Sheet, firstHeader: string): Table | null {
  for (let r = 1; r <= Math.min(sheet.maxRow, 10); r++) {
    if (normalise(String(sheet.cell(r, 1).value ?? '')) !== normalise(firstHeader)) continue;
    const headers: string[] = [];
    for (let c = 1; sheet.cell(r, c).value !== null; c++) headers.push(String(sheet.cell(r, c).value).trim());
    const rows: unknown[][] = [];
    for (let rr = r + 1; rr <= sheet.maxRow; rr++) {
      const row = headers.map((_, i) => sheet.cell(rr, i + 1).value);
      if (!row.every((v) => v === null || v === '')) rows.push(row);
    }
    return { headers, rows };
  }
  return null;
}

function need(t: Table | null, sheetName: string, columns: string[]): Table {
  if (!t) throw new ExportError(`The "${sheetName}" sheet has no table. Upload the file exactly as LinkedIn exports it.`);
  const missing = columns.filter((c) => !t.headers.includes(c));
  if (missing.length) {
    throw new ExportError(`The "${sheetName}" sheet is missing ${missing.map((m) => `"${m}"`).join(', ')}. LinkedIn may have changed its export; tell whoever looks after the site.`);
  }
  return t;
}

/** A cell cleaned by its column: dates for date columns, numbers where the value is numeric, else text. */
function clean(header: string, v: unknown): Value {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  if (/date/i.test(header)) return exportDate(v) ?? String(v).trim();
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v).trim();
  return /^-?[\d,]*\.?\d+%?$/.test(s) ? exportNumber(s) : s;
}

function columnsOf(t: Table, row: unknown[]): Record<string, Value> {
  return Object.fromEntries(t.headers.map((h, i) => [h, clean(h, row[i])]));
}

function readDaily(t: Table): DailyRow[] {
  const out: DailyRow[] = [];
  for (const row of t.rows) {
    const date = exportDate(row[0]);
    if (!date) continue;
    const values: Record<string, number | null> = {};
    t.headers.forEach((h, i) => {
      if (i > 0) values[h] = exportNumber(row[i]);
    });
    out.push({ date, values });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function readAudience(sheets: Sheet[], except: string, of: Audience['of']): Audience {
  const rows: Audience['rows'] = [];
  for (const s of sheets) {
    if (s.name === except) continue;
    const t = table(s, s.name);
    if (!t || t.headers.length < 2) continue;
    for (const r of t.rows) {
      const label = String(r[0] ?? '').trim();
      const value = exportNumber(r[1]);
      if (label && value !== null) rows.push({ dimension: s.name, label, value });
    }
  }
  return { of, rows };
}

const POST = {
  title: 'Post title', link: 'Post link', type: 'Post type', campaign: 'Campaign name', created: 'Created date',
  impressions: 'Impressions', views: 'Views', clicks: 'Clicks', likes: 'Likes', comments: 'Comments',
  reposts: 'Reposts', follows: 'Follows', engagementRate: 'Engagement rate', contentType: 'Content Type'
};
const POST_REQUIRED = [POST.link, POST.type, POST.created, POST.impressions, POST.clicks, POST.likes, POST.comments, POST.reposts];

function readPosts(t: Table, skipped: string[]): PostRow[] {
  const posts: PostRow[] = [];
  const campaigns = new Map<string, number>();
  t.rows.forEach((row, i) => {
    const columns = columnsOf(t, row);
    const num = (h: string) => (typeof columns[h] === 'number' ? (columns[h] as number) : null);
    const type = String(columns[POST.type] ?? '');
    if (type === 'Total') return;
    const link = String(columns[POST.link] ?? '');
    const postId = linkedInKey(link);
    const created = typeof columns[POST.created] === 'string' && /^\d{4}-/.test(columns[POST.created] as string) ? (columns[POST.created] as string) : null;
    if (!postId || !created || (type !== 'Organic' && type !== 'Sponsored')) {
      skipped.push(`All posts, row ${i + 3}: ${!postId ? 'no recognisable post link' : !created ? 'no created date' : `post type "${type}"`}.`);
      return;
    }
    const text = String(columns[POST.title] ?? '').replace(/\s+/g, ' ').trim();
    let campaignId: string | null = null;
    if (type === 'Sponsored') {
      const base = [postId, columns[POST.campaign], columns['Campaign start date'], columns['Campaign end date']].join('|');
      const seen = (campaigns.get(base) ?? 0) + 1;
      campaigns.set(base, seen);
      campaignId = `${columns[POST.campaign] ?? ''}|${columns['Campaign start date'] ?? ''}|${columns['Campaign end date'] ?? ''}|${seen}`;
    }
    posts.push({
      postId,
      link,
      title: text.length > 160 ? `${text.slice(0, 157)}…` : text,
      created,
      sponsored: type === 'Sponsored',
      campaign: type === 'Sponsored' ? String(columns[POST.campaign] ?? '') || null : null,
      campaignId,
      contentType: (columns[POST.contentType] as string | null) ?? null,
      impressions: num(POST.impressions) ?? 0,
      views: num(POST.views),
      clicks: num(POST.clicks),
      reactions: num(POST.likes),
      comments: num(POST.comments),
      reposts: num(POST.reposts),
      follows: num(POST.follows),
      engagementRate: num(POST.engagementRate),
      columns
    });
  });
  return posts;
}

const COMPETITOR = { page: 'Page', total: 'Total Followers', new: 'New Followers', engagements: 'Total post engagements', posts: 'Total posts' };

function readCompetitors(sheet: Sheet, ownNames: string[]): { benchmark: BenchmarkRow[]; from: string | null; to: string | null } {
  const t = need(table(sheet, COMPETITOR.page), sheet.name, [COMPETITOR.page, COMPETITOR.engagements, COMPETITOR.posts]);
  // The period is on the first row, above the table: "10/14/2025 | 10/13/2026".
  let from: string | null = null;
  let to: string | null = null;
  for (let r = 1; r <= 3 && !from; r++) {
    const a = exportDate(sheet.cell(r, 1).value);
    const b = exportDate(sheet.cell(r, 2).value);
    if (a && b) [from, to] = [a, b];
  }
  const own = ownNames.map(normalise);
  const benchmark = t.rows.map((row): BenchmarkRow => {
    const columns = columnsOf(t, row);
    const num = (h: string) => (typeof columns[h] === 'number' ? (columns[h] as number) : null);
    const page = String(columns[COMPETITOR.page] ?? '');
    return {
      page,
      own: own.some((n) => normalise(page).startsWith(n)),
      totalFollowers: num(COMPETITOR.total),
      newFollowers: num(COMPETITOR.new),
      engagements: num(COMPETITOR.engagements),
      posts: num(COMPETITOR.posts),
      columns
    };
  }).filter((b) => b.page);
  return { benchmark, from, to };
}

/**
 * Reads and cleans one LinkedIn export. `ownNames` are the brand's page names as competitor files
 * show them (e.g. "Emkay Global"), to mark its own row there.
 */
export function readLinkedInExport(bytes: Uint8Array, fileName = '', ownNames: string[] = []): CleanedExport {
  let sheets: Sheet[];
  try {
    sheets = readSheets(bytes);
  } catch {
    throw new ExportError('This file could not be opened. Upload the file exactly as LinkedIn exported it.');
  }
  const file = linkedInFileOf(sheets);
  if (!file) throw new ExportError('This is not a LinkedIn page analytics export (content, followers, visitors or competitors).');

  const out: CleanedExport = { platform: 'linkedin', file, page: pageFromFileName(fileName), from: '', to: '', posts: [], daily: [], audience: null, benchmark: [], skipped: [] };
  let period: { from: string | null; to: string | null } = { from: null, to: null };
  if (file === 'content') {
    const posts = sheetNamed(sheets, 'All posts')!;
    out.posts = readPosts(need(table(posts, POST.title) ?? table(posts, POST.link), posts.name, POST_REQUIRED), out.skipped);
    const metrics = sheetNamed(sheets, 'Metrics');
    if (metrics) out.daily = readDaily(need(table(metrics, 'Date'), metrics.name, ['Date']));
  } else if (file === 'competitors') {
    const r = readCompetitors(sheetNamed(sheets, 'Competitors')!, ownNames);
    out.benchmark = r.benchmark;
    period = r;
  } else {
    const main = sheetNamed(sheets, file === 'followers' ? 'New followers' : 'Visitor metrics')!;
    out.daily = readDaily(need(table(main, 'Date'), main.name, ['Date']));
    out.audience = readAudience(sheets, main.name, file);
  }

  const dates = [...out.daily.map((d) => d.date), ...out.posts.map((p) => p.created)].sort();
  out.from = period.from ?? dates[0] ?? '';
  out.to = period.to ?? dates.at(-1) ?? '';
  if (!out.from || (!out.posts.length && !out.daily.length && !out.benchmark.length)) {
    throw new ExportError('This export has no data in it. Check the date range you picked on LinkedIn.');
  }
  return out;
}
