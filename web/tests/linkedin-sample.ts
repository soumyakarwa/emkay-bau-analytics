// Made-up LinkedIn exports, laid out exactly like LinkedIn's (sheet names, note rows, headers,
// US-style dates as text), for the tests. All written as .xls by xls-writer.ts; the competitor
// export is .xlsx on LinkedIn, but the reader does not depend on which, so .xls stands in for it.

import { writeXls, type XlsValue } from './xls-writer';

export const POST_HEADERS = [
  'Post title', 'Post link', 'Post type', 'Campaign name', 'Posted by', 'Created date', 'Campaign start date',
  'Campaign end date', 'Audience', 'Impressions', 'Views', 'Offsite Views', 'Clicks', 'Click through rate (CTR)',
  'Likes', 'Comments', 'Reposts', 'Follows', 'Engagement rate', 'Content Type'
];

export interface SamplePost {
  /** Two digits: the same IDs as the sample calendar's links (tools/template/make_sample.py). */
  id: number;
  created: string;
  title?: string;
  type?: 'Organic' | 'Sponsored' | 'Total';
  campaign?: string;
  campaignDates?: [string, string];
  impressions: number;
  views?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  reposts?: number;
  contentType?: string;
  /** Use LinkedIn's /posts/… style of link instead of /feed/update/…. */
  postsLink?: boolean;
}

export interface Days {
  from: string;
  to: string;
}

export const postId = (id: number) => `74000000000000000${String(id).padStart(2, '0')}`;
export const feedLink = (id: number) => `https://www.linkedin.com/feed/update/urn:li:activity:${postId(id)}`;
export const us = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

function eachDay(days: Days, row: (date: string, i: number) => XlsValue[]): XlsValue[][] {
  const out: XlsValue[][] = [];
  for (let d = Date.parse(days.from), i = 0; d <= Date.parse(days.to); d += 86400000, i++) {
    out.push(row(us(new Date(d).toISOString().slice(0, 10)), i));
  }
  return out;
}

export function contentExport(posts: SamplePost[], days: Days, impressionsPerDay = 100): Uint8Array {
  const rows: XlsValue[][] = [
    ['Engagement metrics for individual posts. Created date indicates when your post was created. All dates and times are in UTC.'],
    POST_HEADERS
  ];
  for (const p of posts) {
    const clicks = p.clicks ?? 0, likes = p.likes ?? 0, comments = p.comments ?? 0, reposts = p.reposts ?? 0;
    const link = p.postsLink
      ? `https://www.linkedin.com/posts/sample-page_some-words-activity-${postId(p.id)}-AbCd`
      : feedLink(p.id);
    rows.push([
      p.title ?? `Post ${p.id}`, link, p.type ?? 'Organic', p.campaign ?? null, 'Sample Person', us(p.created),
      p.campaignDates ? us(p.campaignDates[0]) : null, p.campaignDates ? us(p.campaignDates[1]) : null, 'All followers',
      p.impressions, p.views ?? null, null, clicks, p.impressions ? clicks / p.impressions : 0, likes, comments, reposts, null,
      p.impressions ? (clicks + likes + comments + reposts) / p.impressions : 0, p.contentType ?? null
    ]);
  }
  const metrics: XlsValue[][] = [
    ['Aggregated engagement metrics for your organic and sponsored'],
    ['Date', 'Impressions (organic)', 'Impressions (sponsored)', 'Clicks (organic)'],
    ...eachDay(days, (date) => [date, impressionsPerDay, 0, 5])
  ];
  return writeXls([{ name: 'Metrics', rows: metrics }, { name: 'All posts', rows }]);
}

export function followersExport(days: Days, opts: { organic?: number; sponsored?: number; senior?: number } = {}): Uint8Array {
  const organic = opts.organic ?? 2, sponsored = opts.sponsored ?? 0;
  return writeXls([
    {
      name: 'New followers',
      rows: [['Date', 'Sponsored followers', 'Organic followers', 'Auto-invited followers', 'Total followers'],
        ...eachDay(days, (date) => [date, sponsored, organic, 0, organic + sponsored])]
    },
    { name: 'Location', rows: [['Location', 'Total followers'], ['Mumbai Metropolitan Region, India', 150], ['Greater Delhi Area, India', 40]] },
    { name: 'Seniority', rows: [['Seniority', 'Total followers'], ['Senior', opts.senior ?? 120], ['Entry', 70]] }
  ]);
}

export function visitorsExport(days: Days, viewsPerDay = 10): Uint8Array {
  return writeXls([
    {
      name: 'Visitor metrics',
      rows: [['Date', 'Total page views (desktop)', 'Total page views (mobile)', 'Total page views (total)'],
        ...eachDay(days, (date) => [date, viewsPerDay / 2, viewsPerDay / 2, viewsPerDay])]
    },
    { name: 'Industry', rows: [['Industry', 'Total views'], ['Financial Services', 300], ['Banking', 120]] }
  ]);
}

export function competitorsExport(days: Days, pages: [string, number, number, number, number][]): Uint8Array {
  return writeXls([{
    name: 'COMPETITORS',
    rows: [[us(days.from), us(days.to)], ['Page', 'Total Followers', 'New Followers', 'Total post engagements', 'Total posts'], ...pages]
  }]);
}

/** LinkedIn's newer Competitors layout (from October 2026): no total followers, reactions and comments instead of engagements. */
export function competitorsExportNew(days: Days, pages: [string, number, number, number, number, number][]): Uint8Array {
  return writeXls([{
    name: 'COMPETITORS',
    rows: [[us(days.from), us(days.to)], ['Page', 'New Followers', 'Posts', 'Comments', 'Comments per day', 'Reactions'], ...pages]
  }]);
}
