import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { BoxStatus, BoxSummary, OrgBox, OrgQuestion, Role, Theme, User } from '../shared/types.ts';

const file = resolve(process.env.DATABASE_PATH ?? 'data/kontho.db');
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');

// Bump when the schema changes; older local databases are rebuilt (they only hold sample data).
const SCHEMA_VERSION = 2;
const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
if (user_version !== SCHEMA_VERSION) {
  db.exec('PRAGMA foreign_keys = OFF');
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[];
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  db.exec('PRAGMA foreign_keys = ON');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY,
    role            TEXT NOT NULL CHECK (role IN ('player', 'org')),
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash   TEXT NOT NULL,
    org             TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    division        TEXT NOT NULL DEFAULT '',
    gender          TEXT NOT NULL DEFAULT '',
    age_band        TEXT NOT NULL DEFAULT '',
    consent_contact INTEGER NOT NULL DEFAULT 0,
    demo_feed       INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS boxes (
    id             INTEGER PRIMARY KEY,
    org_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template       TEXT NOT NULL DEFAULT '',
    title          TEXT NOT NULL,
    title_bn       TEXT NOT NULL DEFAULT '',
    topic          TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    brief          TEXT NOT NULL DEFAULT '',
    pool           INTEGER NOT NULL,
    target         INTEGER NOT NULL,
    minutes        INTEGER NOT NULL,
    duration_hours INTEGER NOT NULL DEFAULT 24,
    questions      TEXT NOT NULL,
    themes         TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'draft',
    sample         INTEGER NOT NULL DEFAULT 0,
    released_at    INTEGER,
    closes_at      INTEGER,
    closed_at      INTEGER,
    created_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS responses (
    id             INTEGER PRIMARY KEY,
    box_id         INTEGER NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
    player_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    division       TEXT NOT NULL,
    gender         TEXT NOT NULL,
    age_band       TEXT NOT NULL,
    answers        TEXT NOT NULL,
    idea           TEXT NOT NULL DEFAULT '',
    prediction     TEXT,
    theme_id       TEXT,
    passed         INTEGER NOT NULL,
    fail_reason    TEXT,
    duration_sec   INTEGER NOT NULL,
    consent        INTEGER NOT NULL DEFAULT 0,
    simulated      INTEGER NOT NULL DEFAULT 0,
    points         REAL NOT NULL DEFAULT 0,
    pool_share     REAL NOT NULL DEFAULT 0,
    prediction_bonus REAL NOT NULL DEFAULT 0,
    consent_bonus  REAL NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL,
    UNIQUE (box_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS ledger (
    id         INTEGER PRIMARY KEY,
    player_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     REAL NOT NULL,
    kind       TEXT NOT NULL,
    label      TEXT NOT NULL,
    box_id     INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id         INTEGER PRIMARY KEY,
    player_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method     TEXT NOT NULL,
    amount     REAL NOT NULL,
    status     TEXT NOT NULL DEFAULT 'queued',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_boxes_org ON boxes(org_id);
  CREATE INDEX IF NOT EXISTS idx_boxes_status ON boxes(status);
  CREATE INDEX IF NOT EXISTS idx_responses_box ON responses(box_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_responses_player ON responses(player_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_player ON ledger(player_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);
db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

let depth = 0;

/** Run `fn` inside a transaction (a savepoint when nested), rolling back if it throws. */
export function tx<T>(fn: () => T): T {
  const sp = `sp${depth}`;
  db.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
  depth++;
  try {
    const result = fn();
    depth--;
    db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
    return result;
  } catch (err) {
    depth--;
    db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw err;
  }
}

/** Taka amounts are kept to the paisa. */
export const money = (n: number) => Math.round(n * 100) / 100;

// ---------- users ----------

export interface UserRow {
  id: number;
  role: Role;
  name: string;
  email: string;
  password_hash: string;
  org: string;
  phone: string;
  division: string;
  gender: string;
  age_band: string;
  consent_contact: number;
  demo_feed: number;
  created_at: number;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    org: row.org,
    phone: row.phone,
    division: row.division,
    gender: row.gender,
    ageBand: row.age_band,
    consentContact: row.consent_contact === 1,
    demoFeed: row.demo_feed === 1,
    createdAt: row.created_at,
  };
}

export const getUserRow = (id: number) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;

// ---------- boxes ----------

export interface BoxRow {
  id: number;
  org_id: number;
  template: string;
  title: string;
  title_bn: string;
  topic: string;
  description: string;
  brief: string;
  pool: number;
  target: number;
  minutes: number;
  duration_hours: number;
  questions: string;
  themes: string;
  status: BoxStatus;
  sample: number;
  released_at: number | null;
  closes_at: number | null;
  closed_at: number | null;
  created_at: number;
  received?: number;
  verified?: number;
}

/** Box columns plus response counts. */
export const BOX_SELECT = `
  SELECT b.*,
         (SELECT COUNT(*) FROM responses r WHERE r.box_id = b.id) AS received,
         (SELECT COUNT(*) FROM responses r WHERE r.box_id = b.id AND r.passed = 1) AS verified
    FROM boxes b`;

export function toBoxSummary(row: BoxRow): BoxSummary {
  return {
    id: row.id,
    title: row.title,
    titleBn: row.title_bn,
    topic: row.topic,
    description: row.description,
    pool: row.pool,
    target: row.target,
    minutes: row.minutes,
    questionCount: (JSON.parse(row.questions) as unknown[]).length,
    status: row.status,
    releasedAt: row.released_at,
    closesAt: row.closes_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    received: Number(row.received ?? 0),
    verified: Number(row.verified ?? 0),
    sample: row.sample === 1,
  };
}

export function toOrgBox(row: BoxRow): OrgBox {
  return {
    ...toBoxSummary(row),
    brief: row.brief,
    durationHours: row.duration_hours,
    questions: JSON.parse(row.questions) as OrgQuestion[],
    themes: JSON.parse(row.themes) as Theme[],
  };
}

export const getBoxRow = (id: number) => db.prepare(`${BOX_SELECT} WHERE b.id = ?`).get(id) as BoxRow | undefined;

export interface NewBox {
  orgId: number;
  template: string;
  title: string;
  titleBn: string;
  topic: string;
  description: string;
  brief: string;
  pool: number;
  target: number;
  minutes: number;
  durationHours: number;
  questions: OrgQuestion[];
  themes: Theme[];
  status: BoxStatus;
  sample: boolean;
  releasedAt?: number | null;
  closesAt?: number | null;
  closedAt?: number | null;
  createdAt: number;
}

export function insertBox(b: NewBox): number {
  const r = db
    .prepare(
      `INSERT INTO boxes (org_id, template, title, title_bn, topic, description, brief, pool, target, minutes, duration_hours,
                          questions, themes, status, sample, released_at, closes_at, closed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      b.orgId,
      b.template,
      b.title,
      b.titleBn,
      b.topic,
      b.description,
      b.brief,
      b.pool,
      b.target,
      b.minutes,
      b.durationHours,
      JSON.stringify(b.questions),
      JSON.stringify(b.themes),
      b.status,
      b.sample ? 1 : 0,
      b.releasedAt ?? null,
      b.closesAt ?? null,
      b.closedAt ?? null,
      b.createdAt,
    );
  return Number(r.lastInsertRowid);
}

// ---------- responses ----------

export interface ResponseRow {
  id: number;
  box_id: number;
  player_id: number | null;
  division: string;
  gender: string;
  age_band: string;
  answers: string;
  idea: string;
  prediction: string | null;
  theme_id: string | null;
  passed: number;
  fail_reason: string | null;
  duration_sec: number;
  consent: number;
  simulated: number;
  points: number;
  pool_share: number;
  prediction_bonus: number;
  consent_bonus: number;
  created_at: number;
}

export interface NewResponse {
  boxId: number;
  playerId: number | null;
  division: string;
  gender: string;
  ageBand: string;
  answers: Record<string, string | number>;
  idea: string;
  prediction: string | null;
  themeId: string | null;
  passed: boolean;
  failReason: string | null;
  durationSec: number;
  consent: boolean;
  simulated: boolean;
  createdAt: number;
}

export function insertResponse(r: NewResponse): number {
  const result = db
    .prepare(
      `INSERT INTO responses (box_id, player_id, division, gender, age_band, answers, idea, prediction, theme_id,
                              passed, fail_reason, duration_sec, consent, simulated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      r.boxId,
      r.playerId,
      r.division,
      r.gender,
      r.ageBand,
      JSON.stringify(r.answers),
      r.idea,
      r.prediction,
      r.themeId,
      r.passed ? 1 : 0,
      r.failReason,
      r.durationSec,
      r.consent ? 1 : 0,
      r.simulated ? 1 : 0,
      r.createdAt,
    );
  return Number(result.lastInsertRowid);
}

export function credit(playerId: number, amount: number, kind: string, label: string, boxId: number | null, at: number) {
  db.prepare('INSERT INTO ledger (player_id, amount, kind, label, box_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(playerId, money(amount), kind, label, boxId, at);
}

export function balanceOf(playerId: number): number {
  const row = db.prepare('SELECT COALESCE(SUM(amount), 0) AS b FROM ledger WHERE player_id = ?').get(playerId) as { b: number };
  return money(row.b);
}
