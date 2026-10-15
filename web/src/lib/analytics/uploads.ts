// Analytics exports, kept like the calendar workbooks. Each upload is saved once and never
// changed: its original file, and its cleaned rows as JSON.
//
//   analytics/<brand>/<platform>/<file>/<id>.json       the cleaned rows (rows.ts) and the upload's details
//   analytics/<brand>/<platform>/<file>/<id>.<ext>.b64  the original file, exactly as uploaded
//
// The tables are built from these by combining every upload (tables.ts); nothing combined is saved.
// When a reader changes (ANALYTICS_READER_VERSION), older uploads are read again from their
// original file as they are loaded, so the whole history always follows the current cleaning rules.

import { brandById, BRANDS, type BrandId } from '../brands';
import type { Store } from '../dataset/store';
import { sha256 } from '../dataset/uploads';
import { normalise } from '../workbook/contract';
import { isExportError } from './common';
import { PLATFORMS, exportLabel, fileSpec, ownerOf, readExport, type FileSpec } from './platforms';
import type { CleanedExport, Platform } from './rows';

export const ANALYTICS_READER_VERSION = 4;

export interface AnalyticsUploadInfo {
  id: string;
  brand: BrandId;
  platform: Platform;
  /** Which of the platform's exports (see platforms.ts). */
  file: string;
  /** The page, channel or account the export is for, when it says. */
  account: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  fileName: string;
  contentHash: string;
  /** The days the export covers; `to` is the day its figures are "as of". */
  from: string;
  to: string;
  counts: { posts: number; sponsored: number; days: number; audience: number; benchmark: number; totals: number };
  /** Things worth knowing about this upload (gaps, rows left out, a damaged file, ...). Never blocking. */
  warnings: string[];
}

export interface AnalyticsUpload extends AnalyticsUploadInfo {
  readerVersion: number;
  /** Where the original file is stored. */
  original: string;
  data: CleanedExport;
}

export interface AnalyticsPublishResult {
  status: 'published' | 'ready' | 'unchanged' | 'refused';
  message: string | null;
  upload: AnalyticsUploadInfo | null;
  data: CleanedExport | null;
}

const PREFIX = 'analytics/';
const DAY = 86400000;
const stamp = (d: Date) => d.toISOString().replace(/[-:.]/g, '');
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const monthOf = (iso: string) => iso.slice(0, 7);
const nextMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
const lastDayOf = (month: string) => addDays(`${nextMonth(month)}-01`, -1);
/** True when the period is exactly one calendar month. */
export const isWholeMonth = (from: string, to: string) => from.endsWith('-01') && to === lastDayOf(monthOf(from));

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const read = (bytes: Uint8Array, fileName: string, brand: BrandId) => readExport({ name: fileName, bytes }, [brandById(brand)!.name]);

function countsOf(d: CleanedExport): AnalyticsUploadInfo['counts'] {
  return {
    posts: d.posts.filter((p) => !p.sponsored).length,
    sponsored: d.posts.filter((p) => p.sponsored).length,
    days: d.daily.length,
    audience: d.audience?.rows.length ?? 0,
    benchmark: d.benchmark.length,
    totals: d.totals ? Object.keys(d.totals).length : 0
  };
}

function readerWarnings(d: CleanedExport): string[] {
  const out = [...d.notes];
  if (d.skipped.length) out.push(`${d.skipped.length} ${d.skipped.length === 1 ? 'row was' : 'rows were'} left out: ${d.skipped.slice(0, 3).join(' ')}${d.skipped.length > 3 ? ' …' : ''}`);
  return out;
}

