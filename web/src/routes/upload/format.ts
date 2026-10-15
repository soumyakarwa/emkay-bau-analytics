// Formatting shared by the upload page's sections.

import type { LinkedInFile } from '$lib/analytics/rows';
import { brandById } from '$lib/brands';

export const KIND_LABEL: Record<LinkedInFile, string> = {
  content: 'LinkedIn content (posts)',
  followers: 'LinkedIn followers',
  visitors: 'LinkedIn visitors',
  competitors: 'LinkedIn competitors'
};

export const brandName = (id: string) => brandById(id)?.name ?? id;

/** "14 Oct 2026, 3:02 pm", in India time. */
export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "14 Oct 2026" for a YYYY-MM-DD day. */
export const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Whole days from a YYYY-MM-DD day to today. */
export const daysAgo = (iso: string) => Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(iso)) / 86400000);

export const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
export const fy = (n: number) => `FY${String(n).slice(2)}`;

/** The error message from a failed request to the upload endpoint. */
export async function failureOf(res: Response): Promise<string> {
  return (await res.json().catch(() => null))?.message ?? `Something went wrong (${res.status}).`;
}
