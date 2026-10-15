// Reading and cleaning LinkedIn's page analytics exports, and storing them as uploads.

import { describe, expect, it } from 'vitest';
import { exportDate, isShortLinkedInLink, linkedInKey, pageFromFileName, readLinkedInExport } from '../src/lib/analytics/linkedin';
import { coverage, listAnalyticsUploads, loadAnalyticsUploads, publishAnalyticsFile } from '../src/lib/analytics/uploads';
import { memoryStore } from '../src/lib/dataset/store';
import { writeXls } from './xls-writer';
import { competitorsExport, contentExport, followersExport, postId, visitorsExport } from './linkedin-sample';

const DAYS = { from: '2026-08-01', to: '2026-10-12' };

describe('LinkedIn post links', () => {
  it('give the same post ID whichever way the link was copied', () => {
    const id = postId(7);
    for (const url of [
      `https://www.linkedin.com/feed/update/urn:li:activity:${id}`,
      `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`,
      `https://www.linkedin.com/posts/emkay-page_india-growth-activity-${id}-AbCd?utm_source=share`,
      `https://in.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A${id}`
    ]) expect(linkedInKey(url)).toBe(`activity:${id}`);
  });

  it('keep other kinds of LinkedIn ID apart, and ignore other websites and short links', () => {
    expect(linkedInKey(`https://www.linkedin.com/feed/update/urn:li:ugcPost:${postId(7)}`)).toBe(`ugcPost:${postId(7)}`);
    expect(linkedInKey('https://www.instagram.com/reel/Dd6Jw5wkQ1O/')).toBeNull();
    expect(linkedInKey('https://www.linkedin.com/company/emkay/')).toBeNull();
    expect(linkedInKey('https://lnkd.in/p/dYxWBdqV')).toBeNull();
    expect(isShortLinkedInLink('https://lnkd.in/p/dYxWBdqV')).toBe(true);
  });
});

describe('cleaning', () => {
  it('reads US-style dates (month first) and Excel date numbers', () => {
    expect(exportDate('10/12/2026')).toBe('2026-10-12'); // 12 October, not 10 December
    expect(exportDate('1/5/2026')).toBe('2026-01-05');
    expect(exportDate(46309)).toBe('2026-10-14');
    expect(exportDate('13 October')).toBeNull();
  });

  it('takes the page name from the file name LinkedIn gives', () => {
    expect(pageFromFileName('emkayinvestmentmanagers_content_1791966587478.xls')).toBe('emkayinvestmentmanagers');
    expect(pageFromFileName('Downloads/emkay-wealth-management_followers_1792048688676.xls')).toBe('emkay-wealth-management');
    expect(pageFromFileName('my copy.xls')).toBeNull();
  });
});

