// YouTube Studio exports (Analytics → Advanced mode → a report → Export → CSV), uploaded as the
// zip YouTube gives. Each zip holds three CSVs:
//
//   Table data.csv  the report's table, with totals for the chosen period (first row: "Total")
//   Chart data.csv  the chart above it, by day, for the chart's metric and rows only (often the top 5)
//   Totals.csv      the channel's figures per day, for the chart's metric
//
// The report is told by the table's first column: Content (one row per video), Content type,
// Geography or Traffic source. The period comes from the daily totals; the channel only from the
// zip's name ("Content 2026-09-01_2026-10-01 Emkay Global Financial Services Ltd..zip", whose end
// day is not included).
//
// Unlike LinkedIn, a video's figures cover only the chosen period, so the Content report is
// exported one calendar month at a time and the months add up.

import { unzipSync } from 'fflate';
import { ExportError, cleanCell, exportDate, exportNumber, num, titleOf } from './common';
import { decodeText, isZip, parseCsv } from './csv';
import { NO_MEASURES, type CleanedExport, type DailyRow, type PostRow, type Value } from './rows';

export type YouTubeFile = 'content' | 'content-type' | 'geography' | 'traffic-source';

const REPORTS: [YouTubeFile, string][] = [
  ['content', 'Content'],
  ['content-type', 'Content type'],
  ['geography', 'Geography'],
  ['traffic-source', 'Traffic source']
];

/** The video ID from any YouTube link: watch?v=, youtu.be/, /shorts/, /live/, /embed/. */
export function youTubeKey(url: string): string | null {
  const m = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i.exec(url);
  return m ? `yt:${m[1]}` : null;
}

/** "Content 2026-09-01_2026-10-01 Emkay Global Financial Services Ltd..zip" → the channel and dates. */
export function zipNameParts(fileName: string): { channel: string | null; from: string | null; toExclusive: string | null } {
  const base = (fileName.split(/[\\/]/).pop() ?? '').replace(/(?:-\d+|\s\(\d+\))?\.zip$/i, '');
  const m = /(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})[ _](.+)$/.exec(base);
  if (!m) return { channel: null, from: null, toExclusive: null };
  return { channel: m[3].replace(/_/g, ' ').replace(/\.+$/, '').trim() || null, from: m[1], toExclusive: m[2] };
}

function csvFile(files: Record<string, Uint8Array>, name: string): string[][] | null {
  const key = Object.keys(files).find((k) => k.split('/').pop()?.toLowerCase() === name.toLowerCase());
  return key ? parseCsv(decodeText(files[key]).text) : null;
}

export function isYouTubeZip(bytes: Uint8Array): boolean {
  if (!isZip(bytes)) return false;
  try {
    const names = Object.keys(unzipSync(bytes, { filter: (f) => /(^|\/)(Table data|Totals)\.csv$/i.test(f.name) }));
    return names.some((n) => /Table data\.csv$/i.test(n)) && names.some((n) => /Totals\.csv$/i.test(n));
  } catch {
    return false;
  }
}

/** The YouTube report in a zip, from its table's first column. */
export function youTubeFileOf(bytes: Uint8Array): YouTubeFile | null {
  if (!isYouTubeZip(bytes)) return null;
  const table = csvFile(unzipSync(bytes), 'Table data.csv');
  const first = table?.[0]?.[0]?.trim().toLowerCase();
  return REPORTS.find(([, h]) => h.toLowerCase() === first)?.[0] ?? null;
}

/** The numeric columns of a row (durations as seconds, percentages as given). */
function numbersOf(headers: string[], row: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  headers.forEach((h, i) => {
    const v = cleanCell(h, row[i]);
    if (typeof v === 'number' || v === null) out[h] = v;
  });
  return out;
}

const columnsOf = (headers: string[], row: string[]): Record<string, Value> =>
  Object.fromEntries(headers.map((h, i) => [h, cleanCell(h, row[i])]));

