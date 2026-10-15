// CSV files as platforms export them: UTF-8 (with or without a byte-order mark), UTF-16, or
// Windows-1252 when a file has been opened and re-saved in Excel.

export interface DecodedText {
  text: string;
  /** True when the file was not UTF-8: usually a sign it was re-saved in Excel. */
  resaved: boolean;
}

export function decodeText(bytes: Uint8Array): DecodedText {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), resaved: false };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), resaved: false };
  const body = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(body), resaved: false };
  } catch {
    return { text: windows1252(body), resaved: true };
  }
}

/** Windows-1252's characters for bytes 0x80–0x9F (where it differs from Latin-1); the rest map to themselves. */
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';

/** Decodes Windows-1252 (how Excel saves CSVs on Windows) by hand: not every runtime's TextDecoder does. */
function windows1252(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b >= 0x80 && b <= 0x9f ? CP1252[b - 0x80] : String.fromCharCode(b);
  return out;
}

/** Rows of a CSV (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

/** Probably a CSV: no zero bytes in the first kilobyte (except UTF-16), and a comma in its first lines (some start with a title line). */
export function looksLikeCsv(bytes: Uint8Array): boolean {
  if (isZip(bytes) || bytes.length === 0) return false;
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return true;
  const head = bytes.subarray(0, 1024);
  if (head.includes(0)) return false;
  return decodeText(head).text.split(/\r?\n/).slice(0, 3).some((line) => line.includes(','));
}
