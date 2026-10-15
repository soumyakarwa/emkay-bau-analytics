// Combining uploads into the four tables: posts (with every snapshot), daily, audience, benchmark.

import { describe, expect, it } from 'vitest';
import { buildTables, dailySeries, lastDay, latestPosts, monthlyTotals, postHistory } from '../src/lib/analytics/tables';
import { loadAnalyticsUploads, publishAnalyticsFile } from '../src/lib/analytics/uploads';
import { memoryStore, type Store } from '../src/lib/dataset/store';
import type { BrandId } from '../src/lib/brands';
import { competitorsExport, contentExport, followersExport, postId } from './linkedin-sample';

async function upload(store: Store, bytes: Uint8Array, name: string, day: string, brand: BrandId = 'im') {
  const r = await publishAnalyticsFile(store, bytes, { fileName: name, forBrand: brand, now: new Date(`${day}T05:00:00Z`) });
  expect(r.status).toBe('published');
}

/** Three monthly content exports: post 02 keeps growing, post 03 flattens, 04 appears in October. */
async function threeMonths(): Promise<Store> {
  const store = memoryStore();
  await upload(store, contentExport([
    { id: 2, created: '2026-08-03', impressions: 400, likes: 10 },
    { id: 3, created: '2026-08-20', impressions: 300, likes: 5 }
  ], { from: '2025-09-13', to: '2026-09-12' }, 100), 'p_content_1.xls', '2026-09-13');
  await upload(store, contentExport([
    { id: 2, created: '2026-08-03', impressions: 500, likes: 14 },
    { id: 3, created: '2026-08-20', impressions: 310, likes: 5 },
    { id: 4, created: '2026-10-01', impressions: 90, likes: 2 },
    { id: 4, created: '2026-10-01', impressions: 5000, type: 'Sponsored', campaign: 'Boost', campaignDates: ['2026-10-02', '2026-10-05'] }
  ], { from: '2025-10-14', to: '2026-10-13' }, 120), 'p_content_2.xls', '2026-10-14');
  await upload(store, contentExport([
    { id: 2, created: '2026-08-03', impressions: 520, likes: 15 },
    { id: 3, created: '2026-08-20', impressions: 310, likes: 5 }
  ], { from: '2025-11-12', to: '2026-11-11' }, 130), 'p_content_3.xls', '2026-11-12');
  return store;
}

describe('posts', () => {
  it('keeps every snapshot, tagged with its export day', async () => {
    const t = buildTables(await loadAnalyticsUploads(await threeMonths()));
    const two = t.posts.filter((p) => p.postId === `activity:${postId(2)}`);
    expect(two.map((p) => [p.asOf, p.impressions])).toEqual([['2026-09-12', 400], ['2026-10-13', 500], ['2026-11-11', 520]]);
  });

  it('latest: the newest figures of each post and campaign, even when a post is not in the newest export', async () => {
    const latest = latestPosts(buildTables(await loadAnalyticsUploads(await threeMonths())).posts);
    const figures = Object.fromEntries(latest.map((p) => [`${p.postId.slice(-2)}${p.sponsored ? 's' : ''}`, [p.impressions, p.asOf]]));
    expect(figures).toEqual({
      '02': [520, '2026-11-11'],
      '03': [310, '2026-11-11'],
      '04': [90, '2026-10-13'],
      '04s': [5000, '2026-10-13']
    });
  });

  it("history: one post's organic figures over time", async () => {
    const t = buildTables(await loadAnalyticsUploads(await threeMonths()));
    expect(postHistory(t.posts, 'im', `activity:${postId(2)}`).map((p) => [p.asOf, p.impressions, p.reactions])).toEqual([
      ['2026-09-12', 400, 10], ['2026-10-13', 500, 14], ['2026-11-11', 520, 15]
    ]);
    expect(postHistory(t.posts, 'im', `activity:${postId(4)}`).map((p) => p.impressions)).toEqual([90]); // not the sponsored row
    expect(postHistory(t.posts, 'global', `activity:${postId(2)}`)).toEqual([]);
  });

  it('does not depend on the order the files were uploaded in', async () => {
    const store = memoryStore();
    await upload(store, contentExport([{ id: 2, created: '2026-08-03', impressions: 520 }], { from: '2026-08-01', to: '2026-11-11' }), 'p_content_3.xls', '2026-11-12');
    await upload(store, contentExport([{ id: 2, created: '2026-08-03', impressions: 400 }], { from: '2026-08-01', to: '2026-09-12' }), 'p_content_1.xls', '2026-11-13');
    const latest = latestPosts(buildTables(await loadAnalyticsUploads(store)).posts);
    expect(latest.map((p) => [p.impressions, p.asOf])).toEqual([[520, '2026-11-11']]);
  });
});

