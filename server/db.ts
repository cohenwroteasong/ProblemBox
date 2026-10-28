import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Box, Category, Priority, Problem, ProblemSource, Status, User } from '../shared/types.ts';

const file = resolve(process.env.DATABASE_PATH ?? 'data/kontho.db');
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    org           TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    demo_feed     INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS boxes (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL,
    is_open     INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS problems (
    id                INTEGER PRIMARY KEY,
    box_id            INTEGER NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    body              TEXT NOT NULL DEFAULT '',
    category          TEXT NOT NULL,
    priority          TEXT NOT NULL DEFAULT 'normal',
    status            TEXT NOT NULL DEFAULT 'new',
    author            TEXT,
    contact           TEXT,
    source            TEXT NOT NULL DEFAULT 'web',
    auto_flag         TEXT,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    first_response_at INTEGER,
    resolved_at       INTEGER
  );

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY,
    problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    kind       TEXT NOT NULL,
    data       TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_boxes_user ON boxes(user_id);
  CREATE INDEX IF NOT EXISTS idx_problems_box_created ON problems(box_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_events_problem ON events(problem_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

/** Run `fn` inside a transaction, rolling back if it throws. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---------- row types & mappers ----------

export interface UserRow {
  id: number;
  name: string;
  email: string;
  org: string;
  password_hash: string;
  demo_feed: number;
  created_at: number;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    org: row.org,
    demoFeed: row.demo_feed === 1,
    createdAt: row.created_at,
  };
}

interface BoxRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  is_open: number;
  created_at: number;
  total: number;
  open: number;
  resolved: number;
  last_problem_at: number | null;
}

export const BOX_SELECT = `
  SELECT b.id, b.name, b.slug, b.description, b.color, b.is_open, b.created_at,
         COUNT(p.id) AS total,
         COALESCE(SUM(p.status IN ('new', 'in_progress')), 0) AS open,
         COALESCE(SUM(p.status = 'resolved'), 0) AS resolved,
         MAX(p.created_at) AS last_problem_at
    FROM boxes b
    LEFT JOIN problems p ON p.box_id = b.id`;

export function toBox(row: BoxRow): Box {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    isOpen: row.is_open === 1,
    createdAt: row.created_at,
    total: Number(row.total),
    open: Number(row.open),
    resolved: Number(row.resolved),
    lastProblemAt: row.last_problem_at,
  };
}

export interface ProblemRow {
  id: number;
  box_id: number;
  box_name: string;
  box_color: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  status: string;
  author: string | null;
  contact: string | null;
  source: string;
  auto_flag: string | null;
  created_at: number;
  updated_at: number;
  first_response_at: number | null;
  resolved_at: number | null;
}

export const PROBLEM_SELECT = `
  SELECT p.*, b.name AS box_name, b.color AS box_color
    FROM problems p
    JOIN boxes b ON b.id = p.box_id`;

export function toProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    boxId: row.box_id,
    boxName: row.box_name,
    boxColor: row.box_color,
    title: row.title,
    body: row.body,
    category: row.category as Category,
    priority: row.priority as Priority,
    status: row.status as Status,
    author: row.author,
    contact: row.contact,
    source: row.source as ProblemSource,
    autoFlag: row.auto_flag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstResponseAt: row.first_response_at,
    resolvedAt: row.resolved_at,
  };
}

export function getProblem(id: number, userId: number): Problem | null {
  const row = db.prepare(`${PROBLEM_SELECT} WHERE p.id = ? AND b.user_id = ?`).get(id, userId) as ProblemRow | undefined;
  return row ? toProblem(row) : null;
}

export function getBox(id: number, userId: number): Box | null {
  const row = db.prepare(`${BOX_SELECT} WHERE b.id = ? AND b.user_id = ? GROUP BY b.id`).get(id, userId) as BoxRow | undefined;
  return row ? toBox(row) : null;
}

export function listBoxes(userId: number): Box[] {
  const rows = db.prepare(`${BOX_SELECT} WHERE b.user_id = ? GROUP BY b.id ORDER BY b.created_at`).all(userId) as unknown as BoxRow[];
  return rows.map(toBox);
}

export function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .slice(0, 40) || 'box';
  const exists = db.prepare('SELECT 1 FROM boxes WHERE slug = ?');
  if (!exists.get(base)) return base;
  for (;;) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!exists.get(candidate)) return candidate;
  }
}

export interface NewProblem {
  boxId: number;
  title: string;
  body: string;
  category: Category;
  priority: Priority;
  status?: Status;
  author?: string | null;
  contact?: string | null;
  source: ProblemSource;
  autoFlag?: string | null;
  createdAt: number;
}

export function insertProblem(p: NewProblem): number {
  const result = db
    .prepare(
      `INSERT INTO problems (box_id, title, body, category, priority, status, author, contact, source, auto_flag, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      p.boxId,
      p.title,
      p.body,
      p.category,
      p.priority,
      p.status ?? 'new',
      p.author ?? null,
      p.contact ?? null,
      p.source,
      p.autoFlag ?? null,
      p.createdAt,
      p.createdAt,
    );
  const id = Number(result.lastInsertRowid);
  db.prepare(`INSERT INTO events (problem_id, kind, data, created_at) VALUES (?, 'created', '{}', ?)`).run(id, p.createdAt);
  return id;
}

/** Owner of the box, used to route live events. */
export function boxOwner(boxId: number): number | null {
  const row = db.prepare('SELECT user_id FROM boxes WHERE id = ?').get(boxId) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}
