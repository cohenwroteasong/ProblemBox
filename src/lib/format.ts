import type { Priority, Status } from '../../shared/types';

export const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  in_progress: 'In progress',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

/** "just now", "4 min ago", "3 hr ago", "yesterday", then a date. */
export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, 'minute');
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  const d = Math.round(h / 24);
  if (d < 7) return rtf.format(-d, 'day');
  return new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'short', year: new Date(ts).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
}

export function dateTime(ts: number): string {
  return new Date(ts).toLocaleString('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Durations given in hours: "45 min", "6.5 hr", "2.3 days". */
export function duration(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, '') : Math.round(hours)} hr`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1).replace(/\.0$/, '') : Math.round(days)} days`;
}

export function compact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function percent(x: number | null): string {
  if (x === null) return '—';
  return `${Math.round(x * 100)}%`;
}

/** Signed relative change, e.g. +12%. Returns null when there's no baseline. */
export function change(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return (cur - prev) / prev;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Working late';
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

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' });
}
