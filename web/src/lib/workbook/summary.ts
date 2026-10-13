// Posts per comms task per month, the same numbers as the workbook's Summary sheet:
// posts with a peg from the framework, not Dropped, from the BAU start month onwards.

import { DROPPED, fyMonths, normalise } from './contract';
import type { CalendarWorkbook } from './types';

export interface TaskCount {
  code: string;
  name: string;
  countsAsBau: boolean;
  target: number | null;
  byMonth: Record<string, number>;
  total: number;
  /** Share of all BAU posts in the year, or null for tasks that do not count as BAU. */
  share: number | null;
}

export interface Summary {
  /** YYYY-MM, from the BAU start (or the start of the financial year) to March. */
  months: string[];
  tasks: TaskCount[];
  bau: { byMonth: Record<string, number>; total: number };
  notBau: { byMonth: Record<string, number>; total: number };
  /** Posts before the BAU start, kept as a baseline but not counted. */
  beforeBauStart: number;
  /** Posts on or after the BAU start that cannot be counted because they have no valid peg. */
  withoutPeg: number;
}

export function summarise(wb: CalendarWorkbook): Summary {
  const months = fyMonths(wb.fy)
    .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`)
    .filter((k) => !wb.bauStart || k >= wb.bauStart);
  const zero = () => Object.fromEntries(months.map((k) => [k, 0])) as Record<string, number>;
  const tasks: TaskCount[] = wb.commsTasks.map((t) => ({ ...t, byMonth: zero(), total: 0, share: null }));
  const index = new Map(tasks.map((t) => [t.code, t]));
  const live = wb.posts.filter((p) => !(p.status && normalise(p.status) === normalise(DROPPED)));

  let withoutPeg = 0;
  for (const p of live) {
    if (p.beforeBauStart) continue;
    const t = p.commsTask ? index.get(p.commsTask) : undefined;
    if (!t) {
      withoutPeg++;
      continue;
    }
    t.byMonth[p.month]++;
    t.total++;
  }

  const sum = (pick: (t: TaskCount) => boolean) => {
    const byMonth = zero();
    for (const t of tasks.filter(pick)) for (const k of months) byMonth[k] += t.byMonth[k];
    return { byMonth, total: Object.values(byMonth).reduce((a, b) => a + b, 0) };
  };
  const bau = sum((t) => t.countsAsBau);
  const notBau = sum((t) => !t.countsAsBau);
  for (const t of tasks) t.share = t.countsAsBau && bau.total ? t.total / bau.total : null;

  return { months, tasks, bau, notBau, beforeBauStart: live.filter((p) => p.beforeBauStart).length, withoutPeg };
}
