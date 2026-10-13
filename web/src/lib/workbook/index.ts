// Read and check one brand's calendar workbook.

import { readCalendar, type ReadOptions } from './read-calendar';
import type { ReadResult } from './types';
import { readXlsx } from './xlsx';

export function readCalendarFile(bytes: Uint8Array, options: ReadOptions = {}): ReadResult {
  let sheets;
  try {
    sheets = readXlsx(bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { workbook: null, issues: [{ level: 'error', sheet: null, cell: null, owner: null, post: null, message }] };
  }
  return readCalendar(sheets, options);
}

export { summarise } from './summary';
export type * from './types';
