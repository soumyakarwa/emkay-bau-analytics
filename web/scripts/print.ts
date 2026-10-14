// Terminal output shared by the workbook commands.

import { BRANDS } from '../src/lib/brands';
import type { Summary } from '../src/lib/workbook/summary';
import type { Issue } from '../src/lib/workbook/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`;
export const pct = (n: number | null) => (n === null ? '' : `${Math.round(n * 100)}%`);
export const brandName = (id: string) => BRANDS.find((b) => b.id === id)?.name ?? id;

/** Prints rows as aligned columns: numbers right-aligned, text left-aligned. */
export function table(head: string[], rows: string[][], indent = ''): void {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const numeric = head.map((_, i) => i > 0 && rows.every((r) => /^[\d\s/%.,-]*$/.test(r[i])));
  const line = (r: string[]) => indent + r.map((c, i) => (numeric[i] ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('  ').trimEnd();
  console.log(line(head));
  for (const r of rows) console.log(line(r));
}

/** Posts per comms task per month for one brand, against its own targets. */
export function printSummary(s: Summary, indent = ''): void {
  const months = s.months.filter((k) => s.tasks.some((t) => t.byMonth[k]));
  table(
    ['Comms task', 'BAU', 'Target', ...months.map(monthLabel), 'Total', 'Share'],
    s.tasks.map((t) => [`${t.code} ${t.name}`, t.countsAsBau ? 'yes' : 'no', pct(t.target),
      ...months.map((k) => String(t.byMonth[k])), String(t.total), pct(t.share)]),
    indent
  );
}

/** Problems grouped by the person who should fix them. */
export function printIssues(issues: Issue[], heading = 'Problems'): void {
  if (!issues.length) {
    console.log('\nNo problems found.');
    return;
  }
  const errors = issues.filter((i) => i.level === 'error').length;
  console.log(`\n${heading}: ${errors} blocking, ${issues.length - errors} to fix`);
  const byOwner = new Map<string, Issue[]>();
  for (const i of issues) {
    const k = i.owner ?? 'No owner named';
    byOwner.set(k, [...(byOwner.get(k) ?? []), i]);
  }
  for (const [owner, list] of byOwner) {
    console.log(`\n  ${owner} (${list.length})`);
    for (const i of list) {
      const where = [i.sheet, i.cell].filter(Boolean).join(' ');
      const post = i.post ? ` "${i.post.length > 40 ? i.post.slice(0, 39) + '…' : i.post}"` : '';
      console.log(`    ${i.level === 'error' ? '✖ blocking' : '⚠'}  ${where}${post}: ${i.message}`);
    }
  }
}

/** Splits `--name value` options from the remaining arguments. */
export function parseArgs(args: string[], names: string[]): { opts: Record<string, string>; rest: string[] } {
  const opts: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (args[i].startsWith('--') && names.includes(name)) opts[name] = args[++i];
    else rest.push(args[i]);
  }
  return { opts, rest };
}
