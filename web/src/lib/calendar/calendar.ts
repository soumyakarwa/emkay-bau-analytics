// Calendar logic, free of any page code: the month grid, what a view shows, and its colours.

import { BRANDS, type BrandId } from '../brands';
import type { BrandYear, Dataset, DatasetMoment, DatasetPost } from '../dataset/dataset';
import { DROPPED, normalise } from '../workbook/contract';

export type View = 'all' | BrandId;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10" ± n months. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function isMonth(s: string | null): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** Weeks (Monday first) covering the month; days outside the month are null. */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(`${month}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Categorical colour slots, in fixed order (see app.css). Brands take slots 1–3 (the three that
 * stay distinct for colour-blind readers); a brand's BAU comms tasks take slots in sheet order;
 * tasks that do not count as BAU (Compliance) are neutral grey.
 */
export const SLOTS = 8;
export const NEUTRAL = 'neutral';

export interface LegendEntry {
  key: string;
  label: string;
  colour: string;
}

export function brandColour(brand: BrandId): string {
  return `series-${BRANDS.findIndex((b) => b.id === brand) + 1}`;
}

/** Colour per comms task code for one brand-year: BAU tasks in order, others neutral. */
export function taskColours(year: BrandYear): Map<string, string> {
  const map = new Map<string, string>();
  let slot = 0;
  for (const t of year.commsTasks) {
    map.set(t.code, t.countsAsBau && slot < SLOTS ? `series-${++slot}` : NEUTRAL);
  }
  return map;
}

export interface CalendarPost extends DatasetPost {
  colour: string;
  /** Short line under the title: comms task and peg (brand view) or brand (All of Emkay). */
  label: string;
}

export interface CalendarView {
  view: View;
  month: string;
  posts: CalendarPost[];
  moments: DatasetMoment[];
  legend: LegendEntry[];
  /** Dropped posts this month that are hidden. */
  hiddenDropped: number;
}

const isDropped = (p: DatasetPost) => !!p.status && normalise(p.status) === normalise(DROPPED);

export function calendarView(ds: Dataset, view: View, month: string, showDropped = false): CalendarView {
  const inView = (p: { brand: BrandId; date: string }) => (view === 'all' || p.brand === view) && p.date.startsWith(month);
  const all = ds.posts.filter(inView);
  const yearOf = (p: DatasetPost) => ds.brandYears.find((y) => y.brand === p.brand && y.fy === p.fy);

  let legend: LegendEntry[];
  let colourOf: (p: DatasetPost) => string;
  if (view === 'all') {
    const present = BRANDS.filter((b) => ds.brandYears.some((y) => y.brand === b.id));
    legend = present.map((b) => ({ key: b.id, label: b.name, colour: brandColour(b.id) }));
    colourOf = (p) => brandColour(p.brand);
  } else {
    // A month can straddle two financial years only in theory (FYs end in March), so take the posts' year.
    const year = ds.brandYears.filter((y) => y.brand === view).find((y) => all.some((p) => p.fy === y.fy))
      ?? ds.brandYears.filter((y) => y.brand === view).at(-1);
    const colours = year ? taskColours(year) : new Map<string, string>();
    legend = (year?.commsTasks ?? []).map((t) => ({
      key: t.code,
      label: `${t.code} ${t.name}${t.countsAsBau ? '' : ' (not BAU)'}`,
      colour: colours.get(t.code) ?? NEUTRAL
    }));
    if (all.some((p) => !p.commsTask)) legend.push({ key: '-', label: 'No valid peg', colour: NEUTRAL });
    colourOf = (p) => (p.commsTask ? (taskColours(yearOf(p)!).get(p.commsTask) ?? NEUTRAL) : NEUTRAL);
  }

  const brandShort = (id: BrandId) => BRANDS.find((b) => b.id === id)!.short;
  const posts = all
    .filter((p) => showDropped || !isDropped(p))
    .map((p) => ({
      ...p,
      colour: colourOf(p),
      label: view === 'all'
        ? [brandShort(p.brand), p.commsTask].filter(Boolean).join(' · ')
        : [p.commsTask, p.peg].filter(Boolean).join(' · ') || 'No valid peg'
    }));
  return {
    view,
    month,
    posts,
    moments: ds.moments.filter(inView),
    legend,
    hiddenDropped: showDropped ? 0 : all.filter(isDropped).length
  };
}
