import { ArrowLeft, ArrowRight, Check, Mic, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PlayerBox, Question } from '../../../shared/types';
import { api } from '../../lib/api';
import { clock, ROLE_LABEL, timeLeft, tk } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';

type Answers = Record<string, string | number>;
type Stage = { kind: 'intro' } | { kind: 'q'; i: number } | { kind: 'done'; firstBonus: number | null; closesAt: number | null } | { kind: 'out' };

const draftKey = (id: number) => `kontho-box-${id}`;

/** Progress is saved after every answer, so a player can leave and come back. */
function loadDraft(id: number): { answers: Answers; i: number; started: number } | null {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null');
  } catch {
    return null;
  }
}
function saveDraft(id: number, d: { answers: Answers; i: number; started: number } | null) {
  try {
    if (d) localStorage.setItem(draftKey(id), JSON.stringify(d));
    else localStorage.removeItem(draftKey(id));
  } catch {
    // Storage unavailable: progress just won't survive leaving the page.
  }
}

export function BoxPlay() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: box, error } = useFetch<PlayerBox>(`/player/boxes/${id}`);
  const draft = useRef(loadDraft(id));
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [answers, setAnswers] = useState<Answers>(draft.current?.answers ?? {});
  const started = useRef<number>(draft.current?.started ?? 0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (stage.kind === 'q') saveDraft(id, { answers, i: stage.i, started: started.current });
  }, [id, answers, stage]);

  if (error && !box) {
    return (
      <div className="card mt-10 p-8 text-center">
        <h1 className="text-2xl">This Box isn’t available</h1>
        <p className="mt-2 text-muted">{error}</p>
        <Link to="/play" className="btn btn-amber mt-6">
          Back to tonight
        </Link>
      </div>
    );
  }
  if (!box) return <div className="card mt-10 h-96 animate-pulse" />;

  if (box.mine !== 'open' && stage.kind !== 'done' && stage.kind !== 'out') {
    return (
      <div className="card mt-10 p-8 text-center">
        <h1 className="text-2xl">You’ve already answered this Box</h1>
        <p className="mt-2 text-muted">Results arrive when it closes{box.closesAt ? ` at ${clock(box.closesAt)}` : ''}.</p>
        <Link to={`/play/results/${box.id}`} className="btn btn-amber mt-6">
          See my results
        </Link>
      </div>
    );
  }

  const qs = box.questions;

  async function submit(final: Answers) {
    setBusy(true);
    setSubmitError(null);
    try {
      const durationSec = Math.round((Date.now() - (started.current || Date.now())) / 1000);
      const r = await api<{ screenedOut: boolean; firstBonus: number | null; closesAt: number | null }>(`/player/boxes/${id}/responses`, {
        body: { answers: final, durationSec },
      });
      saveDraft(id, null);
      setStage(r.screenedOut ? { kind: 'out' } : { kind: 'done', firstBonus: r.firstBonus, closesAt: r.closesAt });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not send your answers.');
    } finally {
      setBusy(false);
    }
  }

  function next(i: number, current: Answers) {
    const q = qs[i];
    // A screener answer outside the audience ends the Box politely.
    if (q.role === 'screener' && q.disqualify?.includes(Number(current[q.id]))) {
      void submit({ [q.id]: current[q.id] });
      return;
    }
    if (i === qs.length - 1) void submit(current);
    else setStage({ kind: 'q', i: i + 1 });
  }

  if (stage.kind === 'intro') {
    const resume = draft.current && Object.keys(draft.current.answers).length > 0;
    return (
      <div className="animate-rise flex min-h-[calc(100dvh-3rem)] flex-col">
        <div className="flex items-center justify-between py-2">
          <Link to="/play" className="btn btn-quiet btn-sm -ml-3">
            <ArrowLeft size={16} /> Tonight
          </Link>
          <span className="tnum text-sm text-muted">{timeLeft(box.closesAt)}</span>
        </div>
        <div className="card mt-4 overflow-hidden p-6 sm:p-8" style={{ background: 'radial-gradient(120% 120% at 0% 0%, #3a2a0e 0%, var(--ink-raised) 58%)' }}>
          <span className="pill bg-amber/15 text-amber">Box · {box.topic}</span>
          <h1 className="mt-4 text-4xl">{box.title}</h1>
          {box.titleBn && (
            <p lang="bn" className="text-xl font-semibold text-amber">
              {box.titleBn}
            </p>
          )}
          <p className="mt-3 text-muted">{box.description}</p>
          <dl className="mt-6 grid grid-cols-3 gap-2">
            {[
              ['Pool', tk(box.pool)],
              ['Time', `~${box.minutes} min`],
              ['Questions', String(qs.length)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[14px] bg-ink/50 px-3 py-2.5">
                <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{k}</dt>
                <dd className="tnum font-display text-lg font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ul className="ticks mt-6 px-1 text-[15px]">
          <li>One question per screen. Your progress saves after every answer.</li>
          <li>Your idea is grouped with everyone else’s. The most common ideas earn the most points.</li>
          <li>Answers are anonymous. Contact details are shared only if you switched that on in your profile.</li>
        </ul>
        <div className="mt-auto pt-8">
          <button
            className="btn btn-amber btn-lg w-full"
            onClick={() => {
              if (!started.current) started.current = Date.now();
              setStage({ kind: 'q', i: resume ? Math.min(draft.current!.i, qs.length - 1) : 0 });
            }}
          >
            {resume ? 'Continue where I left off' : 'Start Box'} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (stage.kind === 'done') return <Done box={box} firstBonus={stage.firstBonus} closesAt={stage.closesAt} onHome={() => navigate('/play')} />;
  if (stage.kind === 'out') return <ScreenedOut onHome={() => navigate('/play')} />;

  const i = stage.i;
  const q = qs[i];
  const value = answers[q.id];
  const answered = value !== undefined && value !== '' && (q.type !== 'open' || String(value).trim().length >= 3);
  const autoAdvance = q.type === 'choice' || q.type === 'scale';

  function pick(v: string | number) {
    const updated = { ...answers, [q.id]: v };
    setAnswers(updated);
    if (autoAdvance) setTimeout(() => next(i, updated), 380);
  }

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <div className="flex items-center gap-3 py-2">
        <button className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface" onClick={() => (i === 0 ? setStage({ kind: 'intro' }) : setStage({ kind: 'q', i: i - 1 }))} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex gap-1" aria-hidden>
            {qs.map((_, k) => (
              <i key={k} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: k < i ? 'var(--cream)' : k === i ? 'var(--amber)' : 'var(--line-strong)' }} />
            ))}
          </div>
          <p className="tnum mt-1.5 text-xs font-semibold text-muted">
            Question {i + 1} of {qs.length}
          </p>
        </div>
        <Link to="/play" className="btn btn-quiet btn-sm -mr-3" title="Your progress is saved">
          <X size={16} /> Save & exit
        </Link>
      </div>

      <div key={q.id} className="animate-slide mt-6 flex flex-1 flex-col gap-5">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber">
          <span className="h-[3px] w-[18px] rounded-full bg-amber" />
          {ROLE_LABEL[q.role]}
        </span>
        <h1 className="text-[1.65rem] leading-snug sm:text-3xl">{q.text}</h1>
        {q.textBn && (
          <p lang="bn" className="-mt-3 text-lg text-muted">
            {q.textBn}
          </p>
        )}
        <QuestionInput q={q} value={value} onPick={pick} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
        {autoAdvance && <p className="text-center text-xs text-muted">Tap an answer to continue</p>}
      </div>

      {submitError && (
        <p role="alert" className="mt-4 rounded-[14px] bg-crit-soft px-4 py-3 text-sm font-semibold text-crit">
          {submitError}
        </p>
      )}
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-ink px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
        <button className="btn btn-amber btn-lg w-full" disabled={!answered || busy} onClick={() => next(i, answers)}>
          {busy ? 'Sending…' : i === qs.length - 1 ? 'Submit Box' : 'Next'}
          {!busy && i < qs.length - 1 && <ArrowRight size={18} />}
        </button>
      </div>
    </div>
  );
}

function QuestionInput({ q, value, onPick, onChange }: { q: Question; value: string | number | undefined; onPick(v: string | number): void; onChange(v: string | number): void }) {
  if (q.type === 'choice') {
    return (
      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answer">
        {q.options?.map((o, k) => {
          const on = value === k;
          return (
            <button
              key={o}
              role="radio"
              aria-checked={on}
              onClick={() => onPick(k)}
              className="flex min-h-[60px] items-center gap-4 rounded-[18px] border-2 px-4 py-3 text-left text-[17px] font-semibold transition-[background-color,transform] active:scale-[0.98]"
              style={on ? { background: 'var(--amber)', color: 'var(--ink)', borderColor: 'var(--amber)' } : { background: 'var(--surface)', borderColor: 'var(--line)' }}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: on ? 'var(--ink)' : 'var(--line-strong)', background: on ? 'var(--ink)' : 'transparent' }}>
                {on && <Check size={15} className="text-amber" strokeWidth={3} />}
              </span>
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.type === 'scale') {
    return (
      <div>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Answer">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = value === n;
            return (
              <button
                key={n}
                role="radio"
                aria-checked={on}
                aria-label={`${n}${n === 1 ? ` (${q.low})` : n === 5 ? ` (${q.high})` : ''}`}
                onClick={() => onPick(n)}
                className="tnum grid min-h-16 place-items-center rounded-[18px] border-2 font-display text-2xl font-extrabold transition-transform active:scale-95"
                style={on ? { background: 'var(--amber)', color: 'var(--ink)', borderColor: 'var(--amber)' } : { background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-sm text-muted">
          <span>{q.low}</span>
          <span>{q.high}</span>
        </div>
      </div>
    );
  }
  if (q.type === 'number') {
    return (
      <label className="relative block">
        <span className="sr-only">Your answer</span>
        {q.unit === '৳' && <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-display text-2xl font-extrabold text-amber">৳</span>}
        <input
          className={`input !min-h-16 font-display !text-2xl font-extrabold ${q.unit === '৳' ? 'pl-10' : ''}`}
          type="number"
          inputMode="numeric"
          min={0}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="0"
          autoFocus
        />
        {q.unit && q.unit !== '৳' && <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted">{q.unit}</span>}
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <label>
        <span className="mb-2 block text-sm text-muted">{q.hint}</span>
        <textarea className="input text-[17px]" rows={4} maxLength={600} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder="Type your answer…" autoFocus />
      </label>
      <div className="flex items-center gap-3 rounded-[14px] bg-surface-2 px-4 py-3 text-sm text-muted">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber/15 text-amber">
          <Mic size={16} />
        </span>
        Voice answers work in the Android app. Here, please type.
      </div>
    </div>
  );
}

function Done({ box, firstBonus, closesAt, onHome }: { box: PlayerBox; firstBonus: number | null; closesAt: number | null; onHome(): void }) {
  return (
    <div className="animate-rise flex min-h-[calc(100dvh-3rem)] flex-col items-stretch pt-10 text-center">
      <div className="relative mx-auto size-28">
        <svg className="animate-fade absolute inset-0" viewBox="0 0 96 96" fill="none" stroke="var(--amber)" strokeWidth="3" strokeLinecap="round" aria-hidden>
          <path d="M70 30a26 26 0 0 1 0 36" />
          <path d="M78 22a38 38 0 0 1 0 52" />
          <path d="M26 30a26 26 0 0 0 0 36" />
          <path d="M18 22a38 38 0 0 0 0 52" />
        </svg>
        <span className="animate-core absolute inset-[22%] grid place-items-center rounded-full bg-amber text-ink">
          <Check size={34} strokeWidth={3} />
        </span>
      </div>
      <p lang="bn" className="mt-6 text-2xl font-bold text-amber">
        আপনার কণ্ঠ জমা হয়েছে
      </p>
      <h1 className="mt-1 text-4xl">Your voice is in.</h1>
      <p className="mx-auto mt-2 max-w-sm text-muted">Thank you for answering {box.title}.</p>

      {firstBonus && (
        <div className="card animate-pop mx-auto mt-6 flex w-full items-center justify-between gap-4 border-mint p-5 text-left">
          <div>
            <p className="font-bold">First Box bonus</p>
            <p className="text-sm text-muted">Paid now, so you know Kontho is real.</p>
          </div>
          <span className="sticker shrink-0">+{tk(firstBonus)}</span>
        </div>
      )}

      <ol className="card mt-6 flex flex-col gap-3 p-5 text-left">
        {[
          'Every answer is checked as it arrives.',
          `When the Box closes${closesAt ? ` at ${clock(closesAt)}` : ''}, ideas are grouped and ranked.`,
          'Your earnings land in your wallet, and the results pop up here.',
        ].map((t, k) => (
          <li key={k} className="flex gap-3 text-[15px]">
            <b className="grid size-6 shrink-0 place-items-center rounded-full bg-amber text-xs text-ink">{k + 1}</b>
            {t}
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-col gap-2 pt-8">
        <button className="btn btn-amber btn-lg" onClick={onHome}>
          Back to tonight
        </button>
        <Link to={`/play/results/${box.id}`} className="btn btn-ghost">
          See this Box in my results
        </Link>
      </div>
    </div>
  );
}

function ScreenedOut({ onHome }: { onHome(): void }) {
  return (
    <div className="animate-rise flex min-h-[calc(100dvh-3rem)] flex-col pt-16 text-center">
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-surface text-amber">
        <Check size={34} strokeWidth={3} />
      </span>
      <p lang="bn" className="mt-6 text-2xl font-bold text-amber">
        অংশ নেওয়ার জন্য ধন্যবাদ
      </p>
      <h1 className="mt-1 text-3xl">Thanks for your time</h1>
      <p className="mx-auto mt-2 max-w-sm text-muted">This Box is looking for a different group of people, so it ends here. We’ll pop up the next Box that fits you.</p>
      <div className="mt-auto pt-8">
        <button className="btn btn-amber btn-lg w-full" onClick={onHome}>
          Back to tonight
        </button>
      </div>
    </div>
  );
}
