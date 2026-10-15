# Website

The Emkay BAU microsite (SvelteKit, TypeScript). It reads and checks each brand's calendar
workbook, keeps every upload, combines the brands into All of Emkay, and shows them on a calendar.
Analytics exports from LinkedIn, YouTube, Instagram and X are kept and cleaned into tables; LinkedIn's are laid over the BAU framework on the Analytics page.

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
brand; pick a brand to see only its posts, coloured by its own comms tasks. Filter by stage
(published, in progress, planned), by platform, to posts with a long-form article, and to posts
with something to fix; each post shows its platforms' logos, filled
when live and outlined when planned. Click a post for its details, links and any problems to fix. On a phone the month shows as a list of days. The brand
and month are in the address (e.g. `/?brand=wealth&month=2026-10&stage=published&platform=linkedin`), so a view can be shared.

The site reads the data folder `web/.data`; set `BAU_DATA_DIR` to read another one.

## Upload a workbook

Open http://localhost:5173/upload (or click Upload in the header). Pick the brand and fill in
"Uploaded by" once; the page has two sections, **Calendar workbook** and **LinkedIn analytics**.
Under Calendar workbook, choose the .xlsx and click **Check workbook**. The page shows the workbook's BAU
mix, the framework changes since the last upload, and its problems: blocking ones first, then
the rest grouped by person. If nothing is blocking, **Publish** makes it live. A file whose
Brand cell is another brand's is refused, and an identical re-upload publishes nothing. The
upload history below lists every upload; "Live" is the one the calendar shows.

The header has the pages on the left and, on the right, which part of Emkay you are viewing;
the brand stays selected when you move between pages.

## Analytics

### Monthly routine

Once a month, per brand, export from each platform the brand uses and upload everything at once
on the Upload page, under **Analytics**, exactly as the platforms give the files (no opening in
Excel, no renaming, no unzipping). The site recognises each file by its contents.

| Platform | Export | Period |
| --- | --- | --- |
| LinkedIn | Page admin view → Analytics → **Content**, **Followers**, **Visitors** (and **Competitors**, if set up) → Export (.xls / .xlsx) | The last 365 days |
| YouTube | Studio → Analytics → **Advanced mode** → **Content** (with Likes, Comments added, Shares, Average percentage viewed and Subscribers gained/lost added as columns), **Traffic source** (and Geography, Content type) → Export → CSV (.zip each) | **The previous calendar month** |
| Instagram | Meta Business Suite → Insights → **Content** → Export (.csv, one row per post); the overview and posts summaries are optional | The last 365 days |
| X | Analytics → **Content** and **Overview** → Export (.csv) | The last 365 days |

Why YouTube differs: LinkedIn, Instagram and X give each post's lifetime figures, so a newer
export simply updates them. YouTube gives only what happened in the chosen period, so the site
adds up whole calendar months; YouTube keeps full history, so a missed month can be exported later.

Each file is checked on its own; **Publish all ready files** publishes those that passed and
skips the rest, saying why (another brand's account, already uploaded, chosen twice, not an
export the site reads). The section also shows, per platform, which files are in, any gaps, and
what is due this month. A file put in the wrong section is pointed to the right one.

From the terminal (same checks as the Upload page):

```bash
npm run publish-analytics -- --for im emkayinvestmentmanagers_content_1791966587478.xls …
npm run show-analytics -- --brand im                       # every platform's tables
npm run show-analytics -- --brand global --platform youtube
npm run show-analytics -- --brand im --post 7400000000000000002   # one post's figures over time
```

### The pipeline

1. **Keep the original.** Every upload is saved once and never changed: the original file, and
   its cleaned rows as JSON (`analytics/<brand>/<platform>/<file>/<id>.json`).
2. **Clean it**, with one reader per platform (`src/lib/analytics/linkedin.ts`, `youtube.ts`,
   `instagram.ts`, `x.ts`). Every column is kept. Headers are found by name; every date format
   (`10/12/2026` is 12 October, `Wed, Oct 14, 2026`, `Sep 24, 2026`, …) becomes `2026-10-12`, with
   posting times kept where given; numbers become numbers; durations become seconds; IDs stay text
   (a 19-digit X post ID would lose digits as a number); blanks stay blank, never 0. Post IDs come
   from the links. LinkedIn's "Total" rows are dropped; its sponsored rows are kept per campaign.
   A CSV re-saved in Excel is still read, with a note about what it lost.
3. **Combine into five tables** (`src/lib/analytics/tables.ts`), rebuilt from the uploads
   whenever they are needed and never saved:

   | Table | From | How uploads combine |
   | --- | --- | --- |
   | **Posts** | LinkedIn content, YouTube content, Instagram posts, X posts | Every snapshot kept. Lifetime figures: each post's newest snapshot. YouTube: whole months added up. A post's history shows how it grew. |
   | **Daily** | LinkedIn metrics, followers and visitors; YouTube daily totals; X overview | One value per figure per day: the newest export that has it wins; older exports keep the days newer ones no longer reach. |
   | **Audience** | LinkedIn follower and visitor breakdowns; YouTube traffic source, geography, content type | Every snapshot kept, with its day or period. |
   | **Benchmark** | LinkedIn competitors (optional) | One set per period; a re-export of the same period replaces it. |
   | **Totals** | YouTube's period totals (e.g. subscribers gained and lost); Instagram summaries | One set per period. |

   Shared measures (impressions, reach, views, clicks, likes, comments, reposts, shares, saves,
   follows, watch time) sit beside each platform's own columns, so platforms can be compared.
