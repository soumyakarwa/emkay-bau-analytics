// Saves a follower total read off one of a brand's profiles (the exports only give gains and
// losses). Needs the brand's upload rights, like any upload.

import { error, json } from '@sveltejs/kit';
import { brandById, type BrandId } from '$lib/brands';
import { PLATFORMS } from '$lib/analytics/catalog';
import { parseCount, saveFollowerCount } from '$lib/analytics/followers';
import type { Platform } from '$lib/analytics/rows';
import { getStore } from '$lib/server/data';
import { today } from '$lib/server/today';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const form = await request.formData();
  const brand = String(form.get('brand') ?? '');
  const platform = String(form.get('platform') ?? '');
  const date = String(form.get('date') || today());
  const parsed = parseCount(String(form.get('count') ?? ''));
  if (!brandById(brand)) error(400, 'Pick the brand first.');
  if (!locals.access?.uploadBrands.includes(brand as BrandId)) {
    error(403, `Your sign-in cannot update ${brandById(brand)!.name}. Sign in with its upload password first.`);
  }
  if (!PLATFORMS.some((p) => p.id === platform)) error(400, 'Unknown platform.');
  if (!parsed) error(400, 'Type the count as on the profile, for example 3,735 or 1.6k.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) error(400, 'The date must be today or earlier.');
  const saved = await saveFollowerCount(getStore(), {
    brand: brand as BrandId,
    platform: platform as Platform,
    date,
    count: parsed.count,
    approximate: parsed.approximate,
    enteredBy: String(form.get('enteredBy') ?? '').trim() || null
  });
  return json(saved);
};