function readDaily(rows: string[][]): DailyRow[] {
  const [headers, ...body] = rows;
  return body
    .map((r) => ({ date: exportDate(r[0]), values: Object.fromEntries(headers.slice(1).map((h, i) => [h, exportNumber(r[i + 1])])) }))
    .filter((d): d is DailyRow => d.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const VIDEO = {
  id: 'Content', title: 'Video title', published: 'Video publish time', views: 'Views', watch: 'Watch time (hours)',
  impressions: 'Thumbnail impressions', likes: 'Likes', comments: 'Comments added', shares: 'Shares',
  subscribers: 'Subscribers', gained: 'Subscribers gained'
};

function readVideos(headers: string[], body: string[][], skipped: string[]): PostRow[] {
  const posts: PostRow[] = [];
  body.forEach((row, i) => {
    const columns = columnsOf(headers, row);
    const id = String(columns[VIDEO.id] ?? '');
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
      skipped.push(`Table data, row ${i + 3}: "${id}" is not a video ID.`);
      return;
    }
    // Videos with no activity in the period are listed with blank figures: nothing to keep.
    if (headers.slice(4).every((h) => columns[h] === null)) return;
    const published = columns[VIDEO.published];
    posts.push({
      ...NO_MEASURES,
      postId: `yt:${id}`,
      link: `https://www.youtube.com/watch?v=${id}`,
      title: titleOf(columns[VIDEO.title]),
      created: typeof published === 'string' && /^\d{4}-/.test(published) ? published.slice(0, 10) : null,
      sponsored: false,
      campaign: null,
      campaignId: null,
      contentType: null,
      account: null,
      impressions: num(columns, VIDEO.impressions),
      views: num(columns, VIDEO.views),
      reactions: num(columns, VIDEO.likes),
      comments: num(columns, VIDEO.comments),
      shares: num(columns, VIDEO.shares),
      follows: num(columns, VIDEO.gained) ?? num(columns, VIDEO.subscribers),
      watchHours: num(columns, VIDEO.watch),
      columns
    });
  });
  return posts;
}

export function readYouTubeExport(bytes: Uint8Array, fileName = ''): CleanedExport {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ExportError('This zip could not be opened. Upload the zip exactly as YouTube Studio downloaded it.');
  }
  const table = csvFile(files, 'Table data.csv');
  const totals = csvFile(files, 'Totals.csv');
  if (!table || !totals) {
    throw new ExportError('This zip is missing "Table data.csv" or "Totals.csv". Upload the zip exactly as YouTube Studio downloaded it, without unzipping it.');
  }
  const [headers, ...rows] = table;
  const file = REPORTS.find(([, h]) => h.toLowerCase() === headers[0]?.trim().toLowerCase())?.[0];
  if (!file) {
    throw new ExportError(`This YouTube export is a "${headers[0]}" report. The site reads the Content, Content type, Geography and Traffic source reports.`);
  }
  if (!headers.includes('Views')) throw new ExportError('This YouTube export has no "Views" column. Export the report with its default columns.');

  const name = zipNameParts(fileName);
  const daily = readDaily(totals);
  const from = daily[0]?.date ?? name.from;
  const to = daily.at(-1)?.date ?? (name.toExclusive ? new Date(Date.parse(name.toExclusive) - 86400000).toISOString().slice(0, 10) : null);
  if (!from || !to) throw new ExportError('This YouTube export has no days in it. Check the date range you picked in YouTube Studio.');

  const totalRow = rows.find((r) => r[0]?.trim() === 'Total');
  const body = rows.filter((r) => r !== totalRow);
  const out: CleanedExport = {
    platform: 'youtube', file, account: name.channel, from, to, postFigures: 'period',
    posts: [], daily, audience: null, benchmark: [], skipped: [], notes: [],
    totals: totalRow ? numbersOf(headers.slice(1), totalRow.slice(1)) : null
  };
  if (file === 'content') {
    out.posts = readVideos(headers, body, out.skipped);
    if (out.totals) for (const h of [VIDEO.title, VIDEO.published, 'Duration']) delete out.totals[h];
    if (!headers.includes(VIDEO.likes)) {
      out.notes.push('This export has no Likes, Comments added or Shares columns, so engagement cannot be compared with other platforms. Add them in Advanced mode before exporting.');
    }
  } else {
    const dimension = headers[0];
    out.audience = {
      of: 'views',
      rows: body.map((r) => {
        const values = numbersOf(headers.slice(1), r.slice(1));
        return { dimension, label: r[0]?.trim() ?? '', value: exportNumber(r[headers.indexOf('Views')]) ?? 0, values };
      }).filter((r) => r.label)
    };
  }
  return out;
}

