// Minimal .xlsx reader. An .xlsx file is a zip of XML parts; this reads only what the
// calendar needs: cell values, whether a cell holds a formula, hyperlinks and Excel tables.
// It never evaluates formulas: a formula cell's value is whatever Excel last saved (or null).

import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

export interface Cell {
  /** Saved value. For a formula cell, the result Excel last calculated, or null if none was saved. */
  value: string | number | boolean | null;
  /** True when the cell holds a formula. */
  formula: boolean;
  /** Hyperlink target, if the cell has one. */
  url: string | null;
}

export interface TableInfo {
  name: string;
  /** 1-based, inclusive. Row `top` is the header row. */
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Sheet {
  name: string;
  /** Highest row number that has any cell. */
  maxRow: number;
  tables: TableInfo[];
  /** 1-based row and column. Returns an empty cell when there is nothing there. */
  cell(row: number, col: number): Cell;
}

const EMPTY: Cell = Object.freeze({ value: null, formula: false, url: null });

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  // Decode character references such as &#8230; (…), which some tools write instead of the character.
  htmlEntities: true,
  trimValues: false,
  removeNSPrefix: true,
  isArray: (name) => ['sheet', 'row', 'c', 'si', 'r', 'Relationship', 'hyperlink', 'tablePart'].includes(name)
});

/** "AB12" → { row: 12, col: 28 } */
export function parseRef(ref: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.replace(/\$/g, ''));
  if (!m) throw new Error(`Bad cell reference: ${ref}`);
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]), col };
}

/** 28 → "AB" */
export function columnLetter(col: number): string {
  let out = '';
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
  return out;
}

/** Text content of a <t>, <is> or <si> node, joining rich-text runs. */
function textOf(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  const n = node as Record<string, unknown>;
  if (n.t !== undefined) return textOf(n.t);
  if (Array.isArray(n.r)) return n.r.map((run) => textOf((run as Record<string, unknown>).t)).join('');
  if (n['#text'] !== undefined) return String(n['#text']);
  return '';
}

/** Resolves a relationship target against the folder of the part that owns it. */
function resolve(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function relsFor(files: Record<string, Uint8Array>, part: string): Map<string, { target: string; external: boolean }> {
  const dir = part.split('/').slice(0, -1).join('/');
  const name = part.split('/').pop();
  const raw = files[`${dir}/_rels/${name}.rels`];
  const map = new Map<string, { target: string; external: boolean }>();
  if (!raw) return map;
  const doc = parser.parse(strFromU8(raw));
  for (const rel of doc.Relationships?.Relationship ?? []) {
    const external = rel['@_TargetMode'] === 'External';
    map.set(rel['@_Id'], { target: external ? rel['@_Target'] : resolve(part, rel['@_Target']), external });
  }
  return map;
}

export function readXlsx(bytes: Uint8Array): Sheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('This file is not a valid .xlsx workbook.');
  }
  const wbPart = 'xl/workbook.xml';
  if (!files[wbPart]) throw new Error('This file is not a valid .xlsx workbook.');

  const shared: string[] = [];
  if (files['xl/sharedStrings.xml']) {
    const doc = parser.parse(strFromU8(files['xl/sharedStrings.xml']));
    for (const si of doc.sst?.si ?? []) shared.push(textOf(si));
  }

  const wbRels = relsFor(files, wbPart);
  const wb = parser.parse(strFromU8(files[wbPart]));
  const sheets: Sheet[] = [];
  for (const s of wb.workbook?.sheets?.sheet ?? []) {
    const rel = wbRels.get(s['@_id']);
    if (!rel || !files[rel.target]) continue;
    sheets.push(readSheet(files, rel.target, String(s['@_name']), shared));
  }
  return sheets;
}

function readSheet(files: Record<string, Uint8Array>, part: string, name: string, shared: string[]): Sheet {
  const doc = parser.parse(strFromU8(files[part])).worksheet ?? {};
  const rels = relsFor(files, part);
  const cells = new Map<string, Cell>();
  let maxRow = 0;

  for (const row of doc.sheetData?.row ?? []) {
    for (const c of row.c ?? []) {
      const ref = c['@_r'] as string;
      const type = c['@_t'] as string | undefined;
      const formula = c.f !== undefined;
      const v = c.v === undefined ? undefined : textOf(c.v);
      let value: Cell['value'] = null;
      if (type === 's') value = v === undefined ? null : (shared[Number(v)] ?? null);
      else if (type === 'inlineStr') value = textOf(c.is);
      else if (type === 'str' || type === 'e') value = v ?? null;
      else if (type === 'b') value = v === undefined ? null : v === '1';
      else if (v !== undefined && v !== '') value = Number(v);
      if (typeof value === 'string' && value === '') value = null;
      if (value === null && !formula) continue;
      cells.set(ref, { value, formula, url: null });
      maxRow = Math.max(maxRow, parseRef(ref).row);
    }
  }

  for (const h of doc.hyperlinks?.hyperlink ?? []) {
    const rel = h['@_id'] ? rels.get(h['@_id']) : undefined;
    if (!rel?.external) continue; // internal jumps (to another sheet) are not links we care about
    const ref = String(h['@_ref']).split(':')[0];
    const existing = cells.get(ref);
    cells.set(ref, { ...(existing ?? EMPTY), url: rel.target });
  }

  const tables: TableInfo[] = [];
  for (const tp of doc.tableParts?.tablePart ?? []) {
    const rel = rels.get(tp['@_id']);
    if (!rel || !files[rel.target]) continue;
    const t = parser.parse(strFromU8(files[rel.target])).table;
    const [a, b] = String(t['@_ref']).split(':');
    const tl = parseRef(a);
    const br = parseRef(b ?? a);
    tables.push({ name: String(t['@_displayName'] ?? t['@_name']), top: tl.row, left: tl.col, bottom: br.row, right: br.col });
  }

  return {
    name,
    maxRow,
    tables,
    cell: (row, col) => cells.get(`${columnLetter(col)}${row}`) ?? EMPTY
  };
}
