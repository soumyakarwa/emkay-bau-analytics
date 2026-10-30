# Emkay BAU analytics

A microsite for Emkay's social-media content: the content calendars of Emkay Global, Emkay Investment
Managers and Emkay Wealth Management, measured against each brand's BAU framework (comms tasks,
pillars and pegs), and later combined with analytics from the social platforms to answer questions
such as which pegs perform best and which pillars are under-exposed.

This is version 2, built one step at a time. The first version is on the `main` branch.

## Steps

1. **Excel structure** (done): a standard workbook per brand per financial year. See [`tools/template/`](tools/template/).
2. **Reader and checker** (done): reads one brand's workbook and lists its problems. See [`web/`](web/).
3. **All of Emkay** (done): every upload kept, and the latest of each brand combined into one dataset. See [`web/`](web/).
4. **Calendar** (done): all posts on a month calendar, filtered by brand. See [`web/`](web/).
5. **Upload page** (done): each brand checks, previews and publishes its workbook in the browser. See [`web/`](web/).
6. Storage, built for Vercel Blob.
7. **Sign-in** (done): a team password to view, and one upload password per brand. See [`web/`](web/).
8. Deploy to Vercel.
9. **Analytics** (done, first release): every LinkedIn, YouTube, Instagram and X export kept and cleaned into five tables, and five pages built on them: Overview, Framework, Posts, Growth and Audience. Next: the blog. See [`web/`](web/).

## Monthly analytics: what to export

The analytics month is a **cycle from the 25th to the 24th**, named after the month it ends in:
"October" runs from 25 September to 24 October. Every analytics page groups posts and figures by
cycle.

**When:** on or after the 25th, once the cycle has ended, and before the review meeting. Upload
every file at once on the Upload page, under **Analytics**, exactly as the platforms give them
(no opening in Excel, no renaming, no unzipping). The Upload page shows the same list, with the
exact dates of the cycle to export.

| Platform | File | Dates to export | Where to find it |
| --- | --- | --- | --- |
| LinkedIn | Content | Last 365 days | Page admin view → Analytics → Content → Export |
| LinkedIn | Followers | Last 365 days | Analytics → Followers → Export |
| LinkedIn | Visitors | Last 365 days | Analytics → Visitors → Export |
| LinkedIn | Competitors (optional) | Any period | Analytics → Competitors → Export (once competitors are set up) |
| YouTube | Content | **The cycle: 25th to 24th** | Studio → Analytics → Advanced mode → custom date range → Content, with these columns added: Views, **Watch time (hours)**, Likes, Comments added, Shares, Average percentage viewed, Subscribers gained and Subscribers lost → Export → CSV |
| YouTube | Traffic source | **The cycle: 25th to 24th** | Advanced mode → Traffic source → Export → CSV |
| YouTube | Geography, Content type (optional) | **The cycle: 25th to 24th** | Advanced mode → Geography / Content type → Export → CSV |
| Instagram | Posts | Last 365 days | Meta Business Suite → Insights → Content → Export (one row per post) |
| Instagram | Overview summary (optional) | **The cycle: 25th to 24th** | Insights → Overview → custom dates → Export |
| Instagram | Posts summary (optional) | Any period | Insights → Content → Export summary |
| X | Posts | Last 365 days | Analytics → Content → Export |
| X | Account overview | Last 365 days | Analytics → Overview → Export |

**Why some exports need exact dates.** LinkedIn and X give figures day by day, and Instagram
posts give each post's running totals, so the site sorts them into cycles itself. YouTube and the
Instagram overview only give totals for the dates you pick, so those must be exactly one cycle;
other dates are kept but can't be split into cycles.

**Posts still settling.** A post's result counts once it is 7 days old. Posts from the cycle's
last week are newer than that at the review, so they show as "still settling" and appear under
**Settled since last review** on the next month's Overview.

## Layout

| Folder | What it is |
| --- | --- |
| [`web/`](web/) | The website (SvelteKit, TypeScript), including the workbook reader |
| [`tools/`](tools/) | All Python: the workbook template builder. One virtual environment for everything in it |
