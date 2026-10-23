import { brandById, type BrandId } from '$lib/brands';
import { listFollowerCounts } from '$lib/analytics/followers';
import { coverage, isDue, listAnalyticsUploads } from '$lib/analytics/uploads';
import { today } from '$lib/server/today';
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
  const analytics = await listAnalyticsUploads(store, brand ? { brand } : {});
  const latest = new Map<string, string>();
  for (const u of [...history].reverse()) latest.set(`${u.brand}|${u.fy}`, u.id);
  return {
    brand,
    section: url.searchParams.get('section') === 'analytics' ? ('analytics' as const) : ('calendar' as const),
    team,
    history: history.slice(0, 30).map((u) => ({ ...u, live: latest.get(`${u.brand}|${u.fy}`) === u.id })),
    analyticsHistory: analytics.slice().reverse().slice(0, 30),
    coverage: brand
      ? coverage(analytics, brand).map((p) => ({ ...p, files: p.files.map((f) => ({ ...f, due: isDue(f, today()) })) }))
      : null,
    followerCounts: brand ? await listFollowerCounts(store, brand) : [],
    today: today()
  };
};
