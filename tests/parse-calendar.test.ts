import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCalendarWorkbook } from '../src/lib/core/parse-calendar';
import type { Cell, SheetGrid, SourceInfo } from '../src/lib/core/types';
import { readWorkbook } from '../src/lib/server/read-workbook';

const source: SourceInfo = { kind: 'upload', fileName: 'test.xlsx' };

// Tiny helpers to build grids by hand.
const t = (text: string): Cell => ({ text, date: null, url: null });
const link = (text: string, url: string): Cell => ({ text, date: null, url });
const d = (y: number, m: number, day: number): Cell => ({ text: `${y}-${m}-${day}`, date: { y, m, d: day }, url: null });
const _: Cell = { text: null, date: null, url: null };

const FRAMEWORK: SheetGrid = {
  name: 'BAU framework',
  rows: [
    [t('Comms task code'), t('Comms task'), t('Content pillar'), t('Content peg')],
    [t('TL'), t('Thought Leadership'), t('Fact-led opinions'), t('Myths vs Reality')],
    [t('ML'), t('Market Leadership'), t('Product Placement'), t('Framework-driven approach - E-Qual')]
  ]
};
const HEADERS = ['Date', 'Day', 'Comms task code', 'Content pillar', 'Content peg', 'Content piece', 'LinkedIn', 'Possible moment marketing'].map(t);
const month = (name: string, ...rows: Cell[][]): SheetGrid => ({ name, rows: [HEADERS, ...rows] });

function parse(...sheets: SheetGrid[]) {
  return parseCalendarWorkbook(sheets, source, new Date('2026-10-12T00:00:00Z'));
}
const errors = (r: ReturnType<typeof parse>) => r.issues.filter((i) => i.level === 'error').map((i) => i.message);

describe('valid workbooks', () => {
  it('parses a minimal workbook', () => {
    const r = parse(
      FRAMEWORK,
      month('October 2026',
        [d(2026, 10, 5), t('Monday'), t('TL'), t('Fact-led opinions'), t('Myths vs Reality'), t('Post A'), link('Post link', 'https://linkedin.com/x'), _],
        [d(2026, 10, 6), t('Tuesday'), _, _, _, _, _, _],
        [d(2026, 10, 7), _, _, _, _, _, _, t('Festival')]
      )
    );
    expect(errors(r)).toEqual([]);
    expect(r.dataset?.months).toEqual(['2026-10']);
    expect(r.dataset?.entries).toHaveLength(2);
    const [a, b] = r.dataset!.entries;
    expect(a).toMatchObject({ date: '2026-10-05', kind: 'content', taskCode: 'TL', title: 'Post A', platforms: [{ platform: 'LinkedIn', url: 'https://linkedin.com/x' }] });
    expect(b).toMatchObject({ kind: 'moment', title: 'Festival', taskCode: null });
  });

  it('ignores case and extra spaces in headers and labels, returning framework spelling', () => {
    const headers = ['  date ', 'DAY', 'comms task  code', 'Content Pillar', 'content peg', 'Content Piece '].map(t);
    const r = parse(FRAMEWORK, { name: 'October 2026', rows: [headers, [d(2026, 10, 5), _, t('tl'), t('fact-led  opinions '), t('MYTHS VS REALITY'), t('Post')]] });
    expect(errors(r)).toEqual([]);
    expect(r.dataset!.entries[0]).toMatchObject({ taskCode: 'TL', pillar: 'Fact-led opinions', peg: 'Myths vs Reality' });
  });

  it('allows columns in any order and ignores unknown columns', () => {
    const headers = ['Content piece', 'Notes', 'Comms task code', 'Date', 'Content peg', 'Content pillar'].map(t);
    const r = parse(FRAMEWORK, { name: 'October 2026', rows: [headers, [t('Post'), t('whatever'), t('ML'), d(2026, 10, 1), _, _]] });
    expect(errors(r)).toEqual([]);
    expect(r.dataset!.entries[0].taskCode).toBe('ML');
  });

  it('handles several months, sorted', () => {
    const r = parse(
      month('November 2026', [d(2026, 11, 2), _, t('TL'), _, _, t('Nov post'), _, _]),
      FRAMEWORK,
      month('October 2026', [d(2026, 10, 2), _, t('TL'), _, _, t('Oct post'), _, _])
    );
    expect(r.dataset!.months).toEqual(['2026-10', '2026-11']);
    expect(r.dataset!.entries.map((e) => e.title)).toEqual(['Oct post', 'Nov post']);
  });
});