describe('content export', () => {
  const x = readLinkedInExport(contentExport([
    { id: 2, created: '2026-08-03', impressions: 500, clicks: 400, likes: 12, comments: 2, reposts: 1, title: '  A   carousel\npost ' },
    { id: 7, created: '2026-09-09', impressions: 300, views: 120, clicks: 10, likes: 6, contentType: 'Video', postsLink: true },
    { id: 7, created: '2026-09-09', impressions: 50000, type: 'Sponsored', campaign: 'Boost A', campaignDates: ['2026-09-10', '2026-09-12'] },
    { id: 7, created: '2026-09-09', impressions: 0, type: 'Sponsored', campaign: 'Boost A', campaignDates: ['2026-09-10', '2026-09-12'] },
    { id: 7, created: '2026-09-09', impressions: 9000, type: 'Sponsored', campaign: 'Boost B', campaignDates: ['2026-09-20', '2026-09-22'] },
    { id: 7, created: '2026-09-09', impressions: 59300, type: 'Total' }
  ], DAYS), 'samplepage_content_1.xls');

  it('is recognised, with the days it covers', () => {
    expect([x.file, x.page, x.from, x.to]).toEqual(['content', 'samplepage', '2026-08-01', '2026-10-12']);
    expect(x.daily).toHaveLength(73);
    expect(x.daily[0]).toEqual({ date: '2026-08-01', values: { 'Impressions (organic)': 100, 'Impressions (sponsored)': 0, 'Clicks (organic)': 5 } });
  });

  it('has a row per post and per sponsored campaign, without the Total rows', () => {
    expect(x.posts.map((p) => [p.postId, p.sponsored, p.campaignId])).toEqual([
      [`activity:${postId(2)}`, false, null],
      [`activity:${postId(7)}`, false, null],
      [`activity:${postId(7)}`, true, 'Boost A|2026-09-10|2026-09-12|1'],
      [`activity:${postId(7)}`, true, 'Boost A|2026-09-10|2026-09-12|2'], // same name and dates: still its own row
      [`activity:${postId(7)}`, true, 'Boost B|2026-09-20|2026-09-22|1']
    ]);
  });

  it('keeps every column, cleaned', () => {
    const p = x.posts[0];
    expect(p).toMatchObject({ title: 'A carousel post', created: '2026-08-03', impressions: 500, clicks: 400, reactions: 12, comments: 2, reposts: 1 });
    expect(Object.keys(p.columns)).toEqual(expect.arrayContaining(['Posted by', 'Audience', 'Click through rate (CTR)', 'Offsite Views']));
    expect(p.columns['Created date']).toBe('2026-08-03');
    expect(p.columns['Posted by']).toBe('Sample Person');
    expect(p.columns['Post title']).toBe('A   carousel\npost');
    expect(p.engagementRate).toBeCloseTo(415 / 500);
  });

  it('leaves blanks blank rather than turning them into 0', () => {
    expect(x.posts[0].views).toBeNull(); // not a video
    expect(x.posts[0].columns['Views']).toBeNull();
    expect(x.posts[1].views).toBe(120);
    expect(x.posts[0].contentType).toBeNull();
  });

  it('is refused when a column the analysis needs is missing', () => {
    const broken = writeXls([{ name: 'All posts', rows: [['Post title', 'Post link', 'Created date'], ['x', 'y', '10/01/2026']] }]);
    expect(() => readLinkedInExport(broken)).toThrow(/missing "Post type", "Impressions"/);
  });

  it('is told apart from files that are not LinkedIn exports', () => {
    expect(() => readLinkedInExport(writeXls([{ name: 'Sheet1', rows: [['a']] }]))).toThrow(/not a LinkedIn page analytics export/);
    expect(() => readLinkedInExport(new TextEncoder().encode('nope'))).toThrow(/could not be opened/);
  });

  it('notes rows it has to leave out', () => {
    const bad = writeXls([{ name: 'All posts', rows: [[], ['Post title', 'Post link', 'Post type', 'Created date', 'Impressions', 'Clicks', 'Likes', 'Comments', 'Reposts'],
      ['ok', `https://www.linkedin.com/feed/update/urn:li:activity:${postId(2)}`, 'Organic', '08/03/2026', 10, 0, 1, 0, 0],
      ['no link', 'https://example.com', 'Organic', '08/04/2026', 10, 0, 1, 0, 0]] }]);
    const r = readLinkedInExport(bad);
    expect(r.posts).toHaveLength(1);
    expect(r.skipped).toEqual(['All posts, row 4: no recognisable post link.']);
  });
});

