// Generates the calendar template workbook, pre-filled with dummy data.
// The same file is the site's sample data until a real workbook is published,
// and the template the team downloads from the Data page.
//
//   npm run template
//
// Column layout comes from src/lib/core/contract.ts, so the template always
// matches what the parser expects.

import ExcelJS from 'exceljs';
import { FRAMEWORK_COLUMNS, FRAMEWORK_SHEET, MONTH_COLUMNS, sheetNameForMonth } from '../src/lib/core/contract';

const OUT = new URL('../src/lib/assets/calendar-template.xlsx', import.meta.url);

// The BAU framework as it stands in "Business as usual.xlsx". Edit in Excel afterwards.
const FRAMEWORK: [string, string, string, string][] = [
  ['TL', 'Thought Leadership', 'Fact-led opinions', 'Myths vs Reality'],
  ['TL', 'Thought Leadership', 'Fact-led opinions', 'Emkay IM Research opinions'],
  ['TL', 'Thought Leadership', 'Fact-led opinions', 'Contrarian Views'],
  ['TL', 'Thought Leadership', 'Fact-led opinions', 'Finance in non-finance topics'],
  ['TL', 'Thought Leadership', 'Seasoned Expertise', 'Fund Manager Profile / Legacy'],
  ['TL', 'Thought Leadership', 'Seasoned Expertise', 'Retrospectives: what we did wrong and what we did right'],
  ['ML', 'Market Leadership', 'Product Placement', 'Performance positioning / Events & Webinars'],
  ['ML', 'Market Leadership', 'Product Placement', 'Framework-driven approach - E-Qual'],
  ['ML', 'Market Leadership', 'Product Placement', 'Investment strategies (Including Theme-based) / Interviews'],
  ['BB', 'Brand Building', 'Company', 'Philosophy & purpose'],
  ['BB', 'Brand Building', 'Company', 'Legacy'],
  ['BB', 'Brand Building', 'People & Culture', 'Internal Events'],
  ['BB', 'Brand Building', 'People & Culture', 'Social impact'],
  ['BB', 'Brand Building', 'People & Culture', 'Humanize Through People']
];

type Row = {
  day: number;
  code?: string;
  pillar?: string;
  peg?: string;
  title?: string;
  platforms?: Partial<Record<'LinkedIn' | 'Instagram' | 'YouTube' | 'X.com', string | true>>;
  details?: string;
  moment?: string;
  status?: string;
  format?: string;
  poc?: string;
};

