// Reading LinkedIn's page analytics exports, and keeping them as dated snapshots.

import { describe, expect, it } from 'vitest';
import { exportDate, linkedInKey, pageFromFileName, readLinkedInExport } from '../src/lib/analytics/linkedin';
import { listAnalyticsUploads, loadAnalyticsUploads, publishAnalyticsFile } from '../src/lib/analytics/uploads';
import { memoryStore } from '../src/lib/dataset/store';
import { writeXls } from './xls-writer';
import { contentExport, followersExport, postId } from './linkedin-sample';

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

  it('keep other kinds of LinkedIn ID apart, and ignore other websites', () => {
    expect(linkedInKey(`https://www.linkedin.com/feed/update/urn:li:ugcPost:${postId(7)}`)).toBe(`ugcPost:${postId(7)}`);
    expect(linkedInKey('https://www.instagram.com/reel/Dd6Jw5wkQ1O/')).toBeNull();
    expect(linkedInKey('https://www.linkedin.com/company/emkay/')).toBeNull();
  });
});

describe('export details', () => {
  it('reads US-style dates and Excel date numbers', () => {
    expect(exportDate('10/13/2025')).toBe('2025-10-13');
    expect(exportDate('1/5/2026')).toBe('2026-01-05');
    expect(exportDate(46309)).toBe('2026-10-14');
    expect(exportDate('13 October')).toBeNull();
  });

  it('takes the page name from the file name LinkedIn gives', () => {
    expect(pageFromFileName('emkayinvestmentmanagers_content_1791966587478.xls')).toBe('emkayinvestmentmanagers');
    expect(pageFromFileName('Downloads/somepage_followers_1791966597003.xls')).toBe('somepage');
    expect(pageFromFileName('my copy.xls')).toBeNull();
  });
});

describe('content export', () => {
  const file = contentExport([
    { id: 2, created: '2026-08-03', impressions: 500, clicks: 400, likes: 12, comments: 2, reposts: 1, title: '  A   carousel\npost ' },
    { id: 7, created: '2026-09-09', impressions: 300, clicks: 10, likes: 6, contentType: 'Video', postsLink: true },
    { id: 7, created: '2026-09-09', impressions: 50000, type: 'Sponsored' },
    { id: 7, created: '2026-09-09', impressions: 50300, type: 'Total' }
  ], DAYS);
  const x = readLinkedInExport(file, 'samplepage_content_1.xls');

  it('is recognised, with the days it covers', () => {
    expect([x.kind, x.page, x.from, x.to]).toEqual(['content', 'samplepage', '2026-08-01', '2026-10-12']);
    expect(x.daily).toHaveLength(73);
    expect(x.daily[0]).toEqual({ date: '2026-08-01', values: { 'Impressions (organic)': 100, 'Impressions (sponsored)': 0, 'Clicks (organic)': 5 } });
  });

  it('has one row per post, keeping sponsored rows apart and dropping the Total rows', () => {
    expect(x.posts.map((p) => [p.key, p.sponsored])).toEqual([
      [`activity:${postId(2)}`, false],
      [`activity:${postId(7)}`, false],
      [`activity:${postId(7)}`, true]
    ]);
    expect(x.posts[0]).toMatchObject({
      title: 'A carousel post', created: '2026-08-03', impressions: 500, clicks: 400, likes: 12, comments: 2, reposts: 1, contentType: null
    });
    expect(x.posts[0].engagementRate).toBeCloseTo(415 / 500);
    expect(x.posts[1].contentType).toBe('Video');
  });

  it('is refused when a column the analysis needs is missing', () => {
    const broken = writeXls([{ name: 'All posts', rows: [['Post title', 'Post link', 'Created date'], ['x', 'y', '10/01/2026']] }]);
    expect(() => readLinkedInExport(broken)).toThrow(/missing "Post type", "Impressions"/);
  });

  it('is told apart from files that are not LinkedIn exports', () => {
    expect(() => readLinkedInExport(writeXls([{ name: 'Sheet1', rows: [['a']] }]))).toThrow(/not a LinkedIn page analytics export/);
    expect(() => readLinkedInExport(new TextEncoder().encode('nope'))).toThrow(/could not be opened/);
  });
});

describe('followers export', () => {
  it('has daily new followers and the breakdowns, largest first', () => {
    const x = readLinkedInExport(followersExport({ from: '2026-09-01', to: '2026-09-30' }), 'p_followers_1.xls');
    expect([x.kind, x.from, x.to, x.posts.length, x.daily.length]).toEqual(['followers', '2026-09-01', '2026-09-30', 0, 30]);
    expect(x.daily[0].values['Total followers']).toBe(2);
    expect(x.breakdowns.map((b) => b.name)).toEqual(['Location', 'Seniority']);
    expect(x.breakdowns[1].rows[0]).toEqual({ label: 'Senior', value: 120 });
  });
});

describe('analytics uploads', () => {
  const file = contentExport([{ id: 2, created: '2026-08-03', impressions: 500 }], DAYS);

  it('are checked without storing anything, then published as a dated snapshot with the original file', async () => {
    const store = memoryStore();
    const check = await publishAnalyticsFile(store, file, { fileName: 'a_content_1.xls', forBrand: 'im', dryRun: true });
    expect(check.status).toBe('ready');
    expect(await store.list('')).toEqual([]);

    const r = await publishAnalyticsFile(store, file, { fileName: 'a_content_1.xls', forBrand: 'im', uploadedBy: 'Your name', now: new Date('2026-10-14T05:00:00Z') });
    expect(r.status).toBe('published');
    expect(r.upload).toMatchObject({ brand: 'im', kind: 'content', from: '2026-08-01', to: '2026-10-12', posts: 1, uploadedBy: 'Your name' });
    expect((await store.list('analytics/im/')).sort()).toEqual([
      `analytics/im/linkedin-content/${r.upload!.id}.json`,
      `analytics/im/linkedin-content/${r.upload!.id}.xls.b64`
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

  it("refuse a known page's export filed under another brand", async () => {
    const r = await publishAnalyticsFile(memoryStore(), file, { fileName: 'emkayinvestmentmanagers_content_1.xls', forBrand: 'wealth' });
    expect(r.status).toBe('refused');
    expect(r.message).toMatch(/belongs to Emkay Investment Managers, but it was uploaded for Emkay Wealth Management/);
  });

  it('refuse files that are not LinkedIn exports, with the reason', async () => {
    const r = await publishAnalyticsFile(memoryStore(), writeXls([{ name: 'Sheet1', rows: [['a']] }]), { fileName: 'x.xls', forBrand: 'im' });
    expect(r).toMatchObject({ status: 'refused', upload: null });
    expect(r.message).toMatch(/not a LinkedIn page analytics export/);
  });
});
