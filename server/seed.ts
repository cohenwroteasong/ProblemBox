// Two demo accounts with history, so every screen has something to show:
//   org@kontho.app    / demo1234 — an organisation with closed, live and draft Boxes
//   player@kontho.app / demo1234 — a player who has answered and been paid
// Every Box here is marked sample, and every answer except the demo player's is simulated.

import { FIRST_BOX_BONUS } from '../shared/types.ts';
import { hashPassword } from './auth.ts';
import { credit, db, getBoxRow, insertBox, insertResponse, toOrgBox, tx } from './db.ts';
import { evaluate } from './scoring.ts';
import { scoreBox } from './scoring.ts';
import { DEMO_ORG_EMAIL, simResponse } from './sim.ts';
import { getTemplate } from './templates.ts';

export const DEMO_PLAYER_EMAIL = 'player@kontho.app';
export const DEMO_PASSWORD = 'demo1234';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export async function seedDemo() {
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(DEMO_ORG_EMAIL)) return false;
  const now = Date.now();
  const hash = await hashPassword(DEMO_PASSWORD);

  tx(() => {
    const addUser = db.prepare(
      `INSERT INTO users (role, name, email, password_hash, org, phone, division, gender, age_band, consent_contact, demo_feed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    );
    const orgId = Number(addUser.run('org', 'Farhana Kabir', DEMO_ORG_EMAIL, hash, 'Demo Organisation', '', '', '', '', 0, now - 120 * DAY).lastInsertRowid);
    const playerId = Number(
      addUser.run('player', 'Nusrat Jahan', DEMO_PLAYER_EMAIL, hash, '', '01712000421', 'Dhaka', 'Woman', '25–34', 1, now - 60 * DAY).lastInsertRowid,
    );

    const make = (key: string, opts: { title?: string; status: 'live' | 'draft'; releasedAt?: number; closesAt?: number; createdAt: number; brief?: string }) => {
      const t = getTemplate(key)!;
      return insertBox({
        orgId,
        template: key,
        title: opts.title ?? t.title,
        titleBn: t.titleBn,
        topic: t.topic,
        description: t.description,
        brief: opts.brief ?? '',
        pool: t.pool,
        target: t.target,
        minutes: t.minutes,
        durationHours: t.durationHours,
        questions: t.questions,
        themes: t.themes,
        status: opts.status,
        sample: true,
        releasedAt: opts.releasedAt ?? null,
        closesAt: opts.closesAt ?? null,
        createdAt: opts.createdAt,
      });
    };

    const fillSims = (boxId: number, key: string, n: number, from: number, to: number) => {
      const box = toOrgBox(getBoxRow(boxId)!);
      const times = Array.from({ length: n }, () => from + Math.random() * (to - from)).sort((a, b) => a - b);
      for (const at of times) insertResponse(simResponse(box, key, Math.round(at)));
    };

    // The demo player's own answers: which option they chose, their idea, their prediction.
    const answer = (boxId: number, at: number, idea: string, opts: { failCheck?: boolean; predictTop?: boolean } = {}) => {
      const box = toOrgBox(getBoxRow(boxId)!);
      const answers: Record<string, string | number> = {};
      for (const q of box.questions) {
        if (q.role === 'screener') answers[q.id] = 0;
        if (q.role === 'measured') answers[q.id] = q.type === 'number' ? 120 : q.type === 'scale' ? 4 : 0;
        if (q.role === 'idea') answers[q.id] = idea;
        if (q.role === 'check') answers[q.id] = opts.failCheck ? 0 : (q.correct ?? 0);
        if (q.role === 'prediction') answers[q.id] = opts.predictTop ? 0 : 1;
      }
      const duration = box.minutes * 60;
      const e = evaluate(box, answers, duration);
      insertResponse({
        boxId,
        playerId,
        division: 'Dhaka',
        gender: 'Woman',
        ageBand: '25–34',
        answers,
        idea: e.idea,
        prediction: e.prediction,
        themeId: e.themeId,
        passed: e.passed,
        failReason: e.failReason,
        durationSec: duration,
        consent: true,
        simulated: false,
        createdAt: at,
      });
    };

    // Closed Boxes, oldest first. [template, title, days ago it closed, simulated answers, player's idea or null]
    const closed: [string, string | undefined, number, number, { idea: string; failCheck?: boolean; predictTop?: boolean } | null][] = [
      ['data', 'Mobile data packs · August round', 45, 470, { idea: 'My 7-day pack expires before I use half of it', predictTop: true }],
      ['jobs', undefined, 38, 330, { idea: 'Training courses for computer skills are too costly' }],
      ['market', 'Everyday market problems · September round', 31, 610, { idea: 'Prices of rice and oil', failCheck: true }],
      ['gas', undefined, 24, 340, { idea: 'Cylinder price went up again this month', predictTop: true }],
      ['health', undefined, 17, 420, { idea: 'Every test has a separate fees and the doctor asks for many tests' }],
      ['trip', undefined, 3, 520, { idea: 'Traffic jam at Jatrabari wastes two hours every day', predictTop: true }],
    ];
    let first = true;
    for (const [key, title, daysAgo, n, mine] of closed) {
      const t = getTemplate(key)!;
      const closedAt = now - daysAgo * DAY + 6 * HOUR;
      const releasedAt = closedAt - t.durationHours * HOUR;
      const id = make(key, { title, status: 'live', releasedAt, closesAt: closedAt, createdAt: releasedAt - 2 * DAY });
      fillSims(id, key, n, releasedAt, closedAt);
      if (mine) {
        const at = releasedAt + 2 * HOUR;
        answer(id, at, mine.idea, mine);
        if (first) {
          credit(playerId, FIRST_BOX_BONUS, 'first_box', 'First Box bonus · paid instantly', id, at + 60_000);
          first = false;
        }
      }
      scoreBox(id, closedAt);
    }

    // One withdrawal already sent.
    db.prepare(`INSERT INTO withdrawals (player_id, method, amount, status, created_at) VALUES (?, 'bkash', 100, 'sent', ?)`).run(playerId, now - 20 * DAY);
    credit(playerId, -100, 'withdrawal', 'Withdrawal to bKash · sent', null, now - 20 * DAY);

    // Live Boxes, part-way through their quota.
    const market = make('market', { status: 'live', releasedAt: now - 20 * HOUR, closesAt: now + 28 * HOUR, createdAt: now - 3 * DAY });
    fillSims(market, 'market', 380, now - 20 * HOUR, now - 60_000);
    const data = make('data', { status: 'live', releasedAt: now - 9 * HOUR, closesAt: now + 39 * HOUR, createdAt: now - 2 * DAY });
    fillSims(data, 'data', 240, now - 9 * HOUR, now - 60_000);
    // Answered earlier today, so the player has a result to wait for.
    answer(data, now - 2 * HOUR, 'Data packs are too expensive for students like me', { predictTop: true });

    // A draft waiting to be launched.
    make('snacks', {
      status: 'draft',
      createdAt: now - DAY,
      brief: 'A mid-size snack brand wants to know why families in Dhaka and Gazipur switch snack brands, and how much they spend each week.',
    });
  });
  return true;
}
