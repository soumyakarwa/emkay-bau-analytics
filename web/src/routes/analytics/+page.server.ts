import { analyseLinkedIn } from '$lib/analytics/analysis';
import { audienceInput, frameworkInput, growthInput, postsInput } from '$lib/analytics/insights/inputs';
import { monthDone } from '$lib/analytics/insights/view';
import { loadBrandModel } from '$lib/server/analytics';
import { brandParam } from '$lib/server/analytics-page';
import { today } from '$lib/server/today';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const brand = brandParam(url);
  if (!brand) return { brand: null, input: null, fixes: [] };
  const { model, counts, ds, tables } = await loadBrandModel(brand);
  const t = today();
  const fw = frameworkInput(model, t);
  const posts = postsInput(model, t);
  // The overview only lists posts from the cycle under review and the one before (posts that were
  // still settling at the last review); growth and audience need no post lists.
  const months = posts.months;
  const last = months.at(-1);
  const month = last && !monthDone(last, posts.asOf) && months.length > 1 ? months.at(-2) : last;
  const growth = { ...growthInput(model, counts, t), posts: [] };
  const audience = { ...audienceInput(model, t), posts: [] };
  const fixes = analyseLinkedIn(ds, tables).fixes.filter((f) => f.brand === brand);
  return { brand, input: { fw, posts: { ...posts, posts: posts.posts.filter((p) => p.month === month || (month && p.month === months[months.indexOf(month) - 1])) }, growth, audience }, fixes };
};
