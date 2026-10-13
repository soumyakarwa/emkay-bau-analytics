import { describe, expect, it } from 'vitest';
import { filterEntries, initialMonth, monthWeeks, taxonomyOptions, EMPTY_FILTERS } from '../src/lib/core/calendar-view';
import type { CalendarEntry, Framework } from '../src/lib/core/types';

const framework: Framework = {
  tasks: [
    { code: 'TL', name: 'Thought Leadership' },
    { code: 'ML', name: 'Market Leadership' }
  ],
  rows: [
    { code: 'TL', task: 'Thought Leadership', pillar: 'P1', peg: 'G1' },
    { code: 'TL', task: 'Thought Leadership', pillar: 'P2', peg: 'G2' },
    { code: 'ML', task: 'Market Leadership', pillar: 'P3', peg: 'G3' }
  ]
};

const entry = (over: Partial<CalendarEntry>): CalendarEntry => ({
  id: Math.random().toString(),
  date: '2026-10-05',
  month: '2026-10',
  kind: 'content',
  title: 'T',
  taskCode: 'TL',
  pillar: 'P1',
  peg: 'G1',
  platforms: [],
  status: null,
  format: null,
  poc: null,
  details: null,
  moment: null,
  links: [],
  source: { sheet: 'October 2026', row: 2 },
  ...over
});

describe('monthWeeks', () => {
  it('starts weeks on Monday', () => {
    const weeks = monthWeeks('2026-10'); // 1 Oct 2026 is a Thursday
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe('initialMonth', () => {
  it('prefers the current month, then the next one available', () => {
    expect(initialMonth(['2026-09', '2026-10', '2026-11'], new Date('2026-10-12'))).toBe('2026-10');
    expect(initialMonth(['2026-11', '2026-12'], new Date('2026-10-12'))).toBe('2026-11');
    expect(initialMonth(['2026-08', '2026-09'], new Date('2026-10-12'))).toBe('2026-09');
    expect(initialMonth([])).toBeNull();
  });
});

describe('filters', () => {
  const entries = [
    entry({ title: 'Alpha', platforms: [{ platform: 'LinkedIn', url: null }], status: 'Planned' }),
    entry({ title: 'Beta', taskCode: 'ML', pillar: 'P3', peg: 'G3', details: 'about e-qual' }),
    entry({ title: 'Diwali', kind: 'moment', taskCode: null, pillar: null, peg: null })
  ];
  it('filters by task, platform, status and search', () => {
    expect(filterEntries(entries, { ...EMPTY_FILTERS, task: 'ML' }).map((e) => e.title)).toEqual(['Beta']);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, platform: 'LinkedIn' }).map((e) => e.title)).toEqual(['Alpha']);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, status: 'Planned' }).map((e) => e.title)).toEqual(['Alpha']);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, search: 'E-QUAL' }).map((e) => e.title)).toEqual(['Beta']);
    expect(filterEntries(entries, EMPTY_FILTERS)).toHaveLength(3);
  });
  it('cascades pillar and peg options', () => {
    expect(taxonomyOptions(framework, { task: 'TL', pillar: '' })).toMatchObject({ pillars: ['P1', 'P2'], pegs: ['G1', 'G2'] });
    expect(taxonomyOptions(framework, { task: 'TL', pillar: 'P2' }).pegs).toEqual(['G2']);
    expect(taxonomyOptions(framework, { task: '', pillar: '' }).pillars).toEqual(['P1', 'P2', 'P3']);
  });
});
