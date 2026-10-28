import { Hono } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';
import {
  AGE_BANDS,
  BKASH_MIN,
  DIVISIONS,
  FIRST_BOX_BONUS,
  GENDERS,
  RECHARGE_MIN,
  type BoxReport,
  type BoxResults,
  type Distribution,
  type LedgerEntry,
  type MyResult,
  type OrgOverview,
  type OrgQuestion,
  type PlayerBox,
  type PlayerBoxCard,
  type PlayerHome,
  type PlayerStats,
  type Role,
  type Theme,
  type Wallet,
  type Withdrawal,
} from '../shared/types.ts';
import {
  endSession,
  hashPassword,
  rateLimiter,
  requireJson,
  requireRole,
  requireUser,
  sessionUser,
  startSession,
  verifyPassword,
  type AuthEnv,
} from './auth.ts';
import {
  BOX_SELECT,
  balanceOf,
  credit,
  db,
  getBoxRow,
  getUserRow,
  insertBox,
  insertResponse,
  money,
  toBoxSummary,
  toOrgBox,
  toUser,
  tx,
  type BoxRow,
  type ResponseRow,
  type UserRow,
} from './db.ts';
import { connect } from './live.ts';
import { evaluate, standings, toMyResult, topTheme } from './scoring.ts';
import { announceAnswer, announceBox, closeBox, toAnswer } from './sim.ts';
import { TEMPLATES, getTemplate } from './templates.ts';

const fail = (status: 400 | 401 | 403 | 404 | 409 | 410 | 429, message: string): never => {
  throw new HTTPException(status, { message });
};

function text(value: unknown, field: string, { min = 1, max = 200, optional = false } = {}): string {
  if (value === undefined || value === null || value === '') {
    if (optional) return '';
    fail(400, `${field} is required.`);
  }
  if (typeof value !== 'string') return fail(400, `${field} must be text.`);
  const s = value.trim();
  if (s.length < min) fail(400, min === 1 ? `${field} is required.` : `${field} must be at least ${min} characters.`);
  if (s.length > max) fail(400, `${field} must be at most ${max} characters.`);
  return s;
}

function oneOf<T extends string>(value: unknown, list: readonly T[], field: string): T {
  if (typeof value === 'string' && (list as readonly string[]).includes(value)) return value as T;
  return fail(400, `Choose your ${field.toLowerCase()}.`);
}

function int(value: unknown, field: string, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) fail(400, `${field} must be a whole number from ${min.toLocaleString('en-IN')} to ${max.toLocaleString('en-IN')}.`);
  return n;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^01[3-9]\d{8}$/;

async function body(c: Context): Promise<Record<string, unknown>> {
  try {
    const parsed = await c.req.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return fail(400, 'Malformed request body.');
  }
}

// Only believe X-Forwarded-For behind a reverse proxy that sets it; otherwise any
// client could pick a fresh "IP" per request and dodge the rate limits.
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';

function clientIp(c: Context): string {
  const forwarded = TRUST_PROXY ? c.req.header('x-forwarded-for') : undefined;
  if (forwarded) return forwarded.split(',')[0].trim();
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function idParam(c: Context, name = 'id'): number {
  const id = Number(c.req.param(name));
  if (!Number.isInteger(id) || id <= 0) fail(404, 'Not found.');
  return id;
}

// Bangladesh is UTC+6 all year; days and hours are bucketed in local time.
const BD = 6 * 3_600_000;
const dayKey = (t: number) => new Date(t + BD).toISOString().slice(0, 10);

const loginLimiter = rateLimiter(10, 15 * 60_000);
const signupLimiter = rateLimiter(10, 60 * 60_000);

export const api = new Hono<AuthEnv>().basePath('/api');

api.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500);
});

api.use('*', requireJson);

// ---------- auth ----------

