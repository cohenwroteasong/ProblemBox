// Verification on submit, and scoring when a Box closes, following the reward
// rules: answers in the largest idea group earn 6 points, the second 4, the
// third 3, every other real answer 1; low-effort, copied or failed answers 0.
// The pool is divided by the total points.

import {
  CONSENT_BONUS_RATE,
  OTHER_POINTS,
  PREDICTION_BONUS,
  RANK_POINTS,
  type FailReason,
  type MyResult,
  type OrgBox,
  type Theme,
  type ThemeResult,
} from '../shared/types.ts';
import { credit, db, getBoxRow, money, toOrgBox, tx, type ResponseRow } from './db.ts';
import { classify } from './templates.ts';

export const OTHER_LABEL = 'Other ideas';

/** Anything faster than this can't have been read properly. */
export const minSeconds = (minutes: number) => Math.max(25, Math.round(minutes * 60 * 0.1));

const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export interface Evaluation {
  passed: boolean;
  failReason: FailReason | null;
  themeId: string | null;
  idea: string;
  prediction: string | null;
}

export function evaluate(box: OrgBox, answers: Record<string, string | number>, durationSec: number): Evaluation {
  const q = (role: string) => box.questions.find((x) => x.role === role);
  const screener = q('screener');
  const check = q('check');
  const ideaQ = q('idea');
  const predQ = q('prediction');

  const idea = ideaQ ? String(answers[ideaQ.id] ?? '').trim() : '';
  const predIndex = predQ ? Number(answers[predQ.id]) : NaN;
  const prediction = predQ?.options?.[predIndex] ?? null;
  const themeId = idea ? (classify(idea, box.themes) ?? 'other') : null;
  const result = (failReason: FailReason | null): Evaluation => ({ passed: failReason === null, failReason, themeId, idea, prediction });

  if (screener?.disqualify?.includes(Number(answers[screener.id]))) return result('screened_out');
  if (durationSec < minSeconds(box.minutes)) return result('too_fast');
  if (check && Number(answers[check.id]) !== check.correct) return result('failed_check');
  if (normalise(idea).replace(/\s/g, '').length < 6) return result('low_effort');

  const n = normalise(idea);
  const same = (db.prepare('SELECT idea FROM responses WHERE box_id = ? AND idea != ?').all(box.id, '') as { idea: string }[]).filter(
    (r) => normalise(r.idea) === n,
  ).length;
  if (same >= 2) return result('copied');

  return result(null);
}

/** Current theme ranking from verified answers. */
export function standings(themes: Theme[], verified: { theme_id: string | null }[]): ThemeResult[] {
  const counts = new Map<string, number>();
  for (const r of verified) {
    const id = r.theme_id ?? 'other';
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const total = verified.length || 1;
  const ranked = themes
    .map((t, i) => ({ t, i, count: counts.get(t.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map(({ t, count }, i) => ({
      id: t.id,
      label: t.label,
      rank: i + 1,
      count,
      share: count / total,
      points: count > 0 && i < RANK_POINTS.length ? RANK_POINTS[i] : OTHER_POINTS,
    }));
  const other = counts.get('other') ?? 0;
  if (other > 0) ranked.push({ id: 'other', label: OTHER_LABEL, rank: ranked.length + 1, count: other, share: other / total, points: OTHER_POINTS });
  return ranked;
}

export const topTheme = (s: ThemeResult[]) => s.find((t) => t.id !== 'other' && t.count > 0) ?? null;

/**
 * Close a Box: score every answer and credit real players' wallets.
 * Returns the players to notify and what each earned.
 */
export function scoreBox(boxId: number, at = Date.now()): { playerId: number; total: number }[] {
  const row = getBoxRow(boxId);
  if (!row || row.status !== 'live') return [];
  const box = toOrgBox(row);
  const paid: { playerId: number; total: number }[] = [];

  tx(() => {
    const rows = db.prepare('SELECT * FROM responses WHERE box_id = ?').all(boxId) as unknown as ResponseRow[];
    const st = standings(box.themes, rows.filter((r) => r.passed));
    const points = new Map(st.map((t) => [t.id, t.points]));
    const totalPoints = rows.reduce((s, r) => s + (r.passed ? (points.get(r.theme_id ?? 'other') ?? OTHER_POINTS) : 0), 0);
    const perPoint = totalPoints ? box.pool / totalPoints : 0;
    const top = topTheme(st)?.label ?? null;

    const update = db.prepare('UPDATE responses SET points = ?, pool_share = ?, prediction_bonus = ?, consent_bonus = ? WHERE id = ?');
    for (const r of rows) {
      const pts = r.passed ? (points.get(r.theme_id ?? 'other') ?? OTHER_POINTS) : 0;
      const share = money(pts * perPoint);
      const pred = r.passed && top !== null && r.prediction === top ? PREDICTION_BONUS : 0;
      const consent = r.passed && r.consent ? money(share * CONSENT_BONUS_RATE) : 0;
      update.run(pts, share, pred, consent, r.id);
      const total = money(share + pred + consent);
      if (r.player_id !== null && !r.simulated && total > 0) {
        credit(r.player_id, total, 'box', box.title, box.id, at);
        paid.push({ playerId: r.player_id, total });
      } else if (r.player_id !== null && !r.simulated) {
        paid.push({ playerId: r.player_id, total: 0 });
      }
    }
    db.prepare(`UPDATE boxes SET status = 'closed', closed_at = ? WHERE id = ?`).run(at, boxId);
  });
  return paid;
}

/** Live Boxes whose time is up or whose verified quota is full. */
export function dueBoxes(now = Date.now()): number[] {
  const rows = db
    .prepare(
      `SELECT b.id FROM boxes b
        WHERE b.status = 'live'
          AND (b.closes_at <= ? OR (SELECT COUNT(*) FROM responses r WHERE r.box_id = b.id AND r.passed = 1) >= b.target)`,
    )
    .all(now) as { id: number }[];
  return rows.map((r) => r.id);
}

export function toMyResult(r: ResponseRow, box: OrgBox): MyResult {
  const scored = box.status === 'closed';
  const label = r.theme_id === 'other' ? OTHER_LABEL : (box.themes.find((t) => t.id === r.theme_id)?.label ?? null);
  const rank = scored && r.passed ? RANK_POINTS.indexOf(r.points as (typeof RANK_POINTS)[number]) + 1 || null : null;
  return {
    boxId: box.id,
    title: box.title,
    titleBn: box.titleBn,
    status: scored ? 'scored' : 'pending',
    closesAt: box.closesAt,
    closedAt: box.closedAt,
    submittedAt: r.created_at,
    passed: r.passed === 1,
    failReason: (r.fail_reason as FailReason | null) ?? null,
    idea: r.idea,
    themeLabel: r.passed ? label : null,
    rank: r.theme_id === 'other' ? null : rank,
    points: r.points,
    poolShare: r.pool_share,
    predictionBonus: r.prediction_bonus,
    consentBonus: r.consent_bonus,
    total: money(r.pool_share + r.prediction_bonus + r.consent_bonus),
  };
}
