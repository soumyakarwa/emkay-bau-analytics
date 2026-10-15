// Prints a brand's analytics tables from the local data folder, to check the pipeline without
// the website: which files are uploaded per platform, and what each table holds.
//
//   npm run show-analytics -- --brand im
//   npm run show-analytics -- --brand global --platform youtube
//   npm run show-analytics -- --brand im --post 7400000000000000002
//
// --brand     global, im or wealth (required)
// --platform  only this platform (linkedin, youtube, instagram, x)
// --post      also show one post's figures over time (its ID, or part of its link)
// --data      the data folder (default .data)

import { resolve } from 'node:path';
import { brandById, type BrandId } from '../src/lib/brands';
import { PLATFORMS } from '../src/lib/analytics/catalog';
import type { Platform } from '../src/lib/analytics/rows';
import { buildTables, latestPosts, postHistory } from '../src/lib/analytics/tables';
import { coverage, loadAnalyticsUploads } from '../src/lib/analytics/uploads';
import { folderStore } from '../src/lib/server/folder-store';
import { brandName, monthLabel, parseArgs, table } from './print';

const { opts } = parseArgs(process.argv.slice(2), ['brand', 'platform', 'post', 'data']);
if (!opts.brand || !brandById(opts.brand) || (opts.platform && !PLATFORMS.some((p) => p.id === opts.platform))) {
  console.error('Usage: npm run show-analytics -- --brand global|im|wealth [--platform linkedin|youtube|instagram|x] [--post ID] [--data DIR]');
  process.exit(2);
}
const brand = opts.brand as BrandId;
const uploads = await loadAnalyticsUploads(folderStore(resolve(opts.data ?? '.data')), { brand });
const t = buildTables(uploads);
const n = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? '–' : v.toLocaleString('en-IN', { maximumFractionDigits: digits });

for (const p of coverage(uploads, brand)) {
  if (opts.platform && p.platform !== opts.platform) continue;
  if (!p.used && !opts.platform) {
    console.log(`\n━━ ${brandName(brand)} · ${p.label}: nothing uploaded`);
    continue;
  }
  const platform = p.platform as Platform;
  console.log(`\n━━ ${brandName(brand)} · ${p.label}`);
  table(['File', 'Uploads', 'Covered', 'Gaps'], p.files.map((c) => [
    c.label + (c.optional ? ' (optional)' : ''), String(c.uploads), c.from ? `${c.from} to ${c.to}` : '–',
    c.gaps.map((g) => `${g.from}–${g.to}`).join(', ') || (c.uploads ? 'none' : '–')
  ]), '  ');

  const rows = t.posts.filter((r) => r.platform === platform);
  if (rows.length) {
    const latest = latestPosts(rows);
    const organic = latest.filter((r) => !r.sponsored);
    const sponsored = latest.filter((r) => r.sponsored);
    console.log(`\n  Posts: ${rows.length} rows from ${new Set(rows.map((r) => r.uploadId)).size} exports → ${organic.length} posts` +
      (sponsored.length ? `, ${sponsored.length} sponsored campaign rows` : '') +
      (rows[0].figures === 'period' ? ' (figures for the months uploaded, added up)' : ' (latest lifetime figures)'));
    table(['Created', 'Impressions', 'Reach', 'Views', 'Likes', 'Comments', 'Shares', 'Saves', 'Post'],
      [...organic].sort((a, b) => (b.views ?? b.impressions ?? 0) - (a.views ?? a.impressions ?? 0)).slice(0, 5).map((r) => [
        r.created ?? '–', n(r.impressions), n(r.reach), n(r.views), n(r.reactions), n(r.comments), n(r.shares ?? r.reposts), n(r.saves), r.title.slice(0, 44)
      ]), '    ');
  }

  if (opts.post) {
    const match = latestPosts(rows).find((r) => r.postId.includes(opts.post) || r.link.includes(opts.post));
    if (match) {
      console.log(`\n  Over time: ${match.title.slice(0, 70)}`);
      table(['As of', 'Period', 'Impressions', 'Views', 'Likes', 'Comments'],
        postHistory(rows, brand, match.postId, platform).map((r) => [r.asOf, `${r.from}–${r.to}`, n(r.impressions), n(r.views), n(r.reactions), n(r.comments)]), '    ');
    }
  }

  const daily = [...(t.daily.get(brand)?.entries() ?? [])].filter(([k]) => k.startsWith(`${platform}/`));
  for (const [key, days] of daily) {
    const columns = [...new Set([...days.values()].flatMap((d) => Object.keys(d.values)))].slice(0, 5);
    const byMonth = new Map<string, Record<string, number>>();
    for (const [date, f] of days) {
      const m = byMonth.get(date.slice(0, 7)) ?? {};
      for (const c of columns) m[c] = (m[c] ?? 0) + (f.values[c] ?? 0);
      byMonth.set(date.slice(0, 7), m);
    }
    console.log(`\n  Daily (${key.split('/')[1]}), added up per month:`);
    table(['Month', ...columns], [...byMonth.keys()].sort().slice(-6).map((m) => [monthLabel(m), ...columns.map((c) => n(byMonth.get(m)![c], 1))]), '    ');
  }

  const audience = t.audience.filter((a) => a.platform === platform);
  if (audience.length) {
    const last = audience.map((a) => a.to).sort().at(-1)!;
    console.log(`\n  Audience (up to ${last}):`);
    for (const dim of [...new Set(audience.map((a) => a.dimension))]) {
      const top = audience.filter((a) => a.dimension === dim && a.to === last).sort((a, b) => b.value - a.value).slice(0, 3);
      if (top.length) console.log(`    ${dim.padEnd(15)} ${top.map((r) => `${r.label} ${n(r.value)}`).join(' · ')}`);
    }
  }

  for (const s of t.totals.filter((x) => x.platform === platform)) {
    const shown = Object.entries(s.values).filter(([, v]) => v !== null).slice(0, 8).map(([k, v]) => `${k} ${n(v, 2)}`).join(' · ');
    console.log(`\n  Totals, ${s.file}, ${s.from} to ${s.to}: ${shown}`);
  }

  const bench = t.benchmark.filter((b) => b.platform === platform);
  if (bench.length) {
    const last = bench.map((b) => `${b.from}|${b.to}`).sort().at(-1)!;
    console.log(`\n  Benchmark, ${last.replace('|', ' to ')} (reactions, comments and reposts per post):`);
    table(['Page', 'Followers', 'Posts', 'Per post'], bench.filter((b) => `${b.from}|${b.to}` === last)
      .sort((a, b) => (b.engagements ?? 0) / (b.posts || 1) - (a.engagements ?? 0) / (a.posts || 1))
      .map((b) => [(b.own ? '► ' : '  ') + b.page, n(b.totalFollowers), n(b.posts), b.posts ? ((b.engagements ?? 0) / b.posts).toFixed(1) : '–']), '    ');
  }
}
