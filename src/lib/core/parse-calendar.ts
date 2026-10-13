// Turns workbook grids into a validated CalendarDataset, or a list of issues
// explaining what to change in Excel. Pure function: no I/O.

import {
  FRAMEWORK_COLUMNS,
  FRAMEWORK_SHEET,
  MONTH_COLUMNS,
  columnLetter,
  monthKeyFromSheetName,
  normalise,
  type ColumnSpec
} from './contract';
import type {
  CalendarDataset,
  CalendarEntry,
  Cell,
  Framework,
  Issue,
  IssueLevel,
  ParseResult,
  SheetGrid,
  SourceInfo
} from './types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

class IssueList {
  items: Issue[] = [];
  add(level: IssueLevel, message: string, at: { sheet?: string; row?: number; column?: string } = {}) {
    this.items.push({
      level,
      message,
      sheet: at.sheet ?? null,
      row: at.row ?? null,
      column: at.column ?? null
    });
  }
  error(message: string, at?: { sheet?: string; row?: number; column?: string }) {
    this.add('error', message, at);
  }
  warn(message: string, at?: { sheet?: string; row?: number; column?: string }) {
    this.add('warning', message, at);
  }
  get hasErrors() {
    return this.items.some((i) => i.level === 'error');
  }
}

type ColumnMap = Map<string, number>;

/** Map header text in row 1 to column indexes, reporting missing or duplicated headers. */
function mapHeaders(sheet: SheetGrid, specs: ColumnSpec[], issues: IssueList): ColumnMap | null {
  const headerRow = sheet.rows[0] ?? [];
  const byHeader = new Map(specs.map((s) => [normalise(s.header), s]));
  const map: ColumnMap = new Map();
  let ok = true;

  headerRow.forEach((cell, index) => {
    if (!cell.text) return;
    const spec = byHeader.get(normalise(cell.text));
    if (!spec) return; // Unknown columns are allowed and ignored.
    const existing = map.get(spec.key);
    if (existing !== undefined) {
      issues.error(
        `Column “${spec.header}” appears twice (columns ${columnLetter(existing)} and ${columnLetter(index)}). Rename or remove one.`,
        { sheet: sheet.name, row: 1, column: columnLetter(index) }
      );
      ok = false;
      return;
    }
    map.set(spec.key, index);
  });

  for (const spec of specs) {
    if (spec.required && !map.has(spec.key)) {
      issues.error(`Missing column “${spec.header}” in row 1.`, { sheet: sheet.name, row: 1 });
      ok = false;
    }
  }
  return ok ? map : null;
}

const EMPTY: Cell = { text: null, date: null, url: null };

function cellAt(row: Cell[] | undefined, map: ColumnMap, key: string): Cell {
  const index = map.get(key);
  if (index === undefined || !row) return EMPTY;
  return row[index] ?? EMPTY;
}

