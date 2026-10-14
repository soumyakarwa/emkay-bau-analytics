import { BRANDS, brandById } from '$lib/brands';
import { calendarView, isMonth, monthGrid, type View } from '$lib/calendar/calendar';
import { loadDataset } from '$lib/dataset/dataset';
import { getStore } from '$lib/server/data';
import type { PageServerLoad } from './$types';

/** Today in India, where the team works: YYYY-MM-DD. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export const load: PageServerLoad = async ({ url }) => {
  const ds = await loadDataset(getStore());
  const brand = url.searchParams.get('brand');
  const view: View = brand && brandById(brand) ? (brand as View) : 'all';
  const monthParam = url.searchParams.get('month');
  const now = today();
  const month = isMonth(monthParam) ? monthParam : now.slice(0, 7);
  const showDropped = url.searchParams.get('dropped') === '1';
  return {
    today: now,
    published: ds.brandYears.length > 0,
    brands: BRANDS.map((b) => ({ ...b, published: ds.brandYears.some((y) => y.brand === b.id) })),
    weeks: monthGrid(month),
    showDropped,
    cal: calendarView(ds, view, month, showDropped)
  };
};
