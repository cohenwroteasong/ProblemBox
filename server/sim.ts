// Sample data in motion: simulated players answer live Boxes, and a demo
// release slot puts a new Box in front of players. Everything it creates is
// marked simulated / sample. It only runs while someone with "Simulate
// activity" switched on has a dashboard open, so nothing grows while idle.

import { AGE_BANDS, DIVISIONS, GENDERS, type Answer, type OrgBox } from '../shared/types.ts';
import { BOX_SELECT, db, getBoxRow, insertBox, insertResponse, toBoxSummary, toOrgBox, type BoxRow, type NewResponse, type ResponseRow } from './db.ts';
import { broadcast, online, sendTo } from './live.ts';
import { dueBoxes, minSeconds, scoreBox } from './scoring.ts';
import { RELEASE_ORDER, getTemplate } from './templates.ts';

export const DEMO_ORG_EMAIL = 'org@kontho.app';
const RELEASE_BRIEF = 'Released by the demo release slot.';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

function weighted(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function lognormal(median: number, sigma: number) {
  const z = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  return median * Math.exp(sigma * z);
}

const DIVISION_W = [26, 18, 12, 10, 8, 8, 10, 8];
const GENDER_W = [47, 51, 2];
const AGE_W = [30, 32, 20, 12, 6];

/** A believable simulated answer to `box` at time `at`. */
export function simResponse(box: OrgBox, templateKey: string, at: number): NewResponse {
  const sim = getTemplate(templateKey)?.sim;
  const answers: Record<string, string | number> = {};

  const r = Math.random();
  const failReason = r < 0.05 ? 'screened_out' : r < 0.08 ? 'too_fast' : r < 0.12 ? 'failed_check' : r < 0.14 ? 'copied' : r < 0.16 ? 'duplicate_device' : null;

  // Theme by the template's weights when the Box still uses its themes, otherwise evenly.
  const ids = [...box.themes.map((t) => t.id), 'other'];
  const weights = ids.map((id) => sim?.weights[id] ?? (id === 'other' ? 1 : 4));
  const themeId = ids[weighted(weights)];
  const theme = box.themes.find((t) => t.id === themeId);
  const idea = sim?.ideas[themeId]?.length ? pick(sim.ideas[themeId]) : theme ? theme.label : 'Something else entirely';

  for (const q of box.questions) {
    if (q.role === 'screener') answers[q.id] = failReason === 'screened_out' ? (q.disqualify?.[0] ?? 0) : 0;
    if (failReason === 'screened_out') continue;
    if (q.role === 'measured') {
      const spec = sim?.measured[q.id];
      if (q.type === 'number') {
        const s = spec && !Array.isArray(spec) ? spec : { median: 100, spread: 0.6 };
        answers[q.id] = Math.max(0, Math.round(lognormal(s.median, s.spread)));
      } else {
        const n = q.type === 'scale' ? 5 : (q.options?.length ?? 1);
        const w = Array.isArray(spec) && spec.length === n ? spec : Array(n).fill(1);
        answers[q.id] = q.type === 'scale' ? weighted(w) + 1 : weighted(w);
      }
    }
    if (q.role === 'idea') answers[q.id] = idea;
    if (q.role === 'check') answers[q.id] = failReason === 'failed_check' ? ((q.correct ?? 0) + 1) % (q.options?.length ?? 3) : (q.correct ?? 0);
    if (q.role === 'prediction') {
      const opts = q.options ?? [];
      const favourite = opts.indexOf(box.themes.slice().sort((a, b) => (sim?.weights[b.id] ?? 0) - (sim?.weights[a.id] ?? 0))[0]?.label ?? '');
      answers[q.id] = Math.random() < 0.55 && favourite >= 0 ? favourite : Math.floor(Math.random() * opts.length);
    }
  }

  const predQ = box.questions.find((q) => q.role === 'prediction');
  const duration = failReason === 'too_fast' ? Math.round(rand(8, minSeconds(box.minutes) - 1)) : Math.round(Math.max(minSeconds(box.minutes) + 5, lognormal(box.minutes * 60 * 0.8, 0.35)));

  return {
    boxId: box.id,
    playerId: null,
    division: DIVISIONS[weighted(DIVISION_W)],
    gender: GENDERS[weighted(GENDER_W)],
    ageBand: AGE_BANDS[weighted(AGE_W)],
    answers,
    idea: failReason === 'screened_out' ? '' : idea,
    prediction: predQ && answers[predQ.id] !== undefined ? (predQ.options?.[Number(answers[predQ.id])] ?? null) : null,
    themeId: failReason === 'screened_out' ? null : themeId,
    passed: failReason === null,
    failReason,
    durationSec: duration,
    consent: Math.random() < 0.3,
    simulated: true,
    createdAt: at,
  };
}

export function toAnswer(r: ResponseRow, box: Pick<OrgBox, 'title' | 'themes'>): Answer {
  return {
    id: r.id,
    boxId: r.box_id,
    boxTitle: box.title,
    division: r.division,
    gender: r.gender,
    ageBand: r.age_band,
    idea: r.idea,
    themeLabel: r.passed ? (box.themes.find((t) => t.id === r.theme_id)?.label ?? (r.theme_id === 'other' ? 'Other ideas' : null)) : null,
    passed: r.passed === 1,
    failReason: (r.fail_reason as Answer['failReason']) ?? null,
    durationSec: r.duration_sec,
    simulated: r.simulated === 1,
    createdAt: r.created_at,
  };
}

/** Tell the Box owner about a new answer (and players about quota progress). */
export function announceAnswer(responseId: number) {
  const r = db.prepare('SELECT * FROM responses WHERE id = ?').get(responseId) as ResponseRow | undefined;
  const row = r && getBoxRow(r.box_id);
  if (!r || !row) return;
  sendTo(row.org_id, 'answer', toAnswer(r, toOrgBox(row)));
}

export function announceBox(boxId: number, type: 'released' | 'updated' | 'closed') {
  const row = getBoxRow(boxId);
  if (!row) return;
  const box = toBoxSummary(row);
  sendTo(row.org_id, 'box', { type, box });
  if (type !== 'updated') broadcast('player', 'box', { type, box });
}

export function closeBox(boxId: number) {
  const paid = scoreBox(boxId);
  const row = getBoxRow(boxId);
  if (!row) return;
  announceBox(boxId, 'closed');
  for (const p of paid) sendTo(p.playerId, 'results', { boxId, title: row.title, total: p.total });
}

// ---------- demo release slot ----------

function demoOrgId(): number | null {
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_ORG_EMAIL) as { id: number } | undefined;
  return row?.id ?? null;
}