// Dummy content only. Replace by uploading the real workbook.
const MONTHS: Record<string, Row[]> = {
  '2026-10': [
    { day: 2, moment: 'Gandhi Jayanti' },
    { day: 5, code: 'ML', pillar: 'Product Placement', peg: 'Performance positioning / Events & Webinars', title: 'Sample: monthly performance snapshot', platforms: { LinkedIn: 'https://www.linkedin.com/company/example/posts/1', Instagram: true }, details: 'Dummy entry — replace with the real calendar.', status: 'Completed', format: 'Carousel', poc: 'Team member A' },
    { day: 7, code: 'TL', pillar: 'Fact-led opinions', peg: 'Myths vs Reality', title: 'Sample: three investing myths', platforms: { LinkedIn: true, 'X.com': true }, status: 'Completed', format: 'Carousel', poc: 'Team member B' },
    { day: 9, code: 'BB', pillar: 'People & Culture', peg: 'Humanize Through People', title: 'Sample: meet the research desk', platforms: { LinkedIn: true, Instagram: true }, status: 'Completed', format: 'Video', poc: 'Team member A' },
    { day: 13, code: 'ML', pillar: 'Product Placement', peg: 'Framework-driven approach - E-Qual', title: 'Sample: framework explainer, part 1', platforms: { LinkedIn: true, YouTube: true }, status: 'Content In Progress', format: 'Video', poc: 'Team member C' },
    { day: 15, code: 'TL', pillar: 'Fact-led opinions', peg: 'Emkay IM Research opinions', title: 'Sample: monthly data in charts', platforms: { LinkedIn: true, Instagram: true, 'X.com': true }, status: 'Content In Progress', format: 'Carousel', poc: 'Team member B' },
    { day: 10, moment: 'World Mental Health Day' },
    { day: 21, code: 'TL', pillar: 'Seasoned Expertise', peg: 'Fund Manager Profile / Legacy', title: 'Sample: fund manager Q&A', platforms: { LinkedIn: true, YouTube: true }, status: 'Planned', format: 'Video', poc: 'Team member C' },
    { day: 23, code: 'BB', pillar: 'Company', peg: 'Philosophy & purpose', title: 'Sample: why process beats prediction', platforms: { LinkedIn: true, Instagram: true }, status: 'Planned', format: 'Static', poc: 'Team member A' },
    { day: 28, code: 'ML', pillar: 'Product Placement', peg: 'Investment strategies (Including Theme-based) / Interviews', title: 'Sample: theme-based investing explained', platforms: { LinkedIn: true }, status: 'Planned', format: 'Carousel', poc: 'Team member B' },
    { day: 30, code: 'TL', pillar: 'Fact-led opinions', peg: 'Contrarian Views', title: 'Sample: a contrarian take', platforms: { LinkedIn: true, 'X.com': true }, status: 'Planned', format: 'Static' }
  ],
  '2026-11': [
    { day: 3, code: 'ML', pillar: 'Product Placement', peg: 'Framework-driven approach - E-Qual', title: 'Sample: framework explainer, part 2', platforms: { LinkedIn: true, YouTube: true }, status: 'Planned', format: 'Video', poc: 'Team member C' },
    { day: 5, code: 'TL', pillar: 'Fact-led opinions', peg: 'Finance in non-finance topics', title: 'Sample: what sport teaches about risk', platforms: { LinkedIn: true, Instagram: true }, status: 'Planned', format: 'Carousel', poc: 'Team member B' },
    { day: 10, code: 'BB', pillar: 'People & Culture', peg: 'Internal Events', title: 'Sample: offsite highlights', platforms: { Instagram: true }, status: 'Planned', format: 'Reel', poc: 'Team member A' },
    { day: 14, moment: "Children's Day" },
    { day: 17, code: 'ML', pillar: 'Product Placement', peg: 'Performance positioning / Events & Webinars', title: 'Sample: webinar announcement', platforms: { LinkedIn: true, 'X.com': true }, status: 'Planned', format: 'Static', poc: 'Team member C' },
    { day: 19, code: 'TL', pillar: 'Seasoned Expertise', peg: 'Retrospectives: what we did wrong and what we did right', title: 'Sample: lessons from a past call', platforms: { LinkedIn: true }, status: 'Idea', format: 'Carousel' },
    { day: 24, code: 'BB', pillar: 'Company', peg: 'Legacy', title: 'Sample: our story in five dates', platforms: { LinkedIn: true, Instagram: true, YouTube: true }, status: 'Idea', format: 'Video' },
    { day: 26, code: 'TL', pillar: 'Fact-led opinions', peg: 'Emkay IM Research opinions', title: 'Sample: monthly data in charts', platforms: { LinkedIn: true, Instagram: true }, status: 'Idea', format: 'Carousel', poc: 'Team member B' }
  ],
  '2026-12': [
    { day: 2, code: 'ML', pillar: 'Product Placement', peg: 'Investment strategies (Including Theme-based) / Interviews', title: 'Sample: interview clip', platforms: { YouTube: true, LinkedIn: true }, status: 'Idea', format: 'Video' },
    { day: 8, code: 'BB', pillar: 'People & Culture', peg: 'Social impact', title: 'Sample: volunteering day', platforms: { Instagram: true, LinkedIn: true }, status: 'Idea', format: 'Reel' },
    { day: 15, code: 'TL', pillar: 'Fact-led opinions', peg: 'Myths vs Reality', title: 'Sample: year-end myths', platforms: { LinkedIn: true }, status: 'Idea', format: 'Carousel' },
    { day: 25, moment: 'Christmas' },
    { day: 30, code: 'TL', pillar: 'Seasoned Expertise', peg: 'Fund Manager Profile / Legacy', title: 'Sample: the year in review', platforms: { LinkedIn: true, YouTube: true }, status: 'Idea', format: 'Video' }
  ]
};

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14211A' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/** Dropdown suggestions. Not enforced in Excel; the site's validator is the authority. */
function suggest(ws: ExcelJS.Worksheet, column: string, values: string[], lastRow: number) {
  // Excel limits inline lists to 255 characters; skip when longer.
  const list = `"${values.join(',')}"`;
  if (list.length > 255 || values.some((v) => v.includes(','))) return;
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`${column}${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: [list] };
  }
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SM BAU microsite';

  for (const [key, rows] of Object.entries(MONTHS)) {
    const ws = wb.addWorksheet(sheetNameForMonth(key));
    ws.columns = MONTH_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14 }));
    styleHeader(ws);
    const [y, m] = key.split('-').map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const byDay = new Map<number, Row[]>();
    for (const r of rows) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);

    for (let d = 1; d <= days; d++) {
      for (const r of byDay.get(d) ?? [{ day: d }]) {
        const date = new Date(Date.UTC(y, m - 1, d));
        const excelRow = ws.addRow({
          date,
          taskCode: r.code,
          pillar: r.pillar,
          peg: r.peg,
          title: r.title,
          details: r.details,
          moment: r.moment,
          status: r.status,
          format: r.format,
          poc: r.poc
        });
        const n = excelRow.number;
        const dateCol = ws.getColumn('date').letter;
        ws.getCell(`${dateCol}${n}`).numFmt = 'dd mmm yyyy';
        ws.getCell(`${ws.getColumn('day').letter}${n}`).value = {
          formula: `TEXT(${dateCol}${n},"dddd")`,
          result: date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
        };
        for (const [platform, link] of Object.entries(r.platforms ?? {})) {
          const col = ws.getColumn(platform);
          const cell = excelRow.getCell(col.number);
          cell.value = typeof link === 'string' ? { text: 'Post link', hyperlink: link } : 'Planned';
        }
      }
    }
    const last = ws.rowCount + 60; // leave room for new rows
    const letter = (k: string) => ws.getColumn(k).letter;
    suggest(ws, letter('taskCode'), [...new Set(FRAMEWORK.map((f) => f[0]))], last);
    suggest(ws, letter('pillar'), [...new Set(FRAMEWORK.map((f) => f[2]))], last);
    suggest(ws, letter('status'), ['Idea', 'Planned', 'Content In Progress', 'Completed'], last);
    suggest(ws, letter('format'), ['Carousel', 'Static', 'Video', 'Reel', 'Story'], last);
    for (const p of ['LinkedIn', 'Instagram', 'YouTube', 'X.com']) suggest(ws, letter(p), ['Planned'], last);
  }

  const fw = wb.addWorksheet(FRAMEWORK_SHEET);
  fw.columns = FRAMEWORK_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  styleHeader(fw);
  for (const [code, task, pillar, peg] of FRAMEWORK) fw.addRow({ code, task, pillar, peg });

  await wb.xlsx.writeFile(OUT.pathname);
  console.log(`Wrote ${OUT.pathname}`);
}

main();
