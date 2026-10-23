// Notes a brand's follower totals, read off each profile, so the site can show totals over time
// (the exports only give gains and losses). Each count is kept; the latest one per platform anchors
// the totals.
//
//   npm run set-followers -- --brand im --date 2026-10-23 linkedin=3735 instagram=327 x=689 youtube=6058
//
// --brand  global, im or wealth (required)
// --date   the day the counts were read (default today)
// --by     who read them
// --data   the data folder (default .data)
// Counts can be written as on the profile: 3,735 · 1.6k (kept as approximate).

import { resolve } from 'node:path';
import { brandById, type BrandId } from '../src/lib/brands';
import { PLATFORMS } from '../src/lib/analytics/catalog';
import { parseCount, saveFollowerCount } from '../src/lib/analytics/followers';
import type { Platform } from '../src/lib/analytics/rows';
import { folderStore } from '../src/lib/server/folder-store';
import { brandName, parseArgs } from './print';

const { opts, rest } = parseArgs(process.argv.slice(2), ['brand', 'date', 'by', 'data']);
const date = opts.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const pairs = rest.map((r) => /^([a-z]+)=(.+)$/i.exec(r));
if (!opts.brand || !brandById(opts.brand) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !pairs.length || pairs.some((p) => !p)) {
  console.error('Usage: npm run set-followers -- --brand global|im|wealth [--date YYYY-MM-DD] linkedin=3735 instagram=327 x=1.6k youtube=6058');
  process.exit(2);
}
const store = folderStore(resolve(opts.data ?? '.data'));
for (const [, platform, value] of pairs as RegExpExecArray[]) {
  const p = PLATFORMS.find((x) => x.id === platform.toLowerCase());
  const parsed = parseCount(value);
  if (!p || !parsed) {
    console.log(`✖ ${platform}=${value}: ${!p ? `not a platform (${PLATFORMS.map((x) => x.id).join(', ')})` : 'not a number'}`);
    continue;
  }
  await saveFollowerCount(store, { brand: opts.brand as BrandId, platform: p.id as Platform, date, count: parsed.count, approximate: parsed.approximate, enteredBy: opts.by ?? null });
  console.log(`✔ ${brandName(opts.brand)} ${p.label}: ${parsed.count.toLocaleString('en-IN')}${parsed.approximate ? ' (approximate)' : ''} on ${date}`);
}