describe('daily', () => {
  it('takes each day from the newest export covering it, and keeps days older exports alone still have', async () => {
    const t = buildTables(await loadAnalyticsUploads(await threeMonths()));
    const series = dailySeries(t, 'im', 'content', 'Impressions (organic)');
    const at = (d: string) => series.find((s) => s.date === d)?.value;
    expect([at('2025-09-13'), at('2025-10-13'), at('2025-10-14'), at('2025-11-12'), at('2026-11-11')]).toEqual([100, 100, 120, 130, 130]);
    expect(series[0].date).toBe('2025-09-13'); // a year and two months: more than any one export
    expect(series).toHaveLength(425);
    expect(lastDay(t, 'im', 'content')).toBe('2026-11-11');
    expect(monthlyTotals(t, 'im', 'content', 'Impressions (organic)').get('2026-09')).toBe(30 * 130);
  });

  it('keeps organic and sponsored followers apart', async () => {
    const store = memoryStore();
    await upload(store, followersExport({ from: '2026-01-01', to: '2026-01-31' }, { organic: 3, sponsored: 4 }), 'p_followers_1.xls', '2026-02-01');
    const t = buildTables(await loadAnalyticsUploads(store));
    expect(monthlyTotals(t, 'im', 'followers', 'Organic followers').get('2026-01')).toBe(93);
    expect(monthlyTotals(t, 'im', 'followers', 'Sponsored followers').get('2026-01')).toBe(124);
  });
});

describe('audience', () => {
  it('keeps every snapshot, so the mix can be followed over time', async () => {
    const store = memoryStore();
    await upload(store, followersExport({ from: '2025-10-13', to: '2026-10-12' }, { senior: 1204 }), 'p_followers_1.xls', '2026-10-13');
    await upload(store, followersExport({ from: '2025-11-12', to: '2026-11-11' }, { senior: 1230 }), 'p_followers_2.xls', '2026-11-12');
    const t = buildTables(await loadAnalyticsUploads(store));
    expect(t.audience.filter((a) => a.label === 'Senior').map((a) => [a.of, a.to, a.value])).toEqual([
      ['followers', '2026-10-12', 1204], ['followers', '2026-11-11', 1230]
    ]);
  });
});

describe('benchmark', () => {
  it('keeps each period, and a re-export of the same period replaces it', async () => {
    const store = memoryStore();
    const sep = { from: '2026-09-01', to: '2026-09-30' };
    await upload(store, competitorsExport(sep, [['Emkay Global Financial Services Ltd', 88000, 900, 200, 15], ['Peer Capital', 30000, 500, 1000, 20]]), 'a.xlsx', '2026-10-01', 'global');
    await upload(store, competitorsExport(sep, [['Emkay Global Financial Services Ltd', 88000, 900, 210, 15], ['Peer Capital', 30000, 500, 1000, 20]]), 'b.xlsx', '2026-10-02', 'global');
    await upload(store, competitorsExport({ from: '2026-10-01', to: '2026-10-31' }, [['Emkay Global Financial Services Ltd', 89000, 1000, 400, 18]]), 'c.xlsx', '2026-11-01', 'global');
    const t = buildTables(await loadAnalyticsUploads(store));
    expect(t.benchmark.map((b) => [b.from, b.page, b.own, b.engagements])).toEqual([
      ['2026-09-01', 'Emkay Global Financial Services Ltd', true, 210],
      ['2026-09-01', 'Peer Capital', false, 1000],
      ['2026-10-01', 'Emkay Global Financial Services Ltd', true, 400]
    ]);
  });
});
