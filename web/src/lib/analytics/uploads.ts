// Analytics exports, kept like the calendar workbooks: every upload is stored, never
// overwritten, with its original file. Each upload is a snapshot of the figures on the day it
// was exported; the analysis uses the newest figures for each post.

import { brandById, BRANDS, type BrandId } from '../brands';
import type { Store } from '../dataset/store';
import { sha256 } from '../dataset/uploads';
import { isExportError, readLinkedInExport, type LinkedInExport, type LinkedInKind } from './linkedin';

/** Bumped when the export reader starts producing something new; older uploads are read again from their file. */
export const ANALYTICS_READER_VERSION = 1;

export interface AnalyticsUploadInfo {
  id: string;
  brand: BrandId;
  source: 'linkedin';
  kind: LinkedInKind;
  uploadedAt: string;
  uploadedBy: string | null;
  fileName: string;
  contentHash: string;
  /** The days the export covers. */
  from: string;
  to: string;
  posts: number;
}

export interface AnalyticsUpload extends AnalyticsUploadInfo {
  readerVersion: number;
  data: LinkedInExport;
}

export interface AnalyticsPublishResult {
  status: 'published' | 'ready' | 'unchanged' | 'refused';
  message: string | null;
  upload: AnalyticsUploadInfo | null;
  data: LinkedInExport | null;
}

/**
 * LinkedIn page names (as they appear in export file names) known to belong to each brand, so a
 * file for one brand's page cannot be filed under another by mistake. Add pages here as they appear.
 */
export const LINKEDIN_PAGES: Partial<Record<BrandId, string[]>> = {
  im: ['emkayinvestmentmanagers']
};

const PREFIX = 'analytics/';
const stamp = (d: Date) => d.toISOString().replace(/[-:.]/g, '');
const KIND_TAG: Record<LinkedInKind, string> = { content: 'lic', followers: 'lif', visitors: 'liv' };

function keyFor(u: { brand: string; kind: LinkedInKind; id: string }, ext = 'json') {
  return `${PREFIX}${u.brand}/linkedin-${u.kind}/${u.id}.${ext}`;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function publishAnalyticsFile(
  store: Store,
  bytes: Uint8Array,
  meta: { fileName: string; forBrand: BrandId; uploadedBy?: string | null; now?: Date; dryRun?: boolean }
): Promise<AnalyticsPublishResult> {
  const refuse = (message: string, data: LinkedInExport | null = null): AnalyticsPublishResult => ({ status: 'refused', message, upload: null, data });
  let data: LinkedInExport;
  try {
    data = readLinkedInExport(bytes, meta.fileName);
  } catch (e) {
    if (isExportError(e)) return refuse(e.message);
    throw e;
  }
  if (data.page) {
    const owner = BRANDS.find((b) => LINKEDIN_PAGES[b.id]?.includes(data.page!));
    if (owner && owner.id !== meta.forBrand) {
      return refuse(`This export is for the "${data.page}" LinkedIn page, which belongs to ${owner.name}, but it was uploaded for ${brandById(meta.forBrand)!.name}. Pick the right file.`, data);
    }
  }

  const contentHash = await sha256(bytes);
  const history = await listAnalyticsUploads(store, { brand: meta.forBrand, kind: data.kind });
  const same = history.find((u) => u.contentHash === contentHash);
  if (same) return { status: 'unchanged', message: null, upload: same, data };

  const uploadedAt = (meta.now ?? new Date()).toISOString();
  const upload: AnalyticsUpload = {
    id: `${meta.forBrand}-${KIND_TAG[data.kind]}-${stamp(new Date(uploadedAt))}`,
    brand: meta.forBrand,
    source: 'linkedin',
    kind: data.kind,
    uploadedAt,
    uploadedBy: meta.uploadedBy ?? null,
    fileName: meta.fileName,
    contentHash,
    from: data.from,
    to: data.to,
    posts: data.posts.length,
    readerVersion: ANALYTICS_READER_VERSION,
    data
  };
  if (meta.dryRun) return { status: 'ready', message: null, upload: info(upload), data };
  await store.put(keyFor(upload, 'xls.b64'), toBase64(bytes));
  await store.put(keyFor(upload), JSON.stringify(upload));
  return { status: 'published', message: null, upload: info(upload), data };
}

function info(u: AnalyticsUpload): AnalyticsUploadInfo {
  const { data: _d, readerVersion: _r, ...rest } = u;
  return rest;
}

async function upgrade(store: Store, u: AnalyticsUpload): Promise<AnalyticsUpload> {
  if (u.readerVersion >= ANALYTICS_READER_VERSION) return u;
  const file = await store.get(keyFor(u, 'xls.b64'));
  if (!file) return u;
  try {
    const data = readLinkedInExport(fromBase64(file), u.fileName);
    return { ...u, readerVersion: ANALYTICS_READER_VERSION, data, from: data.from, to: data.to, posts: data.posts.length };
  } catch {
    return u;
  }
}

/** Every analytics upload, oldest first. */
export async function listAnalyticsUploads(store: Store, filter: { brand?: BrandId; kind?: LinkedInKind } = {}): Promise<AnalyticsUploadInfo[]> {
  const prefix = PREFIX + (filter.brand ? `${filter.brand}/` + (filter.kind ? `linkedin-${filter.kind}/` : '') : '');
  const out: AnalyticsUploadInfo[] = [];
  for (const k of (await store.list(prefix)).filter((k) => k.endsWith('.json'))) {
    const raw = await store.get(k);
    if (raw) out.push(info(JSON.parse(raw) as AnalyticsUpload));
  }
  return out.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

/** Every upload with its data, oldest first. */
export async function loadAnalyticsUploads(store: Store, filter: { brand?: BrandId; kind?: LinkedInKind } = {}): Promise<AnalyticsUpload[]> {
  const out: AnalyticsUpload[] = [];
  for (const u of await listAnalyticsUploads(store, filter)) {
    const raw = await store.get(keyFor(u));
    if (raw) out.push(await upgrade(store, JSON.parse(raw) as AnalyticsUpload));
  }
  return out;
}
