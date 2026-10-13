# Website

The Emkay BAU microsite (SvelteKit, TypeScript). For now it has no pages: this step adds the
reader that turns a brand's calendar workbook into posts and lists every problem in it.

## Set up (once)

From the repository root:

```bash
cd web
npm install
```

## Check a workbook

```bash
npm run check-workbook -- "Emkay IM - Content calendar FY27.xlsx"
```

It prints posts per comms task per month (the same numbers as the workbook's Summary sheet) and
every problem, grouped by the person who should fix it. Add `--today 2026-10-13` to check as of
another date. It exits with an error code if anything would block publishing.

## How the reader works

`src/lib/workbook/` reads the workbook and checks it:

| File | What it does |
| --- | --- |
| `xlsx.ts` | Opens the .xlsx file: cell values, formulas, links and tables. |
| `contract.ts` | The sheet, table and column names, matching `tools/template/build_workbook.py`. |
| `read-calendar.ts` | Turns the sheets into posts and problems. |
| `summary.ts` | Posts per comms task per month. |

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