api.post('/auth/signup', async (c) => {
  const b = await body(c);
  const role = oneOf<Role>(b.role, ['player', 'org'], 'Account type');
  const name = text(b.name, 'Name', { max: 80 });
  const email = text(b.email, 'Email', { max: 200 }).toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address.');
  const password = typeof b.password === 'string' ? b.password : '';
  if (password.length < 8) fail(400, 'Password must be at least 8 characters.');
  if (password.length > 200) fail(400, 'Password is too long.');

  let org = '';
  let phone = '';
  let division = '';
  let gender = '';
  let ageBand = '';
  if (role === 'org') {
    org = text(b.org, 'Organisation name', { max: 120 });
  } else {
    if (b.adult !== true) fail(400, 'Kontho is for adults 18 and over.');
    if (b.terms !== true) fail(400, 'Please agree to the player terms and reward rules.');
    phone = text(b.phone, 'Mobile number', { max: 20 }).replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (!PHONE_RE.test(phone)) fail(400, 'Enter an 11-digit Bangladeshi mobile number, like 01712345678.');
    division = oneOf(b.division, DIVISIONS, 'Division');
    gender = oneOf(b.gender, GENDERS, 'Gender');
    ageBand = oneOf(b.ageBand, AGE_BANDS, 'Age');
  }

  if (signupLimiter.hit(clientIp(c))) fail(429, 'Too many sign-ups from this network. Try again later.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'An account with this email already exists. Try signing in.');

  const hash = await hashPassword(password);
  const result = db
    .prepare(
      `INSERT INTO users (role, name, email, password_hash, org, phone, division, gender, age_band, consent_contact, demo_feed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(role, name, email, hash, org, phone, division, gender, ageBand, b.consentContact === true ? 1 : 0, Date.now());
  const user = getUserRow(Number(result.lastInsertRowid))!;
  startSession(c, user.id);
  return c.json({ user: toUser(user) }, 201);
});

api.post('/auth/login', async (c) => {
  const b = await body(c);
  const email = text(b.email, 'Email', { max: 200 }).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  if (!password) fail(400, 'Password is required.');

  const key = `${clientIp(c)}|${email}`;
  const wait = loginLimiter.hit(key);
  if (wait) fail(429, `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? 's' : ''}.`);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  // Hash even when the user doesn't exist so response time doesn't reveal which emails are registered.
  const ok = user ? await verifyPassword(password, user.password_hash) : (await hashPassword(password), false);
  if (!user || !ok) fail(401, 'Incorrect email or password.');

  loginLimiter.reset(key);
  startSession(c, user!.id);
  return c.json({ user: toUser(user!) });
});

api.post('/auth/logout', (c) => {
  endSession(c);
  return c.json({ ok: true });
});

api.get('/auth/me', (c) => {
  const user = sessionUser(c);
  if (!user) return c.json({ error: 'Not signed in.' }, 401);
  return c.json({ user: toUser(user) });
});

// Middleware must be registered before the routes it guards.
api.use('/me', requireUser);
api.use('/me/*', requireUser);
api.use('/stream', requireUser);
api.use('/player/*', requireRole('player'));
api.use('/org/*', requireRole('org'));

api.patch('/me', async (c) => {
  const u = c.get('user');
  const b = await body(c);
  const name = b.name === undefined ? u.name : text(b.name, 'Name', { max: 80 });
  const org = b.org === undefined || u.role !== 'org' ? u.org : text(b.org, 'Organisation name', { max: 120 });
  let phone = u.phone;
  if (b.phone !== undefined && u.role === 'player') {
    phone = text(b.phone, 'Mobile number', { max: 20 }).replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (!PHONE_RE.test(phone)) fail(400, 'Enter an 11-digit Bangladeshi mobile number, like 01712345678.');
  }
  const division = b.division === undefined || u.role !== 'player' ? u.division : oneOf(b.division, DIVISIONS, 'Division');
  const gender = b.gender === undefined || u.role !== 'player' ? u.gender : oneOf(b.gender, GENDERS, 'Gender');
  const ageBand = b.ageBand === undefined || u.role !== 'player' ? u.age_band : oneOf(b.ageBand, AGE_BANDS, 'Age');
  const consent = b.consentContact === undefined ? u.consent_contact : b.consentContact ? 1 : 0;
  const demo = b.demoFeed === undefined ? u.demo_feed : b.demoFeed ? 1 : 0;
  db.prepare('UPDATE users SET name = ?, org = ?, phone = ?, division = ?, gender = ?, age_band = ?, consent_contact = ?, demo_feed = ? WHERE id = ?').run(
    name,
    org,
    phone,
    division,
    gender,
    ageBand,
    consent,
    demo,
    u.id,
  );
  return c.json({ user: toUser(getUserRow(u.id)!) });
});

api.post('/me/password', async (c) => {
  const u = c.get('user');
  if (u.email.endsWith('@kontho.app')) fail(403, 'The shared demo account’s password can’t be changed. Create your own account to try this.');
  const b = await body(c);
  const current = typeof b.current === 'string' ? b.current : '';
  const next = typeof b.next === 'string' ? b.next : '';
  if (!(await verifyPassword(current, u.password_hash))) fail(400, 'Your current password is incorrect.');
  if (next.length < 8) fail(400, 'New password must be at least 8 characters.');
  const hash = await hashPassword(next);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, u.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  startSession(c, u.id);
  return c.json({ ok: true });
});

// ---------- live stream ----------

api.get('/stream', (c) => {
  const user = c.get('user');
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('X-Accel-Buffering', 'no');
  return streamSSE(c, async (stream) => {
    const disconnect = connect(user.id, user.role, (event, data) => {
      void stream.writeSSE({ event, data: JSON.stringify(data) });
    });
    stream.onAbort(disconnect);
    await stream.writeSSE({ event: 'ready', data: '{}', retry: 3000 });
    while (!stream.aborted && !stream.closed) {
      await stream.sleep(20_000);
      await stream.writeSSE({ event: 'ping', data: String(Date.now()) });
    }
    disconnect();
  });
});

// ---------- player ----------

/** What a player may see of a question: never the answer to the hidden check. */
function playerQuestions(questions: OrgQuestion[]) {
  return questions.map(({ correct: _c, ...q }) => q);
}

function myResponse(playerId: number, boxId: number) {
  return db.prepare('SELECT * FROM responses WHERE box_id = ? AND player_id = ?').get(boxId, playerId) as ResponseRow | undefined;
}

function playerCard(row: BoxRow, playerId: number): PlayerBoxCard {
  const r = myResponse(playerId, row.id);
  return { ...toBoxSummary(row), mine: !r ? 'open' : r.fail_reason === 'screened_out' ? 'screened_out' : 'answered' };
}

function streakOf(playerId: number): number {
  const days = new Set((db.prepare('SELECT created_at FROM responses WHERE player_id = ?').all(playerId) as { created_at: number }[]).map((r) => dayKey(r.created_at)));
  let d = Date.now();
  if (!days.has(dayKey(d))) d -= 86_400_000; // today not answered yet doesn't break the streak
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d -= 86_400_000;
  }
  return n;
}

function myResults(playerId: number, limit = 100): MyResult[] {
  const rows = db.prepare('SELECT * FROM responses WHERE player_id = ? ORDER BY created_at DESC LIMIT ?').all(playerId, limit) as unknown as ResponseRow[];
  return rows.map((r) => toMyResult(r, toOrgBox(getBoxRow(r.box_id)!)));
}

api.get('/player/home', (c) => {
  const u = c.get('user');
  const live = db.prepare(`${BOX_SELECT} WHERE b.status = 'live' ORDER BY b.released_at DESC`).all() as unknown as BoxRow[];
  const cards = live.map((row) => playerCard(row, u.id));
  const home: PlayerHome = {
    open: cards.filter((b) => b.mine === 'open'),
    waiting: cards.filter((b) => b.mine === 'answered'),
    recent: myResults(u.id, 12)
      .filter((r) => r.status === 'scored')
      .slice(0, 4),
    balance: balanceOf(u.id),
    streak: streakOf(u.id),
    firstBoxPaid: !!db.prepare(`SELECT 1 FROM ledger WHERE player_id = ? AND kind = 'first_box'`).get(u.id),
  };
  return c.json(home);
});

api.get('/player/boxes/:id', (c) => {
  const u = c.get('user');
  const row = getBoxRow(idParam(c)) ?? fail(404, 'This Box doesn’t exist.');
  if (row.status === 'draft') fail(404, 'This Box doesn’t exist.');
  if (row.status === 'closed') fail(410, 'This Box has closed. See how it went in Results.');
  const box = toOrgBox(row);
  const out: PlayerBox = { ...toBoxSummary(row), questions: playerQuestions(box.questions), mine: playerCard(row, u.id).mine };
  return c.json(out);
});

api.post('/player/boxes/:id/responses', async (c) => {
  const u = c.get('user');
  const row = getBoxRow(idParam(c)) ?? fail(404, 'This Box doesn’t exist.');
  if (row.status !== 'live') fail(410, 'This Box has closed, so new answers can’t be added.');
  if (myResponse(u.id, row.id)) fail(409, 'You’ve already answered this Box.');
  const b = await body(c);
  const box = toOrgBox(row);

  const raw = (b.answers && typeof b.answers === 'object' ? b.answers : {}) as Record<string, unknown>;
  const answers: Record<string, string | number> = {};
  for (const q of box.questions) {
    const v = raw[q.id];
    if (v === undefined || v === null || v === '') continue;
    answers[q.id] = q.type === 'open' ? String(v).slice(0, 2000) : Number(v);
  }
  const durationSec = Math.max(0, Math.min(Number(b.durationSec) || 0, 6 * 3600));
  const e = evaluate(box, answers, durationSec);
  const now = Date.now();

  let firstBonus: number | null = null;
  const id = tx(() => {
    const id = insertResponse({
      boxId: box.id,
      playerId: u.id,
      division: u.division,
      gender: u.gender,
      ageBand: u.age_band,
      answers,
      idea: e.idea,
      prediction: e.prediction,
      themeId: e.themeId,
      passed: e.passed,
      failReason: e.failReason,
      durationSec,
      consent: u.consent_contact === 1,
      simulated: false,
      createdAt: now,
    });
    // The first Box pays instantly, so a new player knows Kontho is real.
    const paidBefore = db.prepare(`SELECT 1 FROM ledger WHERE player_id = ? AND kind = 'first_box'`).get(u.id);
    if (!paidBefore && e.failReason !== 'screened_out') {
      credit(u.id, FIRST_BOX_BONUS, 'first_box', 'First Box bonus · paid instantly', box.id, now);
      firstBonus = FIRST_BOX_BONUS;
    }
    return id;
  });
  announceAnswer(id);
  announceBox(box.id, 'updated');
  // The hidden quality check isn't revealed here; the outcome shows with the results.
  return c.json({ screenedOut: e.failReason === 'screened_out', firstBonus, closesAt: box.closesAt, balance: balanceOf(u.id) }, 201);
});

api.get('/player/results', (c) => c.json({ results: myResults(c.get('user').id) }));

api.get('/player/results/:boxId', (c) => {
  const u = c.get('user');
  const row = getBoxRow(idParam(c, 'boxId'));
  if (!row || row.status === 'draft') return fail(404, 'Not found.');
  const box = toOrgBox(row);
  const r = myResponse(u.id, box.id);
  const closed = box.status === 'closed';
  const verifiedRows = db.prepare('SELECT theme_id, points FROM responses WHERE box_id = ? AND passed = 1').all(box.id) as { theme_id: string | null; points: number }[];
  // The crowd's ranking is shown only after the Box closes, so it can't steer answers.
  const st = closed ? standings(box.themes, verifiedRows) : [];
  const totalPoints = verifiedRows.reduce((s, x) => s + x.points, 0);
  const out: BoxResults = {
    box: toBoxSummary(row),
    themes: st,
    perPoint: closed && totalPoints ? money(box.pool / totalPoints) : null,
    verified: verifiedRows.length,
    topPrediction: closed ? (topTheme(st)?.label ?? null) : null,
    mine: r ? toMyResult(r, box) : null,
  };
  return c.json(out);
});

function walletOf(playerId: number): Wallet {
  const entries = (db.prepare('SELECT * FROM ledger WHERE player_id = ? ORDER BY created_at DESC, id DESC').all(playerId) as Record<string, unknown>[]).map(
    (e): LedgerEntry => ({ id: Number(e.id), amount: Number(e.amount), kind: e.kind as LedgerEntry['kind'], label: String(e.label), boxId: (e.box_id as number | null) ?? null, createdAt: Number(e.created_at) }),
  );
  const withdrawals = (db.prepare('SELECT * FROM withdrawals WHERE player_id = ? ORDER BY created_at DESC').all(playerId) as Record<string, unknown>[]).map(
    (w): Withdrawal => ({ id: Number(w.id), method: w.method as Withdrawal['method'], amount: Number(w.amount), status: w.status as Withdrawal['status'], createdAt: Number(w.created_at) }),
  );
  return {
    balance: balanceOf(playerId),
    totalEarned: money(entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)),
    entries,
    withdrawals,
  };
}

api.get('/player/wallet', (c) => c.json(walletOf(c.get('user').id)));

api.post('/player/withdraw', async (c) => {
  const u = c.get('user');
  const b = await body(c);
  const method = oneOf<'recharge' | 'bkash'>(b.method, ['recharge', 'bkash'], 'Withdrawal method');
  const min = method === 'bkash' ? BKASH_MIN : RECHARGE_MIN;
  tx(() => {
    const balance = balanceOf(u.id);
    if (balance < min) fail(400, `You need at least ৳${min} to withdraw ${method === 'bkash' ? 'to bKash' : 'as mobile recharge'}.`);
    const now = Date.now();
    db.prepare(`INSERT INTO withdrawals (player_id, method, amount, status, created_at) VALUES (?, ?, ?, 'queued', ?)`).run(u.id, method, balance, now);
    credit(u.id, -balance, 'withdrawal', method === 'bkash' ? 'Withdrawal to bKash · in today’s batch' : 'Mobile recharge · in today’s batch', null, now);
  });
  return c.json(walletOf(u.id), 201);
});

api.get('/player/stats', (c) => {
  const u = c.get('user');
  const rows = db.prepare(`SELECT * FROM responses WHERE player_id = ? AND (fail_reason IS NULL OR fail_reason != 'screened_out')`).all(u.id) as unknown as ResponseRow[];
  const credits = db.prepare('SELECT amount, created_at FROM ledger WHERE player_id = ? AND amount > 0').all(u.id) as { amount: number; created_at: number }[];
  // Ten weeks, Saturday to Friday as in Bangladesh.
  const today = new Date(Date.now() + BD);
  const back = (today.getUTCDay() + 1) % 7;
  const thisWeek = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - back) - BD;
  const weekly = Array.from({ length: 10 }, (_, i) => {
    const start = thisWeek - (9 - i) * 7 * 86_400_000;
    const earned = credits.filter((x) => x.created_at >= start && x.created_at < start + 7 * 86_400_000).reduce((s, x) => s + x.amount, 0);
    return { week: dayKey(start), earned: money(earned) };
  });
  const stats: PlayerStats = {
    weekly,
    boxes: rows.length,
    verified: rows.filter((r) => r.passed).length,
    topIdeaHits: rows.filter((r) => r.points === 6).length,
    predictionHits: rows.filter((r) => r.prediction_bonus > 0).length,
    totalEarned: money(credits.reduce((s, x) => s + x.amount, 0)),
    streak: streakOf(u.id),
  };
  return c.json(stats);
});

// ---------- organisation ----------

function ownBox(c: Context<AuthEnv>): BoxRow {
  const row = getBoxRow(idParam(c));
  if (!row || row.org_id !== c.get('user').id) return fail(404, 'Box not found.');
  return row;
}

api.get('/org/templates', (c) => c.json({ templates: TEMPLATES.map(({ key, title, titleBn, topic, description }) => ({ key, title, titleBn, topic, description })) }));

api.get('/org/overview', (c) => {
  const u = c.get('user');
  const rows = db.prepare(`${BOX_SELECT} WHERE b.org_id = ? ORDER BY CASE b.status WHEN 'live' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, COALESCE(b.closed_at, b.released_at, b.created_at) DESC`).all(u.id) as unknown as BoxRow[];
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS received, COALESCE(SUM(r.passed), 0) AS verified,
              COALESCE(SUM(CASE WHEN r.passed = 1 AND r.created_at >= ? THEN 1 ELSE 0 END), 0) AS today,
              COUNT(DISTINCT CASE WHEN r.passed = 1 THEN r.division END) AS divisions
         FROM responses r JOIN boxes b ON b.id = r.box_id WHERE b.org_id = ?`,
    )
    .get(Date.parse(`${dayKey(Date.now())}T00:00:00Z`) - BD, u.id) as { received: number; verified: number; today: number; divisions: number };
  const recent = db
    .prepare(`SELECT r.* FROM responses r JOIN boxes b ON b.id = r.box_id WHERE b.org_id = ? AND r.passed = 1 ORDER BY r.created_at DESC LIMIT 12`)
    .all(u.id) as unknown as ResponseRow[];
  const byId = new Map(rows.map((r) => [r.id, toOrgBox(r)]));
  const out: OrgOverview = {
    kpis: {
      live: rows.filter((r) => r.status === 'live').length,
      verifiedToday: stats.today,
      verifiedTotal: stats.verified,
      received: stats.received,
      players: stats.received,
      divisions: stats.divisions,
    },
    boxes: rows.map((r) => {
      const s = toBoxSummary(r);
      return { ...s, passRate: s.received ? s.verified / s.received : null };
    }),
    recent: recent.map((r) => toAnswer(r, byId.get(r.box_id)!)),
  };
  return c.json(out);
});

