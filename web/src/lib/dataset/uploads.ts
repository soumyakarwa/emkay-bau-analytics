// Publishing a brand's workbook. Every accepted upload is kept, never overwritten, so the
// history shows how each brand's calendar and framework looked at any point. Everything on
// screen uses the latest upload for each brand and financial year.

import { BRANDS, brandById, brandByName, type BrandId } from '../brands';
import { readCalendarFile } from '../workbook';
import type { ReadOptions } from '../workbook/read-calendar';
import type { CalendarWorkbook, Issue, Post, ReadResult } from '../workbook/types';
import { compareFrameworks, type FrameworkChange } from './changes';
import type { Store } from './store';

export interface UploadInfo {
  id: string;
  brand: BrandId;
  fy: number;
  uploadedAt: string;
  uploadedBy: string | null;
  fileName: string;
  /** SHA-256 of the file, to spot an upload identical to the previous one. */
  contentHash: string;
  posts: number;
  warnings: number;
}

/**
 * Bumped whenever the reader starts producing something new for the same workbook. Uploads read
 * by an older version are read again from their stored original file when loaded, so the whole
 * history always follows the current rules.
 */
export const READER_VERSION = 4;

export interface Upload extends UploadInfo {
  /** The reader version that produced `workbook` and `issues` (missing on the very first uploads = 1). */
  readerVersion?: number;
  workbook: CalendarWorkbook;
  /** The warnings the workbook had when it was uploaded. */
  issues: Issue[];
}

export interface PublishResult {
  /**
   * published: stored as the new latest. ready: would be published (a check only, nothing stored).
   * unchanged: identical to the latest, nothing stored. refused: blocking problems.
   */
  status: 'published' | 'ready' | 'unchanged' | 'refused';
  upload: UploadInfo | null;
  /** The workbook as read (not set when it could not be read at all). */
  workbook: CalendarWorkbook | null;
  previous: UploadInfo | null;
  issues: Issue[];
  /** Framework changes since the previous upload of the same brand and year. */
  changes: FrameworkChange[];
}

export interface PublishMeta {
  fileName: string;
  contentHash: string;
  uploadedBy?: string | null;
  /** The brand the person is uploading for. A workbook for another brand is refused. */
  forBrand?: BrandId;
  now?: Date;
  /** The original .xlsx, kept so the upload can be read again by a newer reader. */
  file?: Uint8Array;
  /** Check everything and report what would happen, but store nothing. */
  dryRun?: boolean;
}

const PREFIX = 'uploads/';
const fyTag = (fy: number) => `fy${String(fy).slice(2)}`;
const stamp = (d: Date) => d.toISOString().replace(/[-:.]/g, '');

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Reads, checks and (if there are no blocking problems) stores a workbook file. */
export async function publishFile(
  store: Store,
  bytes: Uint8Array,
  meta: Omit<PublishMeta, 'contentHash'> & ReadOptions
): Promise<PublishResult> {
  return publish(store, readCalendarFile(bytes, { today: meta.today }), { ...meta, file: bytes, contentHash: await sha256(bytes) });
}

/** Stores an already-read workbook. Separate from publishFile so tests can feed in edited sheets. */
export async function publish(store: Store, read: ReadResult, meta: PublishMeta): Promise<PublishResult> {
  const issues = [...read.issues];
  const refuse = (message?: string): PublishResult => {
    if (message) issues.unshift({ level: 'error', sheet: 'Start here', cell: null, owner: null, post: null, message });
    return { status: 'refused', upload: null, workbook: read.workbook, previous: null, issues, changes: [] };
  };
  const wb = read.workbook;
  if (!wb) return refuse();

  const brand = brandByName(wb.brand);
  if (!brand) {
    return refuse(`The brand on the Start here sheet, "${wb.brand}", is not one of ${BRANDS.map((b) => b.name).join(', ')}.`);
  }
  if (meta.forBrand && meta.forBrand !== brand.id) {
    return refuse(`This workbook is ${brand.name}'s, but it was uploaded for ${brandById(meta.forBrand)?.name ?? meta.forBrand}. Pick the right file.`);
  }
  if (issues.some((i) => i.level === 'error')) return refuse();

  const history = await listUploads(store, { brand: brand.id, fy: wb.fy });
  const previous = history.at(-1) ?? null;
  if (previous && previous.contentHash === meta.contentHash) {
    return { status: 'unchanged', upload: previous, workbook: wb, previous, issues, changes: [] };
  }
  const before = previous ? await getUpload(store, previous.id) : null;
  const changes = before ? compareFrameworks(before.workbook, wb) : [];

  const uploadedAt = (meta.now ?? new Date()).toISOString();
  const id = `${brand.id}-${fyTag(wb.fy)}-${stamp(new Date(uploadedAt))}`;
  const upload: Upload = {
    id,
    brand: brand.id,
    fy: wb.fy,
    uploadedAt,
    uploadedBy: meta.uploadedBy ?? null,
    fileName: meta.fileName,
    contentHash: meta.contentHash,
    posts: wb.posts.length,
    warnings: issues.length,
    readerVersion: READER_VERSION,
    workbook: wb,
    issues
  };
  if (meta.dryRun) return { status: 'ready', upload: info(upload), workbook: wb, previous, issues, changes };
  if (meta.file) await store.put(fileKeyFor(upload), toBase64(meta.file));
  await store.put(keyFor(upload), JSON.stringify(upload));
  return { status: 'published', upload: info(upload), workbook: wb, previous, issues, changes };
}

