// The cleaned rows every analytics export is turned into, whatever the platform. Each upload
// stores its own rows once and never changes; the tables in tables.ts are built by combining them.
//
//   posts      one row per post (and per campaign, for sponsored rows) per export
//   daily      the account's figures per day
//   audience   who follows, visits or watches, broken down by location, seniority, traffic source, ...
//   benchmark  the brand against peer pages over a period
//   totals     the account's totals over the export's period (followers gained, reach, ...)
//
// Each platform's own column names are kept in `columns`; the shared measures below are what
// can be compared across platforms.

export type Platform = 'linkedin' | 'youtube' | 'instagram' | 'x';

/** A cleaned cell: dates as YYYY-MM-DD, numbers as numbers, blanks as null (never 0). */
export type Value = string | number | null;

/** Measures shared across platforms. A platform that does not report one leaves it null. */
export interface Measures {
  /** Times the post (or its thumbnail) was shown. */
  impressions: number | null;
  /** Unique people who saw it. */
  reach: number | null;
  /** Video plays or post views, as the platform counts them. */
  views: number | null;
  clicks: number | null;
  /** Likes, or reactions on LinkedIn. */
  reactions: number | null;
  comments: number | null;
  /** Reposts within the platform (LinkedIn, X). */
  reposts: number | null;
  /** Shares, often outside the platform (Instagram, YouTube, X). */
  shares: number | null;
  /** Saves (Instagram) or bookmarks (X). */
  saves: number | null;
  /** Followers gained from the post. */
  follows: number | null;
  watchHours: number | null;
  /** As the platform calculates it (LinkedIn's and X's include clicks). */
  engagementRate: number | null;
}

export interface PostRow extends Measures {
  /** The post's ID as its links carry it, e.g. "activity:7400000000000000002", "yt:AbCdEfGhIjK". */
  postId: string;
  link: string;
  /** The start of the post's text or title (the full text is in `columns`). */
  title: string;
  /** YYYY-MM-DD, in the platform's time zone (UTC for LinkedIn). Null when the export does not say. */
  created: string | null;
  sponsored: boolean;
  /** The campaign, for sponsored rows: one post can be boosted by several campaigns. */
  campaign: string | null;
  /**
   * Tells a post's sponsored rows apart, as campaigns can share a name: the campaign name, its
   * run dates, and a count for rows that match even on those. Null for organic rows.
   */
  campaignId: string | null;
  /** Reel, carousel, video, ... when the export says. */
  contentType: string | null;
  /** The account that published it, when the export says (collab posts can be another account's). */
  account: string | null;
  /** Every column of the export's row, cleaned, by its header. */
  columns: Record<string, Value>;
}

/** One day's figures, by the export's column names. */
export interface DailyRow {
  date: string;
  values: Record<string, number | null>;
}

export interface AudienceRow {
  /** The breakdown, e.g. "Seniority", "Traffic source". */
  dimension: string;
  label: string;
  /** The breakdown's main figure (followers, views). */
  value: number;
  /** Every figure the export gives for this row, by column name. */
  values?: Record<string, number | null>;
}

export interface Audience {
  /**
   * followers: who follows, on the export day.
   * visitors: who visited the page over the export's period.
   * views: where views came from over the export's period (country, traffic source, content type).
   */
  of: 'followers' | 'visitors' | 'views';
  rows: AudienceRow[];
}

export interface BenchmarkRow {
  page: string;
  /** The brand's own page (the others are its peers). */
  own: boolean;
  totalFollowers: number | null;
  newFollowers: number | null;
  /** LinkedIn: reactions + comments + reposts, sponsored included (no clicks). */
  engagements: number | null;
  posts: number | null;
  columns: Record<string, Value>;
}

/** What one export becomes once cleaned. */
export interface CleanedExport {
  platform: Platform;
  /** Which of the platform's exports it is (see platforms.ts). */
  file: string;
  /** The page, channel or account the export is for, when the file says (e.g. "emkayglobal"). */
  account: string | null;
  /** The first and last day the export covers. `to` is the day its figures are "as of". */
  from: string;
  to: string;
  /**
   * What a post's figures mean. lifetime: totals since it was published, as of `to` (LinkedIn,
   * Instagram, X). period: only what happened between `from` and `to` (YouTube).
   */
  postFigures: 'lifetime' | 'period';
  posts: PostRow[];
  daily: DailyRow[];
  audience: Audience | null;
  benchmark: BenchmarkRow[];
  /** The account's totals over the period, by the export's names (e.g. "Subscribers gained"). */
  totals: Record<string, number | null> | null;
  /** Rows the reader had to leave out, and why (e.g. a post with no recognisable link). */
  skipped: string[];
  /** Things the reader noticed about the file itself (e.g. it was re-saved in Excel). */
  notes: string[];
}

export const NO_MEASURES: Measures = {
  impressions: null, reach: null, views: null, clicks: null, reactions: null, comments: null,
  reposts: null, shares: null, saves: null, follows: null, watchHours: null, engagementRate: null
};
