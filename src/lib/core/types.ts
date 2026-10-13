// Shared data shapes. No framework code in here: these modules run in the
// browser, on the server and in tests alike.

/** A single cell, reduced to what the parser needs. Produced by the workbook reader. */
export interface Cell {
  /** Display text (trimmed). Null when the cell is empty. */
  text: string | null;
  /** Set only when the cell holds a real Excel date (not text that looks like one). */
  date: { y: number; m: number; d: number } | null;
  /** Hyperlink target attached to the cell, if any. */
  url: string | null;
}

/** One worksheet as a grid of cells. rows[0] is Excel row 1. */
export interface SheetGrid {
  name: string;
  rows: Cell[][];
}

export interface FrameworkRow {
  code: string;
  task: string;
  pillar: string;
  peg: string;
}

export interface Framework {
  /** Comms tasks in sheet order. */
  tasks: { code: string; name: string }[];
  rows: FrameworkRow[];
}

export interface PlatformLink {
  platform: string;
  url: string | null;
}

export interface CalendarEntry {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** YYYY-MM, taken from the sheet the row lives on. */
  month: string;
  /** "content" = a planned piece; "moment" = only a moment-marketing marker. */
  kind: 'content' | 'moment';
  title: string;
  taskCode: string | null;
  pillar: string | null;
  peg: string | null;
  platforms: PlatformLink[];
  status: string | null;
  format: string | null;
  poc: string | null;
  details: string | null;
  moment: string | null;
  /** Free-text/link fields shown in the details panel. */
  links: { label: string; text: string; url: string | null }[];
  source: { sheet: string; row: number };
}

export type IssueLevel = 'error' | 'warning';

export interface Issue {
  level: IssueLevel;
  sheet: string | null;
  row: number | null;
  column: string | null;
  message: string;
}

export interface SourceInfo {
  /** "upload" = published from the Data page; "sample" = the bundled dummy template. */
  kind: 'upload' | 'sample';
  fileName: string;
}

export interface CalendarDataset {
  schemaVersion: 1;
  /** When this dataset was parsed (ISO). */
  generatedAt: string;
  source: SourceInfo;
  framework: Framework;
  /** YYYY-MM keys in chronological order. */
  months: string[];
  entries: CalendarEntry[];
}

export interface ParseResult {
  dataset: CalendarDataset | null;
  issues: Issue[];
}

/** Outcome of the most recent attempt to load a workbook, whether or not it was published. */
export interface ImportReport {
  attemptedAt: string;
  source: SourceInfo;
  published: boolean;
  issues: Issue[];
  summary: { months: string[]; entries: number } | null;
}
