// LinkedIn figures laid over the sample calendar (tools/template/make_sample.py, as Emkay IM).
// The sample's LinkedIn links use post IDs 01-07; the made-up exports reuse them.

import { beforeAll, describe, expect, it } from 'vitest';
import {
  accountMonths, analyseLinkedIn, brandTable, emkayTable, median, monthsToShow, type AnalysedPost
} from '../src/lib/analytics/analysis';
import { loadAnalyticsUploads, publishAnalyticsFile } from '../src/lib/analytics/uploads';
import { loadDataset, type Dataset } from '../src/lib/dataset/dataset';
import { memoryStore, type Store } from '../src/lib/dataset/store';
import { publish, publishFile } from '../src/lib/dataset/uploads';
import { readCalendar } from '../src/lib/workbook/read-calendar';
import type { Sheet } from '../src/lib/workbook/xlsx';
import { contentExport, feedLink, followersExport, postId, type SamplePost } from './linkedin-sample';
import { buildSample, patch, readXlsx, rowOf } from './sample';

const TODAY = '2026-10-13';
const DAYS = { from: '2026-07-01', to: '2026-10-12' };
let calendar: Uint8Array;
let sheets: Sheet[];

beforeAll(() => {
  calendar = buildSample('Emkay Investment Managers').bytes;
  sheets = readXlsx(calendar);
});

/** Organic posts on LinkedIn: the sample calendar's 01-07, plus some that are not in it. */
const POSTS: SamplePost[] = [
  { id: 1, created: '2026-07-06', impressions: 200, likes: 4 }, // before the BAU start (Aug 2026)
  { id: 2, created: '2026-08-03', impressions: 500, clicks: 400, likes: 10, comments: 3, reposts: 2 }, // Thought leadership
  { id: 3, created: '2026-08-04', impressions: 400, likes: 8 }, // Market leadership; UTC date a day before the calendar's
  { id: 5, created: '2026-08-10', impressions: 300, likes: 3 }, // Compliance: in the calendar, not BAU
  { id: 6, created: '2026-09-01', impressions: 250, likes: 5 }, // retired peg, still BAU
  { id: 7, created: '2026-09-09', impressions: 600, likes: 30, postsLink: true }, // Thought leadership
  { id: 7, created: '2026-09-09', impressions: 40000, likes: 500, type: 'Sponsored' },
  { id: 7, created: '2026-09-09', impressions: 40600, likes: 530, type: 'Total' },
  { id: 90, created: '2026-08-20', impressions: 1000, likes: 10, title: 'Market update video' }, // not in the calendar
  { id: 91, created: '2026-10-09', impressions: 80, likes: 4, title: 'Too new to count' } // 3 days old on 12 Oct
];

async function setUp(opts: { sheets?: Sheet[]; posts?: SamplePost[]; days?: { from: string; to: string } } = {}): Promise<{ store: Store; ds: Dataset }> {
  const store = memoryStore();
  if (opts.sheets) await publish(store, readCalendar(opts.sheets, { today: TODAY }), { fileName: 'im.xlsx', contentHash: 'x' });
  else await publishFile(store, calendar, { fileName: 'im.xlsx', today: TODAY });
  await publishAnalyticsFile(store, contentExport(opts.posts ?? POSTS, opts.days ?? DAYS), { fileName: 'page_content_1.xls', forBrand: 'im', now: new Date('2026-10-13T00:00:00Z') });
  return { store, ds: await loadDataset(store) };
}

async function analyse(opts?: Parameters<typeof setUp>[0]) {
  const { store, ds } = await setUp(opts);
  const uploads = await loadAnalyticsUploads(store);
  return { ds, uploads, a: analyseLinkedIn(ds, uploads) };
}

const byId = (posts: AnalysedPost[], id: number, sponsored = false) =>
  posts.find((p) => p.key === `activity:${postId(id)}` && p.sponsored === sponsored)!;

