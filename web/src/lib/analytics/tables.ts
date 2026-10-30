// The analytics tables, built by combining every upload's cleaned rows, for every platform.
// Nothing here is saved: the tables are rebuilt from the uploads whenever they are needed, so
// they always follow the uploads and the current rules.
//
//   posts      every snapshot of every post: one row per post (per campaign, if sponsored) per
//              export, tagged with the export's period. latestPosts() gives each post's figures:
//              the newest snapshot where figures are lifetime totals (LinkedIn, Instagram, X), or
//              the calendar months added up where they cover only the period (YouTube; exports
//              over other periods are kept but not counted).
//   daily      per brand, platform, file and day, one set of figures: for each figure, the newest
//              export that has it for that day wins, and older exports still supply days (and
//              figures) newer ones no longer cover.
//   audience   every breakdown from every export, tagged with its day or period.
//   benchmark  every competitor export: the brand and its peers over each period.
//   totals     the account's totals over each exported period (followers gained, reach, ...).

import type { BrandId } from '../brands';
import type { AudienceRow, BenchmarkRow, Measures, Platform, PostRow } from './rows';
import { isWholeCycle } from './cycle';
import { isWholeMonth, type AnalyticsUpload } from './uploads';

/** A period that adds up with others: one cycle (25th–24th) or, from older exports, one calendar month. */
export const isWholePeriod = (from: string, to: string) => isWholeCycle(from, to) || isWholeMonth(from, to);

/**
 * Periods that add up without counting a day twice: whole cycles first, then whole calendar
 * months (older exports) that don't overlap them.
 */
export function addablePeriods<T extends { from: string; to: string }>(periods: T[]): T[] {
  const ranked = [...periods.filter((p) => isWholeCycle(p.from, p.to)), ...periods.filter((p) => !isWholeCycle(p.from, p.to) && isWholeMonth(p.from, p.to))];
  const out: T[] = [];
  for (const p of ranked) if (!out.some((q) => p.from <= q.to && q.from <= p.to)) out.push(p);
  return out;
}

export interface PostSnapshot extends PostRow {
  brand: BrandId;
  platform: Platform;
  /** The period the export covers; for lifetime figures, `asOf` (= `to`) is what matters. */
  from: string;
  to: string;
  /** The day these figures are as of. */
  asOf: string;
  figures: 'lifetime' | 'period';
  uploadId: string;
}

export interface DailyFigures {
  values: Record<string, number | null>;
  /** The export the figures come from. */
  asOf: string;
}

export interface AudienceSnapshot extends AudienceRow {
  brand: BrandId;
  platform: Platform;
  of: 'followers' | 'visitors' | 'views';
  /** Followers: who follows on `to`. Visitors and views: over `from` to `to`. */
  from: string;
  to: string;
}

export interface BenchmarkSnapshot extends BenchmarkRow {
  brand: BrandId;
  platform: Platform;
  from: string;
  to: string;
}

export interface TotalsSnapshot {
  brand: BrandId;
  platform: Platform;
  file: string;
  from: string;
  to: string;
  values: Record<string, number | null>;
}

export interface Tables {
  posts: PostSnapshot[];
  /** brand → "<platform>/<file>" → day → figures */
  daily: Map<BrandId, Map<string, Map<string, DailyFigures>>>;
  audience: AudienceSnapshot[];
  benchmark: BenchmarkSnapshot[];
  totals: TotalsSnapshot[];
}

/** Oldest export first; for the same day, the one uploaded later counts as newer. */
const byAge = (a: AnalyticsUpload, b: AnalyticsUpload) => a.to.localeCompare(b.to) || a.uploadedAt.localeCompare(b.uploadedAt);

export function buildTables(uploads: AnalyticsUpload[]): Tables {
  const ordered = [...uploads].sort(byAge);
  const tables: Tables = { posts: [], daily: new Map(), audience: [], benchmark: [], totals: [] };
  // Re-exports of the same period replace the earlier one (later uploads come later here).
  const audiences = new Map<string, AudienceSnapshot[]>();
  const benchmarks = new Map<string, BenchmarkSnapshot[]>();
  const totals = new Map<string, TotalsSnapshot>();

  for (const u of ordered) {
    const d = u.data;
    const tag = { brand: u.brand, platform: u.platform, from: u.from, to: u.to };
    for (const p of d.posts) tables.posts.push({ ...p, ...tag, asOf: u.to, figures: d.postFigures, uploadId: u.id });

    if (d.daily.length) {
      const brand = tables.daily.get(u.brand) ?? new Map<string, Map<string, DailyFigures>>();
      tables.daily.set(u.brand, brand);
      const key = `${u.platform}/${u.file}`;
      const days = brand.get(key) ?? new Map<string, DailyFigures>();
      brand.set(key, days);
      for (const row of d.daily) days.set(row.date, { values: { ...days.get(row.date)?.values, ...row.values }, asOf: u.to });
    }

    const period = `${u.brand}|${u.platform}|${u.file}|${u.from}|${u.to}`;
    if (d.audience) {
      const of = d.audience.of;
      audiences.set(period, d.audience.rows.map((r) => ({ ...r, ...tag, of })));
    }
    if (d.benchmark.length) benchmarks.set(period, d.benchmark.map((b) => ({ ...b, ...tag })));
    if (d.totals) totals.set(period, { ...tag, file: u.file, values: d.totals });
  }
  tables.audience = [...audiences.values()].flat();
  tables.benchmark = [...benchmarks.values()].flat();
  tables.totals = [...totals.values()];
  return tables;
}

