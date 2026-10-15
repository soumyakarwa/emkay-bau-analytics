// Small pieces shared by the platform readers: the error they refuse a file with, and the
// date and number formats the platforms export in.

import type { Value } from './rows';

/** Why a file cannot be used. Its message is shown to whoever uploads it. */
export class ExportError extends Error {}

export function isExportError(e: unknown): e is Error {
  return e instanceof ExportError;
}

/** A file as uploaded. */
export interface ExportFile {
  name: string;
  bytes: Uint8Array;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number | string) => String(n).padStart(2, '0');

/**
 * A date in any of the platforms' formats → "YYYY-MM-DD", or null:
 *   2026-10-12 · 10/12/2026 and 10/12/2026 2:56 (US style: month first) · "Wed, Oct 14, 2026" ·
 *   "Sep 24, 2026" · "Oct-14-2025" · an Excel date number.
 */
export function exportDate(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  }
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/.exec(s);
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  m = /^(?:[A-Za-z]{3},\s*)?([A-Za-z]{3})[a-z]*[\s-]+(\d{1,2}),?[\s-]+(\d{4})$/.exec(s);
  if (m && MONTHS.includes(m[1].toLowerCase())) return `${m[3]}-${pad(MONTHS.indexOf(m[1].toLowerCase()) + 1)}-${pad(m[2])}`;
  return null;
}

/** Like exportDate, but keeps a time of day when there is one: "10/14/2026 5:10" → "2026-10-14T05:10". */
export function exportDateTime(v: unknown): string | null {
  const date = exportDate(v);
  if (!date) return null;
  const t = /(?:^|[\sT])(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\s*$/.exec(String(v ?? '').trim());
  if (!t) return date;
  let h = Number(t[1]);
  if (t[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
  if (t[3]?.toLowerCase() === 'am' && h === 12) h = 0;
  return `${date}T${pad(h)}:${t[2]}`;
}

/** "1,234", "2.23", "12%" (→ 0.12), "" (→ null). */
export function exportNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s.endsWith('%') ? s.slice(0, -1) : s);
  return Number.isFinite(n) ? (s.endsWith('%') ? n / 100 : n) : null;
}

/** "0:02:10" or "2:10" → seconds. */
export function exportDuration(v: unknown): number | null {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim());
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * A cell cleaned by its column: dates for date and time columns, durations, numbers where the
 * value is numeric, blanks as null, anything else as trimmed text.
 */
export function cleanCell(header: string, v: unknown): Value {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (/\b(date|time)\b/i.test(header) && !/watch time|duration/i.test(header)) {
    return (/\btime\b/i.test(header) ? exportDateTime(v) : exportDate(v)) ?? String(v).trim();
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  // IDs and links stay text: a 19-digit post ID would lose its last digits as a number.
  if (/\b(id|link|permalink|url|content)\b/i.test(header) && !/clicks?\b/i.test(header)) return s;
  if (/duration/i.test(header) && exportDuration(s) !== null) return exportDuration(s);
  return /^-?[\d,]*\.?\d+(?:[eE][+-]?\d+)?%?$/.test(s) ? exportNumber(s) : s;
}

/** Shortens a post's text for display; the full text stays in its columns. */
export function titleOf(text: unknown, max = 160): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 3)}…` : t;
}

/** A column's value as a number, or null. */
export const num = (columns: Record<string, Value>, header: string): number | null =>
  typeof columns[header] === 'number' ? (columns[header] as number) : null;
