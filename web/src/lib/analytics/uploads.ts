// Analytics exports, kept like the calendar workbooks. Each upload is saved once and never
// changed: its original file, and its cleaned rows as JSON.
//
//   analytics/<brand>/linkedin/<file>/<id>.json       the cleaned rows (rows.ts) and the upload's details
//   analytics/<brand>/linkedin/<file>/<id>.<ext>.b64  the original file, exactly as uploaded
//
// The tables are built from these by combining every upload (tables.ts); nothing combined is saved.
// When the reader changes (ANALYTICS_READER_VERSION), older uploads are read again from their
// original file as they are loaded, so the whole history always follows the current cleaning rules.

import { brandById, BRANDS, type BrandId } from '../brands';
import type { Store } from '../dataset/store';
import { sha256 } from '../dataset/uploads';
import { normalise } from '../workbook/contract';
import { isExportError, readLinkedInExport } from './linkedin';
import { LINKEDIN_FILES, type CleanedExport, type LinkedInFile } from './rows';

export const ANALYTICS_READER_VERSION = 3;

/** Each brand's LinkedIn page, as LinkedIn names it in export file names. */
export const LINKEDIN_PAGES: Record<BrandId, string[]> = {
  global: ['emkayglobal'],
  im: ['emkayinvestmentmanagers'],
  wealth: ['emkay-wealth-management']
};

