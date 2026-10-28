import type { FailReason, QuestionRole } from '../../shared/types';

/** Taka with Indian digit grouping, as on konthoglobal.com: ৳1,00,000 or ৳34.20. */
export const tk = (n: number) => `৳${n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const tk0 = (n: number) => `৳${Math.round(n).toLocaleString('en-IN')}`;
export const num = (n: number) => n.toLocaleString('en-IN');
export const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const bn = (v: number | string) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, 'minute');
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  const d = Math.round(h / 24);
  if (d < 7) return rtf.format(-d, 'day');
  return dateShort(ts);
}

/** "2h 14m left", "9 min left", "closing now" */
export function timeLeft(ts: number | null, now = Date.now()): string {
  if (ts === null) return '';
  const s = Math.round((ts - now) / 1000);
  if (s <= 30) return 'closing now';
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  return `${Math.round(h / 24)} days left`;
}

export const clock = (ts: number) => new Date(ts).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
export const dateShort = (ts: number) => new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'short' });
export const dateTime = (ts: number) => new Date(ts).toLocaleString('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const FAIL_TEXT: Record<FailReason, string> = {
  screened_out: 'Not in this Box’s audience',
  too_fast: 'Answered too fast to have read the questions',
  failed_check: 'Missed the hidden reading check',
  low_effort: 'The idea answer was too short',
  copied: 'The idea answer matched other answers word for word',
  duplicate_device: 'Same device as another account',
};

/** How each question role is labelled for players. */
export const ROLE_LABEL: Record<QuestionRole, string> = {
  screener: 'A quick question first',
  measured: 'About you · not scored',
  idea: 'Your idea · decides your pool share',
  check: 'Quick question',
  prediction: 'Prediction · bonus if you’re right',
};

/** How each question role is labelled for organisations. */
export const ROLE_ORG: Record<QuestionRole, string> = {
  screener: 'Screener',
  measured: 'Measured · never scored',
  idea: 'Idea · scored by rank',
  check: 'Hidden check',
  prediction: 'Prediction · bonus',
};
