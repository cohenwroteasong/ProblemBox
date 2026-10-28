import { CATEGORIES, PRIORITIES, type Analytics, type Category, type Priority } from '../shared/types.ts';
import { db, listBoxes } from './db.ts';

interface Row {
  box_id: number;
  category: Category;
  priority: Priority;
  status: string;
  created_at: number;
  first_response_at: number | null;
  resolved_at: number | null;
}

const DAY = 86_400_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const hours = (ms: number) => ms / 3_600_000;

/**
 * @param range   number of days, ending today (inclusive)
 * @param tzOffset viewer's `Date#getTimezoneOffset()` in minutes, so days and hours bucket in their local time
 * @param boxId   optionally scope everything to one box
 */
export function computeAnalytics(userId: number, range: number, tzOffset: number, boxId: number | null): Analytics {
  const now = Date.now();
  const shift = -tzOffset * 60_000; // UTC ms → viewer-local ms
  const localNow = now + shift;
  const startOfTodayLocal = Math.floor(localNow / DAY) * DAY;
  const from = startOfTodayLocal - (range - 1) * DAY - shift; // back to UTC ms
  const prevFrom = from - range * DAY;

  const rows = db
    .prepare(
      `SELECT p.box_id, p.category, p.priority, p.status, p.created_at, p.first_response_at, p.resolved_at
         FROM problems p JOIN boxes b ON b.id = p.box_id
        WHERE b.user_id = ? AND (? IS NULL OR b.id = ?)`,
    )
    .all(userId, boxId, boxId) as unknown as Row[];

  const inRange = (t: number | null, a: number, b: number) => t !== null && t >= a && t < b;
  const isOpen = (r: Row) => r.status === 'new' || r.status === 'in_progress';

  const periodStats = (a: number, b: number) => {
    const received = rows.filter((r) => inRange(r.created_at, a, b));
    const resolved = rows.filter((r) => r.status === 'resolved' && inRange(r.resolved_at, a, b));
    const responded = rows.filter((r) => inRange(r.first_response_at, a, b));
    return {
      received: received.length,
      resolved: resolved.length,
      clearanceRate: received.length ? resolved.length / received.length : null,
      medianResolveHours: median(resolved.map((r) => hours(r.resolved_at! - r.created_at))),
      medianFirstResponseHours: median(responded.map((r) => hours(r.first_response_at! - r.created_at))),
    };
  };

  const cur = periodStats(from, now + 1);
  const prev = periodStats(prevFrom, from);

  // Daily series in the viewer's local calendar.
  const daily: Analytics['daily'] = [];
  const dayIndex = (t: number) => Math.floor((t - from) / DAY);
  for (let i = 0; i < range; i++) {
    const d = new Date(from + shift + i * DAY);
    daily.push({ date: d.toISOString().slice(0, 10), received: 0, resolved: 0 });
  }
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));

  for (const r of rows) {
    if (r.created_at >= from) {
      const i = dayIndex(r.created_at);
      if (daily[i]) daily[i].received++;
      const local = new Date(r.created_at + shift);
      heatmap[(local.getUTCDay() + 6) % 7][local.getUTCHours()]++;
    }
    if (r.status === 'resolved' && r.resolved_at !== null && r.resolved_at >= from) {
      const i = dayIndex(r.resolved_at);
      if (daily[i]) daily[i].resolved++;
    }
  }

  const period = rows.filter((r) => r.created_at >= from);
  const byCategory = CATEGORIES.map((category) => {
    const items = period.filter((r) => r.category === category);
    return { category, count: items.length, open: items.filter(isOpen).length };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const byBox = listBoxes(userId)
    .filter((b) => boxId === null || b.id === boxId)
    .map((b) => {
      const items = period.filter((r) => r.box_id === b.id);
      return {
        boxId: b.id,
        name: b.name,
        color: b.color,
        count: items.length,
        open: items.filter(isOpen).length,
        resolved: items.filter((r) => r.status === 'resolved').length,
      };
    })
    .sort((a, b) => b.count - a.count);

  const open = rows.filter(isOpen);

  return {
    range,
    from,
    to: now,
    kpis: {
      received: cur.received,
      receivedPrev: prev.received,
      resolved: cur.resolved,
      resolvedPrev: prev.resolved,
      clearanceRate: cur.clearanceRate,
      clearanceRatePrev: prev.clearanceRate,
      medianResolveHours: cur.medianResolveHours,
      medianResolveHoursPrev: prev.medianResolveHours,
      medianFirstResponseHours: cur.medianFirstResponseHours,
      medianFirstResponseHoursPrev: prev.medianFirstResponseHours,
      openNow: open.length,
      newNow: open.filter((r) => r.status === 'new').length,
      urgentOpen: open.filter((r) => r.priority === 'urgent').length,
    },
    daily,
    byCategory,
    byBox,
    heatmap,
    backlogByPriority: PRIORITIES.map((priority) => ({ priority, count: open.filter((r) => r.priority === priority).length })),
  };
}
