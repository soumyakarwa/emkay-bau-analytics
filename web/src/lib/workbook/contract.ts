// The names the reader relies on. They mirror tools/template/build_workbook.py, which writes the
// workbooks; tests/template-drift.test.ts builds a workbook with that script and reads it back,
// so the two cannot drift apart unnoticed.

export const SUPPORTED_TEMPLATE_VERSIONS = ['1.0'];

export const SHEETS = {
  start: 'Start here',
  summary: 'Summary',
  review: 'Review flags',
  tasks: 'Comms tasks',
  framework: 'Framework',
  lists: 'Lists'
} as const;

/** Labels in column A of the Start here sheet; the value is in column B. */
export const START = {
  brand: 'Brand',
  fy: 'Financial year',
  version: 'Template version',
  purpose: 'Purpose',
  bauStart: 'BAU started'
} as const;

export const TABLES = {
  tasks: 'CommsTasks',
  pegs: 'Pegs',
  statuses: 'Statuses',
  formats: 'Formats',
  team: 'Team',
  series: 'SeriesTable'
} as const;

export const TASK_COLUMNS = { code: 'Code', name: 'Comms task', bau: 'Counts as BAU', target: 'Target share', active: 'Active' } as const;
export const PEG_COLUMNS = { code: 'Comms task code', pillar: 'Pillar', peg: 'Peg', active: 'Active' } as const;
export const LIST_COLUMNS = { status: 'Status', format: 'Format', team: 'Team member', series: 'Series' } as const;

export const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube', 'X', 'WhatsApp'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const MONTH_COLUMNS = {
  date: 'Date',
  day: 'Day (auto)',
  task: 'Comms task (auto)',
  pillar: 'Pillar (auto)',
  peg: 'Peg',
  series: 'Series',
  title: 'Title',
  details: 'Details',
  format: 'Format',
  owner: 'Owner',
  status: 'Status',
  copy: 'Copy link',
  longForm: 'Long-form',
  reference: 'Reference',
  moment: 'Moment marketing'
} as const;

/** The value the Comms task and Pillar formulas show for a peg that is not on the Framework sheet. */
export const NOT_IN_FRAMEWORK = 'Not in framework';
export const DROPPED = 'Dropped';
export const PUBLISHED = 'Published';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** FY27 → the 12 months April 2026 … March 2027, as [year, month]. */
export function fyMonths(fyEnd: number): [number, number][] {
  return [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((m) => [m >= 4 ? fyEnd - 1 : fyEnd, m]);
}

/** [2026, 4] → "Apr 2026" (sheet name). */
export function monthSheetName(y: number, m: number): string {
  return `${MONTH_ABBR[m - 1]} ${y}`;
}

/** [2026, 4] → "Apr_2026" (table name). */
export function monthTableName(y: number, m: number): string {
  return `${MONTH_ABBR[m - 1]}_${y}`;
}

/** Ignore invisible differences: case and repeated or surrounding spaces. */
export function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}
