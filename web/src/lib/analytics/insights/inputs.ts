// What each analytics page needs from the uploads, worked out on the server and sent to the
// browser, where the pages draw their charts. Everything here is plain data.

import { brandById, type BrandId } from '../../brands';
import { normalise } from '../../workbook/contract';
import { followerTotals, type FollowerCount } from '../followers';
import type { Platform } from '../rows';
import { cycleOf, isWholeCycle } from '../cycle';
import { dailySeries, type Tables } from '../tables';
import { isWholeMonth } from '../uploads';
import { PLATFORM_IDS, PLATFORM_NAMES, type BrandModel, type Figures, type Post } from './model';
import { AUDIENCES, FINANCIAL_SERVICES, GOALS, SENIORITY_GROUPS, SENIORITY_ORDER } from './settings';
import { addMonths, monthRange, type PlatformName, type VFig, type VPost } from './view';

const NAME = (p: Platform) => PLATFORM_NAMES[p] as PlatformName;
const FORMAT_ORDER = ['Video', 'Carousel', 'Static', 'Infographic', 'Text', 'Article'];
const per1000 = (n: number, impr: number) => (impr > 0 ? (n / impr) * 1000 : null);
const num = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);

function fig(f: Figures): VFig {
  return {
    impr: f.impressions, likes: f.reactions, comments: f.comments, shares: f.shares, saves: f.saves, clicks: f.clicks,
    follows: f.follows, visits: f.profileVisits, watched: f.viewedPct, watchHours: f.watchHours,
    rate: f.rate === null ? null : f.rate * 100, typical: f.typical === null ? null : f.typical * 100, typicalBasis: f.typicalBasis,
    result: f.result, settled: f.settled
  };
}

/** One post as the pages see it. Episode numbers are filled in by `withEpisodes`. */
export function toVPost(p: Post): VPost {
  const figs = p.figures;
  const impr = figs.reduce((s, f) => s + num(f.impressions), 0);
  const deepN = figs.reduce((s, f) => s + num(f.comments) + num(f.shares) + num(f.saves), 0);
  const spreadN = figs.reduce((s, f) => s + num(f.shares), 0);
  // LinkedIn counts every carousel swipe as a click, so carousels' clicks are left out.
  const clickFigs = figs.filter((f) => f.clicks !== null && f.impressions && !(f.platform === 'linkedin' && /carousel|document/i.test(f.format)));
  const hours: VPost['hours'] = {};
  for (const f of figs) if (f.time) hours[NAME(f.platform)] = Number(f.time.slice(0, 2));
  const platforms = [...new Set([...p.platforms, ...figs.map((f) => f.platform)])].sort((a, b) => PLATFORM_IDS.indexOf(a) - PLATFORM_IDS.indexOf(b));
  return {
    id: p.id, title: p.title, date: p.date, month: p.month, day: Number(p.date.slice(8, 10)), dow: p.dow,
    task: p.task, pillar: p.pillar, peg: p.peg, format: p.format, series: p.series, ep: null,
    status: p.status, bau: p.bau, inCal: p.inCalendar,
    platforms: platforms.map(NAME),
    links: Object.fromEntries(Object.entries({ ...p.links, ...Object.fromEntries(figs.map((f) => [f.platform, f.link])) }).map(([k, v]) => [NAME(k as Platform), v])),
    fig: Object.fromEntries(figs.map((f) => [NAME(f.platform), fig(f)])),
    ratio: p.result,
    pr: Object.fromEntries(figs.filter((f) => f.settled && f.result !== null).map((f) => [NAME(f.platform), f.result as number])),
    settling: figs.length > 0 && !p.settled,
    impr,
    rateAll: p.rate === null ? null : p.rate * 100,
    deep: figs.length ? per1000(deepN, impr) : null,
    action: clickFigs.length ? per1000(clickFigs.reduce((s, f) => s + num(f.clicks), 0), clickFigs.reduce((s, f) => s + num(f.impressions), 0)) : null,
    spread: figs.length ? per1000(spreadN, impr) : null,
    hours
  };
}

/** A post with only what the Growth and Audience pages' post lists show. */
export const slim = (p: VPost): VPost => ({ ...p, fig: p.fig.Instagram ? { Instagram: p.fig.Instagram } : {}, pr: {}, hours: {} });