describe('the code does not repair the spreadsheet', () => {
  it('rejects dates outside the sheet month instead of moving them', () => {
    const r = parse(FRAMEWORK, month('November 2026', [d(2026, 10, 5), _, t('TL'), _, _, t('Copied row'), _, _]));
    expect(r.dataset).toBeNull();
    expect(errors(r)[0]).toMatch(/2026-10-05 is outside November 2026/);
  });

  it('rejects a wrong year instead of guessing it (e.g. 2001)', () => {
    const r = parse(FRAMEWORK, month('October 2026', [d(2001, 10, 5), _, t('TL'), _, _, t('Post'), _, _]));
    expect(errors(r)[0]).toMatch(/2001-10-05 is outside October 2026/);
  });

  it('rejects text dates', () => {
    const r = parse(FRAMEWORK, month('October 2026', [t('5th Oct'), _, t('TL'), _, _, t('Post'), _, _]));
    expect(errors(r)[0]).toMatch(/is text, not an Excel date/);
  });

  it('rejects a weekday that does not match the date', () => {
    const r = parse(FRAMEWORK, month('October 2026', [d(2026, 10, 5), t('Tuesday'), t('TL'), _, _, t('Post'), _, _]));
    expect(errors(r)[0]).toMatch(/Day says “Tuesday” but 2026-10-05 is a Monday/);
  });

  it('rejects taxonomy labels that are not in the framework', () => {
    const r = parse(FRAMEWORK, month('October 2026',
      [d(2026, 10, 5), _, t('XX'), _, _, t('A'), _, _],
      [d(2026, 10, 6), _, t('ML'), t('Fact-led opinions'), _, t('B'), _, _],
      [d(2026, 10, 7), _, t('ML'), t('Product Placement'), t('EQUAL'), t('C'), _, _],
      [d(2026, 10, 8), _, t('ML'), _, t('Framework-driven approach - E-Qual'), t('D'), _, _]
    ));
    expect(errors(r)).toEqual([
      expect.stringMatching(/“XX” is not in the BAU framework/),
      expect.stringMatching(/Pillar “Fact-led opinions” is not listed under ML/),
      expect.stringMatching(/Peg “EQUAL” is not listed under ML › Product Placement/),
      expect.stringMatching(/peg is filled but Content pillar is empty/)
    ]);
  });

  it('requires a comms task code on content pieces', () => {
    const r = parse(FRAMEWORK, month('October 2026', [d(2026, 10, 5), _, _, _, _, t('Post'), _, _]));
    expect(errors(r)[0]).toMatch(/Comms task code is empty/);
  });

  it('rejects non-web links', () => {
    const r = parse(FRAMEWORK, month('October 2026', [d(2026, 10, 5), _, t('TL'), _, _, t('Post'), link('Post link', 'mailto:someone@example.com'), _]));
    expect(errors(r)[0]).toMatch(/not a web address/);
  });

  it('rejects duplicate and missing headers', () => {
    const dup = parse(FRAMEWORK, { name: 'October 2026', rows: [[...HEADERS, t('LinkedIn')]] });
    expect(errors(dup)[0]).toMatch(/“LinkedIn” appears twice \(columns G and I\)/);
    const missing = parse(FRAMEWORK, { name: 'October 2026', rows: [[t('Date'), t('Content piece')]] });
    expect(errors(missing)).toContain('Missing column “Comms task code” in row 1.');
  });

  it('requires the framework sheet', () => {
    const r = parse(month('October 2026'));
    expect(errors(r)).toContain('The workbook has no sheet named “BAU framework”.');
  });

  it('rejects one code with two names in the framework', () => {
    const fw: SheetGrid = { ...FRAMEWORK, rows: [...FRAMEWORK.rows, [t('TL'), t('Thought leader'), t('X'), t('Y')]] };
    const r = parse(fw, month('October 2026'));
    expect(errors(r)[0]).toMatch(/Code “TL” is called “Thought leader” here but “Thought Leadership” in row 2/);
  });
});

describe('warnings do not block publishing', () => {
  it('warns about extra sheets and rows without a title', () => {
    const r = parse(
      FRAMEWORK,
      { name: 'Notes', rows: [[t('anything')]] },
      month('October 2026', [d(2026, 10, 5), _, t('TL'), _, _, _, _, _], [t('Code'), t('Pillar'), t('6'), _, _, _, _, _])
    );
    expect(r.dataset).not.toBeNull();
    const warnings = r.issues.filter((i) => i.level === 'warning');
    expect(warnings.map((w) => w.message)).toEqual([
      expect.stringMatching(/Sheet “Notes” is not a month/),
      expect.stringMatching(/no Content piece or moment marketing/),
      expect.stringMatching(/no Content piece or moment marketing/)
    ]);
  });
});

describe('the bundled template', () => {
  it('is a valid workbook with no issues at all', async () => {
    const file = readFileSync(new URL('../src/lib/assets/calendar-template.xlsx', import.meta.url));
    const r = parseCalendarWorkbook(await readWorkbook(file), source);
    expect(r.issues).toEqual([]);
    expect(r.dataset!.months).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(r.dataset!.entries.length).toBeGreaterThan(20);
    expect(r.dataset!.entries.find((e) => e.platforms.some((p) => p.url))).toBeTruthy();
  });
});