export async function publishAnalyticsFile(
  store: Store,
  bytes: Uint8Array,
  meta: { fileName: string; forBrand: BrandId; uploadedBy?: string | null; now?: Date; dryRun?: boolean }
): Promise<AnalyticsPublishResult> {
  const brand = brandById(meta.forBrand)!;
  const refuse = (message: string, data: CleanedExport | null = null): AnalyticsPublishResult => ({ status: 'refused', message, upload: null, data });
  let data: CleanedExport;
  try {
    data = read(bytes, meta.fileName, meta.forBrand);
  } catch (e) {
    if (isExportError(e)) return refuse(e.message);
    throw e;
  }
  const label = exportLabel(data.platform, data.file);

  // The right brand: by the account the export names, or the own row in a competitor export.
  const owner = ownerOf(data.platform, data.account);
  if (owner && owner !== brand.id) {
    return refuse(`This ${label} export is for "${data.account}", which belongs to ${brandById(owner)!.name}, but it was uploaded for ${brand.name}. Pick the right file.`, data);
  }
  const warnings = readerWarnings(data);
  if (data.platform === 'linkedin' && data.file === 'competitors' && !data.benchmark.some((b) => b.own)) {
    const other = BRANDS.find((b) => b.id !== brand.id && data.benchmark.some((r) => normalise(r.page).startsWith(normalise(b.name))));
    if (other) return refuse(`This competitor export is ${other.name}'s page against its peers, but it was uploaded for ${brand.name}. Pick the right file.`, data);
    warnings.push(`${brand.name}'s own page is not in this competitor export, so it can only show the peers.`);
  }
  if (data.account && !owner) warnings.push(`The site does not know "${data.account}" yet. Check it is ${brand.name}'s account.`);

  const contentHash = await sha256(bytes);
  const history = await listAnalyticsUploads(store, { brand: brand.id, platform: data.platform, file: data.file });
  const same = history.find((u) => u.contentHash === contentHash);
  if (same) return { status: 'unchanged', message: null, upload: same, data };
  warnings.push(...coverageWarnings(data, history, fileSpec(data.platform, data.file)));

  const uploadedAt = (meta.now ?? new Date()).toISOString();
  const id = `${brand.id}-${data.platform}-${data.file}-${stamp(new Date(uploadedAt))}`;
  const dir = `${PREFIX}${brand.id}/${data.platform}/${data.file}/`;
  const ext = /\.([a-z0-9]{2,5})$/i.exec(meta.fileName)?.[1].toLowerCase() ?? 'bin';
  const upload: AnalyticsUpload = {
    id,
    brand: brand.id,
    platform: data.platform,
    file: data.file,
    account: data.account,
    uploadedAt,
    uploadedBy: meta.uploadedBy ?? null,
    fileName: meta.fileName,
    contentHash,
    from: data.from,
    to: data.to,
    counts: countsOf(data),
    warnings,
    readerVersion: ANALYTICS_READER_VERSION,
    original: `${dir}${id}.${ext}.b64`,
    data
  };
  if (meta.dryRun) return { status: 'ready', message: null, upload: info(upload), data };
  await store.put(upload.original, toBase64(bytes));
  await store.put(`${dir}${id}.json`, JSON.stringify(upload));
  return { status: 'published', message: null, upload: info(upload), data };
}

/** Gaps, overlaps and odd periods this upload brings, against the ones before it. */
function coverageWarnings(data: CleanedExport, history: AnalyticsUploadInfo[], spec: FileSpec | undefined): string[] {
  const out: string[] = [];
  if (spec?.rule === 'month') {
    if (!isWholeMonth(data.from, data.to)) {
      out.push(`This export covers ${data.from} to ${data.to}. ${exportLabel(data.platform, data.file)} exports should cover one calendar month (e.g. 1–30 September), so the months add up; this one is kept, but only whole months are counted.`);
    }
    return out;
  }
  if (spec?.rule !== 'rolling') return out;
  const latest = history.map((u) => u.to).sort().at(-1);
  if (!latest) return out;
  if (data.from > addDays(latest, 1)) {
    out.push(`No figures for ${addDays(latest, 1)} to ${addDays(data.from, -1)}: the last upload ended on ${latest} and this one starts on ${data.from}. Export a longer period (the last 365 days) to fill the gap.`);
  }
  if (data.to < latest) out.push(`This export ends on ${data.to}, before the latest one already uploaded (${latest}). It is kept as history; the newer figures still count.`);
  return out;
}

function info(u: AnalyticsUpload): AnalyticsUploadInfo {
  const { data: _d, readerVersion: _r, original: _o, ...rest } = u;
  return rest;
}

/** Uploads saved by earlier versions: `kind` instead of `file`, no platform, the old data shape. */
interface OldUpload {
  id: string;
  brand: BrandId;
  kind?: string;
  file?: string;
  original?: string;
  uploadedAt: string;
  uploadedBy: string | null;
  fileName: string;
  contentHash: string;
  warnings?: string[];
  readerVersion?: number;
}

/** Reads an upload's JSON, bringing it up to the current readers from its original file if needed. */
async function load(store: Store, key: string): Promise<AnalyticsUpload | null> {
  const raw = await store.get(key);
  if (!raw) return null;
  const doc = JSON.parse(raw) as AnalyticsUpload | OldUpload;
  if ((doc.readerVersion ?? 0) >= ANALYTICS_READER_VERSION && 'platform' in doc) return doc as AnalyticsUpload;
  const original = doc.original ?? key.replace(/\.json$/, '.xls.b64');
  const b64 = await store.get(original);
  if (!b64) return null;
  try {
    const data = read(fromBase64(b64), doc.fileName, doc.brand);
    return {
      id: doc.id, brand: doc.brand, platform: data.platform, file: data.file, account: data.account, uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy, fileName: doc.fileName, contentHash: doc.contentHash, from: data.from, to: data.to,
      counts: countsOf(data), warnings: doc.warnings ?? readerWarnings(data), readerVersion: ANALYTICS_READER_VERSION, original, data
    };
  } catch {
    return null;
  }
}

