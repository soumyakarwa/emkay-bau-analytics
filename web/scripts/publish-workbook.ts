// Publishes calendar workbooks into the local data folder (web/.data), as the upload page
// will later. Every accepted upload is kept; a workbook with blocking problems is refused.
//
//   npm run publish-workbook -- "Emkay IM - Content calendar FY27.xlsx"
//   npm run publish-workbook -- --for wealth --by "Your name" file.xlsx
//
// --for   the brand you are uploading for (global, im or wealth); a workbook for another brand is refused
// --by    who is uploading
// --data  the data folder (default .data)
// --today check missing details as of this date (YYYY-MM-DD)

import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { brandById, type BrandId } from '../src/lib/brands';
import { publishFile } from '../src/lib/dataset/uploads';
import { folderStore } from '../src/lib/server/folder-store';
import { brandName, parseArgs, printIssues } from './print';

const { opts, rest: files } = parseArgs(process.argv.slice(2), ['for', 'by', 'data', 'today']);
if (!files.length || (opts.for && !brandById(opts.for))) {
  console.error('Usage: npm run publish-workbook -- [--for global|im|wealth] [--by NAME] [--data DIR] [--today YYYY-MM-DD] <workbook.xlsx> …');
  process.exit(2);
}
const store = folderStore(resolve(opts.data ?? '.data'));

let failed = false;
for (const file of files) {
  console.log(`\n━━ ${basename(file)}`);
  const r = await publishFile(store, new Uint8Array(readFileSync(file)), {
    fileName: basename(file),
    uploadedBy: opts.by ?? null,
    forBrand: opts.for as BrandId | undefined,
    today: opts.today
  });
  if (r.status === 'refused') {
    failed = true;
    console.log('✖ Not published. Fix the blocking problems below and publish again.');
    printIssues(r.issues);
    continue;
  }
  const u = r.upload!;
  const label = `${brandName(u.brand)} FY${String(u.fy).slice(2)}`;
  if (r.status === 'unchanged') {
    console.log(`= ${label}: identical to the latest upload (${u.uploadedAt.slice(0, 16).replace('T', ' ')}), so nothing new was stored.`);
    continue;
  }
  console.log(`✔ Published ${label}: ${u.posts} posts, upload ${u.id}.`);
  if (r.previous) {
    console.log(`  Replaces the upload of ${r.previous.uploadedAt.slice(0, 16).replace('T', ' ')}, which stays in the history.`);
    if (r.changes.length) {
      console.log('\n  Framework changes since then:');
      for (const c of r.changes) console.log(`    • ${c.message}`);
    } else console.log('  No framework changes since then.');
  }
  if (r.issues.length) console.log(`\n  ${r.issues.length} problem${r.issues.length === 1 ? '' : 's'} to fix (not blocking). Run check-workbook to see them.`);
}
process.exit(failed ? 1 : 0);
