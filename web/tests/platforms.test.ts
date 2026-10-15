// The YouTube, Instagram and X readers, telling files apart, and how their uploads combine.

import { describe, expect, it } from 'vitest';
import { cleanCell, exportDate, exportDateTime, exportDuration } from '../src/lib/analytics/common';
import { decodeText, looksLikeCsv, parseCsv } from '../src/lib/analytics/csv';
import { instagramKey, readInstagramExport } from '../src/lib/analytics/instagram';
import { POST_KEY, detectExport, ownerOf, readExport } from '../src/lib/analytics/platforms';
import { buildTables, latestPosts, postHistory } from '../src/lib/analytics/tables';
import { coverage, isDue, listAnalyticsUploads, loadAnalyticsUploads, publishAnalyticsFile } from '../src/lib/analytics/uploads';
import { readXExport, xKey } from '../src/lib/analytics/x';
import { readYouTubeExport, youTubeKey, zipNameParts } from '../src/lib/analytics/youtube';
import { memoryStore } from '../src/lib/dataset/store';
import { contentExport } from './linkedin-sample';
import {
  daysBetween, instagramPostsCsv, instagramSummaryCsv, xOverviewCsv, xPostsCsv, youTubeContentZip, youTubeTrafficZip
} from './platform-samples';
import { buildSample } from './sample';

describe('reading the platforms’ formats', () => {
  it('CSV: quotes, commas and line breaks inside fields', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\r\n\n1,\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere'], ['1', '']]);
  });

  it('text: UTF-8 with or without a byte-order mark, UTF-16, and Windows-1252 from Excel', () => {
    expect(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, 0x61, 0xe2, 0x84, 0xa2]))).toEqual({ text: 'a™', resaved: false });
    expect(decodeText(Uint8Array.from([0xff, 0xfe, 0x61, 0x00]))).toEqual({ text: 'a', resaved: false });
    expect(decodeText(Uint8Array.from([0x61, 0x99]))).toEqual({ text: 'a™', resaved: true });
    expect(looksLikeCsv(new TextEncoder().encode('A title line\nName,Value\n'))).toBe(true);
  });

  it('dates and durations in every platform’s style', () => {
    expect(['2026-09-01', '10/14/2026', '10/14/2026 5:10', 'Thu, Oct 15, 2026', 'Sep 24, 2026', 'Oct-14-2025'].map(exportDate))
      .toEqual(['2026-09-01', '2026-10-14', '2026-10-14', '2026-10-15', '2026-09-24', '2025-10-14']);
    expect(exportDateTime('10/14/2026 5:10')).toBe('2026-10-14T05:10');
    expect(exportDateTime('10/14/2026 5:10 PM')).toBe('2026-10-14T17:10');
    expect([exportDuration('0:02:10'), exportDuration('1:05'), exportDuration('x')]).toEqual([130, 65, null]);
  });

  it('IDs and links stay text, so long post IDs keep every digit', () => {
    expect(cleanCell('Post id', '2100000000000000001')).toBe('2100000000000000001');
    expect(cleanCell('Impressions', '1,234')).toBe(1234);
  });

  it('post IDs from every kind of link', () => {
    for (const url of ['https://www.youtube.com/watch?v=AbCdEfGhIjK', 'https://youtu.be/AbCdEfGhIjK?si=abc', 'https://youtube.com/shorts/AbCdEfGhIjK', 'https://www.youtube.com/live/AbCdEfGhIjK?feature=share']) {
      expect(youTubeKey(url)).toBe('yt:AbCdEfGhIjK');
    }
    expect(instagramKey('https://www.instagram.com/reel/TestReel001/?igsh=x')).toBe('ig:TestReel001');
    expect(instagramKey('https://www.instagram.com/p/TestPost42/')).toBe('ig:TestPost42');
    expect(xKey('https://x.com/EmkayInvestment/status/2100000000000000001?s=20')).toBe('x:2100000000000000001');
    expect(xKey('https://twitter.com/EmkayInvestment/status/2100000000000000001')).toBe('x:2100000000000000001');
    expect(POST_KEY.youtube('https://www.instagram.com/reel/TestReel001/')).toBeNull();
  });
});

