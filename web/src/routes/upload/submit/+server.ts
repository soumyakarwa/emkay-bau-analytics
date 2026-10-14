// Checks (mode=check) or publishes (mode=publish) one brand's workbook, sent from the upload page.
// Publishing re-sends the same file; its fingerprint must match the one that was checked, so what
// gets published is exactly what was previewed.

import { error, json } from '@sveltejs/kit';
import { brandById, type BrandId } from '$lib/brands';
import { publishFile, sha256 } from '$lib/dataset/uploads';
import { getStore } from '$lib/server/data';
import { today } from '$lib/server/today';
import { summarise } from '$lib/workbook/summary';
import type { RequestHandler } from './$types';

const MAX_BYTES = 10 * 1024 * 1024;

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const mode = form.get('mode');
  const brand = String(form.get('brand') ?? '');
  const file = form.get('file');
  const uploadedBy = String(form.get('uploadedBy') ?? '').trim() || null;
  if (mode !== 'check' && mode !== 'publish') error(400, 'Unknown mode.');
  if (!brandById(brand)) error(400, 'Pick the brand you are uploading for.');
  if (!(file instanceof File) || file.size === 0) error(400, 'Choose a workbook (.xlsx) to upload.');
  if (file.size > MAX_BYTES) error(400, 'That file is too large for a calendar workbook (over 10 MB).');
  if (!/\.xlsx$/i.test(file.name)) error(400, 'Choose an Excel workbook (.xlsx).');

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (mode === 'publish' && form.get('checkedHash') !== (await sha256(bytes))) {
    error(409, 'This file changed since it was checked. Check it again before publishing.');
  }
  const r = await publishFile(getStore(), bytes, {
    fileName: file.name,
    uploadedBy,
    forBrand: brand as BrandId,
    today: today(),
    dryRun: mode === 'check'
  });
  return json({
    status: r.status,
    contentHash: await sha256(bytes),
    fileName: file.name,
    upload: r.upload,
    previous: r.previous,
    issues: r.issues,
    changes: r.changes,
    workbook: r.workbook
      ? { brand: r.workbook.brand, fy: r.workbook.fy, bauStart: r.workbook.bauStart, posts: r.workbook.posts.length, summary: summarise(r.workbook) }
      : null
  });
};
