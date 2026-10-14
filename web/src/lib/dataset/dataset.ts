// All of Emkay: the latest upload of every brand and financial year, combined. Each brand
// keeps its own framework; nothing is matched or added up across brands' frameworks. The only
// cross-brand figures are plain post counts (by month and platform).

import { BRANDS, type BrandId } from '../brands';
import { DROPPED, PLATFORMS, normalise, type Platform } from '../workbook/contract';
import { summarise, type Summary } from '../workbook/summary';
import type { CommsTask, Moment, Peg, Post } from '../workbook/types';
import type { Store } from './store';
import { latestUploads, type Upload } from './uploads';

export interface BrandYear {
  brand: BrandId;
  fy: number;
  uploadId: string;
  uploadedAt: string;
  fileName: string;
  bauStart: string | null;
  commsTasks: CommsTask[];
  framework: Peg[];
  /** This brand's BAU mix, measured against its own framework and targets. */
  summary: Summary;
}

export interface DatasetPost extends Post {
  brand: BrandId;
  fy: number;
  /** Unique across the dataset: "<brand>:<fy>:<sheet>!<row>". */
  key: string;
}

export interface DatasetMoment extends Moment {
  brand: BrandId;
  fy: number;
}

export interface Dataset {
  brandYears: BrandYear[];
  /** Every post, sorted by date then brand. */
  posts: DatasetPost[];
  moments: DatasetMoment[];
}

export async function loadDataset(store: Store): Promise<Dataset> {
  return buildDataset(await latestUploads(store));
}

export function buildDataset(uploads: Upload[]): Dataset {
  const order = (b: BrandId) => BRANDS.findIndex((x) => x.id === b);
  const sorted = [...uploads].sort((a, b) => order(a.brand) - order(b.brand) || a.fy - b.fy);
  const brandYears: BrandYear[] = sorted.map((u) => ({
    brand: u.brand,
    fy: u.fy,
    uploadId: u.id,
    uploadedAt: u.uploadedAt,
    fileName: u.fileName,
    bauStart: u.workbook.bauStart,
    commsTasks: u.workbook.commsTasks,
    framework: u.workbook.framework,
    summary: summarise(u.workbook)
  }));
  const posts = sorted
    .flatMap((u) => u.workbook.posts.map((p) => ({ ...p, brand: u.brand, fy: u.fy, key: `${u.brand}:${u.fy}:${p.id}` })))
    .sort((a, b) => a.date.localeCompare(b.date) || order(a.brand) - order(b.brand));
  const moments = sorted
    .flatMap((u) => u.workbook.moments.map((m) => ({ ...m, brand: u.brand, fy: u.fy })))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { brandYears, posts, moments };
}

export interface PostFilter {
  brand?: BrandId;
  fy?: number;
  /** YYYY-MM */
  month?: string;
}

export function filterPosts(ds: Dataset, f: PostFilter = {}): DatasetPost[] {
  return ds.posts.filter((p) => (!f.brand || p.brand === f.brand) && (!f.fy || p.fy === f.fy) && (!f.month || p.month === f.month));
}

export interface EmkayTotals {
  months: string[];
  /** Posts per brand per month (every post except Dropped: BAU, compliance and pre-BAU alike). */
  byBrand: { brand: BrandId; byMonth: Record<string, number>; total: number }[];
  /** Per brand and platform: posts live with a link, and posts still planned. */
  byPlatform: { brand: BrandId; platform: Platform; published: number; planned: number }[];
}

export function emkayTotals(ds: Dataset, fy?: number): EmkayTotals {
  const posts = ds.posts.filter((p) => (!fy || p.fy === fy) && !(p.status && normalise(p.status) === normalise(DROPPED)));
  const months = [...new Set(posts.map((p) => p.month))].sort();
  const brands = BRANDS.map((b) => b.id).filter((id) => ds.brandYears.some((y) => y.brand === id && (!fy || y.fy === fy)));
  const byBrand = brands.map((brand) => {
    const byMonth = Object.fromEntries(months.map((m) => [m, 0])) as Record<string, number>;
    for (const p of posts) if (p.brand === brand) byMonth[p.month]++;
    return { brand, byMonth, total: Object.values(byMonth).reduce((a, b) => a + b, 0) };
  });
  const byPlatform = brands.flatMap((brand) =>
    PLATFORMS.map((platform) => {
      const entries = posts.filter((p) => p.brand === brand).flatMap((p) => p.platforms.filter((x) => x.platform === platform));
      return { brand, platform, published: entries.filter((e) => e.state !== 'planned').length, planned: entries.filter((e) => e.state === 'planned').length };
    })
  );
  return { months, byBrand, byPlatform };
}
