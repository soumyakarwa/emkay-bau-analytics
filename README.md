# Emkay BAU analytics

A microsite for Emkay's social-media content: the content calendars of Emkay Global, Emkay Investment
Managers and Emkay Wealth Management, measured against each brand's BAU framework (comms tasks,
pillars and pegs), and later combined with analytics from the social platforms to answer questions
such as which pegs perform best and which pillars are under-exposed.

This is version 2, built one step at a time. The first version is on the `main` branch.

## Steps

1. **Excel structure** (done): a standard workbook per brand per financial year. See [`tools/template/`](tools/template/).
2. Reader and checker for one brand's workbook.
3. Combine the three brands into one dataset.
4. Calendar view with a brand filter.
5. Upload per brand.
6. Storage, built for Vercel Blob.
7. Sign-in.
8. Deploy to Vercel.
9. Analytics from the platforms, matched to posts by their links.

## Layout

| Folder | What it is |
| --- | --- |
| [`tools/`](tools/) | All Python: currently the workbook template builder. One virtual environment for everything in it |
