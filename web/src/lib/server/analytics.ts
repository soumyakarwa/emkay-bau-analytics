// Loads one brand's analytics model: its calendar, its uploads and its noted follower counts.

import type { BrandId } from '../brands';
import { listFollowerCounts } from '../analytics/followers';
import { buildModel } from '../analytics/insights/model';
import { buildTables } from '../analytics/tables';
import { loadAnalyticsUploads } from '../analytics/uploads';
import { loadDataset } from '../dataset/dataset';
import { getStore } from './data';

export async function loadBrandModel(brand: BrandId) {
  const store = getStore();
  const [ds, uploads, counts] = await Promise.all([loadDataset(store), loadAnalyticsUploads(store, { brand }), listFollowerCounts(store, brand)]);
  const tables = buildTables(uploads);
  return { ds, uploads, counts, tables, model: buildModel(ds, tables, brand) };
}
