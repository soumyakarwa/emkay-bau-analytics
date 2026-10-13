// The template (Python) and the reader (TypeScript) must agree. This builds a fresh workbook
// with the template builder and checks the reader gets back exactly what was put in.

import { beforeAll, describe, expect, it } from 'vitest';
import { readCalendarFile, summarise, type ReadResult } from '../src/lib/workbook';
import { buildSample, type Expected } from './sample';

let result: ReadResult;
let expected: Expected;

beforeAll(() => {
  const sample = buildSample();
  expected = sample.expected;
  result = readCalendarFile(sample.bytes, { today: expected.today });
});

describe('a workbook straight from the template', () => {
  it('reads with no problems at all', () => {
    expect(result.issues).toEqual([]);
    expect(result.workbook).not.toBeNull();
  });

  it('reads the Start here details', () => {
    const wb = result.workbook!;
    expect(wb.brand).toBe(expected.brand);
    expect(wb.fy).toBe(expected.fy);
    expect(wb.bauStart).toBe(expected.bauStart);
  });

  it('reads the comms tasks and framework', () => {
    const wb = result.workbook!;
    expect(wb.commsTasks.map(({ code, countsAsBau, target }) => ({ code, countsAsBau, target }))).toEqual(expected.commsTasks);
    expect(Object.fromEntries(wb.framework.map((p) => [p.peg, p.commsTask]))).toEqual(expected.pegs);
  });

  it('finds every post and moment', () => {
    expect(result.workbook!.posts).toHaveLength(expected.posts);
    expect(result.workbook!.moments).toHaveLength(expected.moments);
  });

  it('counts posts per comms task per month as the template data says', () => {
    const s = summarise(result.workbook!);
    const counts: Record<string, number> = {};
    for (const t of s.tasks) for (const [month, n] of Object.entries(t.byMonth)) if (n) counts[`${month}|${t.code}`] = n;
    expect(counts).toEqual(expected.counts);
  });
});
