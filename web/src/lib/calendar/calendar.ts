// Calendar logic, free of any page code: the month grid, what a view shows, and its colours.

import { BRANDS, type BrandId } from '../brands';
import type { BrandYear, Dataset, DatasetMoment, DatasetPost } from '../dataset/dataset';
import { DROPPED, PLATFORMS, normalise, type Platform } from '../workbook/contract';

export type View = 'all' | BrandId;

/** Where a post is, grouping the workbook's statuses. */
export type Stage = 'published' | 'in-progress' | 'planned' | 'dropped';
export const STAGES: { id: Exclude<Stage, 'dropped'>; label: string }[] = [
  { id: 'published', label: 'Published' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'planned', label: 'Planned' }
];

export function stageOf(status: string | null): Stage {
  const s = normalise(status ?? '');
  if (s === 'published') return 'published';
  if (s === normalise(DROPPED)) return 'dropped';
  if (s.includes('progress') || s.startsWith('ready')) return 'in-progress';
  return 'planned'; // Idea, Planned, or no status yet
}

export function isStage(s: string | null): s is Exclude<Stage, 'dropped'> {
  return STAGES.some((x) => x.id === s);
}

export function platformById(id: string | null): Platform | undefined {
  return PLATFORMS.find((p) => p.toLowerCase() === id?.toLowerCase());
}

export interface Filters {
  /** Only posts at this stage. */
  stage?: Exclude<Stage, 'dropped'>;
  /** Only posts going out on this platform (planned or live). */
  platform?: Platform;
  /** Only posts with problems to fix in the workbook. */
  toFix?: boolean;
  /** Include Dropped posts. */
  showDropped?: boolean;
}

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
 * Colours follow the Emkay guidebook and were checked as sets for being told apart (including
 * with colour blindness) with the data-viz palette validator:
 * - All of Emkay: each brand's colour. Global uses Growth Orange because Trust Teal and Wealth
 *   Indigo are too alike side by side.
 * - One brand: its BAU comms tasks in sheet order take the guidebook's chart order, with the
 *   division colour first: division colour, Growth Orange, grey, amber. Amber is fourth because
 *   it is too close to orange to sit next to it. Tasks that are not BAU (Compliance) are neutral.
 * The names are CSS custom properties defined in app.css as --mark-<name>.
 */
export const NEUTRAL = 'not-bau';
const TASK_ORDER = ['brand', 'orange', 'grey', 'amber'] as const;

export interface LegendEntry {
  key: string;
  label: string;
  colour: string;
}

export function brandColour(brand: BrandId): string {
  return brand;
}

/** Colour per comms task code for one brand-year: BAU tasks in order, others neutral. */
export function taskColours(year: BrandYear): Map<string, string> {
  const map = new Map<string, string>();
  let slot = 0;
  for (const t of year.commsTasks) {
    const c = t.countsAsBau ? TASK_ORDER[slot++] : undefined;
    map.set(t.code, !c ? NEUTRAL : c === 'brand' ? year.brand : c);
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
  /** Posts this month (brand view, not Dropped) at each stage and on each platform, before those filters. */
  stageCounts: Record<Exclude<Stage, 'dropped'>, number>;
  platformCounts: Record<Platform, number>;
  /** Posts with problems to fix, given the stage and platform filters. */
  toFixCount: number;
}

const isDropped = (p: DatasetPost) => !!p.status && normalise(p.status) === normalise(DROPPED);

export function calendarView(ds: Dataset, view: View, month: string, filters: Filters = {}): CalendarView {
  const { stage, platform, toFix = false, showDropped = false } = filters;
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
  const live = all.filter((p) => !isDropped(p));
  const onPlatform = (p: DatasetPost, pl: Platform) => p.platforms.some((x) => x.platform === pl);
  const hasProblems = (p: DatasetPost) => p.problems.length > 0;
  const stageOk = (p: DatasetPost) => !stage || stageOf(p.status) === stage;
  const platformOk = (p: DatasetPost) => !platform || onPlatform(p, platform);
  const fixOk = (p: DatasetPost) => !toFix || hasProblems(p);
  const stageCounts = Object.fromEntries(
    STAGES.map((s) => [s.id, live.filter((p) => stageOf(p.status) === s.id && platformOk(p) && fixOk(p)).length])
  ) as CalendarView['stageCounts'];
  const platformCounts = Object.fromEntries(
    PLATFORMS.map((pl) => [pl, live.filter((p) => onPlatform(p, pl) && stageOk(p) && fixOk(p)).length])
  ) as CalendarView['platformCounts'];
  const toFixCount = live.filter((p) => hasProblems(p) && stageOk(p) && platformOk(p)).length;
  const posts = all
    .filter((p) => (showDropped && !stage) || !isDropped(p))
    .filter((p) => stageOk(p) && platformOk(p) && fixOk(p))
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
    hiddenDropped: showDropped || stage ? 0 : all.filter((p) => isDropped(p) && platformOk(p) && fixOk(p)).length,
    stageCounts,
    platformCounts,
    toFixCount
  };
}