describe('YouTube', () => {
  const sep = youTubeContentZip('2026-09-01', '2026-09-30', [
    { id: 'AbCdEfGhIjK', title: 'Deputy Head of Research, live', published: 'Sep 24, 2026', views: 203, likes: 3, impressions: 1045 },
    { id: 'ZyXwVuTsRqP', title: 'An old video with no views this month', published: 'Oct 13, 2017', views: null }
  ]);

  it('takes the channel and dates from the zip’s name, whose end day is not included', () => {
    expect(zipNameParts(sep.name)).toEqual({ channel: 'Emkay Global Financial Services Ltd', from: '2026-09-01', toExclusive: '2026-10-01' });
    expect(zipNameParts('Traffic_source_2026-09-01_2026-10-01_Emkay_Global_Financial_Services_Ltd.-2.zip').channel).toBe('Emkay Global Financial Services Ltd');
  });

  it('Content: one row per video for the month, its totals and its days', () => {
    const x = readYouTubeExport(sep.bytes, sep.name);
    expect([x.platform, x.file, x.account, x.from, x.to, x.postFigures]).toEqual(['youtube', 'content', 'Emkay Global Financial Services Ltd', '2026-09-01', '2026-09-30', 'period']);
    expect(x.posts).toHaveLength(2);
    // An old video with no views this month, only a few thumbnail impressions: kept as it is.
    expect(x.posts[1]).toMatchObject({ postId: 'yt:ZyXwVuTsRqP', views: null, impressions: 2, reactions: null });
    expect(x.posts[0]).toMatchObject({ postId: 'yt:AbCdEfGhIjK', created: '2026-09-24', views: 203, reactions: 3, impressions: 1045, watchHours: 1.3, follows: 1 });
    expect(x.posts[0].columns['Average view duration']).toBe(76);
    expect(x.totals).toMatchObject({ Likes: 5, 'Subscribers gained': 3, 'Subscribers lost': 1, Views: 203, 'Average view duration': 130 });
    expect(x.daily).toHaveLength(30);
  });

  it('other reports become audience breakdowns of the views', () => {
    const t = youTubeTrafficZip('2026-09-01', '2026-09-30');
    const x = readYouTubeExport(t.bytes, t.name);
    expect(x.file).toBe('traffic-source');
    expect(x.audience).toEqual({ of: 'views', rows: [
      { dimension: 'Traffic source', label: 'YouTube search', value: 200, values: { Views: 200, 'Watch time (hours)': 3, 'Average view duration': 78, 'Thumbnail impressions': 3000, 'Thumbnail click-through rate (%)': 2.93 } },
      { dimension: 'Traffic source', label: 'External', value: 100, values: { Views: 100, 'Watch time (hours)': 2, 'Average view duration': 40, 'Thumbnail impressions': null, 'Thumbnail click-through rate (%)': null } }
    ] });
  });
});

