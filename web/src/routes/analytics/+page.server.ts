import { brandById, type BrandId } from '$lib/brands';
import {
  GROUPINGS, METRICS, accountMonths, analyseLinkedIn, brandTable, emkayTable,
  type GroupBy, type Metric
} from '$lib/analytics/analysis';
import { loadAnalyticsUploads } from '$lib/analytics/uploads';
import { isMonth } from '$lib/calendar/calendar';
import { loadDataset } from '$lib/dataset/dataset';
import { getStore } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const store = getStore();
  const [ds, uploads] = await Promise.all([loadDataset(store), loadAnalyticsUploads(store)]);
  const brand = (brandById(url.searchParams.get('brand') ?? '')?.id ?? null) as BrandId | null;
  const by = (GROUPINGS.find((g) => g.id === url.searchParams.get('by'))?.id ?? 'commsTask') as GroupBy;
  const metric = (METRICS.find((m) => m.id === url.searchParams.get('metric'))?.id ?? 'interactionRate') as Metric;

  const mine = brand ? uploads.filter((u) => u.brand === brand) : uploads;
  const analysis = analyseLinkedIn(ds, mine);
  const table = brand ? brandTable(ds, analysis, brand, by, metric) : emkayTable(ds, analysis, metric);
  const monthParam = url.searchParams.get('month');
  const month = isMonth(monthParam) && table.months.includes(monthParam) ? monthParam : (table.months.at(-1) ?? null);

  return {
    brand,
    by,
    metric,
    month,
    hasContent: mine.some((u) => u.kind === 'content'),
    hasCalendar: ds.brandYears.some((y) => !brand || y.brand === brand),
    asOf: analysis.asOf,
    table,
    account: brand ? accountMonths(mine, brand, table.months) : [],
    fixes: analysis.fixes,
    posts: month ? analysis.posts.filter((p) => p.month === month) : []
  };
};
