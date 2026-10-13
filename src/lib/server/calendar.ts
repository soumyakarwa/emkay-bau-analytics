// Calendar data service: load and publish. Routes call only this module.

import { read } from '$app/server';
import templateUrl from '$lib/assets/calendar-template.xlsx?url';
import { parseCalendarWorkbook } from '$lib/core/parse-calendar';
import type { CalendarDataset, ImportReport, SourceInfo } from '$lib/core/types';
import { assertXlsx, NotAnXlsxError, readWorkbook } from './read-workbook';
import { getStore } from './store';

const PUBLISHED = 'calendar/published.json';
const REPORT = 'calendar/last-report.json';

export { templateUrl };

let sample: CalendarDataset | null = null;

/** The dummy dataset built from the bundled template, used until a real workbook is published. */
async function sampleDataset(): Promise<CalendarDataset> {
  if (sample) return sample;
  const bytes = await read(templateUrl).arrayBuffer();
  const result = parseCalendarWorkbook(await readWorkbook(bytes), { kind: 'sample', fileName: 'calendar-template.xlsx' });
  if (!result.dataset) throw new Error('The bundled template is invalid. Run `npm test`.');
  sample = result.dataset;
  return sample;
}

export async function getPublished(): Promise<CalendarDataset> {
  return (await getStore().read<CalendarDataset>(PUBLISHED)) ?? sampleDataset();
}

export async function getLastReport(): Promise<ImportReport | null> {
  return getStore().read<ImportReport>(REPORT);
}

/** Parse a workbook and publish it only if it has no errors. Always records a report. */
export async function ingest(bytes: ArrayBuffer, source: SourceInfo): Promise<ImportReport> {
  const attemptedAt = new Date().toISOString();
  let report: ImportReport;
  try {
    assertXlsx(bytes);
    const result = parseCalendarWorkbook(await readWorkbook(bytes), source);
    report = {
      attemptedAt,
      source,
      published: Boolean(result.dataset),
      issues: result.issues,
      summary: result.dataset ? { months: result.dataset.months, entries: result.dataset.entries.length } : null
    };
    if (result.dataset) await getStore().write(PUBLISHED, result.dataset);
  } catch (e) {
    const message =
      e instanceof NotAnXlsxError
        ? e.message
        : `The file could not be read as an Excel workbook (${(e as Error).message}). Re-save it as .xlsx and try again.`;
    report = {
      attemptedAt,
      source,
      published: false,
      issues: [{ level: 'error', sheet: null, row: null, column: null, message }],
      summary: null
    };
  }
  await getStore().write(REPORT, report);
  return report;
}
