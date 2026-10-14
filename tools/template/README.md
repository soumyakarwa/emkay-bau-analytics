# Calendar workbook template

`build_workbook.py` is the single definition of the content-calendar workbook that each brand
(Emkay Global, Emkay Investment Managers, Emkay Wealth Management) fills in. The website's
import reads exactly what this script writes, so change the structure here and nowhere else.

## Generate a workbook

Set up the Python environment first (see [`tools/README.md`](../README.md)). Then, from the
`tools` folder with the environment active:

```bash
# A blank workbook for a brand
python template/build_workbook.py --brand "Emkay Global" --fy 2027 --bau-start 2026-11

# Next year's workbook, keeping last year's framework, targets, team and series
python template/build_workbook.py --from "Emkay IM - Content calendar FY27.xlsx" --fy 2028
```

`--fy` is the financial year by its ending year: `2027` builds FY27 (April 2026 to March 2027).

## What's in a workbook

| Sheet | Purpose |
| --- | --- |
| Start here | Brand, financial year, BAU start month, how to fill it in, colour key |
| Apr … Mar | One sheet per month, one row per day. The peg is picked; comms task and pillar are looked up |
| Summary | Posts per comms task per month, share of BAU posts against target, data checks |
| Comms tasks | Codes, whether each counts as BAU, target share, active or retired |
| Framework | Every peg with its pillar and comms task; pegs are retired, never deleted |
| Lists | Statuses, formats, team members and series that feed the dropdowns |

## Rules the structure relies on

- Posts store only the peg. Moving a peg to another pillar or comms task re-files every past
  post, so restructure at the start of a financial year and retire pegs mid-year instead.
- Comms tasks with "Counts as BAU = No" (Compliance) are counted but kept out of the BAU share.
- Months before the brand's BAU start are left out of the Summary.
- Copy link and Reference only take links. The platform columns take "Planned" or the post link
  (WhatsApp also takes "Sent"). Long-form takes "Planned" or the blog article's link: long-form
  is the article behind a post, not a platform.

Real calendar workbooks contain staff names and internal links. Keep them out of this repository.