function isEmpty(cell: Cell) {
  return !cell.text && !cell.date && !cell.url;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** A cell's link: its hyperlink, or its text when the text itself is a URL. */
function linkOf(cell: Cell, issues: IssueList, at: { sheet: string; row: number; column: string }): string | null {
  const candidate = cell.url ?? (cell.text && /^https?:\/\//i.test(cell.text) ? cell.text : null);
  if (!candidate) return null;
  if (!isHttpUrl(candidate)) {
    issues.error(`Link “${candidate}” is not a web address (must start with http:// or https://).`, at);
    return null;
  }
  return candidate;
}

export function parseFramework(sheet: SheetGrid | undefined, issues: IssueList): Framework | null {
  if (!sheet) {
    issues.error(`The workbook has no sheet named “${FRAMEWORK_SHEET}”.`);
    return null;
  }
  const map = mapHeaders(sheet, FRAMEWORK_COLUMNS, issues);
  if (!map) return null;

  const framework: Framework = { tasks: [], rows: [] };
  const taskNames = new Map<string, { name: string; row: number }>();
  const seen = new Set<string>();

  sheet.rows.slice(1).forEach((row, i) => {
    const rowNumber = i + 2;
    const values = FRAMEWORK_COLUMNS.map((spec) => cellAt(row, map, spec.key).text);
    if (values.every((v) => !v)) return;
    const [code, task, pillar, peg] = values;
    FRAMEWORK_COLUMNS.forEach((spec, k) => {
      if (!values[k]) {
        issues.error(`“${spec.header}” is empty. Every framework row needs all four columns.`, {
          sheet: sheet.name,
          row: rowNumber,
          column: columnLetter(map.get(spec.key)!)
        });
      }
    });
    if (!code || !task || !pillar || !peg) return;

    const known = taskNames.get(normalise(code));
    if (known && normalise(known.name) !== normalise(task)) {
      issues.error(`Code “${code}” is called “${task}” here but “${known.name}” in row ${known.row}. Use one name per code.`, {
        sheet: sheet.name,
        row: rowNumber
      });
      return;
    }
    if (!known) {
      taskNames.set(normalise(code), { name: task, row: rowNumber });
      framework.tasks.push({ code, name: task });
    }

    const key = [code, pillar, peg].map(normalise).join('|');
    if (seen.has(key)) {
      issues.warn(`Duplicate framework row (${code} › ${pillar} › ${peg}); it is counted once.`, {
        sheet: sheet.name,
        row: rowNumber
      });
      return;
    }
    seen.add(key);
    framework.rows.push({ code, task, pillar, peg });
  });

  if (framework.rows.length === 0) {
    issues.error('The framework sheet has no rows below the headers.', { sheet: sheet.name });
    return null;
  }
  return framework;
}

/** Look up labels in the framework, returning the framework's own spelling. */
function resolveTaxonomy(framework: Framework) {
  const tasks = new Map(framework.tasks.map((t) => [normalise(t.code), t.code]));
  const pillars = new Map<string, Map<string, string>>();
  const pegs = new Map<string, Map<string, string>>();
  for (const r of framework.rows) {
    const t = normalise(r.code);
    if (!pillars.has(t)) pillars.set(t, new Map());
    pillars.get(t)!.set(normalise(r.pillar), r.pillar);
    const pk = `${t}|${normalise(r.pillar)}`;
    if (!pegs.has(pk)) pegs.set(pk, new Map());
    pegs.get(pk)!.set(normalise(r.peg), r.peg);
  }
  return { tasks, pillars, pegs };
}

function parseMonthSheet(
  sheet: SheetGrid,
  monthKey: string,
  framework: Framework | null,
  issues: IssueList
): CalendarEntry[] {
  const map = mapHeaders(sheet, MONTH_COLUMNS, issues);
  if (!map) return [];
  const taxonomy = framework ? resolveTaxonomy(framework) : null;
  const [year, month] = monthKey.split('-').map(Number);
  const entries: CalendarEntry[] = [];
  const col = (key: string) => columnLetter(map.get(key)!);

  sheet.rows.slice(1).forEach((row, i) => {
    const rowNumber = i + 2;
    const at = (key?: string) => ({ sheet: sheet.name, row: rowNumber, column: key && map.has(key) ? col(key) : undefined });
    const get = (key: string) => cellAt(row, map, key);

    const title = get('title').text;
    const moment = get('moment').text;
    const dateCell = get('date');

    if (!title && !moment) {
      // Name the columns holding data (besides Date and Day), so the warning is actionable.
      const filled = row
        .map((cell, index) => (isEmpty(cell) || index === map.get('date') || index === map.get('day') ? null : index))
        .filter((index): index is number => index !== null)
        .map(columnLetter);
      if (filled.length) {
        issues.warn(
          `Row has values in column${filled.length > 1 ? 's' : ''} ${filled.join(', ')} but no Content piece or moment marketing, so it is ignored.`,
          at()
        );
      }
      return;
    }

    // Date: must be a real date inside this sheet's month.
    if (!dateCell.date) {
      issues.error(
        dateCell.text
          ? `Date “${dateCell.text}” is text, not an Excel date. Re-enter it as a date.`
          : 'Date is empty.',
        at('date')
      );
      return;
    }
    const { y, m, d } = dateCell.date;
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (y !== year || m !== month) {
      issues.error(`Date ${iso} is outside ${sheet.name}. Move the row to the right sheet or correct the date.`, at('date'));
      return;
    }

    const day = get('day').text;
    if (day) {
      const actual = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
      if (normalise(day) !== normalise(actual)) {
        issues.error(`Day says “${day}” but ${iso} is a ${actual}.`, at('day'));
      }
    }

    // Taxonomy.
    let taskCode = get('taskCode').text;
    let pillar = get('pillar').text;
    let peg = get('peg').text;
    if (title) {
      if (!taskCode) {
        issues.error('Comms task code is empty. Every content piece needs one.', at('taskCode'));
      }
    }
    if (taxonomy && taskCode) {
      const code = taxonomy.tasks.get(normalise(taskCode));
      if (!code) {
        issues.error(`Comms task code “${taskCode}” is not in the ${FRAMEWORK_SHEET} sheet.`, at('taskCode'));
      } else {
        taskCode = code;
        if (pillar) {
          const p = taxonomy.pillars.get(normalise(code))?.get(normalise(pillar));
          if (!p) {
            issues.error(`Pillar “${pillar}” is not listed under ${code} in the ${FRAMEWORK_SHEET} sheet.`, at('pillar'));
          } else {
            pillar = p;
            if (peg) {
              const g = taxonomy.pegs.get(`${normalise(code)}|${normalise(p)}`)?.get(normalise(peg));
              if (!g) issues.error(`Peg “${peg}” is not listed under ${code} › ${p} in the ${FRAMEWORK_SHEET} sheet.`, at('peg'));
              else peg = g;
            }
          }
        } else if (peg) {
          issues.error('Content peg is filled but Content pillar is empty.', at('pillar'));
        }
      }
    }

    // Platforms and links.
    const platforms = MONTH_COLUMNS.filter((s) => s.platform && map.has(s.key))
      .filter((s) => !isEmpty(get(s.key)))
      .map((s) => ({ platform: s.header, url: linkOf(get(s.key), issues, { sheet: sheet.name, row: rowNumber, column: col(s.key) }) }));

    const links = MONTH_COLUMNS.filter((s) => s.linkField && map.has(s.key))
      .map((s) => {
        const cell = get(s.key);
        if (isEmpty(cell)) return null;
        const url = linkOf(cell, issues, { sheet: sheet.name, row: rowNumber, column: col(s.key) });
        return { label: s.header, text: cell.text ?? url ?? '', url };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    entries.push({
      id: `${monthKey}-r${rowNumber}`,
      date: iso,
      month: monthKey,
      kind: title ? 'content' : 'moment',
      title: title ?? moment!,
      taskCode: title ? taskCode : null,
      pillar: title ? pillar : null,
      peg: title ? peg : null,
      platforms,
      status: get('status').text,
      format: get('format').text,
      poc: get('poc').text,
      details: get('details').text,
      moment,
      links,
      source: { sheet: sheet.name, row: rowNumber }
    });
  });

  return entries;
}

export function parseCalendarWorkbook(sheets: SheetGrid[], source: SourceInfo, now = new Date()): ParseResult {
  const issues = new IssueList();
  const frameworkSheet = sheets.find((s) => normalise(s.name) === normalise(FRAMEWORK_SHEET));
  const framework = parseFramework(frameworkSheet, issues);

  const months: { key: string; sheet: SheetGrid }[] = [];
  for (const sheet of sheets) {
    if (sheet === frameworkSheet) continue;
    const key = monthKeyFromSheetName(sheet.name);
    if (!key) {
      issues.warn(`Sheet “${sheet.name}” is not a month (like “October 2026”) or “${FRAMEWORK_SHEET}”, so it is ignored.`, {
        sheet: sheet.name
      });
      continue;
    }
    if (months.some((m) => m.key === key)) {
      issues.error(`Two sheets are named for the same month (${sheet.name}).`, { sheet: sheet.name });
      continue;
    }
    months.push({ key, sheet });
  }
  if (months.length === 0) issues.error('The workbook has no month sheets named like “October 2026”.');

  const entries = months
    .flatMap(({ key, sheet }) => parseMonthSheet(sheet, key, framework, issues))
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.row - b.source.row);

  if (issues.hasErrors || !framework) return { dataset: null, issues: issues.items };

  return {
    dataset: {
      schemaVersion: 1,
      generatedAt: now.toISOString(),
      source,
      framework,
      months: months.map((m) => m.key).sort(),
      entries
    } satisfies CalendarDataset,
    issues: issues.items
  };
}
