// Publishing uploads, keeping their history, and combining the brands into All of Emkay.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { brandByName } from '../src/lib/brands';
import { buildDataset, emkayTotals, filterPosts, loadDataset } from '../src/lib/dataset/dataset';
import { memoryStore } from '../src/lib/dataset/store';
import { getUpload, latestUploads, listUploads, publish, publishFile } from '../src/lib/dataset/uploads';
import { folderStore } from '../src/lib/server/folder-store';
import { readCalendar } from '../src/lib/workbook/read-calendar';
import type { Sheet } from '../src/lib/workbook/xlsx';
import { buildSample, patch, readXlsx, rowOf } from './sample';

const TODAY = '2026-10-13';
let im: { bytes: Uint8Array; sheets: Sheet[] };
let wealth: { bytes: Uint8Array; sheets: Sheet[] };
let unknown: Uint8Array;

beforeAll(() => {
  const a = buildSample('Emkay Investment Managers');
  const b = buildSample('Emkay Wealth Management');
  im = { bytes: a.bytes, sheets: readXlsx(a.bytes) };
  wealth = { bytes: b.bytes, sheets: readXlsx(b.bytes) };
  unknown = buildSample('Emkay Something Else').bytes;
});

const at = (iso: string) => ({ now: new Date(iso), fileName: 'calendar.xlsx' });
const read = (sheets: Sheet[]) => readCalendar(sheets, { today: TODAY });

describe('brands', () => {
  it('match on the brand name, ignoring case and spaces', () => {
    expect(brandByName('  emkay wealth   management ')?.id).toBe('wealth');
    expect(brandByName('Emkay IM')).toBeUndefined();
  });
});

describe('publishing', () => {
  it('stores a valid workbook as that brand and year', async () => {
    const store = memoryStore();
    const r = await publishFile(store, im.bytes, { ...at('2026-10-13T09:00:00Z'), today: TODAY });
    expect(r.status).toBe('published');
    expect(r.upload).toMatchObject({ brand: 'im', fy: 2027, posts: 9, warnings: 0 });
    expect((await getUpload(store, r.upload!.id))!.workbook.brand).toBe('Emkay Investment Managers');
  });

  it('refuses a workbook whose brand is not one of the three', async () => {
    const r = await publishFile(memoryStore(), unknown, { ...at('2026-10-13T09:00:00Z'), today: TODAY });
    expect(r.status).toBe('refused');
    expect(r.issues[0].message).toContain('"Emkay Something Else", is not one of');
  });

  it("refuses another brand's workbook", async () => {
    const r = await publishFile(memoryStore(), wealth.bytes, { ...at('2026-10-13T09:00:00Z'), forBrand: 'im', today: TODAY });
    expect(r.status).toBe('refused');
    expect(r.issues[0].message).toContain("Emkay Wealth Management's, but it was uploaded for Emkay Investment Managers");
  });

  it('refuses a workbook with a blocking problem and stores nothing', async () => {
    const store = memoryStore();
    const row = rowOf(im.sheets, 'Sep 2026', 'Data post');
    const r = await publish(store, read(patch(im.sheets, 'Sep 2026', { [`E${row}`]: { value: 'Made-up peg' } })), { ...at('2026-10-13T09:00:00Z'), contentHash: 'x' });
    expect(r.status).toBe('refused');
    expect(await listUploads(store)).toEqual([]);
  });

  it('stores nothing new when the file is identical to the latest upload', async () => {
    const store = memoryStore();
    await publishFile(store, im.bytes, { ...at('2026-10-13T09:00:00Z'), today: TODAY });
    const again = await publishFile(store, im.bytes, { ...at('2026-10-13T10:00:00Z'), today: TODAY });
    expect(again.status).toBe('unchanged');
    expect(await listUploads(store)).toHaveLength(1);
  });
});

