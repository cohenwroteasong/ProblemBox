import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Problem } from '../../shared/types';

// One EventSource per tab. New problems "pop up" three ways: the live feed on the
// overview, a toast in the corner, and a highlighted row in the inbox.

export interface Toast {
  key: number;
  problem: Problem;
}

interface LiveState {
  connected: boolean;
  /** Problems that arrived since this tab opened, newest first. */
  arrivals: Problem[];
  /** Bumps on every created/updated event so views can refetch. */
  tick: number;
  /** IDs that arrived recently, for highlight animations. */
  fresh: Set<number>;
  unseen: number;
  markSeen(): void;
  toasts: Toast[];
  dismissToast(key: number): void;
  popups: boolean;
  setPopups(on: boolean): void;
}

const LiveContext = createContext<LiveState | null>(null);
const POPUP_KEY = 'kontho-popups';

function readPopups() {
  try {
    return localStorage.getItem(POPUP_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [arrivals, setArrivals] = useState<Problem[]>([]);
  const [tick, setTick] = useState(0);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [unseen, setUnseen] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [popups, setPopupsState] = useState(readPopups);
  const popupsRef = useRef(popups);
  popupsRef.current = popups;
  const toastKey = useRef(0);

  const dismissToast = useCallback((key: number) => setToasts((t) => t.filter((x) => x.key !== key)), []);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.addEventListener('ready', () => setConnected(true));
    es.addEventListener('error', () => setConnected(false));
    es.addEventListener('problem', (e) => {
      const { type, problem } = JSON.parse((e as MessageEvent).data) as { type: 'created' | 'updated'; problem: Problem };
      setTick((t) => t + 1);
      if (type === 'updated') {
        setArrivals((list) => list.map((p) => (p.id === problem.id ? problem : p)));
        return;
      }
      setArrivals((list) => [problem, ...list.filter((p) => p.id !== problem.id)].slice(0, 40));
      setUnseen((n) => n + 1);
      setFresh((s) => new Set(s).add(problem.id));
      setTimeout(() => {
        setFresh((s) => {
          const next = new Set(s);
          next.delete(problem.id);
          return next;
        });
      }, 6000);
      if (popupsRef.current) {
        const key = ++toastKey.current;
        setToasts((t) => [...t.slice(-2), { key, problem }]);
        setTimeout(() => dismissToast(key), 6500);
      }
    });
    return () => es.close();
  }, [dismissToast]);

  // Unseen count in the tab title, so a backgrounded tab still shows activity.
  useEffect(() => {
    const base = 'Kontho';
    document.title = unseen > 0 ? `(${unseen}) ${base}` : base;
  }, [unseen]);

  const setPopups = useCallback((on: boolean) => {
    setPopupsState(on);
    try {
      localStorage.setItem(POPUP_KEY, on ? 'on' : 'off');
    } catch {
      // Storage unavailable: preference lasts for this tab only.
    }
  }, []);

  const markSeen = useCallback(() => setUnseen(0), []);

  const value = useMemo<LiveState>(
    () => ({ connected, arrivals, tick, fresh, unseen, markSeen, toasts, dismissToast, popups, setPopups }),
    [connected, arrivals, tick, fresh, unseen, markSeen, toasts, dismissToast, popups, setPopups],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside <LiveProvider>');
  return ctx;
}
