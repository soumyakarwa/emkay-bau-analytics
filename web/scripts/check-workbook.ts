// Reads one or more calendar workbooks and prints what the site would see: posts per comms
// task, and every problem grouped by the person who should fix it.
//
//   npm run check-workbook -- "Emkay IM - Content calendar FY27.xlsx"
//   npm run check-workbook -- --today 2026-10-13 file.xlsx
//
// Exits with code 1 if any workbook has an error (something that would block publishing).

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { readCalendarFile, summarise, type Issue } from '../src/lib/workbook';

const args = process.argv.slice(2);
let today: string | undefined;
const files: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--today') today = args[++i];
  else files.push(args[i]);
}
if (!files.length) {
  console.error('Usage: npm run check-workbook -- [--today YYYY-MM-DD] <workbook.xlsx> [more.xlsx …]');
  process.exit(2);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (k: string) => `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`;
const pct = (n: number | null) => (n === null ? '' : `${Math.round(n * 100)}%`);
const where = (i: Issue) => [i.sheet, i.cell].filter(Boolean).join(' ');

let failed = false;
for (const file of files) {
  console.log(`\n━━ ${basename(file)}`);
  const { workbook, issues } = readCalendarFile(new Uint8Array(readFileSync(file)), { today });
  const errors = issues.filter((i) => i.level === 'error');
  failed ||= errors.length > 0;

  if (workbook) {
    const s = summarise(workbook);
    const bauFrom = workbook.bauStart ? label(workbook.bauStart) : 'the start of the year';
    console.log(`${workbook.brand} · FY${String(workbook.fy).slice(2)} · BAU from ${bauFrom}`);
    console.log(`${s.bau.total} BAU posts, ${s.notBau.total} not BAU` +
      (s.beforeBauStart ? `, ${s.beforeBauStart} before the BAU start (baseline, not counted)` : '') +
      (s.withoutPeg ? `, ${s.withoutPeg} without a valid peg (not counted)` : '') + '\n');

    const months = s.months.filter((k) => s.tasks.some((t) => t.byMonth[k]));
    const head = ['Comms task', 'BAU', 'Target', ...months.map(label), 'Total', 'Share'];
    const rows = s.tasks.map((t) => [`${t.code} ${t.name}`, t.countsAsBau ? 'yes' : 'no', pct(t.target),
      ...months.map((k) => String(t.byMonth[k])), String(t.total), pct(t.share)]);
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const line = (r: string[]) => r.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
    console.log(line(head));
    for (const r of rows) console.log(line(r));
  }

  if (!issues.length) {
    console.log('\nNo problems found.');
    continue;
  }
  console.log(`\nProblems: ${errors.length} blocking, ${issues.length - errors.length} to fix`);
  const byOwner = new Map<string, Issue[]>();
  for (const i of issues) {
    const k = i.owner ?? 'No owner named';
    byOwner.set(k, [...(byOwner.get(k) ?? []), i]);
  }
  for (const [owner, list] of byOwner) {
    console.log(`\n  ${owner} (${list.length})`);
    for (const i of list) {
      const post = i.post ? ` "${i.post.length > 40 ? i.post.slice(0, 39) + '…' : i.post}"` : '';
      console.log(`    ${i.level === 'error' ? '✖ blocking' : '⚠'}  ${where(i)}${post}: ${i.message}`);
    }
  }
}
process.exit(failed ? 1 : 0);
