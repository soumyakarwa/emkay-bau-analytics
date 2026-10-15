// The four analytics tables, built by combining every upload's cleaned rows. Nothing here is
// saved: the tables are rebuilt from the uploads whenever they are needed, so they always follow
// the uploads and the current rules.
//
//   posts      every snapshot of every post: one row per post (per campaign, if sponsored) per
//              export, tagged with the export's "as of" day. latestPosts() keeps the newest of
//              each; postHistory() gives one post's figures over time.
//   daily      per brand, file and day, one set of figures: the newest export covering that day
//              wins, and older exports still supply days the newer ones no longer cover.
//   audience   every breakdown from every export, tagged with its day (followers) or period
//              (visitors), so the mix can be followed over time.
//   benchmark  every competitor export: the brand and its peers over each period.

import type { BrandId } from '../brands';
import type { AudienceRow, BenchmarkRow, LinkedInFile, PostRow } from './rows';
import type { AnalyticsUpload } from './uploads';

export interface PostSnapshot extends PostRow {
  brand: BrandId;
  platform: 'linkedin';
  /** The day of the export these figures are from. */
  asOf: string;
  uploadId: string;
}

export interface DailyFigures {
  values: Record<string, number | null>;
  /** The export the figures come from. */
  asOf: string;
}

export interface AudienceSnapshot extends AudienceRow {
  brand: BrandId;
  of: 'followers' | 'visitors';
  /** Followers: who follows on `to`. Visitors: who visited from `from` to `to`. */
  from: string;
  to: string;
}

export interface BenchmarkSnapshot extends BenchmarkRow {
  brand: BrandId;
  from: string;
  to: string;
}

export interface Tables {
  posts: PostSnapshot[];
  /** brand → file → day → figures */
  daily: Map<BrandId, Map<LinkedInFile, Map<string, DailyFigures>>>;
  audience: AudienceSnapshot[];
  benchmark: BenchmarkSnapshot[];
}

/** Oldest export first; for the same day, the one uploaded later counts as newer. */
const byAge = (a: AnalyticsUpload, b: AnalyticsUpload) => a.to.localeCompare(b.to) || a.uploadedAt.localeCompare(b.uploadedAt);

export function buildTables(uploads: AnalyticsUpload[]): Tables {
  const ordered = [...uploads].sort(byAge);
  const tables: Tables = { posts: [], daily: new Map(), audience: [], benchmark: [] };
  // Re-uploading an export for the same period replaces the earlier one in the benchmark.
  const benchmarks = new Map<string, BenchmarkSnapshot[]>();
  // Two uploads of exports from the same day: only the later one's audience counts.
  const audiences = new Map<string, AudienceSnapshot[]>();

  for (const u of ordered) {
    const d = u.data;
    for (const p of d.posts) tables.posts.push({ ...p, brand: u.brand, platform: 'linkedin', asOf: u.to, uploadId: u.id });

    if (d.daily.length) {
      const brand = tables.daily.get(u.brand) ?? new Map<LinkedInFile, Map<string, DailyFigures>>();
      tables.daily.set(u.brand, brand);
      const days = brand.get(u.file) ?? new Map<string, DailyFigures>();
      brand.set(u.file, days);
      for (const row of d.daily) days.set(row.date, { values: row.values, asOf: u.to });
    }

    if (d.audience) {
      const of = d.audience.of;
      audiences.set(`${u.brand}|${of}|${u.from}|${u.to}`, d.audience.rows.map((r) => ({ ...r, brand: u.brand, of, from: u.from, to: u.to })));
    }
    if (d.benchmark.length) {
      benchmarks.set(`${u.brand}|${u.from}|${u.to}`, d.benchmark.map((b) => ({ ...b, brand: u.brand, from: u.from, to: u.to })));
    }
  }
  tables.audience = [...audiences.values()].flat();
  tables.benchmark = [...benchmarks.values()].flat();
  return tables;
}

/** What makes a post row unique within an export: the post, and for sponsored rows the campaign. */
export const rowKey = (p: Pick<PostSnapshot, 'brand' | 'postId' | 'sponsored' | 'campaignId'>) =>
  `${p.brand}|${p.postId}|${p.sponsored ? `s|${p.campaignId ?? ''}` : 'o'}`;

/** The newest snapshot of every post (and of every campaign of boosted posts). */
export function latestPosts(posts: PostSnapshot[]): PostSnapshot[] {
  const out = new Map<string, PostSnapshot>();
  for (const p of posts) {
    const k = rowKey(p);
    const seen = out.get(k);
    if (!seen || p.asOf >= seen.asOf) out.set(k, p);
  }
  return [...out.values()];
}

/** One post's organic figures over time, one point per export, oldest first. */
export function postHistory(posts: PostSnapshot[], brand: BrandId, postId: string): PostSnapshot[] {
  const byDay = new Map<string, PostSnapshot>();
  for (const p of posts) if (p.brand === brand && p.postId === postId && !p.sponsored) byDay.set(p.asOf, p);
  return [...byDay.values()].sort((a, b) => a.asOf.localeCompare(b.asOf));
}

/** One daily figure for a brand, oldest day first. */
export function dailySeries(tables: Tables, brand: BrandId, file: LinkedInFile, column: string): { date: string; value: number | null }[] {
  const days = tables.daily.get(brand)?.get(file);
  if (!days) return [];
  return [...days.entries()].map(([date, f]) => ({ date, value: f.values[column] ?? null })).sort((a, b) => a.date.localeCompare(b.date));
}

/** A daily figure added up per month (YYYY-MM → total), counting only days that have it. */
export function monthlyTotals(tables: Tables, brand: BrandId, file: LinkedInFile, column: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const { date, value } of dailySeries(tables, brand, file, column)) {
    if (value === null) continue;
    out.set(date.slice(0, 7), (out.get(date.slice(0, 7)) ?? 0) + value);
  }
  return out;
}

/** The last day a brand's daily figures from a file reach, or null. */
export function lastDay(tables: Tables, brand: BrandId, file: LinkedInFile): string | null {
  const days = tables.daily.get(brand)?.get(file);
  return days ? [...days.keys()].sort().at(-1) ?? null : null;
}
