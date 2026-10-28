import { audienceInput } from '$lib/analytics/insights/inputs';
import { loadBrandModel } from '$lib/server/analytics';
import { brandParam } from '$lib/server/analytics-page';
import { today } from '$lib/server/today';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const brand = brandParam(url);
  if (!brand) return { brand: null, input: null };
  const { model } = await loadBrandModel(brand);
  return { brand, input: audienceInput(model, today()) };
};