function keyFor(u: { brand: string; fy: number; id: string }) {
  return `${PREFIX}${u.brand}/${fyTag(u.fy)}/${u.id}.json`;
}

function fileKeyFor(u: { brand: string; fy: number; id: string }) {
  return `${PREFIX}${u.brand}/${fyTag(u.fy)}/${u.id}.xlsx.b64`;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Brings an upload read by an older reader up to date. */
async function upgrade(store: Store, u: Upload): Promise<Upload> {
  if ((u.readerVersion ?? 1) >= READER_VERSION) return u;
  const file = await store.get(fileKeyFor(u));
  if (file) {
    // Read it again as of the day it was uploaded, so "missing details" checks match what the uploader saw.
    const again = readCalendarFile(fromBase64(file), { today: u.uploadedAt.slice(0, 10) });
    if (again.workbook) return { ...u, readerVersion: READER_VERSION, workbook: again.workbook, issues: again.issues, warnings: again.issues.length };
  }
  // The very first uploads kept no file: carry their old fields across instead.
  const posts = u.workbook.posts.map((p): Post => {
    if ('longForm' in p) return p;
    const { longFormLink, ...rest } = p as Omit<Post, 'longForm'> & { longFormLink?: string | null };
    return { ...rest, longForm: longFormLink ? { state: 'published', url: longFormLink } : null };
  });
  return { ...u, readerVersion: READER_VERSION, workbook: { ...u.workbook, posts } };
}

function info(u: Upload): UploadInfo {
  const { workbook: _w, issues: _i, ...rest } = u;
  return rest;
}

/** Every upload, oldest first, optionally for one brand and/or year. */
export async function listUploads(store: Store, filter: { brand?: BrandId; fy?: number } = {}): Promise<UploadInfo[]> {
  const prefix = PREFIX + (filter.brand ? `${filter.brand}/` + (filter.fy ? `${fyTag(filter.fy)}/` : '') : '');
  const keys = (await store.list(prefix)).filter((k) => k.endsWith('.json')).sort();
  const out: UploadInfo[] = [];
  for (const k of keys) {
    const raw = await store.get(k);
    if (!raw) continue;
    const u = info(JSON.parse(raw) as Upload);
    if (filter.fy === undefined || u.fy === filter.fy) out.push(u);
  }
  return out.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

export async function getUpload(store: Store, id: string): Promise<Upload | null> {
  const m = /^([a-z]+)-fy(\d{2})-/.exec(id);
  if (!m) return null;
  const raw = await store.get(keyFor({ brand: m[1], fy: 2000 + Number(m[2]), id }));
  return raw ? upgrade(store, JSON.parse(raw) as Upload) : null;
}

/** The latest upload for each brand and financial year. */
export async function latestUploads(store: Store): Promise<Upload[]> {
  const latest = new Map<string, UploadInfo>();
  for (const u of await listUploads(store)) latest.set(`${u.brand}|${u.fy}`, u);
  const out: Upload[] = [];
  for (const u of latest.values()) {
    const full = await getUpload(store, u.id);
    if (full) out.push(full);
  }
  return out;
}
