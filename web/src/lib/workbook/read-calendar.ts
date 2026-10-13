// Turns the sheets of one brand's calendar workbook into posts, and lists every problem with
// the sheet, cell and person who should fix it.
//
// The reader never trusts the grey (auto) cells. Pillar and comms task come from the post's
// peg and the Framework sheet, exactly as the Excel formulas do. The grey cells are only
// checked, so a typed-over or stale cell is reported instead of silently counted.
//
// Errors mean the reader cannot work out the right answer (the workbook must not be published).
// Warnings mean the answer is still right, but the file should be fixed. Missing details on
// posts dated after `today` are not reported: planning ahead is expected to be incomplete.

import {
  DROPPED,
  LIST_COLUMNS,
  MONTH_COLUMNS,
  NOT_IN_FRAMEWORK,
  PEG_COLUMNS,
  PLATFORMS,
  PUBLISHED,
  SHEETS,
  START,
  SUPPORTED_TEMPLATE_VERSIONS,
  TABLES,
  TASK_COLUMNS,
  fyMonths,
  monthSheetName,
  monthTableName,
  normalise
} from './contract';
import type { CalendarWorkbook, CommsTask, Issue, IssueLevel, Moment, Peg, PlatformEntry, Post, ReadResult } from './types';
import { columnLetter, type Cell, type Sheet, type TableInfo } from './xlsx';

export interface ReadOptions {
  /** YYYY-MM-DD. Posts after this date are not checked for missing details. Defaults to today. */
  today?: string;
}