export interface AnalyticsUploadInfo {
  id: string;
  brand: BrandId;
  platform: 'linkedin';
  file: LinkedInFile;
  uploadedAt: string;
  uploadedBy: string | null;
  fileName: string;
  contentHash: string;
  /** The days the export covers; `to` is the day its figures are "as of". */
  from: string;
  to: string;
  counts: { posts: number; sponsored: number; days: number; audience: number; benchmark: number };
  /** Things worth knowing about this upload (gaps, rows left out, ...). Never blocking. */
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

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const read = (bytes: Uint8Array, fileName: string, brand: BrandId) => readLinkedInExport(bytes, fileName, [brandById(brand)!.name]);

function countsOf(d: CleanedExport): AnalyticsUploadInfo['counts'] {
  return {
    posts: d.posts.filter((p) => !p.sponsored).length,
    sponsored: d.posts.filter((p) => p.sponsored).length,
    days: d.daily.length,
    audience: d.audience?.rows.length ?? 0,
    benchmark: d.benchmark.length
  };
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

  // The right brand: by the page name in LinkedIn's file name, or the own row in a competitor file.
  if (data.page) {
    const owner = BRANDS.find((b) => LINKEDIN_PAGES[b.id].includes(data.page!));
    if (owner && owner.id !== brand.id) {
      return refuse(`This export is for the "${data.page}" LinkedIn page, which belongs to ${owner.name}, but it was uploaded for ${brand.name}. Pick the right file.`, data);
    }
  }
  const warnings = data.skipped.length ? [`${data.skipped.length} ${data.skipped.length === 1 ? 'row was' : 'rows were'} left out: ${data.skipped.slice(0, 3).join(' ')}${data.skipped.length > 3 ? ' …' : ''}`] : [];
  if (data.file === 'competitors' && !data.benchmark.some((b) => b.own)) {
    const other = BRANDS.find((b) => b.id !== brand.id && data.benchmark.some((r) => normalise(r.page).startsWith(normalise(b.name))));
    if (other) return refuse(`This competitor export is ${other.name}'s page against its peers, but it was uploaded for ${brand.name}. Pick the right file.`, data);
    warnings.push(`${brand.name}'s own page is not in this competitor export, so it can only show the peers.`);
  }

  const contentHash = await sha256(bytes);
  const history = await listAnalyticsUploads(store, { brand: brand.id, file: data.file });
  const same = history.find((u) => u.contentHash === contentHash);
  if (same) return { status: 'unchanged', message: null, upload: same, data };
  warnings.push(...coverageWarnings(data, history));

  const uploadedAt = (meta.now ?? new Date()).toISOString();
  const id = `${brand.id}-li-${data.file}-${stamp(new Date(uploadedAt))}`;
  const dir = `${PREFIX}${brand.id}/linkedin/${data.file}/`;
  const ext = /\.xlsx$/i.test(meta.fileName) ? 'xlsx' : 'xls';
  const upload: AnalyticsUpload = {
    id,
    brand: brand.id,
    platform: 'linkedin',
    file: data.file,
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

/** Gaps this upload leaves against the ones before it, and exports older than what is already there. */
function coverageWarnings(data: CleanedExport, history: AnalyticsUploadInfo[]): string[] {
  const out: string[] = [];
  const latest = history.map((u) => u.to).sort().at(-1);
  if (!latest) return out;
  if (data.file === 'competitors') return out; // each competitor export is its own period
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

/** Uploads saved before the pipeline (step 9's first version): `kind` instead of `file`, the old data shape. */
interface OldUpload {
  id: string;
  brand: BrandId;
  kind: LinkedInFile;
  uploadedAt: string;
  uploadedBy: string | null;
  fileName: string;
  contentHash: string;
}

/** Reads an upload's JSON, bringing it up to the current reader from its original file if needed. */
async function load(store: Store, key: string): Promise<AnalyticsUpload | null> {
  const raw = await store.get(key);
  if (!raw) return null;
  const doc = JSON.parse(raw) as AnalyticsUpload | OldUpload;
  if ('file' in doc && doc.readerVersion >= ANALYTICS_READER_VERSION) return doc;
  const original = 'original' in doc ? doc.original : key.replace(/\.json$/, '.xls.b64');
  const b64 = await store.get(original);
  if (!b64) return 'file' in doc ? doc : null;
  try {
    const data = read(fromBase64(b64), doc.fileName, doc.brand);
    return {
      id: doc.id, brand: doc.brand, platform: 'linkedin', file: data.file, uploadedAt: doc.uploadedAt, uploadedBy: doc.uploadedBy,
      fileName: doc.fileName, contentHash: doc.contentHash, from: data.from, to: data.to, counts: countsOf(data),
      warnings: 'warnings' in doc ? doc.warnings : [], readerVersion: ANALYTICS_READER_VERSION, original, data
    };
  } catch {
    return 'file' in doc ? doc : null;
  }
}

async function keys(store: Store, filter: { brand?: BrandId; file?: LinkedInFile }): Promise<string[]> {
  const all = (await store.list(PREFIX + (filter.brand ? `${filter.brand}/` : ''))).filter((k) => k.endsWith('.json'));
  return filter.file ? all.filter((k) => k.includes(`/linkedin/${filter.file}/`) || k.includes(`/linkedin-${filter.file}/`)) : all;
}

/** Every analytics upload, oldest first, without its rows. */
export async function listAnalyticsUploads(store: Store, filter: { brand?: BrandId; file?: LinkedInFile } = {}): Promise<AnalyticsUploadInfo[]> {
  const out: AnalyticsUploadInfo[] = [];
  for (const k of await keys(store, filter)) {
    const u = await load(store, k);
    if (u) out.push(info(u));
  }
  return out.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

/** Every analytics upload with its cleaned rows, oldest first. */
export async function loadAnalyticsUploads(store: Store, filter: { brand?: BrandId; file?: LinkedInFile } = {}): Promise<AnalyticsUpload[]> {
  const out: AnalyticsUpload[] = [];
  for (const k of await keys(store, filter)) {
    const u = await load(store, k);
    if (u) out.push(u);
  }
  return out.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

export interface Coverage {
  file: LinkedInFile;
  label: string;
  optional: boolean;
  help: string;
  uploads: number;
  lastUploadedAt: string | null;
  /** The days covered by all uploads together, and any gaps between them. */
  from: string | null;
  to: string | null;
  gaps: { from: string; to: string }[];
}

/** Which LinkedIn files a brand has uploaded, how recent they are, and any gaps. */
export function coverage(uploads: AnalyticsUploadInfo[], brand: BrandId): Coverage[] {
  return LINKEDIN_FILES.map((f) => {
    const mine = uploads.filter((u) => u.brand === brand && u.file === f.id).sort((a, b) => a.from.localeCompare(b.from));
    const gaps: Coverage['gaps'] = [];
    let end: string | null = null;
    for (const u of mine) {
      if (f.id !== 'competitors' && end && u.from > addDays(end, 1)) gaps.push({ from: addDays(end, 1), to: addDays(u.from, -1) });
      if (!end || u.to > end) end = u.to;
    }
    return {
      file: f.id,
      label: f.label,
      optional: f.optional,
      help: f.help,
      uploads: mine.length,
      lastUploadedAt: mine.map((u) => u.uploadedAt).sort().at(-1) ?? null,
      from: mine[0]?.from ?? null,
      to: end,
      gaps
    };
  });
}

/** Days since the figures were last brought up to date (null when never uploaded). */
export const ageInDays = (c: Coverage, today: string) => (c.to ? daysBetween(c.to, today) : null);
