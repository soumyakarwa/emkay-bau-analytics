// What the analytics pages share in the browser: the post record every page is built from,
// colours, number formats and month labels. Nothing here reads the store, so the pages can work
// out their charts in the browser and switch views instantly.

export type PlatformName = 'LinkedIn' | 'Instagram' | 'X' | 'YouTube';
export const PLATFORMS: PlatformName[] = ['LinkedIn', 'Instagram', 'X', 'YouTube'];
export const PLAT_COLORS: Record<PlatformName, string> = { LinkedIn: '#242b7f', Instagram: '#b5541c', X: '#1d2329', YouTube: '#4f7a28' };
export const PLAT_LETTER: Record<PlatformName, string> = { LinkedIn: 'in', Instagram: 'IG', X: 'X', YouTube: 'YT' };
export const TASK_COLORS = ['#074974', '#ee8a22', '#5b8a2e', '#7a4f9a', '#8a8c8e'];
export const TASK_TEXT = ['#ffffff', '#1d2329', '#ffffff', '#ffffff', '#ffffff'];
export const TASK_TEXT_COLORS = ['#074974', '#a85a00', '#3f6a1e', '#5a3a73', '#4a5560'];
export const NO_FORMAT = 'Format not given';
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One post's figures on one platform. Rates are percentages. */
export interface VFig {
  impr: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  follows: number | null;
  visits: number | null;
  /** YouTube: average share of the video watched, 0–100. */
  watched: number | null;
  watchHours: number | null;
  rate: number | null;
  typical: number | null;
  typicalBasis: 'format' | 'platform' | null;
  result: number | null;
  settled: boolean;
}

/** A post as the pages see it: one calendar post (all its platforms), or one platform post not in the calendar. */
export interface VPost {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM */
  month: string;
  day: number;
  /** 0 = Sunday */
  dow: number;
  task: string | null;
  pillar: string | null;
  peg: string | null;
  format: string;
  series: string | null;
  /** Episode number within its series, by date. */
  ep: number | null;
  status: 'published' | 'dropped' | 'not-yet';
  bau: boolean;
  inCal: boolean;
  platforms: PlatformName[];
  links: Partial<Record<PlatformName, string>>;
  fig: Partial<Record<PlatformName, VFig>>;
  /** Overall result (median of its settled platforms), null until settled or without figures. */
  ratio: number | null;
  /** Result on each platform, once settled. */
  pr: Partial<Record<PlatformName, number>>;
  /** Has figures, but some are less than a week old. */
  settling: boolean;
  /** Impressions (views on YouTube) on all platforms. */
  impr: number;
  /** Interaction rate on all platforms, %. */
  rateAll: number | null;
  /** Comments, shares and saves per 1,000 impressions. */
  deep: number | null;
  /** Clicks per 1,000 impressions, on platforms that count clicks. */
  action: number | null;
  /** Shares and reposts per 1,000 impressions. */
  spread: number | null;
  /** Hour of day it went out, on platforms whose export gives the time. */
  hours: Partial<Record<PlatformName, number>>;
}

export function median(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, x) => s + (typeof x === 'number' ? x : 0), 0);
export const fx = (v: number | null | undefined) => (v === null || v === undefined ? '–' : v.toFixed(1) + '×');
export const plural = (n: number, word = 'post') => `${n} ${word}${n === 1 ? '' : 's'}`;
export const pct = (n: number, of: number) => Math.round((n / (of || 1)) * 100);
export const n0 = (v: number | null | undefined) => (v === null || v === undefined ? '–' : Math.round(v).toLocaleString('en-IN'));
/** 1,234 → 1.2k; 123,456 → 1.2L (lakh), as the team reads numbers. */
export const kfmt = (v: number | null | undefined) =>
  v === null || v === undefined ? '–' : Math.abs(v) >= 100000 ? (v / 100000).toFixed(1) + 'L' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + 'k' : String(Math.round(v));
export const signed = (v: number, f: (x: number) => string = n0) => (v >= 0 ? '+' : '−') + f(Math.abs(v));

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Labels for a YYYY-MM month: "Sep", "Sep 26", "September 2026". */
export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  const name = MONTH_NAMES[m - 1];
  return { short: name.slice(0, 3), yshort: `${name.slice(0, 3)} ${String(y).slice(2)}`, full: `${name} ${y}`, name };
}
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 240; m = addMonths(m, 1)) out.push(m);
  return out;
}
/** Is the month over by `asOf` (YYYY-MM-DD)? */
export function monthDone(month: string, asOf: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) <= asOf;
}

/** A row of toggle buttons. */
export function segs<T extends string>(options: [T, string][], current: T, pick: (id: T) => void, base = 'seg') {
  return options.map(([id, name]) => ({ id, name, cls: id === current ? `${base} on` : base, pressed: id === current ? 'true' : 'false', pick: () => pick(id) }));
}

/** Makes a non-button element clickable with the keyboard too. */
export function act(fn: (() => void) | null | undefined) {
  if (!fn) return {};
  return {
    role: 'button',
    tabindex: 0,
    onclick: fn,
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
      }
    }
  };
}

/** Page state: any of the pages' toggles, kept in one object. */
export type State = Record<string, any>;
export type SetState = (patch: State) => void;
