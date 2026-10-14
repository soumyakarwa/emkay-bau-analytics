// LinkedIn figures laid over the BAU framework. Posts are matched to the calendar by the post ID
// in their link, then compared month by month using medians (one viral post cannot swing a
// median the way it swings an average).
//
// Kept out of the comparisons, but always listed:
//   - sponsored (boosted) posts, which would swamp organic figures;
//   - posts under SETTLE_DAYS days old on the export day, which are still collecting engagement.
//
// The default measure is the interaction rate (reactions, comments and reposts per impression).
// LinkedIn's own engagement rate also counts clicks, and on document (carousel) posts every page
// swipe is a click: their engagement rate runs at 70-120% against 3-12% for other formats, so
// comparing pegs by it would mostly compare formats.

import { BRANDS, type BrandId } from '../brands';
import { shiftMonth } from '../calendar/calendar';
import type { Dataset, DatasetPost } from '../dataset/dataset';
import { DROPPED, PUBLISHED, normalise } from '../workbook/contract';
import { linkedInKey, type LinkedInPost } from './linkedin';
import type { AnalyticsUpload } from './uploads';

export const SETTLE_DAYS = 7;

export type Metric = 'interactionRate' | 'engagementRate' | 'impressions' | 'clicks';
export const METRICS: { id: Metric; label: string; percent: boolean; help: string }[] = [
  { id: 'interactionRate', label: 'Interaction rate', percent: true, help: 'Reactions, comments and reposts, per impression. Fair across formats.' },
  { id: 'engagementRate', label: "LinkedIn's engagement rate", percent: true, help: 'Also counts clicks, so carousels (every page swipe is a click) score far higher than other formats.' },
  { id: 'impressions', label: 'Impressions', percent: false, help: 'How many times the post was shown.' },
  { id: 'clicks', label: 'Clicks', percent: false, help: 'Includes page swipes on carousels.' }
];

export type GroupBy = 'commsTask' | 'pillar' | 'peg' | 'format';
export const GROUPINGS: { id: GroupBy; label: string }[] = [
  { id: 'commsTask', label: 'Comms task' },
  { id: 'pillar', label: 'Pillar' },
  { id: 'peg', label: 'Peg' },
  { id: 'format', label: 'Format' }
];

/** Where a LinkedIn post stands against the BAU framework. */
export type Group = 'bau' | 'not-bau' | 'outside' | 'before-bau';
export const GROUP_LABELS: Record<Group, string> = {
  bau: 'BAU',
  'not-bau': 'In the calendar, not BAU',
  outside: 'Outside BAU',
  'before-bau': 'Before BAU started'
};

export interface CalendarRef {
  key: string;
  title: string | null;
  date: string;
  sheet: string;
  row: number;
}

export interface AnalysedPost extends LinkedInPost {
  brand: BrandId;
  /** The export day these figures are from. */
  asOf: string;
  ageDays: number;
  /** Old enough on the export day to be compared (see SETTLE_DAYS). */
  settled: boolean;
  /** (Reactions + comments + reposts) / impressions. */
  interactionRate: number | null;
  /** YYYY-MM: the calendar's month when matched, else the month LinkedIn gives. */
  month: string;
  group: Group;
  calendar: (CalendarRef & {
    peg: string | null;
    pillar: string | null;
    commsTask: string | null;
    commsTaskName: string | null;
    format: string | null;
    beforeBauStart: boolean;
  }) | null;
  /** For posts not in the calendar: calendar posts with no LinkedIn link from the same days, which this may be. */
  maybe: CalendarRef[];
}

export interface LinkFix {
  brand: BrandId;
  post: CalendarRef;
  problem: 'not-linkedin' | 'not-found' | 'missing';
  message: string;
  /** LinkedIn posts from the same days that are not matched to anything yet. */
  candidates: { link: string; title: string; created: string }[];
}

export interface LinkedInAnalysis {
  asOf: string | null;
  posts: AnalysedPost[];
  fixes: LinkFix[];
}

const DAY = 86400000;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const ref = (p: DatasetPost): CalendarRef => ({ key: p.key, title: p.title, date: p.date, sheet: p.source.sheet, row: p.source.row });
const isDropped = (p: DatasetPost) => !!p.status && normalise(p.status) === normalise(DROPPED);

