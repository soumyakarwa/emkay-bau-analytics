// The Excel contract: the single definition of what a valid calendar workbook
// looks like. The parser, the template generator and the "Excel rules" section
// of the Data page all read from here, so they cannot drift apart.
//
// Principle: the code does not repair the spreadsheet. If the workbook breaks
// a rule, the import fails with a message saying what to change in Excel.
// The only normalisation is ignoring invisible differences: leading/trailing
// spaces, repeated spaces and letter case in headers and taxonomy labels.

export const FRAMEWORK_SHEET = 'BAU framework';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

/** A month sheet must be named exactly like "October 2026". */
export const MONTH_SHEET_PATTERN = new RegExp(`^(${MONTH_NAMES.join('|')}) (\\d{4})$`);

export interface ColumnSpec {
  /** Canonical header text, as it appears in the template. */
  header: string;
  /** Internal key. */
  key: string;
  required: boolean;
  description: string;
  /** Platform columns: a filled cell means "planned for this platform"; its hyperlink is the post link. */
  platform?: boolean;
  /** Shown as a labelled text/link in the details panel. */
  linkField?: boolean;
  /** Example width in the template (characters). */
  width?: number;
}

export const FRAMEWORK_COLUMNS: ColumnSpec[] = [
  { header: 'Comms task code', key: 'code', required: true, width: 18, description: 'Short code used in the calendar, e.g. TL.' },
  { header: 'Comms task', key: 'task', required: true, width: 24, description: 'Full name, e.g. Thought Leadership. Must be the same on every row with the same code.' },
  { header: 'Content pillar', key: 'pillar', required: true, width: 26, description: 'A pillar under the task.' },
  { header: 'Content peg', key: 'peg', required: true, width: 52, description: 'A peg under the pillar. One row per peg.' }
];

export const MONTH_COLUMNS: ColumnSpec[] = [
  { header: 'Date', key: 'date', required: true, width: 12, description: 'A real Excel date inside the sheet’s month (not text).' },
  { header: 'Day', key: 'day', required: false, width: 11, description: 'Optional. If filled, must match the weekday of the date.' },
  { header: 'Comms task code', key: 'taskCode', required: true, width: 10, description: 'Required for every content piece. Must exist in the BAU framework sheet.' },
  { header: 'Content pillar', key: 'pillar', required: true, width: 22, description: 'Optional per row. If filled, must be a pillar of that comms task.' },
  { header: 'Content peg', key: 'peg', required: true, width: 30, description: 'Optional per row. If filled, the pillar must be filled too and the peg must belong to it.' },
  { header: 'Content piece', key: 'title', required: true, width: 40, description: 'The title. A row with a title is a calendar item.' },
  { header: 'LinkedIn', key: 'LinkedIn', required: false, platform: true, width: 11, description: 'Any value = planned for LinkedIn. Add a hyperlink once published.' },
  { header: 'Instagram', key: 'Instagram', required: false, platform: true, width: 11, description: 'As LinkedIn.' },
  { header: 'YouTube', key: 'YouTube', required: false, platform: true, width: 11, description: 'As LinkedIn.' },
  { header: 'X.com', key: 'X.com', required: false, platform: true, width: 11, description: 'As LinkedIn.' },
  { header: 'Post copy', key: 'postCopy', required: false, linkField: true, width: 14, description: 'Text or a hyperlink to the copy document.' },
  { header: 'Short post details', key: 'details', required: false, width: 40, description: 'Free text.' },
  { header: 'Possible moment marketing', key: 'moment', required: false, width: 22, description: 'A row with only this filled shows as a moment marker.' },
  { header: 'Status', key: 'status', required: false, width: 18, description: 'Free text, e.g. Content In Progress, Completed.' },
  { header: 'Content format', key: 'format', required: false, width: 14, description: 'Free text, e.g. Carousel, Video, Static.' },
  { header: 'POC', key: 'poc', required: false, width: 16, description: 'Person responsible.' },
  { header: 'Long-form content', key: 'longForm', required: false, linkField: true, width: 16, description: 'Text or a hyperlink.' },
  { header: 'Reference', key: 'reference', required: false, linkField: true, width: 24, description: 'Text or a hyperlink.' }
];

/** Plain-language rules, shown on the Data page. Keep in sync with parse-calendar.ts. */
export const RULES: string[] = [
  `The workbook needs a sheet named “${FRAMEWORK_SHEET}” and at least one month sheet named like “October 2026”.`,
  'Any other sheets (notes, summaries, old metrics) are ignored, with a warning.',
  'Row 1 of every sheet holds the column headers. Columns can be in any order and extra columns are ignored, but each known header may appear only once.',
  'Headers and taxonomy labels ignore letter case and extra spaces; everything else must match exactly.',
  'Each month sheet only holds dates inside that month. Rows dated in another month are errors, not moved.',
  'A row becomes a calendar item when it has a Content piece. A row with only Possible moment marketing becomes a moment marker. Rows with only a date are empty days.',
  'Rows that have other values but no Content piece or moment are ignored, with a warning — keep summaries on a separate sheet.',
  'Any error stops the update. The site keeps showing the last valid version until the workbook is fixed.'
];

/** Collapse invisible differences: trim, squash whitespace, ignore case. */
export function normalise(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function monthKeyFromSheetName(name: string): string | null {
  const match = MONTH_SHEET_PATTERN.exec(name.trim());
  if (!match) return null;
  const month = MONTH_NAMES.indexOf(match[1] as (typeof MONTH_NAMES)[number]) + 1;
  return `${match[2]}-${String(month).padStart(2, '0')}`;
}

export function sheetNameForMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Convert a 0-based column index to Excel letters (0 → A). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
