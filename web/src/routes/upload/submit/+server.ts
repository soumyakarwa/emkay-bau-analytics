// Checks (mode=check) or publishes (mode=publish) a file sent from the upload page: a brand's
// calendar workbook, or one of its LinkedIn analytics exports. Publishing re-sends the same file;
// its fingerprint must match the one that was checked, so what gets published is exactly what was
// previewed.

import { error, json } from '@sveltejs/kit';
import { brandById, type BrandId } from '$lib/brands';
import { looksLikeLinkedIn } from '$lib/analytics/linkedin';
import { publishAnalyticsFile } from '$lib/analytics/uploads';
import { publishFile, sha256 } from '$lib/dataset/uploads';
import { getStore } from '$lib/server/data';
import { today } from '$lib/server/today';
import { isXls } from '$lib/workbook/xls';
import { readXlsx } from '$lib/workbook/xlsx';
import { summarise } from '$lib/workbook/summary';
import type { RequestHandler } from './$types';

const MAX_BYTES = 10 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, locals }) => {
  const form = await request.formData();
  const mode = form.get('mode');
  const brand = String(form.get('brand') ?? '');
  const file = form.get('file');
  const uploadedBy = String(form.get('uploadedBy') ?? '').trim() || null;
  if (mode !== 'check' && mode !== 'publish') error(400, 'Unknown mode.');
  if (!brandById(brand)) error(400, 'Pick the brand you are uploading for.');
  if (!locals.access?.uploadBrands.includes(brand as BrandId)) {
    error(403, `Your sign-in cannot upload for ${brandById(brand)!.name}. Sign in with its upload password first.`);
  }
  if (!(file instanceof File) || file.size === 0) error(400, 'Choose a file to upload.');
  if (file.size > MAX_BYTES) error(400, 'That file is too large (over 10 MB).');
  if (!/\.xlsx?$/i.test(file.name)) error(400, 'Choose a calendar workbook (.xlsx) or a LinkedIn export (.xls).');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = await sha256(bytes);
  if (mode === 'publish' && form.get('checkedHash') !== contentHash) {
    error(409, 'This file changed since it was checked. Check it again before publishing.');
  }

  // A LinkedIn export (.xls, or .xlsx with LinkedIn's sheets) goes to analytics; anything else is a calendar workbook.
  let linkedIn = isXls(bytes);
  if (!linkedIn) {
    try {
      linkedIn = looksLikeLinkedIn(readXlsx(bytes));
    } catch {
      /* not readable as .xlsx: the calendar reader reports it */
    }
  }

  if (linkedIn) {
    const r = await publishAnalyticsFile(getStore(), bytes, {
      fileName: file.name,
      forBrand: brand as BrandId,
      uploadedBy,
      dryRun: mode === 'check'
    });
    return json({
      type: 'linkedin',
      status: r.status,
      message: r.message,
      contentHash,
      fileName: file.name,
      upload: r.upload,
      export: r.data
        ? {
            kind: r.data.kind,
            page: r.data.page,
            from: r.data.from,
            to: r.data.to,
            posts: r.data.posts.length,
            sponsored: r.data.posts.filter((p) => p.sponsored).length,
            days: r.data.daily.length
          }
        : null
    });
  }

  const r = await publishFile(getStore(), bytes, {
    fileName: file.name,
    uploadedBy,
    forBrand: brand as BrandId,
    today: today(),
    dryRun: mode === 'check'
  });
  return json({
    type: 'calendar',
    status: r.status,
    contentHash,
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
