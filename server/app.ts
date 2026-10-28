import { Hono } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';
import {
  BOX_COLORS,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  type Category,
  type Priority,
  type ProblemEvent,
  type PublicBox,
  type Status,
} from '../shared/types.ts';
import { computeAnalytics } from './analytics.ts';
import {
  endSession,
  hashPassword,
  rateLimiter,
  requireJson,
  requireUser,
  sessionUser,
  startSession,
  verifyPassword,
  type AuthEnv,
} from './auth.ts';
import {
  PROBLEM_SELECT,
  db,
  getBox,
  getProblem,
  insertProblem,
  listBoxes,
  slugify,
  toProblem,
  toUser,
  tx,
  type ProblemRow,
  type UserRow,
} from './db.ts';
import { connect, publishProblem } from './live.ts';
import { seedSampleData } from './samples.ts';
import { triage } from './triage.ts';

export const DEMO_EMAIL = 'demo@kontho.app';

const fail = (status: 400 | 401 | 403 | 404 | 409 | 429, message: string): never => {
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
  return fail(400, `${field} is not valid.`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function idParam(c: Context): number {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) fail(404, 'Not found.');
  return id;
}

function loadEvents(problemId: number): ProblemEvent[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.kind, e.data, e.created_at, u.name AS actor
         FROM events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.problem_id = ? ORDER BY e.created_at, e.id`,
    )
    .all(problemId) as { id: number; kind: string; data: string; created_at: number; actor: string | null }[];
  return rows.map((r) => ({ id: r.id, kind: r.kind, at: r.created_at, actor: r.actor, ...JSON.parse(r.data) }) as ProblemEvent);
}

const loginLimiter = rateLimiter(10, 15 * 60_000);
const signupLimiter = rateLimiter(10, 60 * 60_000);
const submitLimiter = rateLimiter(8, 10 * 60_000);

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
  const name = text(b.name, 'Name', { max: 80 });
  const org = text(b.org, 'Organisation', { max: 120, optional: true });
  const email = text(b.email, 'Email', { max: 200 }).toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address.');
  const password = typeof b.password === 'string' ? b.password : '';
  if (password.length < 8) fail(400, 'Password must be at least 8 characters.');
  if (password.length > 200) fail(400, 'Password is too long.');

  const wait = signupLimiter.hit(clientIp(c));
  if (wait) fail(429, 'Too many sign-ups from this network. Try again later.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'An account with this email already exists. Try signing in.');

  const hash = await hashPassword(password);
  const result = db
    .prepare('INSERT INTO users (name, email, org, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, org, hash, Date.now());
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid)) as unknown as UserRow;
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

// Everything below needs a signed-in user. (Middleware must be registered before the routes it guards.)
for (const path of ['/me', '/me/*', '/boxes', '/boxes/*', '/problems', '/problems/*', '/analytics', '/sample-data', '/stream']) {
  api.use(path, requireUser);
}

api.patch('/me', async (c) => {
  const user = c.get('user');
  const b = await body(c);
  const name = b.name === undefined ? user.name : text(b.name, 'Name', { max: 80 });
  const org = b.org === undefined ? user.org : text(b.org, 'Organisation', { max: 120, optional: true });
  const demoFeed = b.demoFeed === undefined ? user.demo_feed : b.demoFeed ? 1 : 0;
  db.prepare('UPDATE users SET name = ?, org = ?, demo_feed = ? WHERE id = ?').run(name, org, demoFeed, user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as unknown as UserRow;
  return c.json({ user: toUser(fresh) });
});

api.post('/me/password', async (c) => {
  const user = c.get('user');
  if (user.email === DEMO_EMAIL) fail(403, 'The shared demo account’s password can’t be changed. Create your own account to try this.');
  const b = await body(c);
  const current = typeof b.current === 'string' ? b.current : '';
  const next = typeof b.next === 'string' ? b.next : '';
  if (!(await verifyPassword(current, user.password_hash))) fail(400, 'Your current password is incorrect.');
  if (next.length < 8) fail(400, 'New password must be at least 8 characters.');
  const hash = await hashPassword(next);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  // Sign out every other device, keep this one.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  startSession(c, user.id);
  return c.json({ ok: true });
});

// ---------- boxes ----------

api.get('/boxes', (c) => c.json({ boxes: listBoxes(c.get('user').id) }));

api.post('/boxes', async (c) => {
  const user = c.get('user');
  const b = await body(c);
  const name = text(b.name, 'Box name', { max: 60 });
  const description = text(b.description, 'Description', { max: 240, optional: true });
  const color = b.color === undefined ? BOX_COLORS[listBoxes(user.id).length % BOX_COLORS.length] : oneOf(b.color, BOX_COLORS, 'Colour');
  const result = db
    .prepare('INSERT INTO boxes (user_id, name, slug, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.id, name, slugify(name), description, color, Date.now());
  return c.json({ box: getBox(Number(result.lastInsertRowid), user.id) }, 201);
});

api.patch('/boxes/:id', async (c) => {
  const user = c.get('user');
  const box = getBox(idParam(c), user.id) ?? fail(404, 'Box not found.');
  const b = await body(c);
  const name = b.name === undefined ? box.name : text(b.name, 'Box name', { max: 60 });
  const description = b.description === undefined ? box.description : text(b.description, 'Description', { max: 240, optional: true });
  const color = b.color === undefined ? box.color : oneOf(b.color, BOX_COLORS, 'Colour');
  const isOpen = b.isOpen === undefined ? box.isOpen : Boolean(b.isOpen);
  db.prepare('UPDATE boxes SET name = ?, description = ?, color = ?, is_open = ? WHERE id = ?').run(name, description, color, isOpen ? 1 : 0, box.id);
  return c.json({ box: getBox(box.id, user.id) });
});

api.delete('/boxes/:id', (c) => {
  const user = c.get('user');
  const box = getBox(idParam(c), user.id) ?? fail(404, 'Box not found.');
  db.prepare('DELETE FROM boxes WHERE id = ?').run(box.id);
  return c.json({ ok: true });
});

// ---------- problems ----------

const PRIORITY_RANK = `CASE p.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`;
const SORTS: Record<string, string> = {
  newest: 'p.created_at DESC',
  oldest: 'p.created_at ASC',
  priority: `${PRIORITY_RANK}, p.created_at ASC`,
  updated: 'p.updated_at DESC',
};

api.get('/problems', (c) => {
  const user = c.get('user');
  const q = c.req.query();
  const where: string[] = ['b.user_id = ?'];
  const params: (string | number)[] = [user.id];

  if (q.box) {
    where.push('p.box_id = ?');
    params.push(Number(q.box));
  }
  if (q.priority) {
    const list = q.priority.split(',').filter((p) => (PRIORITIES as readonly string[]).includes(p));
    if (list.length) {
      where.push(`p.priority IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }
  if (q.category && (CATEGORIES as readonly string[]).includes(q.category)) {
    where.push('p.category = ?');
    params.push(q.category);
  }
  if (q.q) {
    const like = `%${q.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(`(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\' OR p.author LIKE ? ESCAPE '\\')`);
    params.push(like, like, like);
  }

  const countRows = db
    .prepare(`SELECT p.status, COUNT(*) AS n FROM problems p JOIN boxes b ON b.id = p.box_id WHERE ${where.join(' AND ')} GROUP BY p.status`)
    .all(...params) as { status: Status; n: number }[];
  const counts = { all: 0, new: 0, in_progress: 0, resolved: 0, dismissed: 0 };
  for (const r of countRows) {
    counts[r.status] = r.n;
    counts.all += r.n;
  }

  if (q.status === 'open') where.push(`p.status IN ('new', 'in_progress')`);
  else if (q.status && q.status !== 'all') {
    where.push('p.status = ?');
    params.push(oneOf(q.status, STATUSES, 'Status'));
  }

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM problems p JOIN boxes b ON b.id = p.box_id WHERE ${where.join(' AND ')}`).get(...params) as { n: number }).n;
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
  const offset = Math.max(Number(q.offset) || 0, 0);
  const order = SORTS[q.sort ?? 'newest'] ?? SORTS.newest;
  const rows = db.prepare(`${PROBLEM_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order}, p.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

  return c.json({ items: rows.map((r) => toProblem(r as unknown as ProblemRow)), total, counts });
});

