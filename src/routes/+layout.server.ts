import { getPublished } from '$lib/server/calendar';

export async function load({ locals }) {
  // The login page shares this layout: send nothing about the data before sign-in.
  if (!locals.role) return { role: null, authEnabled: locals.authEnabled, isSample: false };
  const dataset = await getPublished();
  return { role: locals.role, authEnabled: locals.authEnabled, isSample: dataset.source.kind === 'sample' };
}
