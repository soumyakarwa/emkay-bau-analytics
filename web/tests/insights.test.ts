// The analytics pages' calculations, on small made-up data: matching posts to the calendar and
// scoring them, the Framework, Growth and Audience pages, and the Overview's flags.

import { describe, expect, it } from 'vitest';
import type { Dataset } from '../src/lib/dataset/dataset';
import { audienceView } from '../src/lib/analytics/insights/audience';
import { frameworkView, fwMonths } from '../src/lib/analytics/insights/framework';
import { growthView } from '../src/lib/analytics/insights/growth';
import { frameworkInput, postsInput, toVPost, type AudienceInput, type FwInput, type GrowthInput } from '../src/lib/analytics/insights/inputs';
import { buildModel } from '../src/lib/analytics/insights/model';
import { overviewView } from '../src/lib/analytics/insights/overview';
import { postsView } from '../src/lib/analytics/insights/posts';
import { median, type VPost } from '../src/lib/analytics/insights/view';
import type { PostSnapshot, Tables } from '../src/lib/analytics/tables';
import { NO_MEASURES } from '../src/lib/analytics/rows';

const noop = () => {};
const li = (n: number) => `https://www.linkedin.com/feed/update/urn:li:activity:74000000000000000${String(n).padStart(2, '0')}`;

function snap(n: number, created: string, impressions: number, reactions: number, asOf = '2026-10-15', extra: Partial<PostSnapshot> = {}): PostSnapshot {
  return {
    ...NO_MEASURES, impressions, reactions, comments: 0, reposts: 0, clicks: 10,
    postId: `activity:74000000000000000${String(n).padStart(2, '0')}`, link: li(n), title: `Post ${n}`, created, sponsored: false,
    campaign: null, campaignId: null, contentType: null, account: null, columns: {},
    brand: 'im', platform: 'linkedin', from: '2025-10-15', to: asOf, asOf, figures: 'lifetime', uploadId: 'u1', ...extra
  };
}

function dataset(): Dataset {
  const post = (n: number, date: string, peg: string, pillar: string, task: string, status = 'Published', format = 'Carousel') => ({
    id: `Oct!${n}`, key: `im:2027:Oct!${n}`, brand: 'im', fy: 2027, date, month: date.slice(0, 7), title: `Calendar ${n}`, details: null,
    peg, pillar, commsTask: task, countsAsBau: true, beforeBauStart: false, series: null, format, owner: null, status,
    platforms: status === 'Published' ? [{ platform: 'LinkedIn', state: 'published', url: li(n) }] : [{ platform: 'LinkedIn', state: 'planned', url: null }],
    copyLink: null, longForm: null, referenceLink: null, moment: null, source: { sheet: 'Oct', row: n }, problems: []
  });
  return {
    brandYears: [{
      brand: 'im', fy: 2027, uploadId: 'c1', uploadedAt: '2026-10-01', fileName: 'x.xlsx', bauStart: '2026-08',
      commsTasks: [
        { code: 'TL', name: 'Thought leadership', countsAsBau: true, target: 0.5, active: true },
        { code: 'BB', name: 'Brand building', countsAsBau: true, target: 0.5, active: true }
      ],
      framework: [
        { peg: 'Myths', pillar: 'Opinions', commsTask: 'TL', active: true },
        { peg: 'Data', pillar: 'Opinions', commsTask: 'TL', active: true },
        { peg: 'People', pillar: 'Culture', commsTask: 'BB', active: true }
      ],
      summary: {} as never
    }],
    posts: [
      post(1, '2026-09-02', 'Myths', 'Opinions', 'TL'),
      post(2, '2026-09-09', 'Myths', 'Opinions', 'TL'),
      post(3, '2026-09-16', 'Data', 'Opinions', 'TL'),
      post(4, '2026-09-23', 'People', 'Culture', 'BB'),
      post(5, '2026-09-20', 'Data', 'Opinions', 'TL', 'Dropped'),
      post(6, '2026-10-20', 'People', 'Culture', 'BB', 'Planned')
    ],
    moments: []
  } as unknown as Dataset;
}

function tables(): Tables {
  return {
    posts: [
      snap(1, '2026-09-02', 1000, 40), snap(2, '2026-09-09', 1000, 20), snap(3, '2026-09-16', 1000, 20), snap(4, '2026-09-23', 1000, 10),
      snap(9, '2026-10-12', 500, 5) // not in the calendar, and too new to have settled
    ],
    daily: new Map(), audience: [], benchmark: [], totals: []
  };
}