describe('history', () => {
  it('keeps every upload, uses the latest, and reports framework changes', async () => {
    const store = memoryStore();
    await publish(store, read(im.sheets), { ...at('2026-10-01T09:00:00Z'), contentHash: 'first' });

    // Move "Legacy" from BB › Company to TL › Fact-led opinions, and change the TL target.
    const fw = im.sheets.find((s) => s.name === 'Framework')!;
    let legacy = 0;
    for (let r = 2; r <= fw.maxRow; r++) if (fw.cell(r, 3).value === 'Legacy') legacy = r;
    const edited = patch(patch(im.sheets, 'Framework', { [`A${legacy}`]: { value: 'TL' }, [`B${legacy}`]: { value: 'Fact-led opinions' } }),
      'Comms tasks', { D2: { value: 0.5 }, D4: { value: 0.1 } });
    const r = await publish(store, read(edited), { ...at('2026-10-14T09:00:00Z'), contentHash: 'second', uploadedBy: 'Asha Rao' });

    expect(r.status).toBe('published');
    expect(r.previous?.uploadedAt).toBe('2026-10-01T09:00:00.000Z');
    expect(r.changes.map((c) => c.kind).sort()).toEqual(['peg-moved', 'task-changed', 'task-changed']);
    expect(r.changes.find((c) => c.kind === 'peg-moved')!.message).toContain('re-files 1 post');

    const history = await listUploads(store, { brand: 'im' });
    expect(history.map((u) => u.contentHash)).toEqual(['first', 'second']);
    const [latest] = await latestUploads(store);
    expect(latest.contentHash).toBe('second');
    expect(latest.workbook.posts.find((p) => p.title === 'Second post on the same day')!.commsTask).toBe('TL');
    const first = await getUpload(store, history[0].id);
    expect(first!.workbook.posts.find((p) => p.title === 'Second post on the same day')!.commsTask).toBe('BB');
  });
});

describe('All of Emkay', () => {
  it('combines the latest upload of each brand, each with its own framework', async () => {
    const store = memoryStore();
    await publishFile(store, im.bytes, { ...at('2026-10-13T09:00:00Z'), today: TODAY });
    await publishFile(store, wealth.bytes, { ...at('2026-10-13T09:00:01Z'), today: TODAY });
    const ds = await loadDataset(store);

    expect(ds.brandYears.map((y) => y.brand)).toEqual(['im', 'wealth']);
    expect(ds.posts).toHaveLength(18);
    expect(new Set(ds.posts.map((p) => p.key)).size).toBe(18);
    expect(ds.posts.map((p) => p.date)).toEqual([...ds.posts.map((p) => p.date)].sort());
    expect(filterPosts(ds, { brand: 'wealth', month: '2026-08' })).toHaveLength(5);
    expect(ds.brandYears[0].summary.bau.total).toBe(6); // Aug 3 (one Dropped), Sep 2, Nov 1
  });

  it('counts posts per brand per month, leaving out Dropped', async () => {
    const store = memoryStore();
    await publishFile(store, im.bytes, { ...at('2026-10-13T09:00:00Z'), today: TODAY });
    const t = emkayTotals(await loadDataset(store));
    expect(t.byBrand).toEqual([{ brand: 'im', byMonth: { '2026-07': 1, '2026-08': 4, '2026-09': 2, '2026-11': 1 }, total: 8 }]);
    expect(t.byPlatform.find((p) => p.platform === 'LinkedIn')).toEqual({ brand: 'im', platform: 'LinkedIn', published: 6, planned: 1 });
  });

  it('builds the same dataset from uploads directly', async () => {
    const store = memoryStore();
    await publishFile(store, im.bytes, { ...at('2026-10-13T09:00:00Z'), today: TODAY });
    expect(buildDataset(await latestUploads(store))).toEqual(await loadDataset(store));
  });
});

describe('folder store', () => {
  it('keeps uploads as files and finds them again', async () => {
    const store = folderStore(mkdtempSync(join(tmpdir(), 'bau-store-')));
    const r = await publishFile(store, wealth.bytes, { ...at('2026-10-13T09:00:00Z'), today: TODAY });
    expect(await store.list('uploads/wealth/fy27/')).toEqual([`uploads/wealth/fy27/${r.upload!.id}.json`]);
    expect((await latestUploads(store))[0].id).toBe(r.upload!.id);
  });
});