/** Numbers each series' published episodes by date. */
function withEpisodes(posts: VPost[]): VPost[] {
  const bySeries = new Map<string, VPost[]>();
  for (const p of posts) if (p.series && p.status === 'published') bySeries.set(p.series, [...(bySeries.get(p.series) ?? []), p]);
  for (const eps of bySeries.values()) eps.sort((a, b) => a.date.localeCompare(b.date)).forEach((p, i) => (p.ep = i + 1));
  return posts;
}

const brandName = (b: BrandId) => brandById(b)?.name ?? b;
/** The cycle the figures run to: the newest export's, or today's. */
const nowMonth = (m: BrandModel, today: string) => cycleOf(m.asOf ?? today);
/** A daily figure added up per cycle (YYYY-MM → total), counting only days that have it. */
function monthlyTotals(t: Tables, brand: BrandId, platform: Platform, file: string, column: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const { date, value } of dailySeries(t, brand, platform, file, column)) {
    if (value === null) continue;
    out.set(cycleOf(date), (out.get(cycleOf(date)) ?? 0) + value);
  }
  return out;
}

// ---------- Framework ----------

export interface FwTask { name: string; target: number | null; pillars: { name: string; pegs: string[] }[] }
export interface FwInput {
  brand: BrandId;
  brandName: string;
  hasFramework: boolean;
  noFwText: string;
  /** BAU months, YYYY-MM, up to the export month. */
  months: string[];
  asOf: string;
  tasks: FwTask[];
  formats: string[];
  posts: VPost[];
}

