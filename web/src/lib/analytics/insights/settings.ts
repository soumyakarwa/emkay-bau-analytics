// The analytics pages' settings: the choices the team makes, kept in one place so they are easy
// to find and change. Nothing else in the analytics code needs editing to change them.

import type { BrandId } from '../../brands';
import type { Platform } from '../rows';

/** A post's figures count once it is this many days old on the export day. */
export const SETTLE_DAYS = 7;

/** "Typical" is the median interaction rate of the brand's posts in the same format on the same platform over this many months. */
export const TYPICAL_MONTHS = 6;

/** Fewer posts than this in a format on a platform: compare with the platform's posts of any format instead. */
export const TYPICAL_MIN_POSTS = 3;

/** Verdict thresholds on the × result. */
export const RESULT = { giveMoreRoom: 1.3, rethink: 0.8, minPosts: 4, minPostsForBest: 2 };

/** A part of the framework with no posts for this many months is dormant. */
export const DORMANT_MONTHS = 2;

/**
 * The job each comms task exists to do, and the measure that shows it, matched on the comms
 * task's name. `second` adds a second measure to the same card.
 *   conversation: comments, shares and saves per 1,000 impressions
 *   action:       clicks per 1,000 impressions
 *   reach:        impressions per post
 *   spread:       shares and reposts per 1,000 impressions
 */
export type OutcomeMeasure = 'conversation' | 'action' | 'reach' | 'spread';
export interface Outcome { job: string; measure: OutcomeMeasure; second?: { job: string; measure: OutcomeMeasure } }
export const OUTCOMES: { match: RegExp; outcome: Outcome }[] = [
  { match: /thought leadership/i, outcome: { job: 'start conversations', measure: 'conversation', second: { job: 'get passed on', measure: 'spread' } } },
  { match: /market leadership|investment solutions/i, outcome: { job: 'prompt action', measure: 'action' } },
  { match: /brand (building|awareness)/i, outcome: { job: 'reach people', measure: 'reach' } }
];
export const MEASURE_LABEL: Record<OutcomeMeasure, string> = {
  conversation: 'comments, shares and saves per 1,000 impressions',
  action: 'clicks per 1,000 impressions',
  reach: 'impressions per post',
  spread: 'shares and reposts per 1,000 impressions'
};

/**
 * Follower goals per brand and platform. None are set yet; add one and the Growth page shows a
 * goal line and whether the account is on pace. Example:
 *   im: { linkedin: { target: 5000, by: '2027-03' } }
 */
export const GOALS: Record<BrandId, Partial<Record<Platform, { target: number; by: string }>>> = {
  global: {},
  im: {},
  wealth: {}
};

/**
 * How each target audience is spotted among LinkedIn followers. LinkedIn exports each breakdown
 * (industry, seniority, job function, ...) on its own, never combined, so each rule can use one
 * breakdown only. Drafts, to refine with the content team.
 */
export interface AudienceRule {
  name: string;
  dimension: 'Seniority' | 'Industry' | 'Job function' | 'Company size' | 'Location';
  labels: RegExp;
  rule: string;
  reliability: 'Fairly sure' | 'Rough' | 'Weak';
}
export const AUDIENCES: Record<BrandId, AudienceRule[]> = {
  im: [
    { name: 'Distributors (IFAs, banks, national distributors)', dimension: 'Job function', labels: /^(sales|business development)$/i, rule: 'sales or business-development jobs', reliability: 'Rough' },
    { name: 'Individual investors (HNIs and UHNIs)', dimension: 'Seniority', labels: /^(director|vp|cxo|owner|partner)$/i, rule: 'Director, VP, CXO, owner or partner', reliability: 'Weak' },
    { name: 'Future talent', dimension: 'Seniority', labels: /^(training|entry|unpaid)$/i, rule: 'training or entry level', reliability: 'Fairly sure' }
  ],
  global: [
    { name: 'Future talent', dimension: 'Seniority', labels: /^(training|entry|unpaid)$/i, rule: 'training or entry level', reliability: 'Fairly sure' },
    { name: 'Individual investors', dimension: 'Seniority', labels: /^(director|vp|cxo|owner|partner)$/i, rule: 'Director, VP, CXO, owner or partner', reliability: 'Weak' },
    { name: 'Distributors and wealth managers', dimension: 'Job function', labels: /^(sales|business development)$/i, rule: 'sales or business-development jobs', reliability: 'Rough' },
    { name: 'Institutions (FPI / FII)', dimension: 'Location', labels: /^(?!.*india).*$/i, rule: 'located outside India', reliability: 'Weak' },
    { name: 'Corporates', dimension: 'Company size', labels: /^(1001-5000|5001-10000|10001\+)$/, rule: 'at companies of 1,000+ people', reliability: 'Rough' }
  ],
  wealth: [
    { name: 'Individual investors', dimension: 'Seniority', labels: /^(director|vp|cxo|owner|partner)$/i, rule: 'Director, VP, CXO, owner or partner', reliability: 'Weak' },
    { name: 'Corporate treasuries', dimension: 'Job function', labels: /^(finance|accounting)$/i, rule: 'finance or accounting jobs', reliability: 'Rough' },
    { name: 'Corporates', dimension: 'Company size', labels: /^(1001-5000|5001-10000|10001\+)$/, rule: 'at companies of 1,000+ people', reliability: 'Rough' },
    { name: 'CXOs', dimension: 'Seniority', labels: /^(cxo|vp)$/i, rule: 'CXO or VP', reliability: 'Fairly sure' }
  ]
};

/** LinkedIn industries counted as financial services. */
export const FINANCIAL_SERVICES = /^(financial services|banking|investment banking|investment management|investment advice|capital markets|securities and commodity exchanges|credit intermediation|insurance.*|venture capital.*|trusts and estates|funds and trusts|loan brokers|savings institutions)$/i;

/** Seniority groups, in order. */
export const SENIORITY_GROUPS: { name: string; labels: RegExp }[] = [
  { name: 'Future talent', labels: /^(training|entry|unpaid)$/i },
  { name: 'Mid-career', labels: /^(senior|manager)$/i },
  { name: 'Decision makers', labels: /^(director|vp|cxo|owner|partner)$/i }
];
/** LinkedIn's seniority levels, junior to senior. */
export const SENIORITY_ORDER = ['Unpaid', 'Training', 'Entry', 'Senior', 'Manager', 'Director', 'VP', 'CXO', 'Owner', 'Partner'];