describe('model', () => {
  const m = buildModel(dataset(), tables(), 'im');

  it('matches calendar posts to platform posts by their links, and keeps the rest', () => {
    const cal = m.posts.filter((p) => p.inCalendar);
    expect(cal).toHaveLength(6);
    expect(cal.find((p) => p.id.endsWith('!1'))?.figures).toHaveLength(1);
    expect(m.posts.filter((p) => !p.inCalendar).map((p) => p.title)).toEqual(['Post 9']);
  });

  it('marks posts published, dropped or not yet published', () => {
    const status = Object.fromEntries(m.posts.filter((p) => p.inCalendar).map((p) => [p.id.split('!')[1], p.status]));
    expect(status).toEqual({ 1: 'published', 2: 'published', 3: 'published', 4: 'published', 5: 'dropped', 6: 'not-yet' });
  });

  it('scores each post against the typical rate of its format on its platform', () => {
    // Rates 4%, 2%, 2%, 1% for the settled carousels: typical is 2%.
    const r = Object.fromEntries(m.posts.filter((p) => p.inCalendar && p.result !== null).map((p) => [p.id.split('!')[1], p.result]));
    expect(r).toEqual({ 1: 2, 2: 1, 3: 1, 4: 0.5 });
    const late = m.posts.find((p) => p.title === 'Post 9');
    expect(late?.settled).toBe(false);
    expect(late?.result).toBeNull();
  });

  it('counts only BAU posts in the framework', () => {
    expect(m.tasks.map((t) => t.name)).toEqual(['Thought leadership', 'Brand building']);
    expect(m.posts.filter((p) => p.bau)).toHaveLength(6);
  });
});

describe('framework page', () => {
  const m = buildModel(dataset(), tables(), 'im');
  const input = frameworkInput(m, '2026-10-28');
  const sep = input.months.indexOf('2026-09');

  it('runs from the BAU start to the latest export', () => {
    expect(input.months).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(input.tasks[0]).toEqual({ name: 'Thought leadership', target: 50, pillars: [{ name: 'Opinions', pegs: ['Myths', 'Data'] }] });
  });

  it('measures the split against targets (A3) and the plan (A7)', () => {
    const V = frameworkView(input, { fwPeriod: 'm' + sep, fwBrand: 'im' }, noop);
    expect(V.a3.map((t: any) => [t.name, t.ytd, t.verdict])).toEqual([['Thought leadership', 75, '25 pts over'], ['Brand building', 25, '25 pts under']]);
    const tl = V.a7.find((r: any) => r.name === 'Thought leadership');
    expect([tl.planned, tl.pub, tl.dropped]).toEqual([4, 3, 1]);
  });

  it('gives each part the median result of its posts (B1)', () => {
    const V = frameworkView(input, { fwTab: 'B', fwPeriod: 'm' + sep, fwBrand: 'im' }, noop);
    expect(V.b1.map((r: any) => [r.name, r.val, r.n])).toEqual([['Thought leadership', '1.0×', 3], ['Brand building', '0.5×', 1]]);
  });

  it('opens the posts behind a figure', () => {
    let state: any = {};
    const V = frameworkView(input, { fwPeriod: 'm' + sep, fwBrand: 'im' }, (p) => (state = { ...state, ...p }));
    V.a1Cols[sep].segs[0].open();
    expect(state.drawer.list.map((p: VPost) => p.title).sort()).toEqual(['Calendar 1', 'Calendar 2', 'Calendar 3']);
    const W = frameworkView(input, { ...state, fwPeriod: 'm' + sep, fwBrand: 'im' }, noop);
    expect(W.drawerOpen).toBe(true);
    expect(W.drawer.rows).toHaveLength(3);
  });

  it('shows why there is no framework yet', () => {
    const none = frameworkView({ ...input, hasFramework: false, noFwText: 'Not yet.' }, {}, noop);
    expect(none.hasFramework).toBe(false);
    expect(none.noFwText).toBe('Not yet.');
  });

  it('names last quarter as the latest quarter that has ended', () => {
    expect(fwMonths(['2026-08', '2026-09', '2026-10'], '2026-10-15').lastQText).toBe('Jul–Sep');
  });
});

describe('posts page', () => {
  it('ranks settled posts and keeps new ones apart', () => {
    const m = buildModel(dataset(), tables(), 'im');
    const input = postsInput(m, '2026-10-28');
    const V = postsView(input, { pPeriod: 'ytd', pBrand: 'im' }, noop);
    expect(V.best.map((r: any) => r.title)[0]).toBe('Calendar 1');
    expect(V.settlingRows.map((r: any) => r.title)).toEqual(['Post 9']);
  });
});

