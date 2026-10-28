import { ArrowLeft, Ban, CircleCheck, CircleDot, MessageSquareText, RotateCcw, Send, ShieldAlert, Tag, Timer, UserRound, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { CATEGORIES, PRIORITIES, STATUSES, type Problem, type ProblemEvent, type Status } from '../../shared/types';
import { api } from '../lib/api';
import { PRIORITY_LABEL, STATUS_LABEL, dateTime, timeAgo } from '../lib/format';
import { useLive } from '../lib/live';
import { useFetch } from '../lib/useFetch';
import { BoxChip, PriorityBadge, SimulatedTag, StatusBadge } from './Badges';

type Detail = { problem: Problem; events: ProblemEvent[] };

export function ProblemDetail({ id, onClose, onChange }: { id: number; onClose(): void; onChange?(p: Problem): void }) {
  const { data, error, setData, reload } = useFetch<Detail>(`/problems/${id}`);
  const { tick } = useLive();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Pick up changes made in another tab.
  useEffect(() => {
    if (tick) void reload();
  }, [tick, reload]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      const r = await api<Detail>(`/problems/${id}`, { method: 'PATCH', body });
      setData(r);
      onChange?.(r.problem);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update.');
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const r = await api<Detail>(`/problems/${id}/notes`, { body: { text: note } });
      setData(r);
      setNote('');
      onChange?.(r.problem);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not add the note.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="p-6 text-sm text-ink-2">
        <button className="btn btn-ghost btn-sm mb-4 -ml-2" onClick={onClose}>
          <ArrowLeft size={16} /> Back
        </button>
        <p>{error}</p>
      </div>
    );
  }
  if (!data) return <DetailSkeleton />;

  const { problem: p, events } = data;
  const next = primaryAction(p.status);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <button className="btn btn-ghost btn-sm -ml-2 lg:hidden" onClick={onClose}>
          <ArrowLeft size={16} /> Inbox
        </button>
        <div className="hidden min-w-0 items-center gap-2 text-xs text-ink-3 lg:flex">
          <BoxChip name={p.boxName} color={p.boxColor} />
          <span>·</span>
          <span className="tnum">#{p.id}</span>
        </div>
        <button className="btn btn-ghost btn-sm hidden px-2 lg:inline-flex" onClick={onClose} aria-label="Close">
          <X size={17} />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pt-5 pb-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <PriorityBadge priority={p.priority} />
            {p.source === 'demo' && <SimulatedTag />}
            <span className="lg:hidden">
              <BoxChip name={p.boxName} color={p.boxColor} />
            </span>
          </div>
          <h2 className="text-xl leading-snug font-bold tracking-tight text-balance">{p.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={14} />
              {p.author ? (
                <span>
                  <span className="font-medium text-ink-2">{p.author}</span>
                  {p.contact && <span> · {p.contact}</span>}
                </span>
              ) : (
                'Anonymous'
              )}
            </span>
            <span title={dateTime(p.createdAt)}>{timeAgo(p.createdAt)}</span>
            <span className="inline-flex items-center gap-1">
              <Tag size={13} />
              {p.category}
            </span>
          </div>

          {p.autoFlag && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px]" style={{ background: `var(--pr-${p.priority}-soft)`, color: `var(--pr-${p.priority})` }}>
              <ShieldAlert size={16} className="mt-px shrink-0" />
              <span className="font-medium">{p.autoFlag}. Change the priority below if this looks wrong.</span>
            </div>
          )}

          {p.body && <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{p.body}</p>}
        </div>

        <div className="mx-5 grid gap-3 rounded-2xl border border-line bg-surface-2 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="label">Status</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => s !== p.status && patch({ status: s })}
                  className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition-colors ${
                    s === p.status ? 'border-transparent' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
                  }`}
                  style={s === p.status ? { background: `var(--st-${statusVar(s)}-soft)`, color: `var(--st-${statusVar(s)})`, borderColor: `var(--st-${statusVar(s)})` } : undefined}
                  aria-pressed={s === p.status}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="label">Priority</span>
            <select className="input input-sm" value={p.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value })}>
              {PRIORITIES.map((x) => (
                <option key={x} value={x}>
                  {PRIORITY_LABEL[x]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Category</span>
            <select className="input input-sm" value={p.category} disabled={busy} onChange={(e) => patch({ category: e.target.value })}>
              {CATEGORIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {next && (
            <button className="btn btn-primary sm:col-span-2" disabled={busy} onClick={() => patch({ status: next.to })}>
              <next.icon size={16} />
              {next.label}
            </button>
          )}
          {actionError && <p className="text-[13px] text-[var(--pr-urgent)] sm:col-span-2">{actionError}</p>}
        </div>

        <div className="px-5 pt-6 pb-4">
          <h3 className="eyebrow mb-3">Activity</h3>
          <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-line">
            {events.map((e) => (
              <TimelineItem key={e.id} event={e} problem={p} />
            ))}
          </ol>
        </div>
      </div>

      <div className="border-t border-line bg-surface p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="input min-h-[44px] flex-1 resize-none py-2.5 text-sm"
            rows={1}
            placeholder="Add an internal note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void addNote();
            }}
            aria-label="Internal note"
          />
          <button className="btn btn-primary size-11 shrink-0 p-0" disabled={busy || !note.trim()} onClick={addNote} aria-label="Add note" title="Add note (Ctrl+Enter)">
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function statusVar(s: Status) {
  return { new: 'new', in_progress: 'progress', resolved: 'resolved', dismissed: 'dismissed' }[s];
}

function primaryAction(status: Status) {
  if (status === 'new') return { to: 'in_progress', label: 'Start working on this', icon: Timer };
  if (status === 'in_progress') return { to: 'resolved', label: 'Mark as resolved', icon: CircleCheck };
  return { to: 'in_progress', label: 'Reopen', icon: RotateCcw };
}

function TimelineItem({ event: e, problem }: { event: ProblemEvent; problem: Problem }) {
  let icon = <CircleDot size={14} />;
  let tint = 'var(--ink-3)';
  let body: ReactNode;
  const who = <span className="font-semibold text-ink">{e.actor ?? 'Someone'}</span>;

  switch (e.kind) {
    case 'created':
      icon = <CircleDot size={14} />;
      tint = 'var(--st-new)';
      body = (
        <>
          Submitted {problem.author ? <>by {<span className="font-semibold text-ink">{problem.author}</span>}</> : 'anonymously'} to {problem.boxName}
        </>
      );
      break;
    case 'status':
      icon = e.to === 'resolved' ? <CircleCheck size={14} /> : e.to === 'dismissed' ? <Ban size={14} /> : <Timer size={14} />;
      tint = `var(--st-${statusVar(e.to)})`;
      body = (
        <>
          {who} moved this to <span className="font-semibold text-ink">{STATUS_LABEL[e.to]}</span>
        </>
      );
      break;
    case 'priority':
      body = (
        <>
          {who} changed priority to <span className="font-semibold text-ink">{PRIORITY_LABEL[e.to]}</span>
        </>
      );
      break;
    case 'category':
      icon = <Tag size={14} />;
      body = (
        <>
          {who} recategorised as <span className="font-semibold text-ink">{e.to}</span>
        </>
      );
      break;
    case 'note':
      icon = <MessageSquareText size={14} />;
      tint = 'var(--brand)';
      body = (
        <>
          {who} added a note
          <div className="mt-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[14px] whitespace-pre-wrap text-ink">{e.text}</div>
        </>
      );
      break;
  }

  return (
    <li className="relative flex gap-3">
      <span className="relative z-[1] grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface" style={{ color: tint }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-1 text-[13px] text-ink-2">
        {body}
        <div className="mt-0.5 text-xs text-ink-3" title={dateTime(e.at)}>
          {timeAgo(e.at)}
        </div>
      </div>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse p-5">
      <div className="mb-4 h-6 w-40 rounded-full bg-surface-3" />
      <div className="mb-2 h-6 w-4/5 rounded-lg bg-surface-3" />
      <div className="mb-6 h-4 w-1/2 rounded-lg bg-surface-3" />
      <div className="mb-2 h-4 w-full rounded-lg bg-surface-3" />
      <div className="h-4 w-3/4 rounded-lg bg-surface-3" />
    </div>
  );
}
