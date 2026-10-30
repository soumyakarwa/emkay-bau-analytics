// The team's monthly cycle: from the 25th of one month to the 24th of the next, named after the
// month it ends in. "October 2026" runs from 25 September to 24 October 2026. Every analytics
// page groups by cycle; a cycle is written like a month, as YYYY-MM.

/** The day of the month a cycle starts on. */
export const CYCLE_START_DAY = 25;

const pad = (n: number) => String(n).padStart(2, '0');
function shift(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** The cycle a day (YYYY-MM-DD) belongs to: 25 Sep → "YYYY-10", 24 Oct → "YYYY-10". */
export function cycleOf(day: string): string {
  return Number(day.slice(8, 10)) >= CYCLE_START_DAY ? shift(day.slice(0, 7), 1) : day.slice(0, 7);
}

/** A cycle's first and last day. */
export function cycleRange(cycle: string): { from: string; to: string } {
  return { from: `${shift(cycle, -1)}-${pad(CYCLE_START_DAY)}`, to: `${cycle}-${pad(CYCLE_START_DAY - 1)}` };
}

/** True when the period is exactly one cycle (25th to 24th). */
export function isWholeCycle(from: string, to: string): boolean {
  const r = cycleRange(cycleOf(from));
  return r.from === from && r.to === to;
}

/** Has the cycle ended by `asOf` (YYYY-MM-DD)? */
export const cycleDone = (cycle: string, asOf: string) => cycleRange(cycle).to <= asOf;

/** The latest cycle that has ended by `today`. */
export const lastDoneCycle = (today: string) => shift(cycleOf(today), -1);

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d: string, year = false) => `${Number(d.slice(8, 10))} ${SHORT[Number(d.slice(5, 7)) - 1]}${year ? ` ${d.slice(0, 4)}` : ''}`;
/** "25 Sep–24 Oct", or with years: "25 Sep 2026 – 24 Oct 2026". */
export function cycleDates(cycle: string, years = false): string {
  const r = cycleRange(cycle);
  return years ? `${dayLabel(r.from, true)} – ${dayLabel(r.to, true)}` : `${dayLabel(r.from)}–${dayLabel(r.to)}`;
}
