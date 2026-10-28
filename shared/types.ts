// Types and constants shared by the API server and the web client.

export type Role = 'player' | 'org';

export const DIVISIONS = ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh'] as const;
export type Division = (typeof DIVISIONS)[number];
export const GENDERS = ['Woman', 'Man', 'Prefer not to say'] as const;
export const AGE_BANDS = ['18–24', '25–34', '35–44', '45–54', '55+'] as const;

/** Reward rules (konthoglobal.com/reward-rules). */
export const RANK_POINTS = [6, 4, 3] as const;
export const OTHER_POINTS = 1;
export const FIRST_BOX_BONUS = 20;
export const RECHARGE_MIN = 20;
export const BKASH_MIN = 100;
/** Bonus amounts are still with counsel; these are the sample figures from the product demo. */
export const PREDICTION_BONUS = 15;
export const CONSENT_BONUS_RATE = 0.2;

// ---------- Boxes ----------

/**
 * The five question roles in every Box:
 * screener routes people, measured gives clients percentages (never scored),
 * idea is grouped into themes and decides the pool share, check is a hidden
 * quality test, prediction earns the prediction bonus.
 */
export type QuestionRole = 'screener' | 'measured' | 'idea' | 'check' | 'prediction';
export type QuestionType = 'choice' | 'scale' | 'number' | 'open';

export interface Question {
  id: string;
  role: QuestionRole;
  type: QuestionType;
  text: string;
  textBn?: string;
  options?: string[];
  /** Scale end labels. */
  low?: string;
  high?: string;
  hint?: string;
  unit?: string;
  /** Screener options that end the Box (not secret: the player is told politely). */
  disqualify?: number[];
}

/** What only the organisation (and the server) sees about a question. */
export interface OrgQuestion extends Question {
  /** The right option on a check question. Never sent to players. */
  correct?: number;
}

export interface Theme {
  id: string;
  label: string;
  /** Words that put an idea answer in this theme (English and Bangla). */
  keywords: string[];
}

export type BoxStatus = 'draft' | 'live' | 'closed';

export interface BoxSummary {
  id: number;
  title: string;
  titleBn: string;
  topic: string;
  description: string;
  pool: number;
  target: number;
  minutes: number;
  questionCount: number;
  status: BoxStatus;
  releasedAt: number | null;
  closesAt: number | null;
  closedAt: number | null;
  createdAt: number;
  received: number;
  verified: number;
  sample: boolean;
}

export interface PlayerBoxCard extends BoxSummary {
  mine: 'open' | 'answered' | 'screened_out';
}

export interface PlayerBox extends BoxSummary {
  questions: Question[];
  mine: PlayerBoxCard['mine'];
}

export interface OrgBox extends BoxSummary {
  brief: string;
  durationHours: number;
  questions: OrgQuestion[];
  themes: Theme[];
}

export type FailReason = 'screened_out' | 'too_fast' | 'failed_check' | 'low_effort' | 'copied' | 'duplicate_device';

// ---------- results & wallet ----------

export interface ThemeResult {
  id: string;
  label: string;
  rank: number;
  count: number;
  share: number;
  points: number;
}

export interface MyResult {
  boxId: number;
  title: string;
  titleBn: string;
  status: 'pending' | 'scored';
  closesAt: number | null;
  closedAt: number | null;
  submittedAt: number;
  passed: boolean;
  failReason: FailReason | null;
  idea: string;
  themeLabel: string | null;
  rank: number | null;
  points: number;
  poolShare: number;
  predictionBonus: number;
  consentBonus: number;
  total: number;
}

export interface BoxResults {
  box: BoxSummary;
  themes: ThemeResult[];
  perPoint: number | null;
  verified: number;
  topPrediction: string | null;
  mine: MyResult | null;
}

export interface LedgerEntry {
  id: number;
  amount: number;
  kind: 'first_box' | 'box' | 'withdrawal';
  label: string;
  boxId: number | null;
  createdAt: number;
}

export interface Withdrawal {
  id: number;
  method: 'recharge' | 'bkash';
  amount: number;
  status: 'queued' | 'sent';
  createdAt: number;
}

export interface Wallet {
  balance: number;
  totalEarned: number;
  entries: LedgerEntry[];
  withdrawals: Withdrawal[];
}

export interface PlayerHome {
  open: PlayerBoxCard[];
  waiting: PlayerBoxCard[];
  recent: MyResult[];
  balance: number;
  streak: number;
  firstBoxPaid: boolean;
}

export interface PlayerStats {
  weekly: { week: string; earned: number }[];
  boxes: number;
  verified: number;
  topIdeaHits: number;
  predictionHits: number;
  totalEarned: number;
  streak: number;
}

// ---------- organisation analytics ----------

export interface Answer {
  id: number;
  boxId: number;
  boxTitle: string;
  division: string;
  gender: string;
  ageBand: string;
  idea: string;
  themeLabel: string | null;
  passed: boolean;
  failReason: FailReason | null;
  durationSec: number;
  simulated: boolean;
  createdAt: number;
}

export interface OrgOverview {
  kpis: { live: number; verifiedToday: number; verifiedTotal: number; received: number; players: number; divisions: number };
  boxes: (BoxSummary & { passRate: number | null })[];
  recent: Answer[];
}

export interface Distribution {
  label: string;
  count: number;
  share: number;
}

export interface BoxReport {
  box: OrgBox;
  kpis: { received: number; verified: number; passRate: number | null; medianMinutes: number | null; perPoint: number | null; players: number };
  themes: ThemeResult[];
  measured: { id: string; text: string; type: QuestionType; rows: Distribution[]; median: number | null; unit?: string }[];
  predictions: Distribution[];
  funnel: { label: string; count: number; note: string }[];
  quotas: { division: Distribution[]; gender: Distribution[]; age: Distribution[] };
  timeline: { label: string; count: number }[];
  quotes: { themeLabel: string; text: string; division: string }[];
  recent: Answer[];
}

export interface Template {
  key: string;
  title: string;
  titleBn: string;
  topic: string;
  description: string;
}

export interface User {
  id: number;
  role: Role;
  name: string;
  email: string;
  org: string;
  phone: string;
  division: string;
  gender: string;
  ageBand: string;
  consentContact: boolean;
  demoFeed: boolean;
  createdAt: number;
}