describe('matching LinkedIn posts to the calendar', () => {
  it('puts every post in its group by the link in the LinkedIn column', async () => {
    const { a } = await analyse();
    expect(a.asOf).toBe('2026-10-12');
    expect(Object.fromEntries([1, 2, 3, 5, 6, 7, 90, 91].map((id) => [id, byId(a.posts, id).group]))).toEqual({
      1: 'before-bau', 2: 'bau', 3: 'bau', 5: 'not-bau', 6: 'bau', 7: 'bau', 90: 'outside', 91: 'outside'
    });
    expect(byId(a.posts, 2).calendar).toMatchObject({ title: 'Three myths', commsTask: 'TL', commsTaskName: 'Thought leadership', peg: 'Myths vs reality', format: 'Carousel' });
  });

  it("uses the calendar's month, not LinkedIn's UTC date", async () => {
    const { a } = await analyse({ posts: [{ id: 3, created: '2026-07-31', impressions: 100 }] });
    expect(byId(a.posts, 3)).toMatchObject({ created: '2026-07-31', month: '2026-08', group: 'bau' });
  });

  it('keeps sponsored rows apart and marks posts too new to compare', async () => {
    const { a } = await analyse();
    expect(byId(a.posts, 7, true)).toMatchObject({ sponsored: true, group: 'bau' });
    expect(byId(a.posts, 91)).toMatchObject({ ageDays: 3, settled: false });
    expect(byId(a.posts, 90)).toMatchObject({ ageDays: 53, settled: true });
  });

  it('measures interactions without clicks', async () => {
    const { a } = await analyse();
    expect(byId(a.posts, 2).interactionRate).toBeCloseTo(15 / 500);
    expect(byId(a.posts, 2).engagementRate).toBeCloseTo(415 / 500);
  });

  it('takes the newest figures for each post from later exports', async () => {
    const { store, ds } = await setUp();
    const later = contentExport([{ id: 2, created: '2026-08-03', impressions: 900, likes: 30 }], { from: '2026-08-01', to: '2026-11-05' });
    await publishAnalyticsFile(store, later, { fileName: 'page_content_2.xls', forBrand: 'im' });
    const a = analyseLinkedIn(ds, await loadAnalyticsUploads(store));
    expect(byId(a.posts, 2)).toMatchObject({ impressions: 900, asOf: '2026-11-05' });
    expect(byId(a.posts, 90)).toMatchObject({ impressions: 1000, asOf: '2026-10-12' });
    expect(a.asOf).toBe('2026-11-05');
  });
});

describe('links to fix', () => {
  it('a published post with no LinkedIn link, with the likely LinkedIn post', async () => {
    const r = rowOf(sheets, 'Sep 2026', 'Data post');
    const { a } = await analyse({ sheets: patch(sheets, 'Sep 2026', { [`L${r}`]: { value: 'Planned', url: null } }) });
    const fix = a.fixes.find((f) => f.post.title === 'Data post')!;
    expect(fix).toMatchObject({ problem: 'missing', post: { date: '2026-09-09', sheet: 'Sep 2026', row: r } });
    expect(fix.candidates.map((c) => c.created)).toEqual(['2026-09-09']);
    expect(byId(a.posts, 7)).toMatchObject({ group: 'outside', maybe: [{ title: 'Data post' }] });
  });

  it('a link to another website in the LinkedIn column', async () => {
    const r = rowOf(sheets, 'Sep 2026', 'Data post');
    const { a } = await analyse({ sheets: patch(sheets, 'Sep 2026', { [`L${r}`]: { value: 'https://www.instagram.com/reel/abc/', url: null } }) });
    expect(a.fixes.find((f) => f.post.title === 'Data post')).toMatchObject({ problem: 'not-linkedin', candidates: [{ created: '2026-09-09' }] });
  });

  it("a calendar link that is not in LinkedIn's export", async () => {
    const { a } = await analyse({ posts: POSTS.filter((p) => p.id !== 3) });
    expect(a.fixes.map((f) => [f.problem, f.post.title])).toEqual([['not-found', 'Monthly performance']]);
  });

  it('nothing for posts outside the days the export covers', async () => {
    // The export starts on 1 August, so the 6 July post missing from it is not a problem.
    const { a } = await analyse({ posts: POSTS.filter((p) => p.id !== 1), days: { from: '2026-08-01', to: '2026-10-12' } });
    expect(a.fixes).toEqual([]);
  });
});

