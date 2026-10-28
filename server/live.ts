import type { Problem } from '../shared/types.ts';
import { db, getProblem, insertProblem } from './db.ts';
import { demoSubmission } from './samples.ts';

// Each signed-in browser tab holds one Server-Sent Events connection. Events are
// routed to every connection belonging to the box owner.

type Send = (event: string, data: unknown) => void;

const connections = new Map<number, Set<Send>>();

export function connect(userId: number, send: Send) {
  let set = connections.get(userId);
  if (!set) connections.set(userId, (set = new Set()));
  set.add(send);
  // First simulated arrival a few seconds after a dashboard opens, so it's visible quickly.
  if (!nextDemoAt.has(userId)) nextDemoAt.set(userId, Date.now() + 4_000);
  return () => {
    set.delete(send);
    if (set.size === 0) {
      connections.delete(userId);
      nextDemoAt.delete(userId);
    }
  };
}

export function publish(userId: number, event: string, data: unknown) {
  for (const send of connections.get(userId) ?? []) {
    try {
      send(event, data);
    } catch {
      // A broken connection is cleaned up by its own abort handler.
    }
  }
}

export function publishProblem(userId: number, type: 'created' | 'updated', problem: Problem) {
  publish(userId, 'problem', { type, problem });
}

// ---------- live demo feed ----------
// While a user with the demo feed switched on has the dashboard open, a believable
// submission lands in one of their open boxes every ~8–20 seconds. These are
// stored with source = 'demo' and labelled "Simulated" in the UI.

const nextDemoAt = new Map<number, number>();

setInterval(() => {
  const now = Date.now();
  for (const [userId, due] of nextDemoAt) {
    if (due > now) continue;
    nextDemoAt.set(userId, now + 8_000 + Math.random() * 12_000);

    const user = db.prepare('SELECT demo_feed FROM users WHERE id = ?').get(userId) as { demo_feed: number } | undefined;
    if (!user?.demo_feed) continue;
    const boxes = db.prepare('SELECT id, name FROM boxes WHERE user_id = ? AND is_open = 1').all(userId) as { id: number; name: string }[];
    if (boxes.length === 0) continue;
    // Keep a dashboard left open all day from flooding the account.
    const recent = db
      .prepare(`SELECT COUNT(*) AS n FROM problems p JOIN boxes b ON b.id = p.box_id WHERE b.user_id = ? AND p.source = 'demo' AND p.created_at > ?`)
      .get(userId, now - 3_600_000) as { n: number };
    if (recent.n >= 90) continue;

    const s = demoSubmission(boxes);
    const id = insertProblem({ ...s, source: 'demo', createdAt: now });
    const problem = getProblem(id, userId);
    if (problem) publishProblem(userId, 'created', problem);
  }
}, 1_000).unref();
