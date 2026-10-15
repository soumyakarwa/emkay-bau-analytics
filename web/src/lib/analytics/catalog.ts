// The analytics platforms and their exports, by name: what the upload page and the analytics
// pages show. Kept apart from the readers (platforms.ts), which only the server needs.

import type { Platform as CalendarColumn } from '../workbook/contract';
import type { Platform } from './rows';

export interface FileSpec {
  id: string;
  label: string;
  optional: boolean;
  /**
   * rolling: export the last 365 days each month; newer exports update older figures.
   * month: export the previous calendar month each month; the months add up.
   * any: a summary for whatever period is exported.
   */
  rule: 'rolling' | 'month' | 'any';
  /** Where to find it on the platform. */
  help: string;
}

export interface PlatformSpec {
  id: Platform;
  label: string;
  /** The calendar workbook column holding this platform's post links. */
  calendarColumn: CalendarColumn;
  /** How to export, in one line, for the upload page. */
  routine: string;
  files: FileSpec[];
}

export const PLATFORMS: PlatformSpec[] = [
  {
    id: 'linkedin', label: 'LinkedIn', calendarColumn: 'LinkedIn',
    routine: 'Each month, export the last 365 days. Page admin view → Analytics → each tab → Export.',
    files: [
      { id: 'content', label: 'Content', optional: false, rule: 'rolling', help: 'Analytics → Content → Export' },
      { id: 'followers', label: 'Followers', optional: false, rule: 'rolling', help: 'Analytics → Followers → Export' },
      { id: 'visitors', label: 'Visitors', optional: false, rule: 'rolling', help: 'Analytics → Visitors → Export' },
      { id: 'competitors', label: 'Competitors', optional: true, rule: 'any', help: 'Analytics → Competitors → Export (once competitors are set up)' }
    ]
  },
  {
    id: 'youtube', label: 'YouTube', calendarColumn: 'YouTube',
    routine: 'Each month, export the previous calendar month. YouTube Studio → Analytics → Advanced mode → each report → Export → CSV; upload the zips as they are.',
    files: [
      { id: 'content', label: 'Content', optional: false, rule: 'month', help: 'Advanced mode → Content, with Likes, Comments added, Shares, Average percentage viewed and Subscribers gained/lost added' },
      { id: 'traffic-source', label: 'Traffic source', optional: false, rule: 'month', help: 'Advanced mode → Traffic source' },
      { id: 'geography', label: 'Geography', optional: true, rule: 'month', help: 'Advanced mode → Geography' },
      { id: 'content-type', label: 'Content type', optional: true, rule: 'month', help: 'Advanced mode → Content type' }
    ]
  },
  {
    id: 'instagram', label: 'Instagram', calendarColumn: 'Instagram',
    routine: 'Each month, export the last 365 days from Meta Business Suite → Insights. Upload the CSVs without opening them in Excel.',
    files: [
      { id: 'posts', label: 'Posts', optional: false, rule: 'rolling', help: 'Insights → Content → Export (one row per post)' },
      { id: 'overview', label: 'Overview summary', optional: true, rule: 'any', help: 'Insights → Overview → Export' },
      { id: 'posts-summary', label: 'Posts summary', optional: true, rule: 'any', help: 'Insights → Content → Export summary' }
    ]
  },
  {
    id: 'x', label: 'X', calendarColumn: 'X',
    routine: 'Each month, export the last 365 days from X Analytics: the content and the account overview.',
    files: [
      { id: 'posts', label: 'Posts', optional: false, rule: 'rolling', help: 'Analytics → Content → Export' },
      { id: 'overview', label: 'Account overview', optional: false, rule: 'rolling', help: 'Analytics → Overview → Export' }
    ]
  }
];

export const platformSpec = (id: string): PlatformSpec | undefined => PLATFORMS.find((p) => p.id === id);
export const fileSpec = (platform: string, file: string): FileSpec | undefined => platformSpec(platform)?.files.find((f) => f.id === file);
export const exportLabel = (platform: string, file: string) =>
  `${platformSpec(platform)?.label ?? platform} · ${fileSpec(platform, file)?.label ?? file}`;