describe('followers, visitors and competitors exports', () => {
  it('followers: daily figures and who follows on the export day', () => {
    const x = readLinkedInExport(followersExport({ from: '2026-09-01', to: '2026-09-30' }, { organic: 3, sponsored: 1 }), 'p_followers_1.xls');
    expect([x.file, x.from, x.to, x.daily.length]).toEqual(['followers', '2026-09-01', '2026-09-30', 30]);
    expect(x.daily[0].values).toEqual({ 'Sponsored followers': 1, 'Organic followers': 3, 'Auto-invited followers': 0, 'Total followers': 4 });
    expect(x.audience).toEqual({ of: 'followers', rows: [
      { dimension: 'Location', label: 'Mumbai Metropolitan Region, India', value: 150 },
      { dimension: 'Location', label: 'Greater Delhi Area, India', value: 40 },
      { dimension: 'Seniority', label: 'Senior', value: 120 },
      { dimension: 'Seniority', label: 'Entry', value: 70 }
    ] });
  });

  it('visitors: daily figures and who visited over the period', () => {
    const x = readLinkedInExport(visitorsExport({ from: '2026-09-01', to: '2026-09-10' }), 'p_visitors_1.xls');
    expect([x.file, x.daily.length, x.daily[0].values['Total page views (total)'], x.audience?.of]).toEqual(['visitors', 10, 10, 'visitors']);
  });

  it('competitors: the period, each page, and which page is the brand’s own', () => {
    const x = readLinkedInExport(competitorsExport({ from: '2025-10-14', to: '2026-10-13' }, [
      ['Peer Capital', 30000, 7000, 3600, 300],
      ['Emkay Global Financial Services Ltd', 88466, 17331, 2350, 199]
    ]), 'Emkay Global Financial Services Ltd_competitor_analytics_1.xlsx', ['Emkay Global']);
    expect([x.file, x.from, x.to]).toEqual(['competitors', '2025-10-14', '2026-10-13']);
    expect(x.benchmark.map((b) => [b.page, b.own, b.engagements, b.posts])).toEqual([
      ['Peer Capital', false, 3600, 300],
      ['Emkay Global Financial Services Ltd', true, 2350, 199]
    ]);
  });
});