4. **Check every upload.** Refused: not an export the site reads, a missing column, or a file
   for another brand's account (`ACCOUNTS` in `src/lib/analytics/platforms.ts`, or the brand's own
   row in a LinkedIn competitor export). Skipped: an identical re-upload. Warned: an account the
   site does not know yet, a gap, an export older than one already in, a YouTube export that is
   not one calendar month, a file damaged by Excel, rows left out.

Adding a platform means a reader and an entry in `src/lib/analytics/catalog.ts` and
`platforms.ts`; storage, tables and the upload page follow. When a reader changes,
`ANALYTICS_READER_VERSION` goes up and older uploads are cleaned again from their original files.

### The Analytics page (a first version, to be redesigned)

`/analytics?brand=im` shows, month by month, the **median per post** by comms task, pillar, peg
or format for BAU posts (matched to the calendar by the post ID in the LinkedIn column's link);
totals for all BAU posts, posts in the calendar that are not BAU, **Outside BAU**, posts from
before the brand's BAU start, and all posts; **links to fix** in the workbook; each month's
posts; and the page's organic and paid new followers, page views and impressions.

Only organic posts at least 7 days old on the export day are counted. The default measure is the
**interaction rate**: reactions, comments and reposts per impression. LinkedIn's own engagement
rate also counts clicks, and on carousels every page swipe is a click, so it puts carousels at
70-120% against 3-12% for other formats: it compares formats rather than pegs.

## Passwords

While you work on your own computer with no passwords set, sign-in is off and everyone can do
everything. A live site needs all five settings below; without them (or with short or repeated
passwords) every page shows "Site locked", so it can never go live unprotected.

| Setting | What it unlocks |
| --- | --- |
| `SITE_PASSWORD` | Viewing the calendar. Give it to the whole team. |
| `UPLOAD_PASSWORD_GLOBAL` | Viewing, and uploading Emkay Global's workbook. Give it to Global's POCs. |
| `UPLOAD_PASSWORD_IM` | Viewing, and uploading Emkay Investment Managers' workbook. |
| `UPLOAD_PASSWORD_WEALTH` | Viewing, and uploading Emkay Wealth Management's workbook. |
| `AUTH_SECRET` | Nobody types it: a random string (32+ characters) that signs sign-in cookies. Generate one with `openssl rand -base64 48`. |

- Use long passphrases (12+ characters), such as four random words. All five values must differ.
- On your computer, put them in `web/.env` (copy `web/.env.example`). Git ignores `.env`; never
  commit it. On the host, enter them in its environment-variable settings.
- Sign-ins last 30 days. Signing in with a second brand's upload password adds that brand.
- **Changing a password signs out everyone who used it**: do this when someone leaves.
  Changing `AUTH_SECRET` signs out everyone.
- After eight wrong passwords from one address, sign-in pauses for ten minutes.

## Check a workbook

```bash
npm run check-workbook -- "Emkay IM - Content calendar FY27.xlsx"
```

It prints posts per comms task per month (the same numbers as the workbook's Summary sheet) and
every problem, grouped by the person who should fix it. Nothing is stored. Add
`--today 2026-10-13` to check as of another date. It exits with an error code if anything would
block publishing.

## Publish workbooks and see All of Emkay from the terminal

The same publishing can be done from the terminal, into the same local data folder
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
- Each upload also keeps the original .xlsx. When the reader learns something new (its
  `READER_VERSION` goes up), older uploads are read again from their file, so history always
  follows the current rules.
- Brands are never matched with each other: each brand's BAU mix is measured only against its
  own framework. Across brands the site only counts posts.

## How it works

| Folder | What it does |
| --- | --- |
| `src/lib/workbook/xlsx.ts` | Opens the .xlsx file: cell values, formulas, links and tables. |
| `src/lib/workbook/xls.ts` | Opens old binary .xls files (LinkedIn's exports): cell values only. |
| `src/lib/workbook/contract.ts` | The sheet, table and column names, matching `tools/template/build_workbook.py`. |
| `src/lib/workbook/read-calendar.ts` | Turns the sheets into posts and problems. |
| `src/lib/workbook/summary.ts` | Posts per comms task per month, against the brand's own targets. |
| `src/lib/brands.ts` | The three brands. |
| `src/lib/dataset/uploads.ts` | Publishing: brand checks, refusing blocking problems, keeping every upload. |
| `src/lib/dataset/changes.ts` | Framework changes between two uploads. |
| `src/lib/dataset/dataset.ts` | All of Emkay: the latest upload of every brand and year, combined. |
| `src/lib/dataset/store.ts`, `src/lib/server/folder-store.ts` | Where uploads are kept: a local folder now, Vercel Blob later. |
| `src/lib/calendar/` | The calendar: month grid, colours, and the post details panel. |
| `src/lib/analytics/rows.ts` | The cleaned rows every export becomes, and the measures shared across platforms. |
| `src/lib/analytics/catalog.ts`, `platforms.ts` | The platforms: their exports, export rules, accounts per brand, and telling files apart. |
| `src/lib/analytics/linkedin.ts`, `youtube.ts`, `instagram.ts`, `x.ts` | One reader per platform. |
| `src/lib/analytics/csv.ts`, `common.ts` | CSV and text encodings; dates, numbers and durations in every platform's style. |
| `src/lib/analytics/uploads.ts` | Saves each export once (original + cleaned rows), checks it, and tracks coverage. |
| `src/lib/analytics/tables.ts` | Combines every upload into the five tables. |
| `src/lib/analytics/analysis.ts` | Matches posts to the calendar and builds the month-by-month medians. |
| `src/routes/` | The pages: calendar, analytics, upload, sign-in. |
| `src/app.css` | Emkay brand colours and Open Sans, from the Emkay guidebook. |

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
disagree on a name, these tests fail. Analytics exports in the tests are made up
(`tests/linkedin-sample.ts`, `tests/platform-samples.ts`); real exports are never kept in the repository.
