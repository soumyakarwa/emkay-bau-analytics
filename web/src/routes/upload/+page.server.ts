import { brandById, type BrandId } from '$lib/brands';
import { listAnalyticsUploads } from '$lib/analytics/uploads';
import { latestUploads, listUploads } from '$lib/dataset/uploads';
import { getStore } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const store = getStore();
  const brand = brandById(url.searchParams.get('brand') ?? '')?.id ?? null;
  const history = (await listUploads(store, brand ? { brand } : {})).reverse();
  // Names to suggest for "Uploaded by": each brand's team list from its latest workbook.
  const team: Partial<Record<BrandId, string[]>> = {};
  for (const u of await latestUploads(store)) team[u.brand] = [...new Set([...(team[u.brand] ?? []), ...u.workbook.lists.team])];
  const latest = new Map<string, string>();
  for (const u of [...history].reverse()) latest.set(`${u.brand}|${u.fy}`, u.id);
  return {
    brand,
    team,
    history: history.slice(0, 30).map((u) => ({ ...u, live: latest.get(`${u.brand}|${u.fy}`) === u.id })),
    analyticsHistory: (await listAnalyticsUploads(store, brand ? { brand } : {})).reverse().slice(0, 30)
  };
};
