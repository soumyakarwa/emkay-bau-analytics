// Every analytics platform the site reads, in one place: its exports, how often and over what
// period to export them, how to tell its files apart, which calendar column its post links are
// in, and which of its accounts belong to which brand. Adding a platform means adding a reader
// (like youtube.ts) and an entry here; storage, tables and the upload page follow.

import type { BrandId } from '../brands';
import { isXls } from '../workbook/xls';
import { readXlsx } from '../workbook/xlsx';
import { ExportError, type ExportFile } from './common';
import { isZip, looksLikeCsv } from './csv';
import { instagramFileOf, instagramKey, readInstagramExport } from './instagram';
import { linkedInFileOf, linkedInKey, readLinkedInExport, readSheets } from './linkedin';
import type { CleanedExport, Platform } from './rows';
import { readXExport, xFileOf, xKey } from './x';
import { readYouTubeExport, youTubeFileOf, youTubeKey } from './youtube';

export { PLATFORMS, exportLabel, fileSpec, platformSpec, type FileSpec, type PlatformSpec } from './catalog';

/** Each platform's post ID from one of its links, or null. Matches PostRow.postId. */
export const POST_KEY: Record<Platform, (url: string) => string | null> = {
  linkedin: linkedInKey,
  youtube: youTubeKey,
  instagram: instagramKey,
  x: xKey
};

/**
 * Each brand's accounts, as the exports name them (LinkedIn file names, YouTube zip names,
 * Instagram usernames and page names, X handles). A file for one brand's account uploaded for
 * another is refused; an account not listed here is accepted. Add accounts as they appear.
 */
export const ACCOUNTS: Record<BrandId, Partial<Record<Platform, string[]>>> = {
  global: {
    linkedin: ['emkayglobal'],
    youtube: ['Emkay Global Financial Services Ltd']
  },
  im: {
    linkedin: ['emkayinvestmentmanagers'],
    youtube: ['Emkay Investment Managers Limited (EIML)'],
    instagram: ['emkayinvestmentmanagers', 'Emkay Investment Managers Limited'],
    x: ['EmkayInvestment']
  },
  wealth: {
    linkedin: ['emkay-wealth-management'],
    instagram: ['Emkay Wealth']
  }
};

const same = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The brand an account belongs to, if known. */
export function ownerOf(platform: Platform, account: string | null): BrandId | null {
  if (!account) return null;
  for (const [brand, platforms] of Object.entries(ACCOUNTS) as [BrandId, Partial<Record<Platform, string[]>>][]) {
    if (platforms[platform]?.some((a) => same(a, account))) return brand;
  }
  return null;
}

/** Which platform and export a file is, or null for anything else (such as a calendar workbook). */
export function detectExport(f: ExportFile): { platform: Platform; file: string } | null {
  const { bytes } = f;
  try {
    if (isXls(bytes)) {
      const file = linkedInFileOf(readSheets(bytes));
      return file ? { platform: 'linkedin', file } : null;
    }
    if (isZip(bytes)) {
      const yt = youTubeFileOf(bytes);
      if (yt) return { platform: 'youtube', file: yt };
      const file = linkedInFileOf(readXlsx(bytes));
      return file ? { platform: 'linkedin', file } : null;
    }
    if (looksLikeCsv(bytes)) {
      const ig = instagramFileOf(bytes);
      if (ig) return { platform: 'instagram', file: ig };
      const x = xFileOf(bytes);
      if (x) return { platform: 'x', file: x };
    }
  } catch {
    /* unreadable: not an export we know */
  }
  return null;
}

/**
 * Reads and cleans one export. `ownNames` are the brand's own page names, to find its row in a
 * LinkedIn competitor export.
 */
export function readExport(f: ExportFile, ownNames: string[] = []): CleanedExport {
  const found = detectExport(f);
  if (!found) {
    if (isZip(f.bytes) && !isXlsxLike(f.bytes)) {
      throw new ExportError('This zip is not a YouTube Studio export. Upload the zip exactly as YouTube downloaded it.');
    }
    throw new ExportError('This is not an analytics export the site reads (LinkedIn, YouTube, Instagram or X). Upload the file exactly as the platform exported it.');
  }
  switch (found.platform) {
    case 'linkedin': return readLinkedInExport(f.bytes, f.name, ownNames);
    case 'youtube': return readYouTubeExport(f.bytes, f.name);
    case 'instagram': return readInstagramExport(f.bytes, f.name);
    case 'x': return readXExport(f.bytes, f.name);
  }
}

function isXlsxLike(bytes: Uint8Array): boolean {
  try {
    readXlsx(bytes);
    return true;
  } catch {
    return false;
  }
}