describe('analytics uploads', () => {
  const file = contentExport([{ id: 2, created: '2026-08-03', impressions: 500 }], DAYS);
  const at = (iso: string) => new Date(`${iso}T05:00:00Z`);

  it('are checked without storing anything, then saved once: the original and the cleaned rows', async () => {
    const store = memoryStore();
    const check = await publishAnalyticsFile(store, file, { fileName: 'a_content_1.xls', forBrand: 'im', dryRun: true });
    expect(check.status).toBe('ready');
    expect(await store.list('')).toEqual([]);

    const r = await publishAnalyticsFile(store, file, { fileName: 'a_content_1.xls', forBrand: 'im', uploadedBy: 'Your name', now: at('2026-10-14') });
    expect(r.status).toBe('published');
    expect(r.upload).toMatchObject({ brand: 'im', file: 'content', from: '2026-08-01', to: '2026-10-12', uploadedBy: 'Your name',
      counts: { posts: 1, sponsored: 0, days: 73, audience: 0, benchmark: 0 }, warnings: [] });
    expect((await store.list('analytics/im/')).sort()).toEqual([
      `analytics/im/linkedin/content/${r.upload!.id}.json`,
      `analytics/im/linkedin/content/${r.upload!.id}.xls.b64`
    ]);
    expect((await loadAnalyticsUploads(store))[0].data.posts).toHaveLength(1);
  });

  it('report an identical file as nothing new', async () => {
    const store = memoryStore();
    await publishAnalyticsFile(store, file, { fileName: 'a_content_1.xls', forBrand: 'im' });
    const again = await publishAnalyticsFile(store, file, { fileName: 'a_content_2.xls', forBrand: 'im' });
    expect(again.status).toBe('unchanged');
    expect(await listAnalyticsUploads(store)).toHaveLength(1);
  });

  it("refuse a page's export filed under another brand", async () => {
    for (const [page, brand] of [['emkayinvestmentmanagers', 'Emkay Investment Managers'], ['emkayglobal', 'Emkay Global'], ['emkay-wealth-management', 'Emkay Wealth Management']]) {
      const forBrand = page === 'emkayglobal' ? 'im' : 'global';
      const r = await publishAnalyticsFile(memoryStore(), file, { fileName: `${page}_content_1.xls`, forBrand });
      expect(r.status).toBe('refused');
      expect(r.message).toContain(`which belongs to ${brand}, but it was uploaded for`);
    }
  });

  it("refuse a competitor export of another brand's page", async () => {
    const comp = competitorsExport({ from: '2025-10-14', to: '2026-10-13' }, [['Emkay Global Financial Services Ltd', 88466, 17331, 2350, 199]]);
    const r = await publishAnalyticsFile(memoryStore(), comp, { fileName: 'x_competitor_analytics_1.xlsx', forBrand: 'wealth' });
    expect(r.message).toContain("Emkay Global's page against its peers, but it was uploaded for Emkay Wealth Management");
    const store = memoryStore();
    const ok = await publishAnalyticsFile(store, comp, { fileName: 'x_competitor_analytics_1.xlsx', forBrand: 'global' });
    expect(ok.status).toBe('published');
    expect((await store.list('analytics/global/linkedin/competitors/')).filter((k) => k.endsWith('.xlsx.b64'))).toHaveLength(1);
  });

  it('refuse files that are not LinkedIn exports, with the reason', async () => {
    const r = await publishAnalyticsFile(memoryStore(), writeXls([{ name: 'Sheet1', rows: [['a']] }]), { fileName: 'x.xls', forBrand: 'im' });
    expect(r).toMatchObject({ status: 'refused', upload: null });
    expect(r.message).toMatch(/not a LinkedIn page analytics export/);
  });

  it('warn about a gap, and about an export older than one already uploaded', async () => {
    const store = memoryStore();
    await publishAnalyticsFile(store, followersExport({ from: '2026-08-01', to: '2026-08-31' }), { fileName: 'p_followers_1.xls', forBrand: 'im', now: at('2026-09-01') });
    const gap = await publishAnalyticsFile(store, followersExport({ from: '2026-09-11', to: '2026-10-10' }), { fileName: 'p_followers_2.xls', forBrand: 'im', now: at('2026-10-11') });
    expect(gap.upload!.warnings).toEqual([expect.stringMatching(/^No figures for 2026-09-01 to 2026-09-10/)]);
    const old = await publishAnalyticsFile(store, followersExport({ from: '2026-07-01', to: '2026-07-31' }), { fileName: 'p_followers_3.xls', forBrand: 'im', now: at('2026-10-12') });
    expect(old.upload!.warnings).toEqual([expect.stringMatching(/^This export ends on 2026-07-31, before the latest one/)]);

    const followers = coverage(await listAnalyticsUploads(store), 'im').find((c) => c.file === 'followers')!;
    expect(followers).toMatchObject({ uploads: 3, from: '2026-07-01', to: '2026-10-10', gaps: [{ from: '2026-09-01', to: '2026-09-10' }] });
    expect(coverage([], 'im').map((c) => [c.file, c.uploads, c.optional])).toEqual([
      ['content', 0, false], ['followers', 0, false], ['visitors', 0, false], ['competitors', 0, true]
    ]);
  });

  it('saved by an older reader are cleaned again from their original file', async () => {
    const store = memoryStore();
    const r = await publishAnalyticsFile(store, file, { fileName: 'a_content_1.xls', forBrand: 'im' });
    const key = `analytics/im/linkedin/content/${r.upload!.id}.json`;
    const doc = JSON.parse((await store.get(key))!);
    await store.put(key, JSON.stringify({ ...doc, readerVersion: 1, data: { ...doc.data, posts: [] } }));
    expect((await loadAnalyticsUploads(store))[0].data.posts).toHaveLength(1);
  });

  it('saved before the pipeline (the first version of step 9) are still read', async () => {
    const store = memoryStore();
    const old = { id: 'im-lic-20261014T050000000Z', brand: 'im', source: 'linkedin', kind: 'content', uploadedAt: '2026-10-14T05:00:00.000Z',
      uploadedBy: null, fileName: 'a_content_1.xls', contentHash: 'abc', from: '2026-08-01', to: '2026-10-12', posts: 1, readerVersion: 1, data: {} };
    await store.put(`analytics/im/linkedin-content/${old.id}.json`, JSON.stringify(old));
    await store.put(`analytics/im/linkedin-content/${old.id}.xls.b64`, btoa(String.fromCharCode(...file)));
    const [u] = await loadAnalyticsUploads(store, { brand: 'im', file: 'content' });
    expect(u).toMatchObject({ id: old.id, file: 'content', counts: { posts: 1 } });
    expect(u.data.posts[0].postId).toBe(`activity:${postId(2)}`);
  });
});
