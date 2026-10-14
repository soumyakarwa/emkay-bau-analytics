// Builds the sample workbook with the Python template builder (tools/template/make_sample.py),
// so the tests always read a file exactly as the template writes it.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readXlsx, columnLetter, parseRef, type Cell, type Sheet } from '../src/lib/workbook/xlsx';

const TOOLS = resolve(__dirname, '../../tools');

function python(): string {
  const candidates = [process.env.PYTHON, join(TOOLS, '.venv/bin/python'), join(TOOLS, '.venv/Scripts/python.exe'), 'python3', 'python'];
  for (const p of candidates) {
    if (!p) continue;
    try {
      execFileSync(p, ['-c', 'import openpyxl'], { stdio: 'ignore' });
      return p;
    } catch {
      /* try the next one */
    }
  }
  throw new Error('These tests need Python with openpyxl. Set up tools/ first (see tools/README.md).');
}

export interface Expected {
  brand: string;
  fy: number;
  bauStart: string;
  today: string;
  posts: number;
  moments: number;
  counts: Record<string, number>;
  commsTasks: { code: string; countsAsBau: boolean; target: number | null }[];
  pegs: Record<string, string>;
}

export function buildSample(brand?: string): { bytes: Uint8Array; expected: Expected } {
  const dir = mkdtempSync(join(tmpdir(), 'bau-sample-'));
  const xlsx = join(dir, 'sample.xlsx');
  const json = join(dir, 'expected.json');
  execFileSync(python(), [join(TOOLS, 'template/make_sample.py'), xlsx, json, ...(brand ? [brand] : [])], { stdio: 'pipe' });
  if (!existsSync(xlsx)) throw new Error('make_sample.py did not write the workbook');
  return { bytes: new Uint8Array(readFileSync(xlsx)), expected: JSON.parse(readFileSync(json, 'utf8')) };
}

/** Returns the sheets with some cells replaced, without touching the original. */
export function patch(sheets: Sheet[], sheetName: string, cells: Record<string, Partial<Cell> | null>): Sheet[] {
  return sheets.map((s) => {
    if (s.name !== sheetName) return s;
    let maxRow = s.maxRow;
    for (const ref of Object.keys(cells)) maxRow = Math.max(maxRow, parseRef(ref).row);
    return {
      ...s,
      maxRow,
      cell: (row: number, col: number) => {
        const ref = `${columnLetter(col)}${row}`;
        if (!(ref in cells)) return s.cell(row, col);
        const p = cells[ref];
        return p === null ? { value: null, formula: false, url: null } : { ...s.cell(row, col), ...p };
      }
    };
  });
}

/** Row number of the post with this title on a month sheet (Title is column G). */
export function rowOf(sheets: Sheet[], sheetName: string, title: string): number {
  const s = sheets.find((x) => x.name === sheetName)!;
  for (let r = 2; r <= s.maxRow; r++) if (s.cell(r, 7).value === title) return r;
  throw new Error(`No row titled "${title}" on ${sheetName}`);
}

export { readXlsx };