api.get('/problems/:id', (c) => {
  const problem = getProblem(idParam(c), c.get('user').id) ?? fail(404, 'Problem not found.');
  return c.json({ problem, events: loadEvents(problem.id) });
});

api.patch('/problems/:id', async (c) => {
  const user = c.get('user');
  const current = getProblem(idParam(c), user.id) ?? fail(404, 'Problem not found.');
  const b = await body(c);
  const now = Date.now();
  const addEvent = db.prepare('INSERT INTO events (problem_id, user_id, kind, data, created_at) VALUES (?, ?, ?, ?, ?)');

  tx(() => {
    let { status, priority, category, firstResponseAt, resolvedAt } = current;
    if (b.status !== undefined && b.status !== status) {
      const to = oneOf(b.status, STATUSES, 'Status');
      addEvent.run(current.id, user.id, 'status', JSON.stringify({ from: status, to }), now);
      status = to;
      resolvedAt = to === 'resolved' ? now : null;
      firstResponseAt ??= now;
    }
    if (b.priority !== undefined && b.priority !== priority) {
      const to = oneOf<Priority>(b.priority, PRIORITIES, 'Priority');
      addEvent.run(current.id, user.id, 'priority', JSON.stringify({ from: priority, to }), now);
      priority = to;
    }
    if (b.category !== undefined && b.category !== category) {
      const to = oneOf<Category>(b.category, CATEGORIES, 'Category');
      addEvent.run(current.id, user.id, 'category', JSON.stringify({ from: category, to }), now);
      category = to;
    }
    db.prepare(
      'UPDATE problems SET status = ?, priority = ?, category = ?, first_response_at = ?, resolved_at = ?, updated_at = ? WHERE id = ?',
    ).run(status, priority, category, firstResponseAt, resolvedAt, now, current.id);
  });

  const problem = getProblem(current.id, user.id)!;
  publishProblem(user.id, 'updated', problem);
  return c.json({ problem, events: loadEvents(problem.id) });
});