function distribution(labels: string[], values: (string | number | null)[]): Distribution[] {
  const total = values.length || 1;
  return labels.map((label) => {
    const count = values.filter((v) => v === label).length;
    return { label, count, share: count / total };
  });
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function report(row: BoxRow): BoxReport {
  const box = toOrgBox(row);
  const rows = db.prepare('SELECT * FROM responses WHERE box_id = ? ORDER BY created_at').all(box.id) as unknown as ResponseRow[];
  const verified = rows.filter((r) => r.passed);
  const parsed = verified.map((r) => JSON.parse(r.answers) as Record<string, string | number>);
  const st = standings(box.themes, verified);
  const points = new Map(st.map((t) => [t.id, t.points]));
  const totalPoints = box.status === 'closed' ? verified.reduce((s, r) => s + r.points, 0) : verified.reduce((s, r) => s + (points.get(r.theme_id ?? 'other') ?? 1), 0);

  const measured = box.questions
    .filter((q) => q.role === 'measured')
    .map((q) => {
      const vals = parsed.map((a) => a[q.id]).filter((v) => v !== undefined);
      if (q.type === 'number') {
        const nums = vals.map(Number).filter(Number.isFinite);
        const m = median(nums);
        const edges = m ? [0, m * 0.5, m * 0.85, m * 1.15, m * 1.6, Infinity] : [0, Infinity];
        const fmt = (n: number) => (q.unit === '৳' ? `৳${Math.round(n).toLocaleString('en-IN')}` : String(Math.round(n)));
        const rows = edges.slice(0, -1).map((lo, i) => {
          const hi = edges[i + 1];
          const count = nums.filter((n) => n >= lo && n < hi).length;
          return { label: hi === Infinity ? `${fmt(lo)}+` : i === 0 ? `Under ${fmt(hi)}` : `${fmt(lo)}–${fmt(hi)}`, count, share: nums.length ? count / nums.length : 0 };
        });
        return { id: q.id, text: q.text, type: q.type, rows, median: m, unit: q.unit };
      }
      const labels = q.type === 'scale' ? ['1', '2', '3', '4', '5'] : (q.options ?? []);
      const keyed = vals.map((v) => (q.type === 'scale' ? String(v) : (q.options?.[Number(v)] ?? null)));
      const dist = distribution(labels, keyed);
      if (q.type === 'scale') {
        dist[0].label = `1 · ${q.low ?? ''}`;
        dist[4].label = `5 · ${q.high ?? ''}`;
      }
      return { id: q.id, text: q.text, type: q.type, rows: dist, median: null, unit: q.unit };
    });

  const predQ = box.questions.find((q) => q.role === 'prediction');
  const predictions = predQ ? distribution(predQ.options ?? [], verified.map((r) => r.prediction)) : [];

  const n = (reasons: string[]) => rows.filter((r) => r.fail_reason && reasons.includes(r.fail_reason)).length;
  const screened = n(['screened_out']);
  const speed = n(['too_fast', 'failed_check']);
  const copies = n(['copied', 'duplicate_device', 'low_effort']);
  const funnel = [
    { label: 'Answers received', count: rows.length, note: '' },
    { label: 'Passed the screener', count: rows.length - screened, note: `${screened} screened out: not in this Box’s audience` },
    { label: 'Passed speed and attention checks', count: rows.length - screened - speed, note: `${speed} removed: ${n(['too_fast'])} too fast, ${n(['failed_check'])} failed the hidden check` },
    {
      label: 'Passed copy, effort and device checks',
      count: rows.length - screened - speed - copies,
      note: `${copies} removed: ${n(['copied'])} copied, ${n(['low_effort'])} low effort, ${n(['duplicate_device'])} duplicate device`,
    },
    { label: 'Verified', count: verified.length, note: 'Counted in the report and paid from the pool' },
  ];

  // Answers per hour (or per day for longer Boxes), in Bangladesh time.
  const start = box.releasedAt ?? box.createdAt;
  const end = Math.min(box.closedAt ?? Date.now(), Date.now());
  const hourly = end - start <= 72 * 3_600_000;
  const step = hourly ? 3_600_000 : 86_400_000;
  const first = Math.floor((start + BD) / step) * step - BD;
  const buckets = Math.max(1, Math.ceil((end - first) / step));
  const timeline = Array.from({ length: buckets }, (_, i) => {
    const t = first + i * step;
    const d = new Date(t + BD);
    const label = hourly ? `${d.getUTCDate()} ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${String(d.getUTCHours()).padStart(2, '0')}:00` : dayKey(t);
    return { label, count: verified.filter((r) => r.created_at >= t && r.created_at < t + step).length };
  });

  const quotes = st
    .filter((t) => t.id !== 'other' && t.count > 0)
    .slice(0, 3)
    .flatMap((t) => {
      const seen = new Set<string>();
      return verified
        .filter((r) => r.theme_id === t.id && !seen.has(r.idea) && seen.add(r.idea))
        .slice(-2)
        .map((r) => ({ themeLabel: t.label, text: r.idea, division: r.division }));
    });

  const players = rows.length;
  return {
    box,
    kpis: {
      received: rows.length,
      verified: verified.length,
      passRate: rows.length ? verified.length / rows.length : null,
      medianMinutes: median(verified.map((r) => r.duration_sec / 60)),
      perPoint: totalPoints ? money(box.pool / totalPoints) : null,
      players,
    },
    themes: st,
    measured,
    predictions,
    funnel,
    quotas: {
      division: distribution([...DIVISIONS], verified.map((r) => r.division)),
      gender: distribution([...GENDERS], verified.map((r) => r.gender)),
      age: distribution([...AGE_BANDS], verified.map((r) => r.age_band)),
    },
    timeline,
    quotes,
    recent: verified
      .slice(-12)
      .reverse()
      .map((r) => toAnswer(r, box)),
  };
}

api.get('/org/boxes/:id', (c) => c.json(report(ownBox(c))));

api.post('/org/boxes', async (c) => {
  const u = c.get('user');
  const b = await body(c);
  const t = getTemplate(String(b.template ?? '')) ?? fail(400, 'Choose a starting Box.');
  const brief = text(b.brief, 'Brief', { max: 2000, optional: true });
  const id = insertBox({
    orgId: u.id,
    template: t.key,
    title: t.title,
    titleBn: t.titleBn,
    topic: t.topic,
    description: t.description,
    brief,
    pool: t.pool,
    target: t.target,
    minutes: t.minutes,
    durationHours: t.durationHours,
    questions: t.questions,
    themes: t.themes,
    status: 'draft',
    sample: false,
    createdAt: Date.now(),
  });
  return c.json({ id }, 201);
});

api.patch('/org/boxes/:id', async (c) => {
  const row = ownBox(c);
  if (row.status !== 'draft') fail(409, 'Only drafts can be edited. Live and closed Boxes are locked so every player answers the same questions.');
  const box = toOrgBox(row);
  const b = await body(c);
  const title = b.title === undefined ? box.title : text(b.title, 'Title', { max: 80 });
  const titleBn = b.titleBn === undefined ? box.titleBn : text(b.titleBn, 'Bangla title', { max: 80, optional: true });
  const description = b.description === undefined ? box.description : text(b.description, 'Description', { max: 240, optional: true });
  const brief = b.brief === undefined ? box.brief : text(b.brief, 'Brief', { max: 2000, optional: true });
  const pool = b.pool === undefined ? box.pool : int(b.pool, 'Reward pool', 500, 10_000_000);
  const target = b.target === undefined ? box.target : int(b.target, 'Verified answers needed', 20, 100_000);
  const minutes = b.minutes === undefined ? box.minutes : int(b.minutes, 'Minutes', 1, 30);
  const durationHours = b.durationHours === undefined ? box.durationHours : int(b.durationHours, 'Open for (hours)', 1, 168);

  let questions = box.questions;
  if (Array.isArray(b.questions)) {
    const edits = new Map((b.questions as { id?: unknown; text?: unknown; options?: unknown }[]).map((q) => [String(q.id), q]));
    questions = box.questions.map((q) => {
      const e = edits.get(q.id);
      if (!e) return q;
      const next: OrgQuestion = { ...q, text: text(e.text, 'Question', { max: 300 }) };
      // Option lists can be reworded but not resized, so screener and check rules stay valid.
      if (Array.isArray(e.options) && q.options && q.role !== 'prediction') {
        if (e.options.length !== q.options.length) fail(400, 'Keep the same number of options when rewording them.');
        next.options = e.options.map((o, i) => text(o, `Option ${i + 1}`, { max: 120 }));
      }
      return next;
    });
  }
  let themes: Theme[] = box.themes;
  if (Array.isArray(b.themes)) {
    themes = (b.themes as { id?: unknown; label?: unknown; keywords?: unknown }[]).map((t, i) => ({
      id: typeof t.id === 'string' && t.id ? t.id.slice(0, 40) : `t${i + 1}`,
      label: text(t.label, 'Theme name', { max: 60 }),
      keywords: (Array.isArray(t.keywords) ? t.keywords : [])
        .map((k) => String(k).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20),
    }));
    if (themes.length < 3) fail(400, 'Give the idea question at least three themes.');
    if (themes.length > 10) fail(400, 'Ten themes at most.');
  }
  // The prediction question always offers the first five themes.
  questions = questions.map((q) => (q.role === 'prediction' ? { ...q, options: themes.slice(0, 5).map((t) => t.label) } : q));

  db.prepare(
    'UPDATE boxes SET title = ?, title_bn = ?, description = ?, brief = ?, pool = ?, target = ?, minutes = ?, duration_hours = ?, questions = ?, themes = ? WHERE id = ?',
  ).run(title, titleBn, description, brief, pool, target, minutes, durationHours, JSON.stringify(questions), JSON.stringify(themes), row.id);
  return c.json(report(getBoxRow(row.id)!));
});

api.post('/org/boxes/:id/launch', (c) => {
  const row = ownBox(c);
  if (row.status !== 'draft') fail(409, 'This Box has already been launched.');
  const now = Date.now();
  db.prepare(`UPDATE boxes SET status = 'live', released_at = ?, closes_at = ? WHERE id = ?`).run(now, now + row.duration_hours * 3_600_000, row.id);
  announceBox(row.id, 'released');
  return c.json(report(getBoxRow(row.id)!));
});

api.post('/org/boxes/:id/close', (c) => {
  const row = ownBox(c);
  if (row.status !== 'live') fail(409, 'Only a live Box can be closed.');
  closeBox(row.id);
  return c.json(report(getBoxRow(row.id)!));
});

api.delete('/org/boxes/:id', (c) => {
  const row = ownBox(c);
  if (row.status !== 'draft') fail(409, 'Only drafts can be deleted. Launched Boxes stay on record.');
  db.prepare('DELETE FROM boxes WHERE id = ?').run(row.id);
  return c.json({ ok: true });
});

api.all('*', (c) => c.json({ error: 'Not found.' }, 404));
