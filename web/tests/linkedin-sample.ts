// Made-up LinkedIn exports, laid out exactly like LinkedIn's (sheet names, note rows, headers,
// US-style dates as text), for the tests.

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
  impressions: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  reposts?: number;
  contentType?: string;
  /** Use LinkedIn's /posts/… style of link instead of /feed/update/…. */
  postsLink?: boolean;
}

export const postId = (id: number) => `74000000000000000${String(id).padStart(2, '0')}`;
export const feedLink = (id: number) => `https://www.linkedin.com/feed/update/urn:li:activity:${postId(id)}`;
const us = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

export function contentExport(posts: SamplePost[], days: { from: string; to: string }): Uint8Array {
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
      p.title ?? `Post ${p.id}`, link, p.type ?? 'Organic', null, 'Sample Person', us(p.created), null, null, 'All followers',
      p.impressions, null, null, clicks, p.impressions ? clicks / p.impressions : 0, likes, comments, reposts, null,
      p.impressions ? (clicks + likes + comments + reposts) / p.impressions : 0, p.contentType ?? null
    ]);
  }
  const metrics: XlsValue[][] = [
    ['Aggregated engagement metrics for your organic and sponsored'],
    ['Date', 'Impressions (organic)', 'Impressions (sponsored)', 'Clicks (organic)']
  ];
  for (let d = Date.parse(days.from); d <= Date.parse(days.to); d += 86400000) {
    metrics.push([us(new Date(d).toISOString().slice(0, 10)), 100, 0, 5]);
  }
  return writeXls([{ name: 'Metrics', rows: metrics }, { name: 'All posts', rows }]);
}

export function followersExport(days: { from: string; to: string }, perDay = 2): Uint8Array {
  const rows: XlsValue[][] = [['Date', 'Sponsored followers', 'Organic followers', 'Auto-invited followers', 'Total followers']];
  for (let d = Date.parse(days.from); d <= Date.parse(days.to); d += 86400000) {
    rows.push([us(new Date(d).toISOString().slice(0, 10)), 0, perDay, 0, perDay]);
  }
  return writeXls([
    { name: 'New followers', rows },
    { name: 'Location', rows: [['Location', 'Total followers'], ['Mumbai Metropolitan Region, India', 150], ['Greater Delhi Area, India', 40]] },
    { name: 'Seniority', rows: [['Seniority', 'Total followers'], ['Senior', 120], ['Entry', 70]] }
  ]);
}
