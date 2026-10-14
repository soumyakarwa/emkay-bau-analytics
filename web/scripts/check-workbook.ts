// Reads one or more calendar workbooks and prints what the site would see: posts per comms
// task, and every problem grouped by the person who should fix it. Nothing is stored.
//
//   npm run check-workbook -- "Emkay IM - Content calendar FY27.xlsx"
//   npm run check-workbook -- --today 2026-10-13 file.xlsx
//
// Exits with code 1 if any workbook has a blocking problem.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { brandByName } from '../src/lib/brands';
import { readCalendarFile, summarise } from '../src/lib/workbook';
import { monthLabel, parseArgs, printIssues, printSummary } from './print';

const { opts, rest: files } = parseArgs(process.argv.slice(2), ['today']);
if (!files.length) {
  console.error('Usage: npm run check-workbook -- [--today YYYY-MM-DD] <workbook.xlsx> [more.xlsx …]');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  console.log(`\n━━ ${basename(file)}`);
  const { workbook, issues } = readCalendarFile(new Uint8Array(readFileSync(file)), { today: opts.today });
  failed ||= issues.some((i) => i.level === 'error');
  if (workbook) {
    if (!brandByName(workbook.brand)) {
      failed = true;
      console.log(`✖ "${workbook.brand}" is not one of the three Emkay brands, so this workbook would be refused on upload.`);
    }
    const s = summarise(workbook);
    console.log(`${workbook.brand} · FY${String(workbook.fy).slice(2)} · BAU from ${workbook.bauStart ? monthLabel(workbook.bauStart) : 'the start of the year'}`);
    console.log(`${s.bau.total} BAU posts, ${s.notBau.total} not BAU` +
      (s.beforeBauStart ? `, ${s.beforeBauStart} before the BAU start (baseline, not counted)` : '') +
      (s.withoutPeg ? `, ${s.withoutPeg} without a valid peg (not counted)` : '') + '\n');
    printSummary(s);
  }
  printIssues(issues);
}
process.exit(failed ? 1 : 0);
