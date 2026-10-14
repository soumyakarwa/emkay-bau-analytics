// Writes small .xls (BIFF8) files for the tests, so the .xls reader and the LinkedIn exports can
// be tested on made-up data without keeping real exports in the repository. It writes only what
// the reader reads, and deliberately cuts the shared string table into small CONTINUE records
// (much smaller than Excel's) so strings split across records are always exercised.

export type XlsValue = string | number | boolean | null | { formula: number | string };
export type XlsSheet = { name: string; rows: XlsValue[][] };

const SECTOR = 512;
const END = 0xfffffffe;
const FREE = 0xffffffff;

class Bytes {
  private parts: number[] = [];
  get length() {
    return this.parts.length;
  }
  u8(...v: number[]) {
    for (const x of v) this.parts.push(x & 0xff);
    return this;
  }
  u16(v: number) {
    return this.u8(v, v >> 8);
  }
  u32(v: number) {
    return this.u8(v, v >> 8, v >> 16, v >>> 24);
  }
  f64(v: number) {
    const b = new Uint8Array(new Float64Array([v]).buffer);
    return this.u8(...b);
  }
  bytes(b: ArrayLike<number>) {
    return this.u8(...Array.from(b));
  }
  set32(at: number, v: number) {
    for (let i = 0; i < 4; i++) this.parts[at + i] = (v >>> (8 * i)) & 0xff;
  }
  out() {
    return new Uint8Array(this.parts);
  }
}

const wide = (s: string) => s.split('').some((c) => c.charCodeAt(0) > 0xff);
const chars = (s: string, w: boolean) => (w ? s.split('').flatMap((c) => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8]) : s.split('').map((c) => c.charCodeAt(0)));

function record(out: Bytes, type: number, data: Uint8Array) {
  out.u16(type).u16(data.length).bytes(data);
}

/** Shared string table split into records of at most `max` bytes, with a flags byte wherever a string's characters are cut. */
function sst(out: Bytes, strings: string[], max: number) {
  const records: number[][] = [[]];
  const cur = () => records[records.length - 1];
  const room = () => max - cur().length;
  const push = (...b: number[]) => {
    for (const x of b) {
      if (room() <= 0) records.push([]);
      cur().push(x);
    }
  };
  push(...new Bytes().u32(strings.length).u32(strings.length).out());
  for (const s of strings) {
    const w = wide(s);
    if (room() < 3 + (w ? 2 : 1)) records.push([]); // the header and first character stay together
    push(s.length & 0xff, s.length >> 8, w ? 1 : 0);
    const c = chars(s, w);
    const step = w ? 2 : 1;
    for (let i = 0; i < c.length; i += step) {
      if (room() < step) {
        records.push([w ? 1 : 0]); // continued characters restart with a flags byte
      }
      cur().push(...c.slice(i, i + step));
    }
  }
  records.forEach((r, i) => record(out, i === 0 ? 0x00fc : 0x003c, new Uint8Array(r)));
}

function rkValue(v: number): number | null {
  if (Number.isInteger(v) && v >= -(2 ** 29) && v < 2 ** 29) return ((v << 2) | 2) >>> 0;
  if (Number.isInteger(v * 100) && Math.abs(v * 100) < 2 ** 29) return (((v * 100) << 2) | 3) >>> 0;
  return null;
}

function bof(out: Bytes, kind: number) {
  record(out, 0x0809, new Bytes().u16(0x0600).u16(kind).u16(0).u16(0).u32(0).u32(0).out());
}

