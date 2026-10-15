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
9. **Analytics** (in progress): the LinkedIn pipeline is done: every export kept and cleaned into four tables (posts with their history, daily, audience, benchmark). Next: design the analytics pages, then Instagram, X, YouTube and the blog. See [`web/`](web/).

## Layout

| Folder | What it is |
| --- | --- |
| [`web/`](web/) | The website (SvelteKit, TypeScript), including the workbook reader |
| [`tools/`](tools/) | All Python: the workbook template builder. One virtual environment for everything in it |