/** The newest figures for every post across all content uploads (later exports win). */
export function latestPosts(uploads: AnalyticsUpload[]): Map<string, { post: LinkedInPost; asOf: string; brand: BrandId }> {
  const out = new Map<string, { post: LinkedInPost; asOf: string; brand: BrandId }>();
  const ordered = uploads.filter((u) => u.kind === 'content').sort((a, b) => a.to.localeCompare(b.to) || a.uploadedAt.localeCompare(b.uploadedAt));
  for (const u of ordered) {
    for (const p of u.data.posts) out.set(`${u.brand}|${p.key}|${p.sponsored ? 's' : 'o'}`, { post: p, asOf: u.to, brand: u.brand });
  }
  return out;
}

export function analyseLinkedIn(ds: Dataset, uploads: AnalyticsUpload[]): LinkedInAnalysis {
  const latest = latestPosts(uploads);
  const asOf = [...latest.values()].map((x) => x.asOf).sort().at(-1) ?? null;
  const covered = new Map<BrandId, { from: string; to: string }>();
  for (const u of uploads.filter((x) => x.kind === 'content')) {
    const c = covered.get(u.brand);
    covered.set(u.brand, { from: c && c.from < u.from ? c.from : u.from, to: c && c.to > u.to ? c.to : u.to });
  }

  // Calendar posts by the LinkedIn post ID in their LinkedIn column.
  const taskName = new Map<string, string>();
  for (const y of ds.brandYears) for (const t of y.commsTasks) taskName.set(`${y.brand}|${normalise(t.code)}`, t.name);
  const byKey = new Map<string, DatasetPost>();
  const fixes: LinkFix[] = [];
  const withoutLink: DatasetPost[] = [];
  for (const p of ds.posts) {
    if (isDropped(p)) continue;
    const entry = p.platforms.find((x) => x.platform === 'LinkedIn');
    if (!entry) continue;
    if (entry.url) {
      const key = linkedInKey(entry.url);
      if (key) byKey.set(`${p.brand}|${key}`, p);
      else if (covered.has(p.brand)) {
        fixes.push({ brand: p.brand, post: ref(p), problem: 'not-linkedin', candidates: [],
          message: `The LinkedIn column has a link that is not a LinkedIn post: ${entry.url}` });
        withoutLink.push(p);
      }
    } else if (p.status && normalise(p.status) === normalise(PUBLISHED)) {
      withoutLink.push(p);
    }
  }

  const bauStart = new Map<BrandId, string>();
  for (const y of ds.brandYears) {
    const s = bauStart.get(y.brand);
    if (y.bauStart && (!s || y.bauStart < s)) bauStart.set(y.brand, y.bauStart);
  }

  const posts: AnalysedPost[] = [];
  for (const { post, asOf: postAsOf, brand } of latest.values()) {
    const c = byKey.get(`${brand}|${post.key}`);
    const month = c ? c.month : post.created.slice(0, 7);
    const start = bauStart.get(brand);
    const ageDays = days(post.created, postAsOf);
    const calendar = c
      ? { ...ref(c), peg: c.peg, pillar: c.pillar, commsTask: c.commsTask, format: c.format, beforeBauStart: c.beforeBauStart,
          commsTaskName: c.commsTask ? taskName.get(`${brand}|${normalise(c.commsTask)}`) ?? c.commsTask : null }
      : null;
    posts.push({
      ...post,
      brand,
      asOf: postAsOf,
      ageDays,
      settled: ageDays >= SETTLE_DAYS,
      interactionRate: post.impressions > 0 ? (post.likes + post.comments + post.reposts) / post.impressions : null,
      month,
      group: (c ? c.beforeBauStart : !!start && month < start) ? 'before-bau'
        : !c ? 'outside' : c.peg && c.countsAsBau ? 'bau' : 'not-bau',
      calendar,
      maybe: []
    });
  }
  posts.sort((a, b) => b.created.localeCompare(a.created) || a.brand.localeCompare(b.brand));

  // Published calendar posts with no usable LinkedIn link: suggest unmatched LinkedIn posts from the
  // same days (LinkedIn's dates are UTC, so a post can show a day earlier than in India).
  for (const p of withoutLink) {
    const range = covered.get(p.brand);
    if (!range || p.date < range.from || p.date > range.to) continue;
    const near = posts.filter((x) => x.brand === p.brand && !x.calendar && !x.sponsored && Math.abs(days(x.created, p.date)) <= 1);
    for (const x of near) x.maybe.push(ref(p));
    const existing = fixes.find((f) => f.post.key === p.key);
    const candidates = near.map((x) => ({ link: x.link, title: x.title, created: x.created }));
    if (existing) existing.candidates = candidates;
    else fixes.push({ brand: p.brand, post: ref(p), problem: 'missing', candidates,
      message: 'This post is Published but has no LinkedIn link, so its figures cannot be matched.' });
  }

  // Calendar links that LinkedIn's export does not have, although the export covers that day.
  const exported = new Set(posts.map((x) => `${x.brand}|${x.key}`));
  for (const [k, p] of byKey) {
    const range = covered.get(p.brand);
    if (!range || exported.has(k) || p.date < range.from || days(p.date, range.to) < 1) continue;
    fixes.push({ brand: p.brand, post: ref(p), problem: 'not-found', candidates: [],
      message: "This link is not in LinkedIn's export. Check it is the brand page's own post, not someone's share or repost of it." });
  }
  fixes.sort((a, b) => b.post.date.localeCompare(a.post.date));
  return { asOf, posts, fixes };
}

