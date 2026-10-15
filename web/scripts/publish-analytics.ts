// Publishes LinkedIn analytics exports into the local data folder (web/.data), as the upload page
// does. Every upload is kept, as its original file and its cleaned rows.
//
//   npm run publish-analytics -- --for im emkayinvestmentmanagers_content_1791966587478.xls …
//
// --for   the brand the exports are for (global, im or wealth); required
// --by    who is uploading
// --data  the data folder (default .data)

import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { brandById, type BrandId } from '../src/lib/brands';
import { publishAnalyticsFile } from '../src/lib/analytics/uploads';
import { folderStore } from '../src/lib/server/folder-store';
import { brandName, parseArgs } from './print';

const { opts, rest: files } = parseArgs(process.argv.slice(2), ['for', 'by', 'data']);
if (!files.length || !opts.for || !brandById(opts.for)) {
  console.error('Usage: npm run publish-analytics -- --for global|im|wealth [--by NAME] [--data DIR] <export.xls> …');
  process.exit(2);
}
const store = folderStore(resolve(opts.data ?? '.data'));

let failed = false;
for (const file of files) {
  const r = await publishAnalyticsFile(store, new Uint8Array(readFileSync(file)), {
    fileName: basename(file),
    forBrand: opts.for as BrandId,
    uploadedBy: opts.by ?? null
  });
  const name = basename(file);
  if (r.status === 'refused') {
    failed = true;
    console.log(`✖ ${name}: not published. ${r.message}`);
    continue;
  }
  const u = r.upload!;
  if (r.status === 'unchanged') {
    console.log(`= ${name}: already uploaded (${u.uploadedAt.slice(0, 16).replace('T', ' ')}), nothing new stored.`);
    continue;
  }
  const what = u.file === 'content' ? `${u.counts.posts} posts, ${u.counts.sponsored} sponsored rows, ${u.counts.days} days`
    : u.file === 'competitors' ? `${u.counts.benchmark} pages`
    : `${u.counts.days} days, ${u.counts.audience} audience rows`;
  console.log(`✔ ${name}: ${brandName(u.brand)} LinkedIn ${u.file}, ${u.from} to ${u.to}: ${what}.`);
  for (const w of u.warnings) console.log(`  ⚠ ${w}`);
}
process.exit(failed ? 1 : 0);