export function frameworkInput(m: BrandModel, today: string): FwInput {
  const asOf = m.asOf ?? today;
  const end = nowMonth(m, today);
  const bauPosts = m.posts.filter((p) => p.bau);
  const start = m.bauStart ?? bauPosts.map((p) => p.month).sort()[0] ?? null;
  const tasks: FwTask[] = m.tasks.map((t) => {
    const mine = (code: string) => [normalise(t.code), normalise(t.name)].includes(normalise(code));
    const pillars: FwTask['pillars'] = [];
    for (const peg of m.framework.filter((g) => mine(g.commsTask))) {
      let pl = pillars.find((x) => x.name === peg.pillar);
      if (!pl) pillars.push((pl = { name: peg.pillar, pegs: [] }));
      if (!pl.pegs.includes(peg.peg)) pl.pegs.push(peg.peg);
    }
    // Pegs used in posts but no longer in the framework still show.
    for (const p of bauPosts.filter((p) => p.task === t.name && p.pillar && p.peg)) {
      let pl = pillars.find((x) => x.name === p.pillar);
      if (!pl) pillars.push((pl = { name: p.pillar as string, pegs: [] }));
      if (!pl.pegs.includes(p.peg as string)) pl.pegs.push(p.peg as string);
    }
    return { name: t.name, target: t.target === null ? null : Math.round(t.target * 100), pillars };
  });
  const hasFramework = !!start && tasks.length > 0 && start <= end;
  const months = hasFramework ? monthRange(start as string, end) : [];
  const posts = withEpisodes(bauPosts.filter((p) => months.includes(p.month)).map(toVPost));
  const used = new Set(posts.map((p) => p.format));
  const formats = [...FORMAT_ORDER.filter((f) => used.has(f)), ...[...used].filter((f) => !FORMAT_ORDER.includes(f)).sort()];
  const startName = start ? new Date(`${start}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
  const noFwText = !m.hasCalendar
    ? `${brandName(m.brand)} has no calendar uploaded yet, so there is no framework to show.`
    : !tasks.length
      ? `${brandName(m.brand)}’s calendar has no BAU comms tasks yet${startName ? `, and its BAU starts in ${startName}` : ''}. This page fills in once it does.`
      : `${brandName(m.brand)}’s BAU starts in ${startName}, so this page fills in from ${startName?.split(' ')[0]}’s posts.`;
  return { brand: m.brand, brandName: brandName(m.brand), hasFramework, noFwText, months, asOf, tasks, formats: formats.length ? formats : FORMAT_ORDER, posts };
}

// ---------- Posts ----------

export interface PostsInput { brand: BrandId; brandName: string; asOf: string; months: string[]; formats: string[]; posts: VPost[] }

/** Every published post of the financial year so far (April on), in the calendar or not. */
export function postsInput(m: BrandModel, today: string): PostsInput {
  const asOf = m.asOf ?? today;
  const end = nowMonth(m, today);
  const fyStart = `${Number(end.slice(5, 7)) >= 4 ? end.slice(0, 4) : Number(end.slice(0, 4)) - 1}-04`;
  const posts = withEpisodes(m.posts.filter((p) => p.status === 'published' && p.figures.length && p.month >= fyStart && p.month <= end).map(toVPost));
  const first = posts.map((p) => p.month).sort()[0] ?? end;
  const used = new Set(posts.map((p) => p.format));
  const formats = [...FORMAT_ORDER.filter((f) => used.has(f)), ...[...used].filter((f) => !FORMAT_ORDER.includes(f)).sort()];
  return { brand: m.brand, brandName: brandName(m.brand), asOf, months: monthRange(first, end), formats, posts };
}

// ---------- Growth ----------

export interface PlatformSeries {
  platform: PlatformName;
  has: boolean;
  /** Net new followers per month (null: no figures). */
  gains: (number | null)[];
  /** LinkedIn: new followers from sponsored posts. */
  spons: (number | null)[];
  /** Followers at each month's end, worked out from the noted count. */
  total: (number | null)[];
  estimated: boolean;
  /** The latest noted count. */
  now: number | null;
  nowDate: string | null;
  org: (number | null)[];
  spo: (number | null)[];
  inter: (number | null)[];
  hours: (number | null)[] | null;
  notes: string[];
}
export interface Peer { name: string; followers: number | null; newFollowers: number | null; posts: number | null; engagements: number | null; own: boolean }
export interface GrowthInput {
  brand: BrandId;
  brandName: string;
  asOf: string;
  months: string[];
  series: PlatformSeries[];
  /** Platform posts that went out each month (a post on two platforms counts twice). */
  postsPerMonth: number[];
  posts: VPost[];
  peers: Peer[];
  peersPeriod: string | null;
  goals: Partial<Record<PlatformName, { target: number; by: string }>>;
}

const pick = (map: Map<string, number>, months: string[]) => months.map((mo) => (map.has(mo) ? (map.get(mo) as number) : null));
function addSeries(...xs: (number | null)[][]): (number | null)[] {
  return xs[0].map((_, i) => (xs.some((x) => x[i] !== null) ? xs.reduce((s, x) => s + num(x[i]), 0) : null));
}
/** Whole-cycle period totals (YouTube, Instagram overview): cycle → value. Other periods don't add up into cycles. */
function wholeMonths(t: Tables, brand: BrandId, platform: Platform, file: string, column: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of t.totals) {
    if (s.brand !== brand || s.platform !== platform || s.file !== file || !isWholeCycle(s.from, s.to)) continue;
    const v = s.values[column];
    if (typeof v === 'number') out.set(cycleOf(s.to), v);
  }
  return out;
}

export function growthInput(m: BrandModel, counts: FollowerCount[], today: string): GrowthInput {
  const t = m.tables;
  const b = m.brand;
  const asOf = m.asOf ?? today;
  const end = nowMonth(m, today);
  const months = monthRange(addMonths(end, -11), end);
  const mt = (platform: Platform, file: string, column: string) => pick(monthlyTotals(t, b, platform, file, column), months);
  const postSums = (platform: Platform, key: (f: Figures) => number | null) => {
    const map = new Map<string, number>();
    for (const p of m.posts) for (const f of p.figures) if (f.platform === platform) {
      const v = key(f);
      if (v !== null) map.set(cycleOf(f.created), (map.get(cycleOf(f.created)) ?? 0) + v);
    }
    return pick(map, months);
  };
  const nulls = () => months.map(() => null as number | null);

  const series: PlatformSeries[] = PLATFORM_IDS.map((platform) => {
    const notes: string[] = [];
    let gains = nulls(), spons = nulls(), org = nulls(), spo = nulls(), inter = nulls();
    let hours: (number | null)[] | null = null;
    if (platform === 'linkedin') {
      gains = mt('linkedin', 'followers', 'Total followers');
      spons = mt('linkedin', 'followers', 'Sponsored followers');
      org = mt('linkedin', 'content', 'Impressions (organic)');
      spo = mt('linkedin', 'content', 'Impressions (sponsored)');
      inter = addSeries(mt('linkedin', 'content', 'Reactions (total)'), mt('linkedin', 'content', 'Comments (total)'), mt('linkedin', 'content', 'Reposts (total)'));
      if (gains.some((g) => g !== null)) notes.push('LinkedIn exports new followers but not unfollows, so totals are estimates.');
    } else if (platform === 'x') {
      const nf = mt('x', 'overview', 'New follows'), uf = mt('x', 'overview', 'Unfollows');
      gains = nf.map((v, i) => (v === null ? null : v - num(uf[i])));
      org = mt('x', 'overview', 'Impressions');
      inter = addSeries(mt('x', 'overview', 'Likes'), mt('x', 'overview', 'Replies'), mt('x', 'overview', 'Reposts'), mt('x', 'overview', 'Bookmarks'), mt('x', 'overview', 'Shares'));
    } else if (platform === 'youtube') {
      gains = pick(wholeMonths(t, b, 'youtube', 'content', 'Subscribers'), months);
      // Views and interactions from each cycle's totals row; the daily file only has whichever
      // measure was on YouTube's chart when it was exported, so it is the fallback.
      const cyc = (col: string) => pick(wholeMonths(t, b, 'youtube', 'content', col), months);
      const dailyViews = mt('youtube', 'content', 'Views');
      org = cyc('Views').map((v, i) => v ?? dailyViews[i]);
      const dailyLikes = mt('youtube', 'content', 'Likes');
      const cycInter = addSeries(cyc('Likes'), cyc('Comments added'), cyc('Shares'));
      inter = cycInter.map((v, i) => v ?? dailyLikes[i]);
      hours = pick(wholeMonths(t, b, 'youtube', 'content', 'Watch time (hours)'), months);
      if (org.some((v) => v !== null)) notes.push('YouTube views, subscribers and watch hours come from exports covering one whole cycle (25th to 24th); interactions are likes, comments and shares.');
    } else {
      const ovViews = wholeMonths(t, b, 'instagram', 'overview', 'Views');
      gains = pick(wholeMonths(t, b, 'instagram', 'overview', 'New Followers'), months);
      const fromPosts = postSums('instagram', (f) => f.impressions);
      org = months.map((mo, i) => (ovViews.has(mo) ? (ovViews.get(mo) as number) : fromPosts[i]));
      inter = postSums('instagram', (f) => f.interactions);
      if (fromPosts.some((v) => v !== null)) notes.push('Instagram views and interactions are added up from its posts, by the month they went out.');
      if (!gains.some((g) => g !== null)) notes.push('Instagram’s new followers come from its overview export for one whole cycle (25th to 24th); none uploaded yet.');
    }
    const totals = followerTotals(t, counts, b, platform, months, 45, 'cycle');
    const total = months.map((mo) => totals.find((x) => cycleOf(x.date) === mo)?.total ?? null);
    const anchor = counts.filter((c) => c.brand === b && c.platform === platform).sort((a, c) => a.date.localeCompare(c.date)).at(-1) ?? null;
    if (!anchor) notes.push(`No follower count noted for ${PLATFORM_NAMES[platform]} yet: add one on the Upload page to see the total.`);
    const has = [gains, org, inter].some((s) => s.some((v) => v !== null)) || !!anchor;
    return {
      platform: NAME(platform), has, gains, spons, total, estimated: totals.some((x) => x.estimated) || platform === 'linkedin',
      now: anchor?.count ?? null, nowDate: anchor?.date ?? null, org, spo, inter, hours, notes
    };
  });

  const postsPerMonth = months.map((mo) => m.posts.reduce((s, p) => s + p.figures.filter((f) => cycleOf(f.created) === mo).length, 0));
  const posts = m.posts.filter((p) => p.figures.length && months.includes(p.month)).map(toVPost).map(slim);

  const bench = t.benchmark.filter((r) => r.brand === b);
  const latestTo = bench.map((r) => r.to).sort().at(-1) ?? null;
  const latest = bench.filter((r) => r.to === latestTo);
  const peers: Peer[] = latest.map((r) => ({ name: r.page, followers: r.totalFollowers, newFollowers: r.newFollowers, posts: r.posts, engagements: r.engagements, own: r.own }));
  const peersPeriod = latest.length ? `${latest[0].from} to ${latest[0].to}` : null;
  const goals = Object.fromEntries(Object.entries(GOALS[b] ?? {}).map(([k, v]) => [NAME(k as Platform), v]));
  return { brand: b, brandName: brandName(b), asOf, months, series, postsPerMonth, posts, peers, peersPeriod, goals };
}

// ---------- Audience ----------

export interface AudRow { label: string; value: number }
export interface AudSnapshot { from: string; to: string; dims: Record<string, AudRow[]> }
export interface AudienceInput {
  brand: BrandId;
  brandName: string;
  asOf: string;
  months: string[];
  rules: { name: string; dimension: string; labels: string; flags: string; rule: string; reliability: string }[];
  financialServices: { source: string; flags: string };
  seniorityGroups: { name: string; source: string; flags: string }[];
  seniorityOrder: string[];
  /** LinkedIn follower breakdowns, one per export day, oldest first. */
  followers: AudSnapshot[];
  /** LinkedIn page-visitor breakdowns, one per export period, oldest first. */
  visitors: AudSnapshot[];
  /** YouTube views by country, traffic source and content type, from the latest export. */
  youtube: AudSnapshot | null;
  /** LinkedIn new followers and unique page visitors per month. */
  followRate: { month: string; newFollowers: number | null; visitors: number | null }[];
  posts: VPost[];
}

function snapshots(t: Tables, b: BrandId, platform: Platform, of: 'followers' | 'visitors' | 'views'): AudSnapshot[] {
  const by = new Map<string, AudSnapshot>();
  for (const r of t.audience) {
    if (r.brand !== b || r.platform !== platform || r.of !== of) continue;
    const k = `${r.from}|${r.to}`;
    const s = by.get(k) ?? { from: r.from, to: r.to, dims: {} };
    by.set(k, s);
    (s.dims[r.dimension] ??= []).push({ label: r.label, value: r.value });
  }
  return [...by.values()].sort((a, c) => a.to.localeCompare(c.to) || c.from.localeCompare(a.from));
}

export function audienceInput(m: BrandModel, today: string): AudienceInput {
  const t = m.tables;
  const b = m.brand;
  const end = nowMonth(m, today);
  const months = monthRange(addMonths(end, -11), end);
  // One follower snapshot per day; visitors: the longest period ending on each day.
  const followers = snapshots(t, b, 'linkedin', 'followers').filter((s, i, all) => all.findIndex((x) => x.to === s.to) === i);
  const visitors = snapshots(t, b, 'linkedin', 'visitors').filter((s, i, all) => all.findIndex((x) => x.to === s.to) === i);
  const yt = snapshots(t, b, 'youtube', 'views');
  const ytMonth = yt.filter((s) => isWholeCycle(s.from, s.to)).at(-1) ?? yt.filter((s) => isWholeMonth(s.from, s.to)).at(-1) ?? yt.at(-1) ?? null;
  const nf = monthlyTotals(t, b, 'linkedin', 'followers', 'Total followers');
  const uv = monthlyTotals(t, b, 'linkedin', 'visitors', 'Total unique visitors (total)');
  const uvOverview = monthlyTotals(t, b, 'linkedin', 'visitors', 'Overview unique visitors (total)');
  return {
    brand: b, brandName: brandName(b), asOf: m.asOf ?? today, months,
    rules: (AUDIENCES[b] ?? []).map((r) => ({ name: r.name, dimension: r.dimension, labels: r.labels.source, flags: r.labels.flags, rule: r.rule, reliability: r.reliability })),
    financialServices: { source: FINANCIAL_SERVICES.source, flags: FINANCIAL_SERVICES.flags },
    seniorityGroups: SENIORITY_GROUPS.map((g) => ({ name: g.name, source: g.labels.source, flags: g.labels.flags })),
    seniorityOrder: SENIORITY_ORDER,
    followers, visitors, youtube: ytMonth,
    followRate: months.map((mo) => ({ month: mo, newFollowers: nf.get(mo) ?? null, visitors: uv.get(mo) ?? uvOverview.get(mo) ?? null })),
    posts: m.posts.filter((p) => p.figures.length && months.includes(p.month)).map(toVPost).map(slim)
  };
}