describe('comparing month by month', () => {
  it('medians: middle value, or the mean of the middle two', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 100])).toBe(3.5);
  });

  it('show three months of baseline before the BAU start', () => {
    const p = (month: string) => ({ month }) as AnalysedPost;
    expect(monthsToShow([p('2026-03'), p('2026-10')], '2026-08')).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(monthsToShow([p('2026-07'), p('2026-09')], '2026-08')).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('by comms task: BAU posts only, organic and settled, then the totals', async () => {
    const { ds, a } = await analyse();
    const t = brandTable(ds, a, 'im', 'commsTask', 'interactionRate');
    expect(t.months).toEqual(['2026-07', '2026-08', '2026-09']);
    const row = (label: string) => t.rows.find((r) => r.label === label)!;
    expect(t.rows.map((r) => r.label)).toEqual([
      'Thought leadership', 'Market leadership', 'Brand building',
      'All BAU posts', 'In the calendar, not BAU', 'Outside BAU', 'Before BAU started', 'All organic posts'
    ]);
    expect(row('Thought leadership').byMonth['2026-08']).toEqual({ median: 15 / 500, n: 1 });
    expect(row('Thought leadership').byMonth['2026-09']).toEqual({ median: 30 / 600, n: 1 }); // not the sponsored row
    expect(row('Thought leadership').all).toEqual({ median: (15 / 500 + 30 / 600) / 2, n: 2 });
    expect(row('Brand building').all.n).toBe(1); // the retired peg's post
    expect(row('All BAU posts').all.n).toBe(4);
    expect(row('Outside BAU').all.n).toBe(1); // the post 3 days old is not counted
    expect(row('Before BAU started').byMonth['2026-07']).toEqual({ median: 4 / 200, n: 1 });
    expect(row('All organic posts').all.n).toBe(7);
  });

  it('by peg, keeping a retired peg only while it has posts in view', async () => {
    const { ds, a } = await analyse();
    const labels = brandTable(ds, a, 'im', 'peg', 'impressions').rows.filter((r) => r.kind === 'framework').map((r) => r.label);
    expect(labels).toEqual(['Myths vs reality', 'Research opinions', 'Performance positioning', 'Legacy', 'Old peg']);
    const { ds: ds2, a: a2 } = await analyse({ posts: POSTS.filter((p) => p.id !== 6) });
    expect(brandTable(ds2, a2, 'im', 'peg', 'impressions').rows.map((r) => r.label)).not.toContain('Old peg');
  });

  it('by format, from the calendar', async () => {
    const { ds, a } = await analyse();
    const t = brandTable(ds, a, 'im', 'format', 'impressions');
    expect(t.rows.filter((r) => r.kind === 'framework').map((r) => [r.label, r.all.n])).toEqual([
      ['Carousel', 2], ['Infographic', 1], ['Static', 1]
    ]);
  });

  it('All of Emkay: each brand overall, never mixing frameworks', async () => {
    const { ds, a } = await analyse();
    const t = emkayTable(ds, a, 'interactionRate');
    expect(t.rows.map((r) => [r.label, r.context, r.all.n])).toEqual([
      ['Emkay Investment Managers', 'All BAU posts', 4],
      ['Emkay Investment Managers', 'All organic posts', 7]
    ]);
  });
});

describe('the page as a whole', () => {
  it('adds up the daily figures per month, marking the month still running', async () => {
    const { store } = await setUp();
    await publishAnalyticsFile(store, followersExport({ from: '2026-09-01', to: '2026-10-12' }, 3), { fileName: 'page_followers_1.xls', forBrand: 'im' });
    const months = accountMonths(await loadAnalyticsUploads(store), 'im', ['2026-08', '2026-09', '2026-10']);
    expect(months).toEqual([
      { month: '2026-08', complete: true, newFollowers: null, pageViews: null, impressions: 3100 },
      { month: '2026-09', complete: true, newFollowers: 90, pageViews: null, impressions: 3000 },
      { month: '2026-10', complete: false, newFollowers: 36, pageViews: null, impressions: 1200 }
    ]);
  });
});

it('sample links match the made-up export links', () => {
  expect(feedLink(2)).toBe('https://www.linkedin.com/feed/update/urn:li:activity:7400000000000000002');
});
