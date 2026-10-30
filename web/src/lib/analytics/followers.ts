// Follower totals. The platforms' exports only say how many people followed (and, on some,
// unfollowed) each day or month, never the total. So someone notes the total from each profile
// once ("LinkedIn: 3,735 followers on 23 October"), and the totals for other months are worked
// out from it with the exports' gains and losses:
//
//   LinkedIn   new followers per day (no unfollows: the total is an estimate that drifts upward)
//   X          new follows and unfollows per day (exact)
//   YouTube    subscribers gained minus lost, per whole month uploaded
//   Instagram  new followers per period, from the overview summary when it covers a whole month
//
// Counts are kept like uploads: each one saved once, never changed; a later count for the same
// platform takes over as the anchor, so re-checking once a year corrects any drift.

import type { BrandId } from '../brands';
import type { Store } from '../dataset/store';
import type { Platform } from './rows';
import { cycleOf, cycleRange } from './cycle';
import { addablePeriods, dailySeries, type Tables } from './tables';

export interface FollowerCount {
  brand: BrandId;
  platform: Platform;
  /** The day the count was read off the profile (YYYY-MM-DD). */
  date: string;
  count: number;
  /** True for a rounded figure, such as "1.6k". */
  approximate: boolean;
  enteredBy: string | null;
  enteredAt: string;
}

const PREFIX = 'analytics/';
const DAY = 86400000;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const stamp = (d: Date) => d.toISOString().replace(/[-:.]/g, '');

/** "3,735", "1.6k", "2.1M" → a number, and whether it was rounded. */
export function parseCount(text: string): { count: number; approximate: boolean } | null {
  const m = /^\s*([\d,]*\.?\d+)\s*([kKmM])?\s*$/.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const scale = m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1;
  return { count: Math.round(n * scale), approximate: !!m[2] };
}

export async function saveFollowerCount(store: Store, c: Omit<FollowerCount, 'enteredAt'>, now = new Date()): Promise<FollowerCount> {
  const saved: FollowerCount = { ...c, enteredAt: now.toISOString() };
  await store.put(`${PREFIX}${c.brand}/follower-counts/${c.platform}-${c.date}-${stamp(now)}.json`, JSON.stringify(saved));
  return saved;
}

/** Every count, oldest entry first; for the same platform and day, the later entry wins. */
export async function listFollowerCounts(store: Store, brand?: BrandId): Promise<FollowerCount[]> {
  const keys = (await store.list(PREFIX + (brand ? `${brand}/` : ''))).filter((k) => k.includes('/follower-counts/') && k.endsWith('.json')).sort();
  const latest = new Map<string, FollowerCount>();
  for (const k of keys) {
    const raw = await store.get(k);
    if (!raw) continue;
    const c = JSON.parse(raw) as FollowerCount;
    const id = `${c.brand}|${c.platform}|${c.date}`;
    const seen = latest.get(id);
    if (!seen || c.enteredAt >= seen.enteredAt) latest.set(id, c);
  }
  return [...latest.values()].sort((a, b) => a.date.localeCompare(b.date) || a.platform.localeCompare(b.platform));
}

/** The platform's net change in followers per day, as far as its exports say. */
function netPerDay(tables: Tables, brand: BrandId, platform: Platform): { days: Map<string, number>; exact: boolean } {
  const days = new Map<string, number>();
  const add = (date: string, n: number) => days.set(date, (days.get(date) ?? 0) + n);
  if (platform === 'linkedin') {
    for (const d of dailySeries(tables, brand, 'linkedin', 'followers', 'Total followers')) if (d.value !== null) add(d.date, d.value);
    return { days, exact: false };
  }
  if (platform === 'x') {
    const gains = dailySeries(tables, brand, 'x', 'overview', 'New follows');
    const losses = new Map(dailySeries(tables, brand, 'x', 'overview', 'Unfollows').map((d) => [d.date, d.value ?? 0]));
    for (const d of gains) if (d.value !== null) add(d.date, d.value - (losses.get(d.date) ?? 0));
    return { days, exact: true };
  }
  // YouTube and Instagram give a total per period: spread whole cycles (or, from older exports,
  // whole months) evenly over their days.
  const column = platform === 'youtube' ? 'Subscribers' : 'New Followers';
  const file = platform === 'youtube' ? 'content' : 'overview';
  for (const t of addablePeriods(tables.totals.filter((t) => t.brand === brand && t.platform === platform && t.file === file))) {
    const n = t.values[column];
    if (n === null || n === undefined) continue;
    const span = Math.round((Date.parse(t.to) - Date.parse(t.from)) / DAY) + 1;
    for (let i = 0; i < span; i++) days.set(addDays(t.from, i), n / span);
  }
  return { days, exact: false };
}

export interface FollowerTotal {
  /** The last day of the month, or the anchor's day. */
  date: string;
  total: number;
  /** True when worked out from incomplete or gains-only figures, or a rounded count. */
  estimated: boolean;
}

/**
 * The follower total at the end of each month (or each cycle, with `by: 'cycle'`), worked out from the latest count: forwards by
 * adding each day's net change, backwards by taking it away. Days the exports do not cover count
 * as no change, and make the total an estimate; a platform whose exports say nothing about
 * followers shows only the count itself. Months more than `limit` days of missing figures
 * away from the count are left out.
 */
export function followerTotals(tables: Tables, counts: FollowerCount[], brand: BrandId, platform: Platform, months: string[], limit = 45, by: 'month' | 'cycle' = 'month'): FollowerTotal[] {
  const periodOf = (day: string) => (by === 'cycle' ? cycleOf(day) : day.slice(0, 7));
  const endOf = (month: string) => {
    if (by === 'cycle') return cycleRange(month).to;
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  };
  const anchor = counts.filter((c) => c.brand === brand && c.platform === platform).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!anchor) return [];
  const { days, exact } = netPerDay(tables, brand, platform);
  const out: FollowerTotal[] = [];
  const lastData = [...days.keys()].sort().at(-1) ?? '';
  for (const month of days.size ? months : months.filter((m) => m === periodOf(anchor.date))) {
    const end = endOf(month);
    // The count's own month ends on the count's day until the exports reach the month's end.
    const date = month === periodOf(anchor.date) && end > anchor.date && end > lastData ? anchor.date : end;
    let total = anchor.count;
    let missing = 0;
    // Forwards: add the days after the count up to `date`. Backwards: take away the days after `date` up to the count.
    const [from, to, sign] = date >= anchor.date ? [addDays(anchor.date, 1), date, 1] : [addDays(date, 1), anchor.date, -1];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const n = days.get(d);
      if (n === undefined) missing++;
      else total += sign * n;
    }
    if (missing > limit) continue;
    out.push({ date, total: Math.round(total), estimated: date === anchor.date ? anchor.approximate : !exact || missing > 0 || anchor.approximate });
  }
  return out;
}
