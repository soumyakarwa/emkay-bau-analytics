// The .xls reader, on files written by the test writer (xls-writer.ts).

import { describe, expect, it } from 'vitest';
import { isXls, readXls } from '../src/lib/workbook/xls';
import { writeXls } from './xls-writer';

describe('.xls reader', () => {
  const long = 'A post that goes on and on, '.repeat(12).trim();
  const unicode = 'India’s “quick” commerce — ₹ and 🇮🇳 '.repeat(4).trim();
  const file = writeXls([
    {
      name: 'All posts',
      rows: [
        ['Engagement metrics for individual posts.'],
        ['Post title', 'Impressions', 'Rate', 'Big', 'Flag', 'Sum', 'Text formula'],
        [long, 530, 0.06415094435214996, 123456789012, true, { formula: 42.5 }, { formula: 'done' }],
        [unicode, 12, 1.5, -7, false, null, null],
        [null, null, 3.25]
      ]
    },
    { name: 'Location', rows: [['Location', 'Total views'], ['Greater Jaipur Area, India', 99]] }
  ]);
  const sheets = readXls(file);

  it('recognises the file and lists its sheets in order', () => {
    expect(isXls(file)).toBe(true);
    expect(sheets.map((s) => s.name)).toEqual(['All posts', 'Location']);
  });

  it('reads text, including long and non-Latin text split across records', () => {
    const s = sheets[0];
    expect(s.cell(1, 1).value).toBe('Engagement metrics for individual posts.');
    expect(s.cell(3, 1).value).toBe(long);
    expect(s.cell(4, 1).value).toBe(unicode);
  });

  it('reads numbers stored every way Excel stores them', () => {
    const s = sheets[0];
    expect([s.cell(3, 2).value, s.cell(3, 3).value, s.cell(3, 4).value]).toEqual([530, 0.06415094435214996, 123456789012]);
    expect([s.cell(4, 2).value, s.cell(4, 3).value, s.cell(4, 4).value]).toEqual([12, 1.5, -7]);
    expect(s.cell(5, 3).value).toBe(3.25);
  });

  it('reads booleans and the saved results of formulas', () => {
    const s = sheets[0];
    expect([s.cell(3, 5).value, s.cell(4, 5).value]).toEqual([true, false]);
    expect(s.cell(3, 6)).toEqual({ value: 42.5, formula: true, url: null });
    expect(s.cell(3, 7)).toEqual({ value: 'done', formula: true, url: null });
  });

  it('returns empty cells for blanks and beyond the data', () => {
    const s = sheets[0];
    expect(s.cell(4, 6).value).toBeNull();
    expect(s.cell(5, 1).value).toBeNull();
    expect(s.cell(99, 99).value).toBeNull();
    expect(s.maxRow).toBe(5);
    expect(sheets[1].cell(2, 2).value).toBe(99);
  });

  it('gives the same result however the string table is split', () => {
    const rows = [['x'.repeat(300), 'é'.repeat(70) + '€'.repeat(70)]];
    for (const size of [9, 13, 64, 8224]) {
      const s = readXls(writeXls([{ name: 'S', rows }], { sstRecordSize: size }))[0];
      expect([s.cell(1, 1).value, s.cell(1, 2).value]).toEqual(rows[0]);
    }
  });

  it('refuses files that are not .xls workbooks', () => {
    expect(isXls(new Uint8Array(600))).toBe(false);
    expect(() => readXls(new TextEncoder().encode('not a workbook'.repeat(50)))).toThrow(/not a valid \.xls/);
  });
});
