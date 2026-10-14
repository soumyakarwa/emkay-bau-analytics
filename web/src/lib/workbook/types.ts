// What a calendar workbook becomes once it has been read and checked.

import type { Platform } from './contract';

export interface CommsTask {
  code: string;
  name: string;
  /** False for tasks such as Compliance: counted, but outside the BAU mix and targets. */
  countsAsBau: boolean;
  /** Target share of BAU posts, 0–1, or null when not set. */
  target: number | null;
  active: boolean;
}

export interface Peg {
  peg: string;
  pillar: string;
  commsTask: string;
  active: boolean;
}

export interface PlatformEntry {
  platform: Platform;
  state: 'planned' | 'sent' | 'published';
  url: string | null;
}

export interface Post {
  /** Stable within one workbook: "<sheet>!<row>". */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM */
  month: string;
  title: string | null;
  details: string | null;
  /** Null when no peg was picked, or the peg is not in the framework (see issues). */
  peg: string | null;
  pillar: string | null;
  commsTask: string | null;
  countsAsBau: boolean | null;
  /** Posts from before the brand started the BAU framework: a baseline, not counted in the mix. */
  beforeBauStart: boolean;
  series: string | null;
  format: string | null;
  owner: string | null;
  status: string | null;
  platforms: PlatformEntry[];
  copyLink: string | null;
  /** The long-form piece behind the post (a blog article): planned, or live with its link. */
  longForm: { state: 'planned' | 'published'; url: string | null } | null;
  referenceLink: string | null;
  moment: string | null;
  source: { sheet: string; row: number };
}

/** A row that only carries a moment-marketing reminder. */
export interface Moment {
  date: string;
  text: string;
  source: { sheet: string; row: number };
}

export interface CalendarWorkbook {
  brand: string;
  /** Financial year by its ending year: 2027 is FY27 (April 2026 to March 2027). */
  fy: number;
  templateVersion: string;
  purpose: string | null;
  /** YYYY-MM, or null if not set. */
  bauStart: string | null;
  commsTasks: CommsTask[];
  framework: Peg[];
  lists: { statuses: string[]; formats: string[]; team: string[]; series: string[] };
  posts: Post[];
  moments: Moment[];
}

/**
 * error: the reader cannot work out the right answer, so the workbook must not be published.
 * warning: the reader still gets the right answer, but the workbook should be fixed.
 */
export type IssueLevel = 'error' | 'warning';

export interface Issue {
  level: IssueLevel;
  sheet: string | null;
  /** Cell address such as "C14", or null for sheet- or workbook-wide issues. */
  cell: string | null;
  /** The person who should fix it: the row's Owner, or null when nobody is named. */
  owner: string | null;
  /** The post's title or peg, to help find it. */
  post: string | null;
  message: string;
}

export interface ReadResult {
  /** Null when the workbook is too broken to read (see the errors). */
  workbook: CalendarWorkbook | null;
  issues: Issue[];
}
