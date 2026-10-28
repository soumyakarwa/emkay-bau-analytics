// One brand's posts with their figures on every platform, laid over the calendar. This is what the
// analytics pages are built from.
//
// A calendar post is matched to each platform's post by the post ID in its link on that platform.
// Platform posts that no calendar post links to are kept too ("not in the calendar"): they count
// towards growth and the Posts page, but not towards the framework.
//
// Each platform post gets a result: its interaction rate ÷ the typical interaction rate for its
// format on that platform (the median of the brand's posts in that format there over the last
// TYPICAL_MONTHS months). 1.0× is a typical post. A calendar post's result is the median of its
// platforms' results.

import type { BrandId } from '../../brands';
import type { Dataset, DatasetPost } from '../../dataset/dataset';
import { normalise, DROPPED, PUBLISHED } from '../../workbook/contract';
import type { CommsTask, Peg } from '../../workbook/types';
import { POST_KEY } from '../platforms';
import type { Platform } from '../rows';
import { latestPosts, type PostSnapshot, type Tables } from '../tables';
import { SETTLE_DAYS, TYPICAL_MIN_POSTS, TYPICAL_MONTHS } from './settings';

export const PLATFORM_IDS: Platform[] = ['linkedin', 'instagram', 'x', 'youtube'];
export const PLATFORM_NAMES: Record<Platform, string> = { linkedin: 'LinkedIn', instagram: 'Instagram', x: 'X', youtube: 'YouTube' };
const FROM_CALENDAR: Record<string, Platform> = { LinkedIn: 'linkedin', Instagram: 'instagram', X: 'x', YouTube: 'youtube' };
export { NO_FORMAT } from './view';
import { NO_FORMAT } from './view';

/** A post's figures on one platform. */
export interface Figures {
  platform: Platform;
  postId: string;
  link: string;
  /** YYYY-MM-DD */
  created: string;
  /** HH:MM, when the export gives the time (Instagram). */
  time: string | null;
  asOf: string;
  /** Impressions; on YouTube, views (its "impressions" are thumbnail impressions). */
  impressions: number | null;
  reach: number | null;
  reactions: number | null;
  comments: number | null;
  /** Shares and reposts together. */
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  follows: number | null;
  watchHours: number | null;
  /** YouTube: the average share of the video watched, 0–100. */
  viewedPct: number | null;
  /** X: profile visits from the post. */
  profileVisits: number | null;
  /** Likes, comments, shares, reposts and saves. */
  interactions: number;
  /** interactions ÷ impressions, or null without impressions. */
  rate: number | null;
  /** The typical rate it is compared with, and what it was taken over. */
  typical: number | null;
  typicalBasis: 'format' | 'platform' | null;
  /** rate ÷ typical. */
  result: number | null;
  /** Old enough on the export day for its figures to have settled. */
  settled: boolean;
  format: string;
}

export type Status = 'published' | 'dropped' | 'not-yet';

export interface Post {
  /** The calendar key, or "<platform>:<postId>" for posts not in the calendar. */
  id: string;
  brand: BrandId;
  inCalendar: boolean;
  title: string;
  /** YYYY-MM-DD: the calendar's date, else the platform's. */
  date: string;
  month: string;
  /** 0 = Sunday. */
  dow: number;
  /** The comms task's name, pillar and peg (null outside the calendar or without a peg). */
  task: string | null;
  taskCode: string | null;
  pillar: string | null;
  peg: string | null;
  format: string;
  series: string | null;
  status: Status;
  /** Counts in the BAU framework: a peg in a BAU comms task, after the BAU start. */
  bau: boolean;
  /** Platforms the calendar planned it for (or the one it was found on). */
  platforms: Platform[];
  /** The post's link on each platform, where the calendar or the export has one. */
  links: Partial<Record<Platform, string>>;
  figures: Figures[];
  /** Median of its settled platforms' results. */
  result: number | null;
  settled: boolean;
  impressions: number | null;
  interactions: number;
  rate: number | null;
}