describe('growth page', () => {
  const months = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const none = months.map(() => null);
  const input: GrowthInput = {
    brand: 'im', brandName: 'IM', asOf: '2026-10-15', months,
    series: [
      { platform: 'LinkedIn', has: true, gains: [10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 40, 5], spons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0], total: none, estimated: true, now: 500, nowDate: '2026-10-15', org: months.map(() => 1000), spo: none, inter: months.map(() => 50), hours: null, notes: [] },
      { platform: 'Instagram', has: false, gains: none, spons: none, total: none, estimated: false, now: null, nowDate: null, org: none, spo: none, inter: none, hours: null, notes: [] }
    ],
    postsPerMonth: months.map(() => 10), posts: [], peers: [], peersPeriod: null, goals: { LinkedIn: { target: 1000, by: '2027-03' } }
  };

  it('compares the latest complete month with the one before', () => {
    const V = growthView(input, {}, noop);
    expect(V.curName).toBe('September');
    expect(V.tiles[1]).toMatchObject({ value: '+40', change: '+20', dir: 'up' });
    expect(V.fol.map((f: any) => f.name)).toEqual(['LinkedIn']);
  });

  it('shows a goal and whether the account is on pace', () => {
    const f = growthView(input, {}, noop).fol[0];
    expect(f.hasGoal).toBe(true);
    expect(f.gtext).toBe('Behind pace');
  });

  it('splits paid growth from organic', () => {
    expect(growthView(input, {}, noop).paidStand[0]).toContain('10 of 155');
  });
});

describe('audience page', () => {
  const snapshot = (to: string, senior: number, entry: number) => ({ from: to, to, dims: { Seniority: [{ label: 'Senior', value: senior }, { label: 'Entry', value: entry }, { label: 'Director', value: 20 }], Industry: [{ label: 'Banking', value: 50 }, { label: 'IT Services', value: 50 }] } });
  const base: AudienceInput = {
    brand: 'im', brandName: 'IM', asOf: '2026-10-15', months: [],
    rules: [{ name: 'Future talent', dimension: 'Seniority', labels: '^(training|entry)$', flags: 'i', rule: 'entry', reliability: 'Fairly sure' }],
    financialServices: { source: '^banking$', flags: 'i' },
    seniorityGroups: [{ name: 'Future talent', source: '^(training|entry)$', flags: 'i' }],
    seniorityOrder: ['Training', 'Entry', 'Senior', 'Director'],
    followers: [snapshot('2026-09-12', 60, 20)], visitors: [], youtube: null, followRate: [], posts: []
  };

  it('works from one snapshot, and says trends need more', () => {
    const V = audienceView(base, {}, noop);
    expect(V.aud[0].now).toBe('20.0%');
    expect(V.fsText).toContain('50.0%');
    expect(V.single).toBe(true);
    expect(V.jNone).toBe(true);
  });

  it('works out new followers between two snapshots', () => {
    const V = audienceView({ ...base, followers: [snapshot('2026-09-12', 60, 20), snapshot('2026-10-12', 70, 50)] }, {}, noop);
    // 10 new senior, 30 new entry, 0 new directors: 75% of new followers are future talent.
    expect(V.aud[0].newNow).toContain('75.0%');
    expect(V.jHas).toBe(true);
  });
});

describe('overview', () => {
  it('raises flags from the other pages, with links to them', () => {
    const m = buildModel(dataset(), tables(), 'im');
    const fw: FwInput = frameworkInput(m, '2026-10-28');
    const posts = postsInput(m, '2026-10-28');
    const growth: GrowthInput = { brand: 'im', brandName: 'IM', asOf: '2026-10-15', months: [], series: [], postsPerMonth: [], posts: [], peers: [], peersPeriod: null, goals: {} };
    const audience = { brand: 'im', brandName: 'IM', asOf: '2026-10-15', months: [], rules: [], financialServices: { source: 'x', flags: '' }, seniorityGroups: [], seniorityOrder: [], followers: [], visitors: [], youtube: null, followRate: [], posts: [] } as AudienceInput;
    const V = overviewView({ fw, posts, growth, audience }, (p, tab) => `/analytics/${p}${tab ? `?tab=${tab}` : ''}`);
    expect(V.mName).toBe('September');
    const below = V.flags.find((f: any) => f.kind === 'Below target');
    expect(below).toMatchObject({ text: 'Brand building: 25% of posts this year against a 50% target.', href: '/analytics/framework?tab=A' });
    expect(V.flags[0].kind).toBe('Below target');
  });
});

describe('helpers', () => {
  it('takes medians ignoring gaps', () => {
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
  });
  it('turns a model post into the pages’ post', () => {
    const m = buildModel(dataset(), tables(), 'im');
    const p = toVPost(m.posts.find((x) => x.id.endsWith('!1'))!);
    expect(p).toMatchObject({ platforms: ['LinkedIn'], ratio: 2, impr: 1000, links: { LinkedIn: li(1) } });
    // LinkedIn counts carousel swipes as clicks, so a carousel has no clicks measure.
    expect(p.action).toBeNull();
  });
});

describe('cycles', () => {
  it('puts a post from the 25th on in the next month’s cycle', () => {
    const ds = dataset();
    (ds.posts as any[]).push({ ...ds.posts[0], id: 'Sep!7', key: 'im:2027:Sep!7', date: '2026-09-27', month: '2026-09', platforms: [] });
    const p = buildModel(ds, tables(), 'im').posts.find((x) => x.id.endsWith('!7'));
    expect(p?.month).toBe('2026-10');
  });
});
