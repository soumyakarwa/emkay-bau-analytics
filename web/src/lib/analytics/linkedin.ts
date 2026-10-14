// LinkedIn page analytics exports, read exactly as LinkedIn gives them (Page admin view →
// Analytics → Export). There are three kinds of file:
//   content   - one row per post (All posts) and daily totals (Metrics). The one the BAU analysis uses.
//   followers - new followers per day, and who follows the page.
//   visitors  - page views per day, and who visits the page.
// The numbers on each file are totals as of the day it was exported.

import { readXls, isXls } from '../workbook/xls';
import { readXlsx, type Sheet } from '../workbook/xlsx';

export type LinkedInKind = 'content' | 'followers' | 'visitors';

export interface LinkedInPost {
  /** The post's ID as LinkedIn's links carry it, e.g. "activity:7400000000000000002". */
  key: string;
  link: string;
  /** The start of the post's text. */
  title: string;
  /** YYYY-MM-DD, in UTC as LinkedIn exports it. */
  created: string;
  sponsored: boolean;
  contentType: string | null;
  impressions: number;
  views: number | null;
  clicks: number;
  likes: number;
  comments: number;
  reposts: number;
  follows: number | null;
  /** 0–1, as LinkedIn calculates it: (clicks + reactions + comments + reposts + follows) / impressions. */
  engagementRate: number | null;
}

/** One day's account-level figures, keyed by LinkedIn's column names. */
export interface DailyRow {
  date: string;
  values: Record<string, number>;
}

/** Breakdown of followers or visitors (location, job function, seniority, ...) on the export day. */
export interface Breakdown {
  name: string;
  rows: { label: string; value: number }[];
}

export interface LinkedInExport {
  kind: LinkedInKind;
  /** The page's name as it appears in LinkedIn's file name (e.g. "emkayinvestmentmanagers"), if recognisable. */
  page: string | null;
  /** First and last day the file covers (YYYY-MM-DD). `to` is the day the figures are "as of". */
  from: string;
  to: string;
  posts: LinkedInPost[];
  daily: DailyRow[];
  breakdowns: Breakdown[];
}

const KIND_SHEETS: [LinkedInKind, string][] = [
  ['content', 'All posts'],
  ['followers', 'New followers'],
  ['visitors', 'Visitor metrics']
];

/** True when the file looks like a LinkedIn export rather than a calendar workbook. */
export function looksLikeLinkedIn(sheets: Sheet[]): boolean {
  return KIND_SHEETS.some(([, name]) => sheets.some((s) => s.name === name));
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
 * /posts/name_slug-activity-123…-abcd, and the same with ugcPost or share. Null for other links.
 */
export function linkedInKey(url: string): string | null {
  if (!/^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(url)) return null;
  const m = /(?:urn(?::|%3A)li(?::|%3A)|[-_])(activity|ugcPost|share)(?::|%3A|-)(\d{15,22})/i.exec(url);
  if (!m) return null;
  const kind = m[1].toLowerCase() === 'ugcpost' ? 'ugcPost' : m[1].toLowerCase();
  return `${kind}:${m[2]}`;
}

/** "10/13/2025" (US style, as LinkedIn writes it) or an Excel date number → "2025-10-13". */
export function exportDate(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? '').trim());
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s.endsWith('%') ? s.slice(0, -1) : s);
  return Number.isFinite(n) ? (s.endsWith('%') ? n / 100 : n) : null;
};

interface Table {
  headers: string[];
  rows: unknown[][];
}

/** The table on a sheet: its header row is the first row containing `firstHeader`. */
function table(sheet: Sheet, firstHeader: string): Table | null {
  for (let r = 1; r <= Math.min(sheet.maxRow, 10); r++) {
    if (sheet.cell(r, 1).value !== firstHeader) continue;
    const headers: string[] = [];
    for (let c = 1; sheet.cell(r, c).value !== null; c++) headers.push(String(sheet.cell(r, c).value).trim());
    const rows: unknown[][] = [];
    for (let rr = r + 1; rr <= sheet.maxRow; rr++) {
      const row = headers.map((_, i) => sheet.cell(rr, i + 1).value);
      if (row.every((v) => v === null)) continue;
      rows.push(row);
    }
    return { headers, rows };
  }
  return null;
}

class ExportError extends Error {}

function need(t: Table | null, sheetName: string, columns: string[]): Table {
  if (!t) throw new ExportError(`The "${sheetName}" sheet has no table. Use the file exactly as LinkedIn exports it.`);
  const missing = columns.filter((c) => !t.headers.includes(c));
  if (missing.length) {
    throw new ExportError(`The "${sheetName}" sheet is missing ${missing.map((m) => `"${m}"`).join(', ')}. LinkedIn may have changed its export; tell whoever looks after the site.`);
  }
  return t;
}