export interface BrandModel {
  brand: BrandId;
  /** The newest export day across platforms, or null with no exports. */
  asOf: string | null;
  bauStart: string | null;
  /** BAU comms tasks, in the workbook's order. */
  tasks: CommsTask[];
  framework: Peg[];
  posts: Post[];
  hasCalendar: boolean;
  tables: Tables;
}

const DAY = 86400000;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
export const dayOfWeek = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** A format from the platform's own post type, for posts not in the calendar. */
function formatOf(p: PostSnapshot): string {
  const t = (p.contentType ?? '').toLowerCase();
  if (p.platform === 'youtube' || /video|reel/.test(t)) return 'Video';
  if (/carousel|document/.test(t)) return 'Carousel';
  if (/article/.test(t)) return 'Article';
  if (/image|photo/.test(t)) return 'Static';
  return NO_FORMAT;
}

const n = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);

function figuresOf(p: PostSnapshot, format: string): Figures {
  const impressions = p.platform === 'youtube' ? p.views : (p.impressions ?? p.views ?? p.reach);
  const interactions = n(p.reactions) + n(p.comments) + n(p.reposts) + n(p.shares) + n(p.saves);
  const created = p.created ?? p.asOf;
  const timeCell = p.columns['Publish time'];
  const time = typeof timeCell === 'string' ? (/T?(\d{2}:\d{2})/.exec(timeCell)?.[1] ?? null) : null;
  const viewed = p.columns['Average percentage viewed (%)'];
  const visits = p.columns['Profile visits'];
  return {
    platform: p.platform, postId: p.postId, link: p.link, created, time, asOf: p.asOf,
    impressions, reach: p.reach, reactions: p.reactions, comments: p.comments,
    shares: p.shares === null && p.reposts === null ? null : n(p.shares) + n(p.reposts),
    saves: p.saves, clicks: p.clicks, follows: p.follows, watchHours: p.watchHours,
    viewedPct: typeof viewed === 'number' ? viewed : null, profileVisits: typeof visits === 'number' ? visits : null,
    interactions, rate: impressions ? interactions / impressions : null,
    typical: null, typicalBasis: null, result: null,
    settled: daysBetween(created, p.asOf) >= SETTLE_DAYS, format
  };
}

/** Typical rates and results, per platform: the same format over the last TYPICAL_MONTHS months. */
function scoreFigures(all: Figures[]): void {
  for (const platform of PLATFORM_IDS) {
    const mine = all.filter((f) => f.platform === platform);
    const asOf = mine.map((f) => f.asOf).sort().at(-1);
    if (!asOf) continue;
    const since = `${addMonths(asOf.slice(0, 7), -TYPICAL_MONTHS)}${asOf.slice(7)}`;
    const pool = mine.filter((f) => f.settled && f.rate !== null && f.created >= since);
    const platformTypical = median(pool.map((f) => f.rate as number));
    const byFormat = new Map<string, number | null>();
    for (const f of mine) {
      if (!byFormat.has(f.format)) {
        const same = pool.filter((x) => x.format === f.format);
        byFormat.set(f.format, f.format !== NO_FORMAT && same.length >= TYPICAL_MIN_POSTS ? median(same.map((x) => x.rate as number)) : null);
      }
      const typ = byFormat.get(f.format) ?? null;
      f.typical = typ ?? platformTypical;
      f.typicalBasis = typ !== null ? 'format' : platformTypical !== null ? 'platform' : null;
      f.result = f.rate !== null && f.typical ? f.rate / f.typical : null;
    }
  }
}

function summarise(post: Omit<Post, 'result' | 'settled' | 'impressions' | 'interactions' | 'rate'>): Post {
  const settledFigs = post.figures.filter((f) => f.settled && f.result !== null);
  const impressions = post.figures.reduce((s, f) => s + n(f.impressions), 0);
  const interactions = post.figures.reduce((s, f) => s + f.interactions, 0);
  return {
    ...post,
    result: median(settledFigs.map((f) => f.result as number)),
    settled: post.figures.length > 0 && post.figures.every((f) => f.settled),
    impressions: post.figures.length ? impressions : null,
    interactions,
    rate: impressions ? interactions / impressions : null
  };
}

