// Prints a brand's analytics tables from the local data folder, to check the pipeline without
// the website: which files are uploaded, and what each of the four tables holds.
//
//   npm run show-analytics -- --brand im
//   npm run show-analytics -- --brand im --post 7400000000000000002
//
// --brand  global, im or wealth (required)
// --post   also show one post's figures over time (its ID, or part of its link)
// --data   the data folder (default .data)

import { resolve } from 'node:path';
import { brandById, type BrandId } from '../src/lib/brands';
import { latestPosts, buildTables, monthlyTotals, postHistory } from '../src/lib/analytics/tables';
import { coverage, loadAnalyticsUploads } from '../src/lib/analytics/uploads';
import { folderStore } from '../src/lib/server/folder-store';
import { brandName, monthLabel, parseArgs, table } from './print';

const { opts } = parseArgs(process.argv.slice(2), ['brand', 'post', 'data']);
if (!opts.brand || !brandById(opts.brand)) {
  console.error('Usage: npm run show-analytics -- --brand global|im|wealth [--post ID] [--data DIR]');
  process.exit(2);
}
const brand = opts.brand as BrandId;
const uploads = await loadAnalyticsUploads(folderStore(resolve(opts.data ?? '.data')), { brand });
const t = buildTables(uploads);
const n = (v: number | null | undefined) => (v === null || v === undefined ? '–' : Math.round(v).toLocaleString('en-IN'));

console.log(`\n━━ ${brandName(brand)}: LinkedIn files`);
table(['File', 'Uploads', 'Covered', 'Gaps'], coverage(uploads, brand).map((c) => [
  c.label + (c.optional ? ' (optional)' : ''), String(c.uploads), c.from ? `${c.from} to ${c.to}` : '–',
  c.gaps.map((g) => `${g.from}–${g.to}`).join(', ') || (c.uploads ? 'none' : '–')
]));

const latest = latestPosts(t.posts);
const organic = latest.filter((p) => !p.sponsored);
const sponsored = latest.filter((p) => p.sponsored);
console.log(`\nPosts: ${t.posts.length} rows from ${new Set(t.posts.map((p) => p.asOf)).size} exports → ${organic.length} posts` +
  (sponsored.length ? `, ${sponsored.length} sponsored campaign rows on ${new Set(sponsored.map((p) => p.postId)).size} posts` : ''));
console.log('Most impressions (organic, latest figures):');
table(['Created', 'Impressions', 'Reactions', 'Comments', 'Reposts', 'Clicks', 'As of', 'Post'],
  [...organic].sort((a, b) => b.impressions - a.impressions).slice(0, 5).map((p) => [
    p.created, n(p.impressions), n(p.reactions), n(p.comments), n(p.reposts), n(p.clicks), p.asOf, p.title.slice(0, 50)
  ]), '  ');

if (opts.post) {
  const match = latest.find((p) => p.postId.includes(opts.post) || p.link.includes(opts.post));
  if (!match) console.log(`\nNo post matches "${opts.post}".`);
  else {
    console.log(`\nOver time: ${match.title.slice(0, 70)}`);
    table(['As of', 'Impressions', 'Reactions', 'Comments', 'Reposts', 'Clicks'],
      postHistory(t.posts, brand, match.postId).map((p) => [p.asOf, n(p.impressions), n(p.reactions), n(p.comments), n(p.reposts), n(p.clicks)]), '  ');
  }
}

const months = [...new Set([...(t.daily.get(brand)?.values() ?? [])].flatMap((m) => [...m.keys()].map((d) => d.slice(0, 7))))].sort().slice(-13);
if (months.length) {
  const series = {
    'Followers (organic)': monthlyTotals(t, brand, 'followers', 'Organic followers'),
    'Followers (paid)': monthlyTotals(t, brand, 'followers', 'Sponsored followers'),
    'Page views': monthlyTotals(t, brand, 'visitors', 'Total page views (total)'),
    'Impressions (organic)': monthlyTotals(t, brand, 'content', 'Impressions (organic)'),
    'Impressions (paid)': monthlyTotals(t, brand, 'content', 'Impressions (sponsored)')
  };
  console.log('\nDaily figures, added up per month:');
  table(['Month', ...Object.keys(series)], months.map((m) => [monthLabel(m), ...Object.values(series).map((s) => n(s.get(m)))]), '  ');
}

const followerDays = [...new Set(t.audience.filter((a) => a.of === 'followers').map((a) => a.to))].sort();
if (followerDays.length) {
  const day = followerDays.at(-1)!;
  console.log(`\nAudience: who follows, on ${day} (${followerDays.length} ${followerDays.length === 1 ? 'snapshot' : 'snapshots'} so far)`);
  for (const dim of [...new Set(t.audience.map((a) => a.dimension))]) {
    const rows = t.audience.filter((a) => a.of === 'followers' && a.to === day && a.dimension === dim).sort((a, b) => b.value - a.value).slice(0, 3);
    if (rows.length) console.log(`  ${dim.padEnd(13)} ${rows.map((r) => `${r.label} ${n(r.value)}`).join(' · ')}`);
  }
}

const periods = [...new Set(t.benchmark.map((b) => `${b.from}|${b.to}`))].sort();
if (periods.length) {
  const [from, to] = periods.at(-1)!.split('|');
  console.log(`\nBenchmark: ${from} to ${to} (reactions, comments and reposts per post)`);
  table(['Page', 'Followers', 'New', 'Posts', 'Engagements', 'Per post'],
    t.benchmark.filter((b) => b.from === from && b.to === to)
      .sort((a, b) => (b.engagements ?? 0) / (b.posts || 1) - (a.engagements ?? 0) / (a.posts || 1))
      .map((b) => [(b.own ? '► ' : '  ') + b.page, n(b.totalFollowers), n(b.newFollowers), n(b.posts), n(b.engagements),
        b.posts ? ((b.engagements ?? 0) / b.posts).toFixed(1) : '–']), '  ');
}
