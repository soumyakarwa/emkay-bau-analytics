// The cleaned rows every analytics export is turned into, whatever the platform. Each upload
// stores its own rows once and never changes; the tables in tables.ts are built by combining them.
//
//   posts      one row per post (and per campaign, for sponsored rows) per export
//   daily      the account's figures per day
//   audience   who follows or visits, broken down by location, seniority, industry, ...
//   benchmark  the brand against peer pages over a period

/** A cleaned cell: dates as YYYY-MM-DD, numbers as numbers, blanks as null (never 0). */
export type Value = string | number | null;

export interface PostRow {
  /** The post's ID as its links carry it, e.g. "activity:7400000000000000002". */
  postId: string;
  link: string;
  /** The start of the post's text (the full text is in `columns`). */
  title: string;
  /** YYYY-MM-DD, in the platform's time zone (UTC for LinkedIn). */
  created: string;
  sponsored: boolean;
  /** The campaign, for sponsored rows: one post can be boosted by several campaigns. */
  campaign: string | null;
  /**
   * Tells a post's sponsored rows apart, as campaigns can share a name: the campaign name, its
   * run dates, and a count for rows that match even on those. Null for organic rows.
   */
  campaignId: string | null;
  contentType: string | null;
  impressions: number;
  views: number | null;
  clicks: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  follows: number | null;
  /** As the platform calculates it (LinkedIn's includes clicks). */
  engagementRate: number | null;
  /** Every column of the export's row, cleaned, by its header. */
  columns: Record<string, Value>;
}

/** One day's figures, by the export's column names. */
export interface DailyRow {
  date: string;
  values: Record<string, number | null>;
}

export interface AudienceRow {
  /** The breakdown, e.g. "Seniority". */
  dimension: string;
  label: string;
  value: number;
}

export interface Audience {
  /**
   * followers: who follows the page on the export day.
   * visitors: who visited the page over the whole period the export covers.
   */
  of: 'followers' | 'visitors';
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

export type LinkedInFile = 'content' | 'followers' | 'visitors' | 'competitors';

export const LINKEDIN_FILES: { id: LinkedInFile; label: string; optional: boolean; help: string }[] = [
  { id: 'content', label: 'Content', optional: false, help: 'Analytics → Content → Export' },
  { id: 'followers', label: 'Followers', optional: false, help: 'Analytics → Followers → Export' },
  { id: 'visitors', label: 'Visitors', optional: false, help: 'Analytics → Visitors → Export' },
  { id: 'competitors', label: 'Competitors', optional: true, help: 'Analytics → Competitors → Export (only once competitors are set up)' }
];

/** What one export becomes once cleaned. */
export interface CleanedExport {
  platform: 'linkedin';
  file: LinkedInFile;
  /** The page's name from LinkedIn's file name (e.g. "emkayglobal"), when recognisable. */
  page: string | null;
  /** The first and last day the export covers. `to` is the day its figures are "as of". */
  from: string;
  to: string;
  posts: PostRow[];
  daily: DailyRow[];
  audience: Audience | null;
  benchmark: BenchmarkRow[];
  /** Rows the reader had to leave out, and why (e.g. a post with no recognisable link). */
  skipped: string[];
}
