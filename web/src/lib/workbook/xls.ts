// Minimal reader for the old binary .xls format (BIFF8), which is what LinkedIn's analytics
// exports are. Like xlsx.ts it reads only cell values: no formatting, no formulas, no links.
//
// An .xls file is a "compound file" (a small FAT file system); the cells live in its "Workbook"
// stream as a list of records. Format references: [MS-CFB] and [MS-XLS].

import type { Cell, Sheet } from './xlsx';

const EMPTY: Cell = Object.freeze({ value: null, formula: false, url: null });
const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END_OF_CHAIN = 0xfffffffe;
const FREE = 0xffffffff;

const bad = () => new Error('This file is not a valid .xls workbook.');

export function isXls(bytes: Uint8Array): boolean {
  return bytes.length >= 512 && SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Finds the workbook stream inside the compound file. */
function workbookStream(bytes: Uint8Array): Uint8Array {
  if (!isXls(bytes)) throw bad();
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (o: number) => dv.getUint32(o, true);
  const sectorSize = 1 << dv.getUint16(0x1e, true);
  const miniSize = 1 << dv.getUint16(0x20, true);
  const miniCutoff = u32(0x38);
  const sector = (n: number) => {
    const at = (n + 1) * sectorSize;
    if (at + sectorSize > bytes.length) throw bad();
    return at;
  };

  // The FAT is spread over sectors listed in the header (first 109) and then in a DIFAT chain.
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) fatSectors.push(u32(0x4c + i * 4));
  for (let d = u32(0x44), guard = 0; d !== END_OF_CHAIN && d !== FREE && guard < 1e5; guard++) {
    const at = sector(d);
    for (let i = 0; i < sectorSize / 4 - 1; i++) fatSectors.push(u32(at + i * 4));
    d = u32(at + sectorSize - 4);
  }
  const fat: number[] = [];
  for (const s of fatSectors) {
    if (s === FREE || s === END_OF_CHAIN) continue;
    const at = sector(s);
    for (let i = 0; i < sectorSize / 4; i++) fat.push(u32(at + i * 4));
  }
  const chain = (start: number, table: number[]) => {
    const out: number[] = [];
    for (let s = start; s !== END_OF_CHAIN && s !== FREE; s = table[s]) {
      if (s >= table.length || out.length > table.length) throw bad();
      out.push(s);
    }
    return out;
  };
  const read = (start: number) => {
    const sectors = chain(start, fat);
    const out = new Uint8Array(sectors.length * sectorSize);
    sectors.forEach((s, i) => out.set(bytes.subarray(sector(s), sector(s) + sectorSize), i * sectorSize));
    return out;
  };

  const dir = read(u32(0x30));
  const ddv = new DataView(dir.buffer);
  const entries: { name: string; type: number; start: number; size: number }[] = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const len = Math.max(0, ddv.getUint16(o + 0x40, true) - 2);
    let name = '';
    for (let i = 0; i < len; i += 2) name += String.fromCharCode(ddv.getUint16(o + i, true));
    entries.push({ name, type: dir[o + 0x42], start: ddv.getUint32(o + 0x74, true), size: ddv.getUint32(o + 0x78, true) });
  }
  const entry = entries.find((e) => e.type === 2 && (e.name === 'Workbook' || e.name === 'Book'));
  if (!entry) throw bad();
  if (entry.size >= miniCutoff) return read(entry.start).subarray(0, entry.size);

  // Small streams live in the "mini stream", which is itself stored in the root entry's chain.
  const root = entries[0];
  const ministream = read(root.start);
  const minifatBytes = read(u32(0x3c));
  const minifat: number[] = [];
  for (let i = 0; i + 4 <= minifatBytes.length; i += 4) minifat.push(new DataView(minifatBytes.buffer).getUint32(i, true));
  const out = new Uint8Array(entry.size);
  chain(entry.start, minifat).forEach((s, i) => {
    const part = ministream.subarray(s * miniSize, (s + 1) * miniSize);
    out.set(part.subarray(0, Math.min(miniSize, entry.size - i * miniSize)), i * miniSize);
  });
  return out;
}

