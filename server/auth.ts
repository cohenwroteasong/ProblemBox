import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Role } from '../shared/types.ts';
import { db, type UserRow } from './db.ts';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const COOKIE = 'kontho_session';
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function startSession(c: Context, userId: number) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const expires = now + SESSION_DAYS * 86_400_000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), userId, now, expires);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isHttps(c),
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function endSession(c: Context) {
  const token = getCookie(c, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  deleteCookie(c, COOKIE, { path: '/' });
}

function isHttps(c: Context) {
  const trustProxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
  return (trustProxy && c.req.header('x-forwarded-proto') === 'https') || new URL(c.req.url).protocol === 'https:';
}

export function sessionUser(c: Context): UserRow | null {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), Date.now()) as UserRow | undefined;
  return row ?? null;
}

export type AuthEnv = { Variables: { user: UserRow } };

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
  const user = sessionUser(c);
  if (!user) return c.json({ error: 'Please sign in to continue.' }, 401);
  c.set('user', user);
  await next();
});

export const requireRole = (role: Role) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = sessionUser(c);
    if (!user) return c.json({ error: 'Please sign in to continue.' }, 401);
    if (user.role !== role) return c.json({ error: role === 'org' ? 'This page is for organisation accounts.' : 'This page is for player accounts.' }, 403);
    c.set('user', user);
    await next();
  });

/**
 * State-changing requests must be JSON. Browsers can't send a cross-site JSON
 * request without a CORS preflight, so together with SameSite=Lax cookies this
 * blocks CSRF without needing tokens.
 */
export const requireJson = createMiddleware(async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const type = c.req.header('content-type') ?? '';
    if (!type.toLowerCase().startsWith('application/json')) {
      return c.json({ error: 'Requests must be sent as JSON.' }, 415);
    }
  }
  await next();
});

/** Small fixed-window limiter, keyed by whatever the caller chooses. */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, hit] of hits) if (hit.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return {
    /** Returns seconds to wait if the key is over its limit, otherwise null (and records the hit). */
    hit(key: string): number | null {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return null;
      }
      if (entry.count >= limit) return Math.ceil((entry.resetAt - now) / 1000);
      entry.count += 1;
      return null;
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}

export function pruneSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}
