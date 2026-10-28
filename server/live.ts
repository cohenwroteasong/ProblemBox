import type { Role } from '../shared/types.ts';

// One Server-Sent Events connection per signed-in browser tab.

type Send = (event: string, data: unknown) => void;
interface Conn {
  userId: number;
  role: Role;
  send: Send;
}

const conns = new Set<Conn>();

export function connect(userId: number, role: Role, send: Send) {
  const conn = { userId, role, send };
  conns.add(conn);
  return () => {
    conns.delete(conn);
  };
}

function deliver(conn: Conn, event: string, data: unknown) {
  try {
    conn.send(event, data);
  } catch {
    // A broken connection is removed by its own abort handler.
  }
}

export function sendTo(userId: number, event: string, data: unknown) {
  for (const c of conns) if (c.userId === userId) deliver(c, event, data);
}

export function broadcast(role: Role, event: string, data: unknown) {
  for (const c of conns) if (c.role === role) deliver(c, event, data);
}

/** Distinct users with a dashboard open right now. */
export function online(): { userId: number; role: Role }[] {
  const seen = new Map<number, Role>();
  for (const c of conns) seen.set(c.userId, c.role);
  return [...seen].map(([userId, role]) => ({ userId, role }));
}