interface RecordInfo {
  type: number;
  data: Uint8Array;
  /** Offset of the record in the stream. */
  at: number;
}

function* records(stream: Uint8Array, from = 0): Generator<RecordInfo> {
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  for (let o = from; o + 4 <= stream.length; ) {
    const type = dv.getUint16(o, true);
    const len = dv.getUint16(o + 2, true);
    if (o + 4 + len > stream.length) throw bad();
    yield { type, data: stream.subarray(o + 4, o + 4 + len), at: o };
    o += 4 + len;
  }
}

/** Reads across a record and its CONTINUE records, as the shared string table needs. */
class Segments {
  private seg = 0;
  private pos = 0;
  constructor(private parts: Uint8Array[]) {}
  private next() {
    while (this.seg < this.parts.length && this.pos >= this.parts[this.seg].length) {
      this.seg++;
      this.pos = 0;
    }
    if (this.seg >= this.parts.length) throw bad();
  }
  u8(): number {
    this.next();
    return this.parts[this.seg][this.pos++];
  }
  u16(): number {
    return this.u8() | (this.u8() << 8);
  }
  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0;
  }
  skip(n: number) {
    for (let i = 0; i < n; i++) this.u8();
  }
  /** Characters of a string. A string cut by a CONTINUE record restarts with a new flags byte there. */
  chars(count: number, wide: boolean): string {
    let out = '';
    while (count > 0) {
      if (this.pos >= this.parts[this.seg].length) {
        this.seg++;
        this.pos = 0;
        if (this.seg >= this.parts.length) throw bad();
        wide = (this.parts[this.seg][this.pos++] & 1) === 1;
      }
      const part = this.parts[this.seg];
      const fit = Math.min(count, Math.floor((part.length - this.pos) / (wide ? 2 : 1)));
      if (fit === 0) throw bad();
      for (let i = 0; i < fit; i++) {
        out += String.fromCharCode(wide ? part[this.pos] | (part[this.pos + 1] << 8) : part[this.pos]);
        this.pos += wide ? 2 : 1;
      }
      count -= fit;
    }
    return out;
  }
  /** XLUnicodeRichExtendedString, as used in the shared string table. */
  richString(): string {
    const count = this.u16();
    const flags = this.u8();
    const runs = flags & 0x08 ? this.u16() : 0;
    const ext = flags & 0x04 ? this.u32() : 0;
    const s = this.chars(count, (flags & 1) === 1);
    this.skip(runs * 4 + ext);
    return s;
  }
}

/** XLUnicodeString (2-byte length) starting at `o`. */
function unicodeString(data: Uint8Array, o: number): string {
  const count = data[o] | (data[o + 1] << 8);
  const wide = (data[o + 2] & 1) === 1;
  let s = '';
  for (let i = 0, p = o + 3; i < count && p < data.length; i++, p += wide ? 2 : 1) {
    s += String.fromCharCode(wide ? data[p] | (data[p + 1] << 8) : data[p]);
  }
  return s;
}

function rk(v: number): number {
  const n = v & 0x02 ? v >> 2 : (() => {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setUint32(4, v & 0xfffffffc, true);
    return dv.getFloat64(0, true);
  })();
  return v & 0x01 ? n / 100 : n;
}