function readDaily(t: Table): DailyRow[] {
  const out: DailyRow[] = [];
  for (const row of t.rows) {
    const date = exportDate(row[0]);
    if (!date) continue;
    const values: Record<string, number> = {};
    t.headers.forEach((h, i) => {
      const n = i > 0 ? num(row[i]) : null;
      if (n !== null) values[h] = n;
    });
    out.push({ date, values });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function readBreakdowns(sheets: Sheet[], except: string): Breakdown[] {
  const out: Breakdown[] = [];
  for (const s of sheets) {
    if (s.name === except) continue;
    const t = table(s, s.name);
    if (!t || t.headers.length < 2) continue;
    const rows = t.rows
      .map((r) => ({ label: String(r[0] ?? '').trim(), value: num(r[1]) ?? 0 }))
      .filter((r) => r.label)
      .sort((a, b) => b.value - a.value);
    out.push({ name: s.name, rows });
  }
  return out;
}

const POST_COLUMNS = {
  title: 'Post title',
  link: 'Post link',
  type: 'Post type',
  created: 'Created date',
  impressions: 'Impressions',
  views: 'Views',
  clicks: 'Clicks',
  likes: 'Likes',
  comments: 'Comments',
  reposts: 'Reposts',
  follows: 'Follows',
  engagementRate: 'Engagement rate',
  contentType: 'Content Type'
};
const REQUIRED_POST_COLUMNS = ['link', 'type', 'created', 'impressions', 'clicks', 'likes', 'comments', 'reposts'] as const;

function readPosts(t: Table): LinkedInPost[] {
  const at = (row: unknown[], k: keyof typeof POST_COLUMNS) => {
    const i = t.headers.indexOf(POST_COLUMNS[k]);
    return i < 0 ? null : row[i];
  };
  const posts: LinkedInPost[] = [];
  for (const row of t.rows) {
    const type = String(at(row, 'type') ?? '').trim();
    // LinkedIn adds a "Total" row after a boosted post, summing its organic and sponsored rows.
    if (type !== 'Organic' && type !== 'Sponsored') continue;
    const link = String(at(row, 'link') ?? '').trim();
    const key = linkedInKey(link);
    const created = exportDate(at(row, 'created'));
    if (!key || !created) continue;
    const impressions = num(at(row, 'impressions')) ?? 0;
    const title = String(at(row, 'title') ?? '').replace(/\s+/g, ' ').trim();
    posts.push({
      key,
      link,
      title: title.length > 160 ? `${title.slice(0, 157)}…` : title,
      created,
      sponsored: type === 'Sponsored',
      contentType: String(at(row, 'contentType') ?? '').trim() || null,
      impressions,
      views: num(at(row, 'views')),
      clicks: num(at(row, 'clicks')) ?? 0,
      likes: num(at(row, 'likes')) ?? 0,
      comments: num(at(row, 'comments')) ?? 0,
      reposts: num(at(row, 'reposts')) ?? 0,
      follows: num(at(row, 'follows')),
      engagementRate: num(at(row, 'engagementRate'))
    });
  }
  return posts;
}

export function readLinkedInExport(bytes: Uint8Array, fileName = ''): LinkedInExport {
  let sheets: Sheet[];
  try {
    sheets = readSheets(bytes);
  } catch {
    throw new ExportError('This file could not be opened. Upload the file exactly as LinkedIn exported it (.xls).');
  }
  const kind = KIND_SHEETS.find(([, name]) => sheets.some((s) => s.name === name))?.[0];
  if (!kind) throw new ExportError('This is not a LinkedIn page analytics export (content, followers or visitors).');
  const sheet = (name: string) => sheets.find((s) => s.name === name) ?? null;
  const page = pageFromFileName(fileName);

  let posts: LinkedInPost[] = [];
  let daily: DailyRow[] = [];
  let breakdowns: Breakdown[] = [];
  if (kind === 'content') {
    const all = need(table(sheet('All posts')!, POST_COLUMNS.title) ?? table(sheet('All posts')!, POST_COLUMNS.link), 'All posts',
      REQUIRED_POST_COLUMNS.map((k) => POST_COLUMNS[k]));
    posts = readPosts(all);
    const metrics = sheet('Metrics');
    if (metrics) daily = readDaily(need(table(metrics, 'Date'), 'Metrics', ['Date']));
  } else {
    const name = kind === 'followers' ? 'New followers' : 'Visitor metrics';
    daily = readDaily(need(table(sheet(name)!, 'Date'), name, ['Date']));
    breakdowns = readBreakdowns(sheets, name);
  }

  const dates = [...daily.map((d) => d.date), ...posts.map((p) => p.created)].sort();
  if (!dates.length) throw new ExportError('This export has no data in it. Check the date range you picked on LinkedIn.');
  return { kind, page, from: dates[0], to: dates.at(-1)!, posts, daily, breakdowns };
}

export function isExportError(e: unknown): e is Error {
  return e instanceof ExportError;
}
