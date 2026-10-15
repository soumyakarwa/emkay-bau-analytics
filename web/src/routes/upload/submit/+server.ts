// Checks (mode=check) or publishes (mode=publish) one file sent from a section of the upload page:
// a brand's calendar workbook (section=calendar) or one of its analytics exports from any platform
// (section=analytics). A file sent to the wrong section is turned away with where it belongs.
// Publishing re-sends the same file; its fingerprint must match the one that was checked, so
// what gets published is exactly what was previewed.

import { error, json } from '@sveltejs/kit';
import { brandById, type BrandId } from '$lib/brands';
import { detectExport, exportLabel } from '$lib/analytics/platforms';
import { publishAnalyticsFile } from '$lib/analytics/uploads';
import { publishFile, sha256 } from '$lib/dataset/uploads';
import { getStore } from '$lib/server/data';
import { today } from '$lib/server/today';
import { summarise } from '$lib/workbook/summary';
import type { RequestHandler } from './$types';

const MAX_BYTES = 10 * 1024 * 1024;


export const POST: RequestHandler = async ({ request, locals }) => {
  const form = await request.formData();
  const mode = form.get('mode');
  const section = form.get('section');
  const brand = String(form.get('brand') ?? '');
  const file = form.get('file');
  const uploadedBy = String(form.get('uploadedBy') ?? '').trim() || null;
  if (mode !== 'check' && mode !== 'publish') error(400, 'Unknown mode.');
  if (section !== 'calendar' && section !== 'analytics') error(400, 'Unknown section.');
  if (!brandById(brand)) error(400, 'Pick the brand you are uploading for.');
  if (!locals.access?.uploadBrands.includes(brand as BrandId)) {
    error(403, `Your sign-in cannot upload for ${brandById(brand)!.name}. Sign in with its upload password first.`);
  }
  if (!(file instanceof File) || file.size === 0) error(400, 'Choose a file to upload.');
  if (file.size > MAX_BYTES) error(400, 'That file is too large (over 10 MB).');
  if (section === 'analytics' && !/\.(xlsx?|csv|zip)$/i.test(file.name)) error(400, `${file.name} is not an analytics export (.xls, .xlsx, .csv or .zip).`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = await sha256(bytes);
  if (mode === 'publish' && form.get('checkedHash') !== contentHash) {
    error(409, 'This file changed since it was checked. Check it again before publishing.');
  }

  const found = detectExport({ name: file.name, bytes });
  if (section === 'calendar' && found) error(400, `${file.name} is a ${exportLabel(found.platform, found.file)} export: upload it under Analytics.`);
  if (section === 'calendar' && !/\.xlsx$/i.test(file.name)) error(400, 'Choose the calendar workbook (.xlsx).');
  if (section === 'analytics' && !found && /\.xlsx$/i.test(file.name)) {
    error(400, `${file.name} is not an analytics export. If it is the calendar workbook, upload it under Calendar workbook.`);
  }

  if (section === 'analytics') {
    const r = await publishAnalyticsFile(getStore(), bytes, {
      fileName: file.name,
      forBrand: brand as BrandId,
      uploadedBy,
      dryRun: mode === 'check'
    });
    return json({
      status: r.status,
      message: r.message,
      contentHash,
      fileName: file.name,
      upload: r.upload,
      export: r.data
        ? {
            platform: r.data.platform,
            file: r.data.file,
            label: exportLabel(r.data.platform, r.data.file),
            account: r.data.account,
            from: r.data.from,
            to: r.data.to,
            posts: r.data.posts.filter((p) => !p.sponsored).length,
            sponsored: r.data.posts.filter((p) => p.sponsored).length,
            days: r.data.daily.length,
            audience: r.data.audience?.rows.length ?? 0,
            peers: r.data.benchmark.filter((b) => !b.own).length,
            totals: r.data.totals ? Object.keys(r.data.totals).length : 0
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