export function readXls(bytes: Uint8Array): Sheet[] {
  const stream = workbookStream(bytes);
  const sheets: { name: string; at: number }[] = [];
  let shared: string[] = [];
  let first = true;

  const globals = records(stream);
  for (let r = globals.next(); !r.done; r = globals.next()) {
    const { type, data } = r.value;
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (first) {
      // BOF of the workbook globals: only BIFF8 (Excel 97 and later) is supported.
      if (type !== 0x0809 || dv.getUint16(0, true) !== 0x0600) throw new Error('This .xls file is from a very old Excel version. Open it in Excel and save it again.');
      first = false;
    } else if (type === 0x002f) {
      throw new Error('This .xls file is password-protected. Remove the password and try again.');
    } else if (type === 0x0085) {
      // BoundSheet8: where the sheet starts, its kind (0 = worksheet) and its name.
      if (data[5] !== 0) continue;
      const count = data[6];
      const wide = (data[7] & 1) === 1;
      let name = '';
      for (let i = 0, p = 8; i < count; i++, p += wide ? 2 : 1) name += String.fromCharCode(wide ? data[p] | (data[p + 1] << 8) : data[p]);
      sheets.push({ name, at: dv.getUint32(0, true) });
    } else if (type === 0x00fc) {
      // Shared string table, continued in the CONTINUE records that follow it.
      const parts = [data];
      let n = globals.next();
      while (!n.done && n.value.type === 0x003c) {
        parts.push(n.value.data);
        n = globals.next();
      }
      const seg = new Segments(parts);
      seg.u32();
      const unique = seg.u32();
      shared = [];
      for (let i = 0; i < unique; i++) shared.push(seg.richString());
      if (n.done) break;
      if (n.value.type === 0x000a) break;
    } else if (type === 0x000a) {
      break;
    }
  }

  return sheets.map(({ name, at }) => readSheet(stream, at, name, shared));
}

function readSheet(stream: Uint8Array, at: number, name: string, shared: string[]): Sheet {
  const cells = new Map<number, Cell>();
  const key = (row: number, col: number) => row * 16384 + col;
  let maxRow = 0;
  let pendingString: { row: number; col: number } | null = null;
  const set = (row: number, col: number, value: Cell['value'], formula = false) => {
    if (typeof value === 'string' && value === '') value = null;
    if (value === null && !formula) return;
    cells.set(key(row + 1, col + 1), { value, formula, url: null });
    maxRow = Math.max(maxRow, row + 1);
  };

  let started = false;
  for (const { type, data } of records(stream, at)) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (!started) {
      if (type !== 0x0809) throw bad();
      started = true;
      continue;
    }
    if (type === 0x000a) break;
    const row = data.length >= 4 ? dv.getUint16(0, true) : 0;
    const col = data.length >= 4 ? dv.getUint16(2, true) : 0;
    switch (type) {
      case 0x00fd: // LabelSst
        set(row, col, shared[dv.getUint32(6, true)] ?? null);
        break;
      case 0x0203: // Number
        set(row, col, dv.getFloat64(6, true));
        break;
      case 0x027e: // RK
        set(row, col, rk(dv.getUint32(6, true)));
        break;
      case 0x00bd: { // MulRk
        const last = dv.getUint16(data.length - 2, true);
        for (let c = col, o = 4; c <= last; c++, o += 6) set(row, c, rk(dv.getUint32(o + 2, true)));
        break;
      }
      case 0x0204: // Label
        set(row, col, unicodeString(data, 6));
        break;
      case 0x0205: // BoolErr
        set(row, col, data[7] ? null : data[6] === 1);
        break;
      case 0x0006: { // Formula: the saved result
        if (dv.getUint16(12, true) === 0xffff) {
          const kind = data[6];
          if (kind === 0) pendingString = { row, col };
          else set(row, col, kind === 1 ? data[8] === 1 : null, true);
        } else {
          set(row, col, dv.getFloat64(6, true), true);
        }
        break;
      }
      case 0x0207: // String: the text result of the formula just before it
        if (pendingString) set(pendingString.row, pendingString.col, unicodeString(data, 0), true);
        pendingString = null;
        break;
    }
  }

  return {
    name,
    maxRow,
    tables: [],
    cell: (row, col) => cells.get(key(row, col)) ?? EMPTY
  };
}