api.post('/problems/:id/notes', async (c) => {
  const user = c.get('user');
  const current = getProblem(idParam(c), user.id) ?? fail(404, 'Problem not found.');
  const b = await body(c);
  const note = text(b.text, 'Note', { max: 2000 });
  const now = Date.now();
  tx(() => {
    db.prepare(`INSERT INTO events (problem_id, user_id, kind, data, created_at) VALUES (?, ?, 'note', ?, ?)`).run(current.id, user.id, JSON.stringify({ text: note }), now);
    db.prepare('UPDATE problems SET updated_at = ?, first_response_at = COALESCE(first_response_at, ?) WHERE id = ?').run(now, now, current.id);
  });
  const problem = getProblem(current.id, user.id)!;
  publishProblem(user.id, 'updated', problem);
  return c.json({ problem, events: loadEvents(problem.id) }, 201);
});

// ---------- analytics ----------

api.get('/analytics', (c) => {
  const range = [7, 14, 30, 90].includes(Number(c.req.query('range'))) ? Number(c.req.query('range')) : 30;
  const tz = Number(c.req.query('tz'));
  const boxParam = c.req.query('box');
  const boxId = boxParam ? Number(boxParam) : null;
  return c.json(computeAnalytics(c.get('user').id, range, Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : 0, boxId));
});

// ---------- sample data ----------

api.post('/sample-data', (c) => {
  const user = c.get('user');
  const has = db.prepare('SELECT 1 FROM boxes WHERE user_id = ? LIMIT 1').get(user.id);
  if (has) fail(409, 'Sample data can only be added to an account with no boxes yet.');
  seedSampleData(user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as unknown as UserRow;
  return c.json({ user: toUser(fresh) }, 201);
});

// ---------- live stream ----------

api.get('/stream', (c) => {
  const user = c.get('user');
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('X-Accel-Buffering', 'no');
  return streamSSE(c, async (stream) => {
    const disconnect = connect(user.id, (event, data) => {
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

// ---------- public box pages ----------

function publicBox(slug: string) {
  const row = db
    .prepare(
      `SELECT b.id, b.user_id, b.name, b.slug, b.description, b.color, b.is_open, u.org
         FROM boxes b JOIN users u ON u.id = b.user_id WHERE b.slug = ?`,
    )
    .get(slug) as { id: number; user_id: number; name: string; slug: string; description: string; color: string; is_open: number; org: string } | undefined;
  return row ?? fail(404, 'This problem box doesn’t exist or has been removed.');
}

api.get('/public/boxes/:slug', (c) => {
  const b = publicBox(c.req.param('slug'));
  const out: PublicBox = { name: b.name, slug: b.slug, description: b.description, color: b.color, org: b.org, isOpen: b.is_open === 1 };
  return c.json({ box: out });
});

api.post('/public/boxes/:slug/problems', async (c) => {
  const box = publicBox(c.req.param('slug'));
  if (!box.is_open) fail(403, 'This box isn’t accepting new problems right now.');
  const b = await body(c);

  // Honeypot: real people never see or fill this field.
  if (typeof b.website === 'string' && b.website.length > 0) return c.json({ ok: true }, 201);

  const title = text(b.title, 'A short summary', { min: 4, max: 140 });
  const details = text(b.body, 'Details', { max: 4000, optional: true });
  const category = b.category ? oneOf<Category>(b.category, CATEGORIES, 'Category') : 'Other';
  const author = text(b.author, 'Name', { max: 80, optional: true }) || null;
  const contact = text(b.contact, 'Contact', { max: 120, optional: true }) || null;

  const wait = submitLimiter.hit(`${clientIp(c)}|${box.id}`);
  if (wait) fail(429, 'You’ve sent several problems in a short time. Please wait a few minutes and try again.');

  const flag = triage(title, details);
  const id = insertProblem({
    boxId: box.id,
    title,
    body: details,
    category,
    priority: flag.priority ?? 'normal',
    author,
    contact,
    source: 'web',
    autoFlag: flag.reason,
    createdAt: Date.now(),
  });
  const problem = getProblem(id, box.user_id);
  if (problem) publishProblem(box.user_id, 'created', problem);
  return c.json({ ok: true }, 201);
});

api.all('*', (c) => c.json({ error: 'Not found.' }, 404));