/** Median of the numbers, or null for none. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface Figure {
  median: number | null;
  /** Posts behind the figure. */
  n: number;
}

export interface TableRow {
  label: string;
  /** Where the row sits in the framework (e.g. "Thought leadership · Fact-led opinions"). */
  context: string | null;
  kind: 'framework' | 'total';
  byMonth: Record<string, Figure>;
  all: Figure;
}

export interface MonthlyTable {
  months: string[];
  rows: TableRow[];
}

/** Posts that go into the comparisons: organic, settled, with a figure for the metric. */
export function comparable(posts: AnalysedPost[], metric: Metric): AnalysedPost[] {
  return posts.filter((p) => !p.sponsored && p.settled && p[metric] !== null);
}

function figures(posts: AnalysedPost[], months: string[], metric: Metric): Pick<TableRow, 'byMonth' | 'all'> {
  const value = (p: AnalysedPost) => p[metric] as number;
  const inRange = posts.filter((p) => months.includes(p.month));
  const byMonth: Record<string, Figure> = {};
  for (const m of months) {
    const list = inRange.filter((p) => p.month === m).map(value);
    byMonth[m] = { median: median(list), n: list.length };
  }
  return { byMonth, all: { median: median(inRange.map(value)), n: inRange.length } };
}

/** The months to show: from three months before the BAU start (a baseline) to the latest month with posts. */
export function monthsToShow(posts: AnalysedPost[], bauStart: string | null): string[] {
  const all = [...new Set(posts.map((p) => p.month))].sort();
  if (!all.length) return [];
  const last = all.at(-1)!;
  const first = bauStart ? shiftMonth(bauStart, -3) : shiftMonth(last, -5);
  const out: string[] = [];
  for (let m = first > all[0] ? first : all[0]; m <= last; m = shiftMonth(m, 1)) out.push(m);
  return out.slice(-15);
}