describe('Instagram', () => {
  const posts = [
    { code: 'TestReel001', published: '12/23/2025 02:56', views: 459, reach: 353, likes: 0 },
    { code: 'TestCarou-1', published: '10/14/2026 05:10', views: 56, reach: 35, likes: 3, type: 'IG carousel' },
    { code: 'TestCollab1', published: '10/10/2026 09:00', views: 10, reach: 8, likes: 1, username: 'partner_account' }
  ];

  it('posts: lifetime figures per post, the account, and the period from the file name', () => {
    const x = readInstagramExport(instagramPostsCsv(posts), 'Oct-15-2025_Oct-14-2026_1234.csv');
    expect([x.file, x.account, x.from, x.to, x.postFigures, x.notes]).toEqual(['posts', 'emkayinvestmentmanagers', '2025-10-15', '2026-10-14', 'lifetime', []]);
    expect(x.posts[1]).toMatchObject({ postId: 'ig:TestCarou-1', created: '2026-10-14', contentType: 'carousel', views: 56, impressions: 56, reach: 35, reactions: 3, saves: 3 });
    expect(x.posts[1].columns['Publish time']).toBe('2026-10-14T05:10');
    expect(x.posts[0].title).toBe('Post TestReel001 — “growth” ™');
    expect(x.posts[2].account).toBe('partner_account'); // a collab post, kept with its account
  });

  it('a file re-saved in Excel is still read, with a note about what it lost', () => {
    const x = readInstagramExport(instagramPostsCsv(posts, { resaved: true }), 'Insta_data.csv');
    expect(x.posts.map((p) => p.postId)).toEqual(['ig:TestReel001', 'ig:TestCarou-1', 'ig:TestCollab1']);
    expect(x.posts[0].title).toBe('Post TestReel001 — “growth” ™');
    expect(x.notes.join(' ')).toMatch(/re-saved in Excel.*rounded \(e\.g\. 1\.79E\+16\).*period is taken from the posts' dates/);
    expect([x.from, x.to]).toEqual(['2025-12-23', '2026-10-14']);
  });

  it('summaries: the account’s totals for the period on their title line', () => {
    const o = readInstagramExport(instagramSummaryCsv('Overview'), 'whatever.csv');
    expect([o.file, o.account, o.from, o.to, o.totals]).toEqual(['overview', 'Emkay Wealth', '2025-10-14', '2026-10-14', { Reach: 6358, 'New Followers': 29 }]);
    const p = readInstagramExport(instagramSummaryCsv('Posts'), 'x.csv');
    expect([p.file, p.totals]).toEqual(['posts-summary', { Posts: 88, Reach: 6358, 'Reels Skip Rate': 78.83 }]);
  });
});

describe('X', () => {
  it('posts: one row per post, keeping the full 19-digit ID, and the period from the file name', () => {
    const x = readXExport(xPostsCsv([{ id: '2100000000000000001', date: 'Wed, Oct 14, 2026', impressions: 58, likes: 1 }]), 'account_analytics_content_2025-10-15_2026-10-15.csv');
    expect([x.file, x.account, x.from, x.to]).toEqual(['posts', 'EmkayInvestment', '2025-10-15', '2026-10-15']);
    expect(x.posts[0]).toMatchObject({ postId: 'x:2100000000000000001', created: '2026-10-14', impressions: 58, reactions: 1, comments: 1, reposts: 1, saves: 1, clicks: 2 });
    expect(x.posts[0].columns['Post id']).toBe('2100000000000000001');
  });

  it('overview: the account’s figures per day, oldest first', () => {
    const x = readXExport(xOverviewCsv(daysBetween('2026-10-13', '2026-10-15')), 'account_overview_analytics.csv');
    expect([x.file, x.from, x.to, x.daily.length]).toEqual(['overview', '2026-10-13', '2026-10-15', 3]);
    expect(x.daily[0].values).toMatchObject({ Impressions: 100, 'New follows': 1, Unfollows: 0 });
  });
});

describe('telling files apart', () => {
  it('each export is recognised by its contents, and a calendar workbook is not an export', () => {
    const yt = youTubeContentZip('2026-09-01', '2026-09-30', [{ id: 'AbCdEfGhIjK', title: 't', published: 'Sep 24, 2026', views: 1 }]);
    const cases: [string, Uint8Array, unknown][] = [
      ['emkayglobal_content_1.xls', contentExport([{ id: 2, created: '2026-08-03', impressions: 5 }], { from: '2026-08-01', to: '2026-08-31' }), { platform: 'linkedin', file: 'content' }],
      [yt.name, yt.bytes, { platform: 'youtube', file: 'content' }],
      ['renamed.csv', instagramPostsCsv([{ code: 'Abc', published: '10/14/2026 05:10', views: 1, reach: 1, likes: 0 }]), { platform: 'instagram', file: 'posts' }],
      ['s.csv', instagramSummaryCsv('Posts'), { platform: 'instagram', file: 'posts-summary' }],
      ['p.csv', xPostsCsv([{ id: '2100000000000000001', date: 'Wed, Oct 14, 2026', impressions: 1, likes: 0 }]), { platform: 'x', file: 'posts' }],
      ['o.csv', xOverviewCsv(['2026-10-14']), { platform: 'x', file: 'overview' }],
      ['calendar.xlsx', buildSample('Emkay Global').bytes, null],
      ['notes.csv', new TextEncoder().encode('a,b\n1,2\n'), null]
    ];
    for (const [name, bytes, want] of cases) expect([name, detectExport({ name, bytes })]).toEqual([name, want]);
    expect(() => readExport({ name: 'notes.csv', bytes: new TextEncoder().encode('a,b\n1,2\n') })).toThrow(/not an analytics export the site reads/);
  });

  it('accounts belong to brands', () => {
    expect([ownerOf('youtube', 'Emkay Global Financial Services Ltd.'), ownerOf('x', 'emkayinvestment'), ownerOf('instagram', 'Emkay Wealth'), ownerOf('x', 'someone')])
      .toEqual(['global', 'im', 'wealth', null]);
  });
});

describe('uploads across platforms', () => {
  const at = (iso: string) => new Date(`${iso}T05:00:00Z`);

  it("refuse an account's export filed under another brand, and warn about an account the site does not know", async () => {
    const yt = youTubeContentZip('2026-09-01', '2026-09-30', [{ id: 'AbCdEfGhIjK', title: 't', published: 'Sep 24, 2026', views: 1 }]);
    const r = await publishAnalyticsFile(memoryStore(), yt.bytes, { fileName: yt.name, forBrand: 'im' });
    expect(r.message).toBe('This YouTube · Content export is for "Emkay Global Financial Services Ltd", which belongs to Emkay Global, but it was uploaded for Emkay Investment Managers. Pick the right file.');
    const x = await publishAnalyticsFile(memoryStore(), xPostsCsv([{ id: '2100000000000000001', date: 'Wed, Oct 14, 2026', impressions: 1, likes: 0 }], 'EmkayWealth'), { fileName: 'p.csv', forBrand: 'wealth' });
    expect(x.upload!.warnings).toContain('The site does not know "EmkayWealth" yet. Check it is Emkay Wealth Management\'s account.');
  });

  it('YouTube: saved by platform, a month at a time; other periods are kept with a warning', async () => {
    const store = memoryStore();
    const sep = youTubeContentZip('2026-09-01', '2026-09-30', [{ id: 'AbCdEfGhIjK', title: 't', published: 'Sep 24, 2026', views: 203 }]);
    const r = await publishAnalyticsFile(store, sep.bytes, { fileName: sep.name, forBrand: 'global', now: at('2026-10-03') });
    expect(r.upload).toMatchObject({ platform: 'youtube', file: 'content', warnings: [] });
    expect((await store.list('analytics/global/youtube/content/')).map((k) => k.replace(/.*\./, '.'))).toEqual(expect.arrayContaining(['.json', '.b64']));
    const year = youTubeContentZip('2025-10-14', '2026-10-13', [{ id: 'AbCdEfGhIjK', title: 't', published: 'Sep 24, 2026', views: 900 }]);
    const y = await publishAnalyticsFile(store, year.bytes, { fileName: year.name, forBrand: 'global' });
    expect(y.upload!.warnings).toEqual([expect.stringMatching(/should cover one calendar month.*only whole months are counted/)]);
  });

  it('YouTube: months add up, and a missing month shows as a gap', async () => {
    const store = memoryStore();
    for (const [from, to, views] of [['2026-07-01', '2026-07-31', 50], ['2026-09-01', '2026-09-30', 30]] as const) {
      const z = youTubeContentZip(from, to, [{ id: 'AbCdEfGhIjK', title: 't', published: 'Jul 2, 2026', views }]);
      await publishAnalyticsFile(store, z.bytes, { fileName: z.name, forBrand: 'global', now: at(to) });
    }
    const year = youTubeContentZip('2025-10-14', '2026-10-13', [{ id: 'AbCdEfGhIjK', title: 't', published: 'Jul 2, 2026', views: 999 }]);
    await publishAnalyticsFile(store, year.bytes, { fileName: year.name, forBrand: 'global', now: at('2026-10-14') });

    const t = buildTables(await loadAnalyticsUploads(store));
    const [video] = latestPosts(t.posts);
    expect(video).toMatchObject({ postId: 'yt:AbCdEfGhIjK', views: 80, from: '2026-07-01', to: '2026-09-30' }); // not the 999 from the year export
    expect(postHistory(t.posts, 'global', 'yt:AbCdEfGhIjK').map((p) => [p.from, p.views])).toEqual([['2026-07-01', 50], ['2026-09-01', 30]]);

    const content = coverage(await listAnalyticsUploads(store), 'global').find((p) => p.platform === 'youtube')!.files.find((f) => f.file === 'content')!;
    expect(content).toMatchObject({ uploads: 3, to: '2026-09-30', gaps: [{ from: '2026-08-01', to: '2026-08-31' }] });
    expect(isDue(content, '2026-10-15')).toBe(false); // September is in
    expect(isDue(content, '2026-11-02')).toBe(true); // October is not
  });

  it('daily figures from two exports of the same days merge column by column', async () => {
    const store = memoryStore();
    const a = youTubeContentZip('2026-09-01', '2026-09-30', [{ id: 'AbCdEfGhIjK', title: 't', published: 'Sep 24, 2026', views: 1 }]);
    const b = youTubeTrafficZip('2026-09-01', '2026-09-30');
    await publishAnalyticsFile(store, a.bytes, { fileName: a.name, forBrand: 'global' });
    await publishAnalyticsFile(store, b.bytes, { fileName: b.name, forBrand: 'global' });
    const t = buildTables(await loadAnalyticsUploads(store));
    expect([...t.daily.get('global')!.keys()].sort()).toEqual(['youtube/content', 'youtube/traffic-source']);
    expect(t.totals.map((x) => [x.file, x.values.Views])).toEqual([['content', 1], ['traffic-source', 300]]);
    expect(t.audience.map((x) => [x.platform, x.of, x.label])).toEqual([['youtube', 'views', 'YouTube search'], ['youtube', 'views', 'External']]);
  });
});