function text(cell: Cell): string | null {
  if (cell.value === null) return null;
  if (typeof cell.value === 'boolean') return cell.value ? 'TRUE' : 'FALSE';
  const s = String(cell.value).trim();
  return s === '' ? null : s;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Excel stores dates as days since 30 Dec 1899. */
function serialToIso(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);
/** A path to a file on someone's computer rather than a shared link. */
const isLocalPath = (s: string) => /^(file:|\.\.?[\\/]|[a-z]:[\\/]|\\\\|\/(users|home)\/)/i.test(s) || /appdata[\\/]/i.test(s) || /^[^\s:]+[\\/][^\s]+\.\w{2,4}$/.test(s);
const LOCAL_FILE = 'points to a file on one computer, so nobody else can open it. Put the file on SharePoint or OneDrive and paste that link instead.';
const LOCAL_POST = 'points to a file on one computer, not to the post. Paste the post\'s web link.';

interface TableView {
  sheet: Sheet;
  table: TableInfo;
  /** normalised header → column number */
  columns: Map<string, number>;
}

function viewTable(sheet: Sheet, table: TableInfo): TableView {
  const columns = new Map<string, number>();
  for (let c = table.left; c <= table.right; c++) {
    const h = text(sheet.cell(table.top, c));
    if (h) columns.set(normalise(h), c);
  }
  return { sheet, table, columns };
}

function findTable(sheets: Sheet[], name: string): TableView | null {
  for (const sheet of sheets) {
    const t = sheet.tables.find((x) => normalise(x.name) === normalise(name));
    if (t) return viewTable(sheet, t);
  }
  return null;
}

export function readCalendar(sheets: Sheet[], options: ReadOptions = {}): ReadResult {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const issues: Issue[] = [];
  const add = (level: IssueLevel, sheet: string | null, cell: string | null, message: string, owner: string | null = null, post: string | null = null) =>
    issues.push({ level, sheet, cell, owner, post, message });
  const fail = (): ReadResult => ({ workbook: null, issues });

  const byName = new Map(sheets.map((s) => [normalise(s.name), s]));
  const sheet = (name: string) => byName.get(normalise(name));

  for (const name of [SHEETS.start, SHEETS.tasks, SHEETS.framework, SHEETS.lists]) {
    if (!sheet(name)) add('error', name, null, `The "${name}" sheet is missing. This does not look like a calendar workbook made from the template.`);
  }
  if (issues.length) return fail();

  // ---------- Start here ----------
  const start = sheet(SHEETS.start)!;
  const info = new Map<string, { value: Cell; row: number }>();
  for (let r = 1; r <= Math.min(start.maxRow, 40); r++) {
    const label = text(start.cell(r, 1));
    if (label) info.set(normalise(label), { value: start.cell(r, 2), row: r });
  }
  const startValue = (label: string) => {
    const hit = info.get(normalise(label));
    return hit ? text(hit.value) : null;
  };
  const brand = startValue(START.brand);
  if (!brand) add('error', SHEETS.start, null, 'The brand name is missing (next to "Brand").');
  const fyMatch = /FY\s*(\d{2})/i.exec(startValue(START.fy) ?? '');
  if (!fyMatch) add('error', SHEETS.start, null, 'The financial year is missing or unreadable (next to "Financial year", e.g. "FY27").');
  const templateVersion = startValue(START.version) ?? '';
  if (!SUPPORTED_TEMPLATE_VERSIONS.includes(templateVersion)) {
    add('error', SHEETS.start, null, `Template version "${templateVersion || 'missing'}" is not one this site can read (expected ${SUPPORTED_TEMPLATE_VERSIONS.join(' or ')}). Use a workbook generated from the current template.`);
  }
  let bauStart: string | null = null;
  const bauHit = info.get(normalise(START.bauStart));
  if (bauHit && typeof bauHit.value.value === 'number') bauStart = serialToIso(bauHit.value.value).slice(0, 7);
  else if (bauHit && text(bauHit.value)) add('warning', SHEETS.start, `B${bauHit.row}`, 'The BAU start is not a date. Type the first day of the month the brand started the BAU, e.g. 01/08/2026.');
  else add('warning', SHEETS.start, null, 'The BAU start date is not set, so every month counts towards the BAU mix.');
  if (!brand || !fyMatch || !SUPPORTED_TEMPLATE_VERSIONS.includes(templateVersion)) return fail();
  const fy = 2000 + Number(fyMatch[1]);

  // ---------- Comms tasks ----------
  const taskTable = findTable([sheet(SHEETS.tasks)!], TABLES.tasks);
  const commsTasks: CommsTask[] = [];
  if (!taskTable || !taskTable.columns.has(normalise(TASK_COLUMNS.code))) {
    add('error', SHEETS.tasks, null, 'The comms tasks table is missing or has lost its "Code" column.');
    return fail();
  }
  {
    const { sheet: s, table, columns } = taskTable;
    const col = (h: string) => columns.get(normalise(h));
    const seen = new Set<string>();
    for (let r = table.top + 1; r <= table.bottom; r++) {
      const v = (h: string) => (col(h) ? text(s.cell(r, col(h)!)) : null);
      const raw = (h: string) => (col(h) ? s.cell(r, col(h)!) : null);
      const code = v(TASK_COLUMNS.code);
      if (!code) {
        if (v(TASK_COLUMNS.name)) add('error', s.name, `A${r}`, `Comms task "${v(TASK_COLUMNS.name)}" has no code. Give it a short code such as TL.`);
        continue;
      }
      if (seen.has(normalise(code))) {
        add('error', s.name, `A${r}`, `The code "${code}" is used twice. Each comms task needs its own code.`);
        continue;
      }
      seen.add(normalise(code));
      let target: number | null = null;
      const t = raw(TASK_COLUMNS.target)?.value;
      if (typeof t === 'number') {
        target = t > 1 ? t / 100 : t;
        if (t > 1) add('warning', s.name, `${columnLetter(col(TASK_COLUMNS.target)!)}${r}`, `Target share for ${code} is ${t}; read as ${t}%. Format the cell as a percentage.`);
      }
      commsTasks.push({
        code,
        name: v(TASK_COLUMNS.name) ?? code,
        countsAsBau: normalise(v(TASK_COLUMNS.bau) ?? '') !== 'no',
        target,
        active: normalise(v(TASK_COLUMNS.active) ?? '') !== 'no'
      });
    }
    const bauTasks = commsTasks.filter((c) => c.countsAsBau);
    const withTarget = bauTasks.filter((c) => c.target !== null);
    if (bauTasks.length && !withTarget.length) {
      add('warning', s.name, null, 'No target shares are set, so the mix cannot be compared with a plan. Fill in Target share for each BAU comms task.');
    } else if (withTarget.length) {
      const sum = withTarget.reduce((a, c) => a + (c.target ?? 0), 0);
      if (Math.abs(sum - 1) > 0.001) add('warning', s.name, null, `BAU target shares add up to ${Math.round(sum * 100)}%, not 100%.`);
    }
  }
  const taskIndex = new Map(commsTasks.map((t) => [normalise(t.code), t]));

  // ---------- Framework ----------
  const pegTable = findTable([sheet(SHEETS.framework)!], TABLES.pegs);
  if (!pegTable || !pegTable.columns.has(normalise(PEG_COLUMNS.peg))) {
    add('error', SHEETS.framework, null, 'The framework table is missing or has lost its "Peg" column.');
    return fail();
  }
  const framework: Peg[] = [];
  const pegIndex = new Map<string, Peg>();
  {
    const { sheet: s, table, columns } = pegTable;
    const col = (h: string) => columns.get(normalise(h));
    for (let r = table.top + 1; r <= table.bottom; r++) {
      const v = (h: string) => (col(h) ? text(s.cell(r, col(h)!)) : null);
      const peg = v(PEG_COLUMNS.peg);
      const code = v(PEG_COLUMNS.code);
      const pillar = v(PEG_COLUMNS.pillar);
      if (!peg && !code && !pillar) continue;
      const at = (h: string) => `${columnLetter(col(h) ?? 1)}${r}`;
      if (!peg) {
        add('error', s.name, at(PEG_COLUMNS.peg), 'This framework row has no peg name.');
        continue;
      }
      if (pegIndex.has(normalise(peg))) {
        add('error', s.name, at(PEG_COLUMNS.peg), `The peg "${peg}" appears twice. Each peg can belong to only one pillar.`);
        continue;
      }
      if (!code || !taskIndex.has(normalise(code))) {
        add('error', s.name, at(PEG_COLUMNS.code), code
          ? `Peg "${peg}" uses comms task code "${code}", which is not on the Comms tasks sheet.`
          : `Peg "${peg}" has no comms task code.`);
        continue;
      }
      if (!pillar) {
        add('error', s.name, at(PEG_COLUMNS.pillar), `Peg "${peg}" has no pillar.`);
        continue;
      }
      const entry: Peg = { peg, pillar, commsTask: taskIndex.get(normalise(code))!.code, active: normalise(v(PEG_COLUMNS.active) ?? '') !== 'no' };
      framework.push(entry);
      pegIndex.set(normalise(peg), entry);
    }
  }

  // ---------- Lists ----------
  const listValues = (table: string, header: string): string[] => {
    const view = findTable([sheet(SHEETS.lists)!], table);
    const c = view?.columns.get(normalise(header));
    if (!view || !c) {
      add('warning', SHEETS.lists, null, `The "${header}" list is missing, so ${header.toLowerCase()} values are not checked.`);
      return [];
    }
    const out: string[] = [];
    for (let r = view.table.top + 1; r <= view.table.bottom; r++) {
      const v = text(view.sheet.cell(r, c));
      if (v) out.push(v);
    }
    return out;
  };
  const lists = {
    statuses: listValues(TABLES.statuses, LIST_COLUMNS.status),
    formats: listValues(TABLES.formats, LIST_COLUMNS.format),
    team: listValues(TABLES.team, LIST_COLUMNS.team),
    series: listValues(TABLES.series, LIST_COLUMNS.series)
  };
  const inList = (list: string[], value: string) => list.some((x) => normalise(x) === normalise(value));

  // ---------- Month sheets ----------
  const posts: Post[] = [];
  const moments: Moment[] = [];
  const expected = new Set<string>(Object.values(SHEETS).map(normalise));
  for (const [y, m] of fyMonths(fy)) {
    const name = monthSheetName(y, m);
    expected.add(normalise(name));
    const ms = sheet(name);
    if (!ms) {
      add('error', name, null, `The "${name}" sheet is missing. Month sheets must not be renamed or deleted.`);
      continue;
    }
    const t = ms.tables.find((x) => normalise(x.name) === normalise(monthTableName(y, m)));
    if (!t) {
      add('error', ms.name, null, `The "${name}" sheet has lost its table. Rebuild the sheet from the template.`);
      continue;
    }
    const { columns } = viewTable(ms, t);
    const missing = Object.values(MONTH_COLUMNS).filter((h) => !columns.has(normalise(h)));
    if (missing.length) {
      add('error', ms.name, null, `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Column headers must not be renamed.`);
      continue;
    }
    readMonth(ms, t, columns, y, m);

    for (let r = t.bottom + 1; r <= ms.maxRow; r++) {
      for (let c = t.left; c <= t.right; c++) {
        if (text(ms.cell(r, c))) {
          add('warning', ms.name, `${columnLetter(c)}${r}`, `Row ${r} is below the table, so it is ignored. Insert rows inside the table instead (right-click a row → Insert → Table Rows Above).`);
          break;
        }
      }
    }
  }
  for (const s of sheets) {
    if (!expected.has(normalise(s.name))) add('warning', s.name, null, `The sheet "${s.name}" is not part of the template and is ignored.`);
  }

  function readMonth(ms: Sheet, t: TableInfo, columns: Map<string, number>, y: number, m: number) {
    const col = (h: string) => columns.get(normalise(h))!;
    const monthKey = `${y}-${pad(m)}`;
    for (let r = t.top + 1; r <= t.bottom; r++) {
      const raw = (h: string) => ms.cell(r, col(h));
      const v = (h: string) => text(raw(h));
      const at = (h: string) => `${columnLetter(col(h))}${r}`;

      const peg = v(MONTH_COLUMNS.peg);
      const title = v(MONTH_COLUMNS.title);
      const moment = v(MONTH_COLUMNS.moment);
      const owner = v(MONTH_COLUMNS.owner);
      const inputs = [MONTH_COLUMNS.peg, MONTH_COLUMNS.series, MONTH_COLUMNS.title, MONTH_COLUMNS.details, MONTH_COLUMNS.format,
        MONTH_COLUMNS.owner, MONTH_COLUMNS.status, MONTH_COLUMNS.copy, MONTH_COLUMNS.longForm, MONTH_COLUMNS.reference,
        MONTH_COLUMNS.moment, ...PLATFORMS];
      if (!inputs.some((h) => v(h) !== null || raw(h).url)) continue; // an empty day
      const label = title ?? peg ?? moment;
      const report = (level: IssueLevel, h: string, message: string) => add(level, ms.name, at(h), message, owner, label);

      // Date
      const dateCell = raw(MONTH_COLUMNS.date);
      if (typeof dateCell.value !== 'number') {
        report('error', MONTH_COLUMNS.date, dateCell.value === null
          ? 'This row has content but no date.'
          : `The date "${v(MONTH_COLUMNS.date)}" is typed as text. Type it as a date, e.g. 05/${pad(m)}/${y}.`);
        continue;
      }
      const date = serialToIso(dateCell.value);
      if (date.slice(0, 7) !== monthKey) {
        report('error', MONTH_COLUMNS.date, `${date} is not in ${ms.name}. Move the row to the right month sheet or correct the date.`);
        continue;
      }

      // Framework lookup, as the Excel formulas do
      const found = peg ? pegIndex.get(normalise(peg)) : undefined;
      const expectTask = peg ? (found ? found.commsTask : NOT_IN_FRAMEWORK) : '';
      const expectPillar = peg ? (found ? found.pillar : NOT_IN_FRAMEWORK) : '';
      const checkAuto = (h: string, expectedValue: string | null, what: string) => {
        const cell = raw(h);
        const shown = text(cell);
        const should = expectedValue ? ` The site uses "${expectedValue}"${peg ? `, from the peg "${peg}"` : ''}.` : '';
        if (!cell.formula) {
          report('warning', h, shown
            ? `The grey ${what} cell was typed over with "${shown}", so Excel no longer fills it in.${should} Copy the grey cell from the row above to restore it.`
            : `The grey ${what} cell has lost its formula.${should} Copy the grey cell from the row above to restore it.`);
        } else if (expectedValue !== null && shown !== null && normalise(shown) !== normalise(expectedValue)) {
          report('warning', h, `The grey ${what} cell shows "${shown}" but should show "${expectedValue}". Open the workbook in Excel and save it so it recalculates.`);
        }
      };
      checkAuto(MONTH_COLUMNS.day, null, 'Day');
      checkAuto(MONTH_COLUMNS.task, expectTask, 'Comms task');
      checkAuto(MONTH_COLUMNS.pillar, expectPillar, 'Pillar');

      if (!title && !peg) {
        if (moment) moments.push({ date, text: moment, source: { sheet: ms.name, row: r } });
        const extra = inputs.filter((h) => h !== MONTH_COLUMNS.moment && (v(h) !== null || raw(h).url));
        if (extra.length && date <= today) report('warning', MONTH_COLUMNS.title, `This row has ${extra.join(', ')} but no title or peg, so it is not counted as a post. Add a title and peg, or clear the row.`);
        continue;
      }

      if (peg && !found) {
        report('error', MONTH_COLUMNS.peg, `The peg "${peg}" is not on the Framework sheet, so this post cannot be counted. Pick a peg from the dropdown, or add it to the Framework first.`);
      }

      for (const [h, list, what] of [
        [MONTH_COLUMNS.series, lists.series, 'series'], [MONTH_COLUMNS.format, lists.formats, 'format'],
        [MONTH_COLUMNS.owner, lists.team, 'team member'], [MONTH_COLUMNS.status, lists.statuses, 'status']
      ] as const) {
        const value = v(h);
        if (value && list.length && !inList(list, value)) report('warning', h, `"${value}" is not a ${what} on the Lists sheet. Pick one from the dropdown, or add it to the Lists sheet.`);
      }

      const platforms: PlatformEntry[] = [];
      for (const p of PLATFORMS) {
        const cell = raw(p);
        const value = text(cell);
        const target = cell.url ?? value;
        const url = target && isUrl(target) ? target : null;
        if (url) platforms.push({ platform: p, state: 'published', url });
        else if (target && (cell.url || isLocalPath(target))) report('warning', p, `The ${p} link ${LOCAL_POST}`);
        else if (value && normalise(value) === 'planned') platforms.push({ platform: p, state: 'planned', url: null });
        else if (value && p === 'WhatsApp' && normalise(value) === 'sent') platforms.push({ platform: p, state: 'sent', url: null });
        else if (value) report('warning', p, `"${value}" is not valid in ${p}. Type Planned${p === 'WhatsApp' ? ' or Sent' : ''}, or paste the post link.`);
      }
      const link = (h: string) => {
        const cell = raw(h);
        const target = cell.url ?? text(cell);
        if (!target) return null;
        if (isUrl(target)) return target;
        report('warning', h, isLocalPath(target)
          ? `The ${h} ${LOCAL_FILE}`
          : `"${target}" is not a link. ${h} only takes links (starting with http).`);
        return null;
      };

      const status = v(MONTH_COLUMNS.status);
      const dropped = status !== null && normalise(status) === normalise(DROPPED);
      if (date <= today && !dropped) {
        if (!peg) report('warning', MONTH_COLUMNS.peg, 'This post has no peg, so it is not counted in the BAU mix. Pick a peg.');
        if (!status) report('warning', MONTH_COLUMNS.status, 'This post has no status.');
        if (!owner) report('warning', MONTH_COLUMNS.owner, 'This post has no owner.');
        if (status && normalise(status) === normalise(PUBLISHED) && !platforms.some((p) => p.state !== 'planned')) {
          report('warning', MONTH_COLUMNS.status, 'This post is Published but has no post link. Paste the link in each platform column it went out on.');
        }
      }

      const task = found ? taskIndex.get(normalise(found.commsTask)) : undefined;
      posts.push({
        id: `${ms.name}!${r}`,
        date,
        month: monthKey,
        title,
        details: v(MONTH_COLUMNS.details),
        peg: found?.peg ?? null,
        pillar: found?.pillar ?? null,
        commsTask: found?.commsTask ?? null,
        countsAsBau: task ? task.countsAsBau : null,
        beforeBauStart: bauStart !== null && monthKey < bauStart,
        series: v(MONTH_COLUMNS.series),
        format: v(MONTH_COLUMNS.format),
        owner,
        status,
        platforms,
        copyLink: link(MONTH_COLUMNS.copy),
        longFormLink: link(MONTH_COLUMNS.longForm),
        referenceLink: link(MONTH_COLUMNS.reference),
        moment,
        source: { sheet: ms.name, row: r }
      });
    }
  }

  const workbook: CalendarWorkbook = {
    brand,
    fy,
    templateVersion,
    purpose: startValue(START.purpose),
    bauStart,
    commsTasks,
    framework,
    lists,
    posts,
    moments
  };
  return { workbook, issues };
}