/** The JSON keys of uploads, narrowed by brand, platform and file where the layout allows. */
async function keys(store: Store, filter: { brand?: BrandId; platform?: Platform; file?: string }): Promise<string[]> {
  return (await store.list(PREFIX + (filter.brand ? `${filter.brand}/` : ''))).filter((k) => k.endsWith('.json'));
}

const matches = (u: AnalyticsUploadInfo, f: { brand?: BrandId; platform?: Platform; file?: string }) =>
  (!f.brand || u.brand === f.brand) && (!f.platform || u.platform === f.platform) && (!f.file || u.file === f.file);

/** Every analytics upload with its cleaned rows, oldest first. */
export async function loadAnalyticsUploads(store: Store, filter: { brand?: BrandId; platform?: Platform; file?: string } = {}): Promise<AnalyticsUpload[]> {
  const out: AnalyticsUpload[] = [];
  for (const k of await keys(store, filter)) {
    const u = await load(store, k);
    if (u && matches(u, filter)) out.push(u);
  }
  return out.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

/** Every analytics upload, oldest first, without its rows. */
export async function listAnalyticsUploads(store: Store, filter: { brand?: BrandId; platform?: Platform; file?: string } = {}): Promise<AnalyticsUploadInfo[]> {
  return (await loadAnalyticsUploads(store, filter)).map(info);
}

export interface Coverage {
  platform: Platform;
  file: string;
  label: string;
  optional: boolean;
  rule: FileSpec['rule'];
  help: string;
  uploads: number;
  lastUploadedAt: string | null;
  /** The days covered by all uploads together, and any gaps between them. */
  from: string | null;
  to: string | null;
  gaps: { from: string; to: string }[];
}

export interface PlatformCoverage {
  platform: Platform;
  label: string;
  routine: string;
  /** True once any of its files has been uploaded for the brand. */
  used: boolean;
  files: Coverage[];
}

function coverageOf(uploads: AnalyticsUploadInfo[], brand: BrandId, platform: Platform, f: FileSpec): Coverage {
  const mine = uploads.filter((u) => u.brand === brand && u.platform === platform && u.file === f.id).sort((a, b) => a.from.localeCompare(b.from));
  const gaps: Coverage['gaps'] = [];
  let end: string | null = null;
  if (f.rule === 'month') {
    // Whole months only; a month with no upload between the first and the last is a gap.
    const months = new Set(mine.filter((u) => isWholeMonth(u.from, u.to)).map((u) => monthOf(u.from)));
    const sorted = [...months].sort();
    for (let m = sorted[0]; m && m <= sorted.at(-1)!; m = nextMonth(m)) {
      if (!months.has(m)) gaps.push({ from: `${m}-01`, to: lastDayOf(m) });
    }
    end = sorted.length ? lastDayOf(sorted.at(-1)!) : null;
  } else {
    for (const u of mine) {
      if (f.rule === 'rolling' && end && u.from > addDays(end, 1)) gaps.push({ from: addDays(end, 1), to: addDays(u.from, -1) });
      if (!end || u.to > end) end = u.to;
    }
  }
  return {
    platform,
    file: f.id,
    label: f.label,
    optional: f.optional,
    rule: f.rule,
    help: f.help,
    uploads: mine.length,
    lastUploadedAt: mine.map((u) => u.uploadedAt).sort().at(-1) ?? null,
    from: mine[0]?.from ?? null,
    to: end,
    gaps
  };
}

/** Which files a brand has uploaded, platform by platform, how recent they are, and any gaps. */
export function coverage(uploads: AnalyticsUploadInfo[], brand: BrandId): PlatformCoverage[] {
  return PLATFORMS.map((p) => {
    const files = p.files.map((f) => coverageOf(uploads, brand, p.id, f));
    return { platform: p.id, label: p.label, routine: p.routine, used: files.some((f) => f.uploads > 0), files };
  });
}

/** Days since the figures were last brought up to date (null when never uploaded). */
export const ageInDays = (c: Coverage, today: string) => (c.to ? daysBetween(c.to, today) : null);

/**
 * Whether a file is up to date on `today`: rolling and summary exports within about a month,
 * monthly exports once last month is in.
 */
export function isDue(c: Coverage, today: string): boolean {
  if (!c.to) return !c.optional;
  if (c.rule === 'month') return c.to < lastDayOf(monthOf(addDays(`${monthOf(today)}-01`, -1)));
  return daysBetween(c.to, today) > 40;
}
