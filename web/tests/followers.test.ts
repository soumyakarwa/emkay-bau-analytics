// Follower totals: counts noted from the profiles, and totals for other months worked out from
// the exports' gains and losses.

import { describe, expect, it } from 'vitest';
import { followerTotals, listFollowerCounts, parseCount, saveFollowerCount } from '../src/lib/analytics/followers';
import { buildTables } from '../src/lib/analytics/tables';
import { loadAnalyticsUploads, publishAnalyticsFile } from '../src/lib/analytics/uploads';
import { memoryStore } from '../src/lib/dataset/store';
import { followersExport } from './linkedin-sample';
import { daysBetween, xOverviewCsv, youTubeContentZip } from './platform-samples';

describe('follower counts', () => {
  it('are typed as on the profile', () => {
    expect([parseCount('3,735'), parseCount('1.6k'), parseCount(' 2M '), parseCount('many')]).toEqual([
      { count: 3735, approximate: false }, { count: 1600, approximate: true }, { count: 2000000, approximate: true }, null
    ]);
  });

  it('are kept, the later entry for the same day winning', async () => {
    const store = memoryStore();
    const base = { brand: 'im' as const, platform: 'x' as const, date: '2026-10-23', approximate: false, enteredBy: null };
    await saveFollowerCount(store, { ...base, count: 680 }, new Date('2026-10-23T05:00:00Z'));
    await saveFollowerCount(store, { ...base, count: 689 }, new Date('2026-10-23T06:00:00Z'));
    await saveFollowerCount(store, { ...base, platform: 'linkedin', count: 3735 }, new Date('2026-10-23T06:00:00Z'));
    expect((await listFollowerCounts(store, 'im')).map((c) => [c.platform, c.count])).toEqual([['linkedin', 3735], ['x', 689]]);
  });
});

describe('follower totals for other months', () => {
  it('X: exact, from new follows minus unfollows, backwards and forwards from the count', async () => {
    const store = memoryStore();
    await publishAnalyticsFile(store, xOverviewCsv(daysBetween('2026-08-01', '2026-10-31')), { fileName: 'account_overview_analytics.csv', forBrand: 'im' });
    await saveFollowerCount(store, { brand: 'im', platform: 'x', date: '2026-10-15', count: 700, approximate: false, enteredBy: null });
    const t = buildTables(await loadAnalyticsUploads(store));
    // The sample has one new follow and no unfollows a day.
    expect(followerTotals(t, await listFollowerCounts(store), 'im', 'x', ['2026-08', '2026-09', '2026-10'])).toEqual([
      { date: '2026-08-31', total: 700 - 45, estimated: false },
      { date: '2026-09-30', total: 700 - 15, estimated: false },
      { date: '2026-10-31', total: 700 + 16, estimated: false }
    ]);
  });

  it('LinkedIn: an estimate, as its exports give new followers but not unfollows', async () => {
    const store = memoryStore();
    await publishAnalyticsFile(store, followersExport({ from: '2026-09-01', to: '2026-10-23' }, { organic: 2, sponsored: 1 }), { fileName: 'emkayinvestmentmanagers_followers_1.xls', forBrand: 'im' });
    await saveFollowerCount(store, { brand: 'im', platform: 'linkedin', date: '2026-10-23', count: 3735, approximate: false, enteredBy: null });
    const t = buildTables(await loadAnalyticsUploads(store));
    expect(followerTotals(t, await listFollowerCounts(store), 'im', 'linkedin', ['2026-09', '2026-10'])).toEqual([
      { date: '2026-09-30', total: 3735 - 23 * 3, estimated: true },
      { date: '2026-10-23', total: 3735, estimated: false } // the count itself
    ]);
  });

  it('YouTube: whole months of subscribers gained minus lost, spread over their days', async () => {
    const store = memoryStore();
    const sep = youTubeContentZip('2026-09-01', '2026-09-30', [{ id: 'AbCdEfGhIjK', title: 't', published: 'Sep 2, 2026', views: 1 }]);
    await publishAnalyticsFile(store, sep.bytes, { fileName: sep.name, forBrand: 'global' });
    await saveFollowerCount(store, { brand: 'global', platform: 'youtube', date: '2026-09-30', count: 1608, approximate: false, enteredBy: null });
    const t = buildTables(await loadAnalyticsUploads(store));
    // The sample's September totals say 2 subscribers (net).
    expect(followerTotals(t, await listFollowerCounts(store), 'global', 'youtube', ['2026-08', '2026-09'])).toEqual([
      { date: '2026-08-31', total: 1606, estimated: true },
      { date: '2026-09-30', total: 1608, estimated: false }
    ]);
  });

  it('a platform whose exports say nothing about followers shows only the count, marked if rounded', async () => {
    const store = memoryStore();
    await saveFollowerCount(store, { brand: 'wealth', platform: 'x', date: '2026-10-23', count: 1600, approximate: true, enteredBy: null });
    const t = buildTables([]);
    expect(followerTotals(t, await listFollowerCounts(store), 'wealth', 'x', ['2026-09', '2026-10'])).toEqual([
      { date: '2026-10-23', total: 1600, estimated: true }
    ]);
    expect(followerTotals(t, [], 'wealth', 'x', ['2026-10'])).toEqual([]);
  });
});
