// Prints the All of Emkay view from the local data folder: the latest upload of every brand,
// post counts across brands, and each brand's BAU mix against its own framework.
//
//   npm run show-emkay
//   npm run show-emkay -- --brand wealth
//   npm run show-emkay -- --history
//
// --brand    only this brand (global, im or wealth)
// --history  also list every upload ever published
// --data     the data folder (default .data)

import { resolve } from 'node:path';
import { brandById, type BrandId } from '../src/lib/brands';
import { buildDataset, emkayTotals, filterPosts } from '../src/lib/dataset/dataset';
import { latestUploads, listUploads } from '../src/lib/dataset/uploads';
import { folderStore } from '../src/lib/server/folder-store';
import { brandName, monthLabel, parseArgs, printSummary, table } from './print';

const args = process.argv.slice(2);
const history = args.includes('--history');
const { opts } = parseArgs(args.filter((a) => a !== '--history'), ['brand', 'data']);
if (opts.brand && !brandById(opts.brand)) {
  console.error('Usage: npm run show-emkay -- [--brand global|im|wealth] [--history] [--data DIR]');
  process.exit(2);
}
const brand = opts.brand as BrandId | undefined;
const store = folderStore(resolve(opts.data ?? '.data'));
const uploads = (await latestUploads(store)).filter((u) => !brand || u.brand === brand);
if (!uploads.length) {
  console.log('Nothing published yet. Run: npm run publish-workbook -- <workbook.xlsx>');
  process.exit(0);
}
const ds = buildDataset(uploads);
const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');

console.log(`\n━━ ${brand ? brandName(brand) : 'All of Emkay'}`);
table(['Brand', 'Year', 'Posts', 'Latest upload', 'File'],
  ds.brandYears.map((y) => [brandName(y.brand), `FY${String(y.fy).slice(2)}`, String(filterPosts(ds, { brand: y.brand, fy: y.fy }).length),
    when(y.uploadedAt), y.fileName]));

const t = emkayTotals(ds);
console.log('\nPosts per month (every post except Dropped)');
table(['Brand', ...t.months.map(monthLabel), 'Total'],
  t.byBrand.map((b) => [brandName(b.brand), ...t.months.map((m) => String(b.byMonth[m])), String(b.total)]));

console.log('\nPosts per platform (live / planned)');
const platforms = [...new Set(t.byPlatform.map((p) => p.platform))];
table(['Brand', ...platforms],
  [...new Set(t.byPlatform.map((p) => p.brand))].map((b) => [brandName(b),
    ...platforms.map((pl) => {
      const x = t.byPlatform.find((p) => p.brand === b && p.platform === pl)!;
      return `${x.published} / ${x.planned}`;
    })]));

for (const y of ds.brandYears) {
  console.log(`\n${brandName(y.brand)} FY${String(y.fy).slice(2)}: BAU mix against its own framework` +
    (y.bauStart ? ` (from ${monthLabel(y.bauStart)})` : ''));
  printSummary(y.summary, '  ');
}

if (history) {
  console.log('\nEvery upload (oldest first)');
  const all = (await listUploads(store)).filter((u) => !brand || u.brand === brand);
  table(['Upload', 'Brand', 'Uploaded', 'By', 'Posts', 'To fix', 'File'],
    all.map((u) => [u.id, brandName(u.brand), when(u.uploadedAt), u.uploadedBy ?? '', String(u.posts), String(u.warnings), u.fileName]));
}