export function releaseDemoBox(now = Date.now()): number | null {
  const orgId = demoOrgId();
  if (!orgId) return null;
  const released = (db.prepare('SELECT COUNT(*) AS n FROM boxes WHERE org_id = ? AND brief = ?').get(orgId, RELEASE_BRIEF) as { n: number }).n;
  const tpl = getTemplate(RELEASE_ORDER[released % RELEASE_ORDER.length])!;
  const id = insertBox({
    orgId,
    template: tpl.key,
    title: tpl.title,
    titleBn: tpl.titleBn,
    topic: tpl.topic,
    description: tpl.description,
    brief: RELEASE_BRIEF,
    pool: 3000,
    target: 150,
    minutes: tpl.minutes,
    durationHours: 1,
    questions: tpl.questions,
    themes: tpl.themes,
    status: 'live',
    sample: true,
    releasedAt: now,
    closesAt: now + 5 * 60_000,
    createdAt: now,
  });
  announceBox(id, 'released');
  return id;
}

function openFor(playerId: number): number {
  return (
    db
      .prepare(`SELECT COUNT(*) AS n FROM boxes b WHERE b.status = 'live' AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.box_id = b.id AND r.player_id = ?)`)
      .get(playerId) as { n: number }
  ).n;
}

// ---------- ticker ----------

const nextSim = new Map<number, number>();
const lastReleaseFor = new Map<number, number>();
let releaseAt: number | null = null;
let lastRelease = 0;

export function startSimulator() {
  setInterval(() => {
    const now = Date.now();

    // 1. Close Boxes whose time is up or whose quota is full, then score and pay.
    for (const id of dueBoxes(now)) closeBox(id);

    const watching = online().filter(({ userId }) => (db.prepare('SELECT demo_feed FROM users WHERE id = ?').get(userId) as { demo_feed: number } | undefined)?.demo_feed);
    if (watching.length === 0) return;

    // 2. Simulated players answer live Boxes.
    const live = db.prepare(`${BOX_SELECT} WHERE b.status = 'live'`).all() as unknown as BoxRow[];
    for (const row of live) {
      const due = nextSim.get(row.id);
      if (due === undefined) {
        nextSim.set(row.id, now + rand(1000, 4000));
        continue;
      }
      if (due > now) continue;
      const short = row.sample === 1 && row.duration_hours <= 1;
      nextSim.set(row.id, now + (short ? rand(1500, 3500) : rand(3500, 8000)));
      const id = insertResponse(simResponse(toOrgBox(row), row.template, now));
      announceAnswer(id);
    }

    // 3. Demo release slot: when a player has fewer than three Boxes to answer,
    //    a new one is released to everyone a few seconds later.
    if (releaseAt === null && now - lastRelease > 60_000) {
      const player = watching.find(({ userId, role }) => role === 'player' && now - (lastReleaseFor.get(userId) ?? 0) > 3 * 60_000 && openFor(userId) < 3);
      if (player) {
        releaseAt = now + 8_000;
        for (const w of watching) if (w.role === 'player') lastReleaseFor.set(w.userId, now);
      }
    }
    if (releaseAt !== null && now >= releaseAt) {
      releaseAt = null;
      lastRelease = now;
      releaseDemoBox(now);
    }
  }, 1000).unref();
}
