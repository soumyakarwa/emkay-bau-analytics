// The calendar view: month grid, what each view shows, and its colours.

import { beforeAll, describe, expect, it } from 'vitest';
import { calendarView, isMonth, monthGrid, shiftMonth } from '../src/lib/calendar/calendar';
import { loadDataset, type Dataset } from '../src/lib/dataset/dataset';
import { memoryStore } from '../src/lib/dataset/store';
import { publish } from '../src/lib/dataset/uploads';
import { readCalendar } from '../src/lib/workbook/read-calendar';
import { buildSample, patch, readXlsx, rowOf } from './sample';

let ds: Dataset;

beforeAll(async () => {
  const store = memoryStore();
  const im = readXlsx(buildSample('Emkay Investment Managers').bytes);
  const row = rowOf(im, 'Aug 2026', 'Three myths');
  // Give one post a problem (a typed-over grey cell) so it carries a warning.
  const imRead = readCalendar(patch(im, 'Aug 2026', { [`C${row}`]: { value: 'TL', formula: false } }), { today: '2026-10-13' });
  await publish(store, imRead, { fileName: 'im.xlsx', contentHash: 'im', now: new Date('2026-10-13T09:00:00Z') });
  const wealth = readXlsx(buildSample('Emkay Wealth Management').bytes);
  await publish(store, readCalendar(wealth, { today: '2026-10-13' }), { fileName: 'w.xlsx', contentHash: 'w', now: new Date('2026-10-13T09:00:01Z') });
  ds = await loadDataset(store);
});

describe('months', () => {
  it('steps across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });

  it('only accepts real months', () => {
    expect(isMonth('2026-10')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('../etc')).toBe(false);
  });

  it('lays a month out in Monday-first weeks', () => {
    const weeks = monthGrid('2026-10'); // 1 Oct 2026 is a Thursday
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe('All of Emkay', () => {
  it('shows every brand, coloured by brand', () => {
    const v = calendarView(ds, 'all', '2026-08');
    expect(new Set(v.posts.map((p) => p.brand))).toEqual(new Set(['im', 'wealth']));
    expect(v.legend.map((l) => [l.key, l.colour])).toEqual([['im', 'im'], ['wealth', 'wealth']]);
    expect(v.posts.every((p) => p.colour === p.brand)).toBe(true);
  });

  it('hides Dropped posts unless asked', () => {
    expect(calendarView(ds, 'all', '2026-08').hiddenDropped).toBe(2);
    const shown = calendarView(ds, 'all', '2026-08', true);
    expect(shown.hiddenDropped).toBe(0);
    expect(shown.posts.filter((p) => p.status === 'Dropped')).toHaveLength(2);
  });

  it('includes moment reminders', () => {
    expect(calendarView(ds, 'all', '2026-08').moments.map((m) => m.text)).toEqual(['Independence Day', 'Independence Day']);
  });
});

describe('one brand', () => {
  it("shows only that brand, coloured by its own comms tasks in the guidebook's chart order; non-BAU tasks are neutral", () => {
    const v = calendarView(ds, 'im', '2026-08');
    expect(v.posts.every((p) => p.brand === 'im')).toBe(true);
    expect(v.legend.map((l) => [l.key, l.colour])).toEqual([
      ['TL', 'im'], ['ML', 'orange'], ['BB', 'grey'], ['CO', 'not-bau']
    ]);
    expect(v.posts.find((p) => p.title === 'Do not share your OTP')!.colour).toBe('not-bau');
    expect(v.posts.find((p) => p.title === 'Three myths')!.label).toBe('TL · Myths vs reality');
  });

  it("carries the post's problems for the warning dot", () => {
    const v = calendarView(ds, 'im', '2026-08');
    const post = v.posts.find((p) => p.title === 'Three myths')!;
    expect(post.problems).toHaveLength(1);
    expect(post.problems[0].message).toContain('typed over');
    expect(v.posts.filter((p) => p.problems.length)).toHaveLength(1);
  });
});