/** One brand's month-by-month table: its framework rows, then totals. */
export function brandTable(ds: Dataset, analysis: LinkedInAnalysis, brand: BrandId, by: GroupBy, metric: Metric): MonthlyTable {
  const posts = comparable(analysis.posts.filter((p) => p.brand === brand), metric);
  const years = ds.brandYears.filter((y) => y.brand === brand);
  const bauStart = years.map((y) => y.bauStart).filter((s): s is string => !!s).sort()[0] ?? null;
  const months = monthsToShow(posts, bauStart);
  const bau = posts.filter((p) => p.group === 'bau');

  // Framework rows in the workbook's order: BAU comms tasks, their pillars, their pegs.
  const rows: TableRow[] = [];
  const seen = new Set<string>();
  if (by === 'format') {
    const formats = [...new Set(bau.map((p) => p.calendar?.format ?? 'No format given'))].sort();
    for (const f of formats) {
      rows.push({ label: f, context: null, kind: 'framework', ...figures(bau.filter((p) => (p.calendar?.format ?? 'No format given') === f), months, metric) });
    }
  }
  for (const y of by === 'format' ? [] : years) {
    for (const t of y.commsTasks.filter((t) => t.countsAsBau)) {
      const pegs = y.framework.filter((f) => normalise(f.commsTask) === normalise(t.code));
      const add = (label: string, context: string | null, match: (p: AnalysedPost) => boolean) => {
        const id = `${context}|${label}`;
        if (seen.has(id)) return;
        seen.add(id);
        const mine = bau.filter(match);
        // Retired pegs (and pillars) only appear while they still have posts in view.
        const retired = by !== 'commsTask' && !pegs.some((f) => f.active && (by === 'peg' ? f.peg === label : f.pillar === label));
        if (retired && !mine.some((p) => months.includes(p.month))) return;
        rows.push({ label, context, kind: 'framework', ...figures(mine, months, metric) });
      };
      if (by === 'commsTask') add(t.name, null, (p) => normalise(p.calendar?.commsTask ?? '') === normalise(t.code));
      else if (by === 'pillar') {
        for (const pillar of [...new Set(pegs.map((f) => f.pillar))]) {
          add(pillar, t.name, (p) => normalise(p.calendar?.commsTask ?? '') === normalise(t.code) && p.calendar?.pillar === pillar);
        }
      } else {
        for (const f of pegs) add(f.peg, `${t.name} · ${f.pillar}`, (p) => p.calendar?.peg === f.peg && p.calendar?.pillar === f.pillar);
      }
    }
  }

  const total = (label: string, list: AnalysedPost[]): TableRow => ({ label, context: null, kind: 'total', ...figures(list, months, metric) });
  rows.push(
    total('All BAU posts', bau),
    total(GROUP_LABELS['not-bau'], posts.filter((p) => p.group === 'not-bau')),
    total(GROUP_LABELS.outside, posts.filter((p) => p.group === 'outside')),
    total(GROUP_LABELS['before-bau'], posts.filter((p) => p.group === 'before-bau')),
    total('All organic posts', posts)
  );
  // Leave out total rows with nothing in view (e.g. no non-BAU calendar posts yet).
  return { months, rows: rows.filter((r) => r.kind === 'framework' || r.all.n > 0 || r.label === 'All BAU posts') };
}

/** All of Emkay: each brand's overall figures side by side. Frameworks are never mixed across brands. */
export function emkayTable(ds: Dataset, analysis: LinkedInAnalysis, metric: Metric): MonthlyTable {
  const posts = comparable(analysis.posts, metric);
  const starts = ds.brandYears.map((y) => y.bauStart).filter((s): s is string => !!s).sort();
  const months = monthsToShow(posts, starts[0] ?? null);
  const rows: TableRow[] = [];
  for (const b of BRANDS) {
    const mine = posts.filter((p) => p.brand === b.id);
    if (!mine.length) continue;
    rows.push({ label: b.name, context: 'All BAU posts', kind: 'framework', ...figures(mine.filter((p) => p.group === 'bau'), months, metric) });
    rows.push({ label: b.name, context: 'All organic posts', kind: 'total', ...figures(mine, months, metric) });
  }
  return { months, rows };
}

export interface AccountMonth {
  month: string;
  /** False for the latest month while it is still running. */
  complete: boolean;
  newFollowers: number | null;
  pageViews: number | null;
  impressions: number | null;
}

/** Account-level totals per month, from the daily figures of the newest export of each kind. */
export function accountMonths(uploads: AnalyticsUpload[], brand: BrandId, months: string[]): AccountMonth[] {
  const daily = (kind: AnalyticsUpload['kind'], column: string) => {
    const byDate = new Map<string, number>();
    const ordered = uploads.filter((u) => u.brand === brand && u.kind === kind).sort((a, b) => a.to.localeCompare(b.to));
    for (const u of ordered) for (const d of u.data.daily) if (column in d.values) byDate.set(d.date, d.values[column]);
    return byDate;
  };
  const sources = {
    newFollowers: daily('followers', 'Total followers'),
    pageViews: daily('visitors', 'Total page views (total)'),
    impressions: daily('content', 'Impressions (organic)')
  };
  const lastDay = [...Object.values(sources)].flatMap((m) => [...m.keys()]).sort().at(-1) ?? '';
  const sum = (m: Map<string, number>, month: string) => {
    const list = [...m.entries()].filter(([d]) => d.startsWith(month));
    return list.length ? list.reduce((a, [, v]) => a + v, 0) : null;
  };
  return months.map((month) => {
    const end = shiftMonth(month, 1);
    return {
      month,
      complete: days(lastDay, `${end}-01`) <= 1,
      newFollowers: sum(sources.newFollowers, month),
      pageViews: sum(sources.pageViews, month),
      impressions: sum(sources.impressions, month)
    };
  });
}
