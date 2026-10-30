// The monthly cycle, 25th to 24th, and how periods that don't match it are counted.

import { describe, expect, it } from 'vitest';
import { cycleDates, cycleDone, cycleOf, cycleRange, isWholeCycle, lastDoneCycle } from '../src/lib/analytics/cycle';
import { addablePeriods } from '../src/lib/analytics/tables';

describe('cycle', () => {
  it('runs from the 25th to the 24th, named after the month it ends in', () => {
    expect(cycleOf('2026-09-24')).toBe('2026-09');
    expect(cycleOf('2026-09-25')).toBe('2026-10');
    expect(cycleOf('2026-12-31')).toBe('2027-01');
    expect(cycleRange('2026-01')).toEqual({ from: '2025-12-25', to: '2026-01-24' });
    expect(cycleDates('2026-10')).toBe('25 Sep–24 Oct');
    expect(cycleDates('2026-10', true)).toBe('25 Sep 2026 – 24 Oct 2026');
  });

  it('knows whole cycles and when a cycle has ended', () => {
    expect(isWholeCycle('2026-09-25', '2026-10-24')).toBe(true);
    expect(isWholeCycle('2026-10-01', '2026-10-31')).toBe(false);
    expect(cycleDone('2026-10', '2026-10-24')).toBe(true);
    expect(cycleDone('2026-10', '2026-10-23')).toBe(false);
    expect(lastDoneCycle('2026-10-26')).toBe('2026-10');
    expect(lastDoneCycle('2026-10-20')).toBe('2026-09');
  });

  it('adds up whole cycles, and older calendar months only where they don’t overlap', () => {
    const periods = [
      { from: '2026-07-01', to: '2026-07-31' }, // overlaps the August cycle: left out
      { from: '2026-05-01', to: '2026-05-31' }, // older, no overlap: counted
      { from: '2026-07-25', to: '2026-08-24' },
      { from: '2025-10-14', to: '2026-10-13' } // a year: never added up
    ];
    expect(addablePeriods(periods).map((p) => p.from)).toEqual(['2026-07-25', '2026-05-01']);
  });
});