function workbookStream(sheets: XlsSheet[], sstRecordSize: number): Uint8Array {
  const strings: string[] = [];
  const index = new Map<string, number>();
  for (const s of sheets) for (const row of s.rows) for (const v of row) {
    if (typeof v === 'string' && v !== '' && !index.has(v)) {
      index.set(v, strings.length);
      strings.push(v);
    }
  }

  const out = new Bytes();
  bof(out, 0x0005);
  const sheetOffsets: number[] = [];
  for (const s of sheets) {
    const w = wide(s.name);
    const data = new Bytes().u32(0).u8(0, 0).u8(s.name.length, w ? 1 : 0).bytes(chars(s.name, w)).out();
    sheetOffsets.push(out.length + 4);
    record(out, 0x0085, data);
  }
  sst(out, strings, sstRecordSize);
  record(out, 0x000a, new Uint8Array());

  sheets.forEach((s, si) => {
    out.set32(sheetOffsets[si], out.length);
    bof(out, 0x0010);
    s.rows.forEach((row, r) => {
      // Runs of two or more RK-able numbers go in one MulRk record, as Excel writes them.
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v === null || v === '') continue;
        const cell = new Bytes().u16(r).u16(c).u16(0);
        if (typeof v === 'number') {
          let end = c;
          while (end + 1 < row.length && typeof row[end + 1] === 'number' && rkValue(row[end + 1] as number) !== null) end++;
          if (end > c && rkValue(v) !== null) {
            const m = new Bytes().u16(r).u16(c);
            for (let k = c; k <= end; k++) m.u16(0).u32(rkValue(row[k] as number)!);
            record(out, 0x00bd, m.u16(end).out());
            c = end;
          } else if (rkValue(v) !== null) record(out, 0x027e, cell.u32(rkValue(v)!).out());
          else record(out, 0x0203, cell.f64(v).out());
        } else if (typeof v === 'string') {
          record(out, 0x00fd, cell.u32(index.get(v)!).out());
        } else if (typeof v === 'boolean') {
          record(out, 0x0205, cell.u8(v ? 1 : 0, 0).out());
        } else if (typeof v.formula === 'number') {
          record(out, 0x0006, cell.f64(v.formula).u16(0).u32(0).u16(0).out());
        } else {
          record(out, 0x0006, cell.u8(0, 0, 0, 0, 0, 0).u16(0xffff).u16(0).u32(0).u16(0).out());
          const w = wide(v.formula);
          record(out, 0x0207, new Bytes().u16(v.formula.length).u8(w ? 1 : 0).bytes(chars(v.formula, w)).out());
        }
      }
    });
    record(out, 0x000a, new Uint8Array());
  });
  return out.out();
}

/** A compound file holding one "Workbook" stream (padded so it is never a "mini" stream). */
export function writeXls(sheets: XlsSheet[], opts: { sstRecordSize?: number } = {}): Uint8Array {
  const raw = workbookStream(sheets, opts.sstRecordSize ?? 64);
  const size = Math.max(raw.length, 4096);
  const streamSectors = Math.ceil(size / SECTOR);
  const total = 2 + streamSectors; // FAT, directory, stream
  if (total > SECTOR / 4) throw new Error('Test workbook too large for the simple writer');

  const out = new Bytes();
  out.bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).bytes(new Uint8Array(16));
  out.u16(0x3e).u16(3).u16(0xfffe).u16(9).u16(6).bytes(new Uint8Array(6));
  out.u32(0).u32(1).u32(1).u32(0).u32(4096).u32(END).u32(0).u32(END).u32(0);
  out.u32(0);
  for (let i = 1; i < 109; i++) out.u32(FREE);

  // FAT: sector 0 is the FAT itself, 1 the directory, then the stream's chain.
  out.u32(0xfffffffd).u32(END);
  for (let i = 0; i < streamSectors; i++) out.u32(i === streamSectors - 1 ? END : 3 + i);
  for (let i = total; i < SECTOR / 4; i++) out.u32(FREE);

  const entry = (name: string, type: number, start: number, len: number) => {
    const n = new Bytes();
    for (const c of name) n.u16(c.charCodeAt(0));
    n.bytes(new Uint8Array(64 - n.length));
    n.u16(name ? (name.length + 1) * 2 : 0).u8(type, 1).u32(FREE).u32(FREE).u32(type === 5 ? 1 : FREE);
    n.bytes(new Uint8Array(16 + 4 + 16)).u32(start).u32(len).u32(0);
    return n.out();
  };
  out.bytes(entry('Root Entry', 5, END, 0));
  out.bytes(entry('Workbook', 2, 2, size));
  out.bytes(entry('', 0, 0, 0));
  out.bytes(entry('', 0, 0, 0));

  const stream = new Uint8Array(streamSectors * SECTOR);
  stream.set(raw);
  out.bytes(stream);
  return out.out();
}
