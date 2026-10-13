// View helpers for the calendar: month grids, filtering and option lists.
// Pure functions so the UI stays thin and these stay testable.

import { MONTH_NAMES, normalise } from './contract';
import type { CalendarEntry, Framework } from './types';

export interface Filters {
  search: string;
  task: string;
  pillar: string;
  peg: string;
  platform: string;
  status: string;
}

export const EMPTY_FILTERS: Filters = { search: '', task: '', pillar: '', peg: '', platform: '', status: '' };

export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Weeks (Monday first) covering the month; days outside the month are null. */
export function monthWeeks(key: string): (string | null)[][] {
  const [y, m] = key.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${key}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The month to open on: today's month if present, else the nearest later one, else the last. */
export function initialMonth(months: string[], today = new Date()): string | null {
  if (!months.length) return null;
  const current = today.toISOString().slice(0, 7);
  return months.find((m) => m >= current) ?? months[months.length - 1];
}

export function matches(entry: CalendarEntry, f: Filters): boolean {
  if (f.task && entry.taskCode !== f.task) return false;
  if (f.pillar && entry.pillar !== f.pillar) return false;
  if (f.peg && entry.peg !== f.peg) return false;
  if (f.platform && !entry.platforms.some((p) => p.platform === f.platform)) return false;
  if (f.status && (entry.status ?? '') !== f.status) return false;
  if (f.search) {
    const haystack = normalise(
      [entry.title, entry.details, entry.peg, entry.pillar, entry.format, entry.poc, entry.moment, entry.status].filter(Boolean).join(' ')
    );
    if (!haystack.includes(normalise(f.search))) return false;
  }
  return true;
}

/** Moment markers carry no taxonomy, so taxonomy filters hide them; other filters still apply. */
export function filterEntries(entries: CalendarEntry[], f: Filters) {
  return entries.filter((e) => matches(e, f));
}

export function isFiltered(f: Filters) {
  return Object.values(f).some(Boolean);
}

/** Pillar and peg options cascade from the chosen task and pillar. */
export function taxonomyOptions(framework: Framework, f: Pick<Filters, 'task' | 'pillar'>) {
  const rows = framework.rows.filter((r) => !f.task || r.code === f.task);
  const pillars = [...new Set(rows.map((r) => r.pillar))];
  const pegs = [...new Set(rows.filter((r) => !f.pillar || r.pillar === f.pillar).map((r) => r.peg))];
  return { tasks: framework.tasks, pillars, pegs };
}

/** Distinct values present in the data, for platform and status filters. */
export function presentValues(entries: CalendarEntry[]) {
  const platforms = [...new Set(entries.flatMap((e) => e.platforms.map((p) => p.platform)))];
  const statuses = [...new Set(entries.map((e) => e.status).filter((s): s is string => Boolean(s)))].sort();
  return { platforms, statuses };
}

/** Stable colour slot per comms task, by its order in the framework sheet. */
export function taskSlot(framework: Framework, code: string | null): number {
  if (!code) return -1;
  return framework.tasks.findIndex((t) => t.code === code);
}

export function formatLongDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}