/** One brand's posts and figures. */
export function buildModel(ds: Dataset, tables: Tables, brand: BrandId): BrandModel {
  const years = ds.brandYears.filter((y) => y.brand === brand).sort((a, b) => a.fy - b.fy);
  const latestYear = years.at(-1);
  const tasks = (latestYear?.commsTasks ?? []).filter((t) => t.countsAsBau);
  const framework = latestYear?.framework ?? [];
  const taskName = new Map<string, string>();
  for (const y of years) for (const t of y.commsTasks) taskName.set(normalise(t.code), t.name);
  const bauCodes = new Set(years.flatMap((y) => y.commsTasks.filter((t) => t.countsAsBau).map((t) => normalise(t.code))));
  const bauStart = years.map((y) => y.bauStart).filter((s): s is string => !!s).sort()[0] ?? null;

  // Each platform's posts: organic figures only.
  const platformPosts = latestPosts(tables.posts.filter((p) => p.brand === brand && !p.sponsored));
  const byKey = new Map(platformPosts.map((p) => [`${p.platform}|${p.postId}`, p]));
  const used = new Set<string>();

  const posts: Omit<Post, 'result' | 'settled' | 'impressions' | 'interactions' | 'rate'>[] = [];
  const allFigures: Figures[] = [];
  for (const c of ds.posts.filter((p) => p.brand === brand)) {
    const format = c.format ?? NO_FORMAT;
    const figures: Figures[] = [];
    for (const entry of c.platforms) {
      const platform = FROM_CALENDAR[entry.platform];
      if (!platform || !entry.url) continue;
      const key = POST_KEY[platform](entry.url);
      const snap = key ? byKey.get(`${platform}|${key}`) : undefined;
      if (!snap || used.has(`${platform}|${key}`)) continue;
      used.add(`${platform}|${key}`);
      figures.push(figuresOf(snap, format));
    }
    allFigures.push(...figures);
    posts.push(calendarPost(c, figures, format, taskName, bauCodes));
  }
  for (const p of platformPosts) {
    if (used.has(`${p.platform}|${p.postId}`)) continue;
    const f = figuresOf(p, formatOf(p));
    allFigures.push(f);
    posts.push({
      id: `${p.platform}:${p.postId}`, brand, inCalendar: false, title: p.title || '(no title)', date: f.created, month: f.created.slice(0, 7),
      dow: dayOfWeek(f.created), task: null, taskCode: null, pillar: null, peg: null, format: f.format, series: null,
      status: 'published', bau: false, platforms: [p.platform], links: { [p.platform]: p.link }, figures: [f]
    });
  }
  scoreFigures(allFigures);
  const asOf = platformPosts.map((p) => p.asOf).concat([...(tables.daily.get(brand)?.values() ?? [])].flatMap((m) => [...m.keys()])).sort().at(-1) ?? null;
  return {
    brand, asOf, bauStart, tasks, framework, hasCalendar: years.length > 0, tables,
    posts: posts.map(summarise).sort((a, b) => b.date.localeCompare(a.date))
  };
}

function calendarPost(c: DatasetPost, figures: Figures[], format: string, taskName: Map<string, string>, bauCodes: Set<string>) {
  const code = c.commsTask ? normalise(c.commsTask) : null;
  const status: Status = c.status && normalise(c.status) === normalise(DROPPED) ? 'dropped'
    : figures.length || (c.status && normalise(c.status) === normalise(PUBLISHED)) ? 'published' : 'not-yet';
  return {
    id: c.key, brand: c.brand, inCalendar: true, title: c.title ?? '(no title)', date: c.date, month: c.month, dow: dayOfWeek(c.date),
    task: code ? taskName.get(code) ?? c.commsTask : null, taskCode: c.commsTask, pillar: c.pillar, peg: c.peg, format, series: c.series,
    status, bau: !!c.peg && !!code && bauCodes.has(code) && !!c.countsAsBau && !c.beforeBauStart,
    platforms: c.platforms.map((e) => FROM_CALENDAR[e.platform]).filter((x): x is Platform => !!x),
    links: Object.fromEntries(c.platforms.filter((e) => FROM_CALENDAR[e.platform] && e.url).map((e) => [FROM_CALENDAR[e.platform], e.url as string])),
    figures
  };
}
