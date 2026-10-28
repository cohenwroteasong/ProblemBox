import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Answer, BoxSummary, Role } from '../../shared/types';
import { tk } from './format';

// One EventSource per tab. What "pops up" depends on who is signed in:
// players see new Boxes and their results; organisations see verified answers.

export interface Toast {
  key: number;
  eyebrow: string;
  title: string;
  body?: string;
  href?: string;
  tone: 'amber' | 'mint' | 'plain';
}

interface LiveState {
  connected: boolean;
  /** Bumps on every event so views can refetch. */
  tick: number;
  /** Boxes released in the last few seconds (players) — for the pop-in animation. */
  freshBoxes: Set<number>;
  /** Answers that just arrived (organisations), newest first. */
  answers: Answer[];
  freshAnswers: Set<number>;
  toasts: Toast[];
  dismiss(key: number): void;
  notify(t: Omit<Toast, 'key'>): void;
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

function useFlashSet(ms: number) {
  const [set, setSet] = useState<Set<number>>(new Set());
  const add = useCallback(
    (id: number) => {
      setSet((s) => new Set(s).add(id));
      setTimeout(
        () =>
          setSet((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          }),
        ms,
      );
    },
    [ms],
  );
  return [set, add] as const;
}

export function LiveProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [freshBoxes, flashBox] = useFlashSet(8000);
  const [freshAnswers, flashAnswer] = useFlashSet(6000);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [popups, setPopupsState] = useState(readPopups);
  const popupsRef = useRef(popups);
  popupsRef.current = popups;
  const keyRef = useRef(0);
  const lastAnswerToast = useRef(0);

  const dismiss = useCallback((key: number) => setToasts((t) => t.filter((x) => x.key !== key)), []);
  const notify = useCallback(
    (t: Omit<Toast, 'key'>) => {
      if (!popupsRef.current) return;
      const key = ++keyRef.current;
      setToasts((list) => [...list.slice(-2), { ...t, key }]);
      setTimeout(() => dismiss(key), 7000);
    },
    [dismiss],
  );

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.addEventListener('ready', () => setConnected(true));
    es.addEventListener('error', () => setConnected(false));

    es.addEventListener('box', (e) => {
      const { type, box } = JSON.parse((e as MessageEvent).data) as { type: 'released' | 'updated' | 'closed'; box: BoxSummary };
      setTick((t) => t + 1);
      if (type === 'released' && role === 'player') {
        flashBox(box.id);
        notify({ eyebrow: 'New Box is open', title: box.title, body: `${tk(box.pool)} pool · about ${box.minutes} min`, href: `/play/box/${box.id}`, tone: 'amber' });
      }
      if (type === 'closed' && role === 'org') {
        notify({ eyebrow: 'Box closed and scored', title: box.title, body: `${box.verified} verified answers`, href: `/org/boxes/${box.id}`, tone: 'plain' });
      }
    });

    es.addEventListener('answer', (e) => {
      const a = JSON.parse((e as MessageEvent).data) as Answer;
      setTick((t) => t + 1);
      if (!a.passed) return;
      setAnswers((list) => [a, ...list.filter((x) => x.id !== a.id)].slice(0, 40));
      flashAnswer(a.id);
      // At most one pop-up every few seconds; the live feeds show every answer.
      const now = Date.now();
      if (now - lastAnswerToast.current > 8000) {
        lastAnswerToast.current = now;
        notify({ eyebrow: 'New verified answer', title: `“${a.idea}”`, body: `${a.boxTitle} · ${a.division}`, href: `/org/boxes/${a.boxId}`, tone: 'plain' });
      }
    });

    es.addEventListener('results', (e) => {
      const r = JSON.parse((e as MessageEvent).data) as { boxId: number; title: string; total: number };
      setTick((t) => t + 1);
      notify({
        eyebrow: 'Results are in',
        title: r.total > 0 ? `+${tk(r.total)} added to your wallet` : 'No points this time',
        body: r.title,
        href: `/play/results/${r.boxId}`,
        tone: r.total > 0 ? 'mint' : 'plain',
      });
    });

    return () => es.close();
  }, [role, notify, flashBox, flashAnswer]);

  const setPopups = useCallback((on: boolean) => {
    setPopupsState(on);
    try {
      localStorage.setItem(POPUP_KEY, on ? 'on' : 'off');
    } catch {
      // Storage unavailable: the choice lasts for this tab only.
    }
  }, []);

  const value = useMemo<LiveState>(
    () => ({ connected, tick, freshBoxes, answers, freshAnswers, toasts, dismiss, notify, popups, setPopups }),
    [connected, tick, freshBoxes, answers, freshAnswers, toasts, dismiss, notify, popups, setPopups],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside <LiveProvider>');
  return ctx;
}

/** Refetch when live events arrive, at most once every two seconds. */
export function useLiveReload(reload: () => unknown) {
  const { tick } = useLive();
  const last = useRef(0);
  useEffect(() => {
    if (!tick) return;
    const wait = Math.max(0, last.current + 2000 - Date.now());
    const t = setTimeout(() => {
      last.current = Date.now();
      void reload();
    }, wait);
    return () => clearTimeout(t);
  }, [tick, reload]);
}
