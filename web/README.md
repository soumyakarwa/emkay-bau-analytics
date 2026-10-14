# Website

The Emkay BAU microsite (SvelteKit, TypeScript). It reads and checks each brand's calendar
workbook, keeps every upload, combines the brands into All of Emkay, and shows them on a calendar.

## Set up (once)

From the repository root:

```bash
cd web
npm install
```

## See the calendar

Publish the workbooks first (below), then:

```bash
npm run dev
```

and open http://localhost:5173. It opens on All of Emkay for the current month, coloured by
brand; pick a brand to see only its posts, coloured by its own comms tasks. Click a post for its
details, links and any problems to fix. On a phone the month shows as a list of days. The brand
and month are in the address (e.g. `/?brand=wealth&month=2026-10`), so a view can be shared.

The site reads the data folder `web/.data`; set `BAU_DATA_DIR` to read another one.

## Check a workbook

```bash
npm run check-workbook -- "Emkay IM - Content calendar FY27.xlsx"
```

It prints posts per comms task per month (the same numbers as the workbook's Summary sheet) and
every problem, grouped by the person who should fix it. Nothing is stored. Add
`--today 2026-10-13` to check as of another date. It exits with an error code if anything would
block publishing.

## Publish workbooks and see All of Emkay

Until the upload page exists, publishing happens from the terminal into a local data folder
(`web/.data`, which Git ignores because it holds real calendars):

```bash
npm run publish-workbook -- "Emkay IM - Content calendar FY27.xlsx"
npm run publish-workbook -- --for wealth --by "Your name" "Emkay Wealth - Content calendar FY27.xlsx"
npm run show-emkay              # All of Emkay: posts per brand, per month and per platform, and each brand's BAU mix
npm run show-emkay -- --brand im --history
```

- A workbook belongs to a brand through the Brand cell on its Start here sheet, never its file
  name. It must be Emkay Global, Emkay Investment Managers or Emkay Wealth Management.
  `--for` refuses a workbook that belongs to a different brand.
- A workbook with blocking problems is refused. Re-publishing an identical file stores nothing.
- Every accepted upload is kept. Everything shown uses the latest upload for each brand and
  year; `--history` lists them all. Publishing prints the framework changes since the previous
  upload, such as a peg moved to another pillar, which re-files that peg's past posts.
- Brands are never matched with each other: each brand's BAU mix is measured only against its
  own framework. Across brands the site only counts posts.

## How it works

| Folder | What it does |
| --- | --- |
| `src/lib/workbook/xlsx.ts` | Opens the .xlsx file: cell values, formulas, links and tables. |
| `src/lib/workbook/contract.ts` | The sheet, table and column names, matching `tools/template/build_workbook.py`. |
| `src/lib/workbook/read-calendar.ts` | Turns the sheets into posts and problems. |
| `src/lib/workbook/summary.ts` | Posts per comms task per month, against the brand's own targets. |
| `src/lib/brands.ts` | The three brands. |
| `src/lib/dataset/uploads.ts` | Publishing: brand checks, refusing blocking problems, keeping every upload. |
| `src/lib/dataset/changes.ts` | Framework changes between two uploads. |
| `src/lib/dataset/dataset.ts` | All of Emkay: the latest upload of every brand and year, combined. |
| `src/lib/dataset/store.ts`, `src/lib/server/folder-store.ts` | Where uploads are kept: a local folder now, Vercel Blob later. |
| `src/lib/calendar/` | The calendar: month grid, colours, and the post details panel. |
| `src/routes/` | The calendar page. |
| `src/app.css` | Colours and fonts in one place: swap them for Emkay's brand. |

- Pillar and comms task come from the post's peg and the Framework sheet, never from the grey
  cells. The grey cells are only checked, so a typed-over cell is reported.
- **Blocking** problems mean the reader cannot work out the right answer: an unknown peg, a date
  typed as text or in the wrong month, a missing sheet or column.
- **To fix** problems mean the answer is still right but the workbook should be corrected.
- Missing details (owner, status, links) are only reported for posts up to today.

## Tests

```bash
npm test
```

The tests build a sample workbook with the Python template builder and read it back, so they
need the Python tools set up first (see `tools/README.md`). If the template and the reader ever
disagree on a name, these tests fail.
