import { getPublished } from '$lib/server/calendar';

export async function load() {
  const dataset = await getPublished();
  return { framework: dataset.framework, months: dataset.months, entries: dataset.entries };
}
