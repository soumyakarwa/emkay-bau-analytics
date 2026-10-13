// Reads an .xlsx file into plain grids for the parser. This is the only place
// that knows about the Excel library, so swapping libraries touches one file.

import ExcelJS from 'exceljs';
import type { Cell, SheetGrid } from '../core/types';

const EMPTY: Cell = { text: null, date: null, url: null };

function textOf(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('hyperlink' in value) return textOf((value as ExcelJS.CellHyperlinkValue).text as ExcelJS.CellValue);
    if ('formula' in value || 'sharedFormula' in value) {
      return textOf((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    }
    if ('error' in value) return String((value as ExcelJS.CellErrorValue).error);
  }
  return null;
}

function convert(cell: ExcelJS.Cell): Cell {
  // In a merged range only the top-left cell holds the value; the library
  // repeats it in every covered cell, which would duplicate headers.
  if (cell.isMerged && cell.master !== cell) return EMPTY;
  let value = cell.value;
  if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
    value = (value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue;
  }
  if (value === null || value === undefined || value === '') return EMPTY;

  // Excel stores dates as serial numbers; the library returns a Date at UTC
  // midnight when the cell is formatted as a date. Plain text is never parsed.
  const date =
    value instanceof Date && !Number.isNaN(value.getTime())
      ? { y: value.getUTCFullYear(), m: value.getUTCMonth() + 1, d: value.getUTCDate() }
      : null;

  const raw = textOf(value);
  const text = raw === null ? null : raw.trim() || null;

  let url: string | null = null;
  if (typeof value === 'object' && value !== null && 'hyperlink' in value) {
    url = (value as ExcelJS.CellHyperlinkValue).hyperlink?.trim() || null;
  }
  if (!url && cell.hyperlink) url = cell.hyperlink.trim() || null;
  // Internal workbook links ("#Sheet!A1") are not web links.
  if (url?.startsWith('#')) url = null;

  if (!text && !date && !url) return EMPTY;
  return { text, date, url };
}

export async function readWorkbook(data: ArrayBuffer | Buffer): Promise<SheetGrid[]> {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  // exceljs' types predate Node's generic Buffer; the runtime accepts any Buffer.
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  return workbook.worksheets.map((ws) => {
    const rows: Cell[][] = [];
    const width = ws.columnCount;
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells: Cell[] = [];
      for (let c = 1; c <= width; c++) cells.push(convert(row.getCell(c)));
      rows.push(cells);
    }
    // Drop trailing empty rows so row counts reflect real content.
    while (rows.length && rows[rows.length - 1].every((c) => c === EMPTY)) rows.pop();
    return { name: ws.name, rows };
  });
}

export class NotAnXlsxError extends Error {}

/** Cheap check before parsing: .xlsx files are zip archives starting with "PK". */
export function assertXlsx(data: ArrayBuffer | Buffer) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new NotAnXlsxError('This file is not an .xlsx workbook. In Excel, use File › Save As › Excel Workbook (.xlsx).');
  }
}