/** What makes a post row unique: the platform, the post, and for sponsored rows the campaign. */
export const rowKey = (p: Pick<PostSnapshot, 'brand' | 'platform' | 'postId' | 'sponsored' | 'campaignId'>) =>
  `${p.brand}|${p.platform}|${p.postId}|${p.sponsored ? `s|${p.campaignId ?? ''}` : 'o'}`;

const MEASURES: (keyof Measures)[] = ['impressions', 'reach', 'views', 'clicks', 'reactions', 'comments', 'reposts', 'shares', 'saves', 'follows', 'watchHours'];

/** Period figures added up: a measure is null only when no period has it. */
function addUp(rows: PostSnapshot[]): PostSnapshot {
  const newest = rows.reduce((a, b) => (b.to > a.to ? b : a));
  const sum: PostSnapshot = { ...newest, from: rows.map((r) => r.from).sort()[0], engagementRate: null };
  for (const m of MEASURES) {
    const values = rows.map((r) => r[m]).filter((v): v is number => v !== null);
    sum[m] = values.length ? values.reduce((a, b) => a + b, 0) : null;
  }
  return sum;
}

/**
 * Each post's figures. Lifetime figures: the newest snapshot. Period figures: the calendar months
 * added up, each month's newest upload counting (a post with no whole month uploaded is left out).
 */
export function latestPosts(posts: PostSnapshot[]): PostSnapshot[] {
  const groups = new Map<string, PostSnapshot[]>();
  for (const p of posts) groups.set(rowKey(p), [...(groups.get(rowKey(p)) ?? []), p]);
  const out: PostSnapshot[] = [];
  for (const rows of groups.values()) {
    if (rows[0].figures === 'lifetime') {
      out.push(rows.reduce((a, b) => (b.asOf >= a.asOf ? b : a)));
      continue;
    }
    const byPeriod = new Map<string, PostSnapshot>();
    for (const r of rows) byPeriod.set(`${r.from}|${r.to}`, r); // later uploads come later
    const months = addablePeriods([...byPeriod.values()]);
    if (months.length) out.push(addUp(months));
  }
  return out;
}

/**
 * One post's organic figures over time, oldest first: a point per export for lifetime figures
 * (how the totals grew), a point per calendar month for period figures (what each month added).
 */
export function postHistory(posts: PostSnapshot[], brand: BrandId, postId: string, platform?: Platform): PostSnapshot[] {
  const byPoint = new Map<string, PostSnapshot>();
  for (const p of posts) {
    if (p.brand !== brand || p.postId !== postId || p.sponsored || (platform && p.platform !== platform)) continue;
    if (p.figures === 'period' && !isWholePeriod(p.from, p.to)) continue;
    byPoint.set(p.figures === 'period' ? p.from : p.asOf, p);
  }
  return [...byPoint.values()].sort((a, b) => a.to.localeCompare(b.to));
}

/** One daily figure for a brand, oldest day first. */
export function dailySeries(tables: Tables, brand: BrandId, platform: Platform, file: string, column: string): { date: string; value: number | null }[] {
  const days = tables.daily.get(brand)?.get(`${platform}/${file}`);
  if (!days) return [];
  return [...days.entries()].map(([date, f]) => ({ date, value: f.values[column] ?? null })).sort((a, b) => a.date.localeCompare(b.date));
}

/** A daily figure added up per month (YYYY-MM → total), counting only days that have it. */
export function monthlyTotals(tables: Tables, brand: BrandId, platform: Platform, file: string, column: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const { date, value } of dailySeries(tables, brand, platform, file, column)) {
    if (value === null) continue;
    out.set(date.slice(0, 7), (out.get(date.slice(0, 7)) ?? 0) + value);
  }
  return out;
}

/** The last day a brand's daily figures from a file reach, or null. */
export function lastDay(tables: Tables, brand: BrandId, platform: Platform, file: string): string | null {
  const days = tables.daily.get(brand)?.get(`${platform}/${file}`);
  return days ? [...days.keys()].sort().at(-1) ?? null : null;
}
