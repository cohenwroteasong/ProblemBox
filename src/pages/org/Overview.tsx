import { ArrowRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Answer, OrgOverview as Data, User } from '../../../shared/types';
import { Switch } from '../../components/Switch';
import { VoiceWave } from '../../components/VoiceWave';
import { api } from '../../lib/api';
import { useAuth, useUser } from '../../lib/auth';
import { dateShort, greeting, num, pct, timeAgo, timeLeft, tk } from '../../lib/format';
import { useLive, useLiveReload } from '../../lib/live';
import { useFetch } from '../../lib/useFetch';
import { StatusPill } from './parts';

export function OrgOverview() {
  const user = useUser();
  const { data, reload } = useFetch<Data>('/org/overview');
  useLiveReload(reload);
  const k = data?.kpis;
  const sample = data?.boxes.some((b) => b.sample);

  return (
    <div className="animate-rise flex flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Organisation console</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">Every Box you run, the verified answers coming in right now, and what Bangladesh is telling you.</p>
        </div>
        <div className="flex items-center gap-3">
          {sample && <span className="sticker sticker-pink">Sample data</span>}
          <Link to="/org/new" className="btn btn-primary">
            <Plus size={18} /> New Box
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Live Boxes" value={k ? String(k.live) : '—'} sub="answering right now" />
        <Kpi label="Verified today" value={k ? num(k.verifiedToday) : '—'} sub="answers that passed every check" />
        <Kpi label="Verified answers" value={k ? num(k.verifiedTotal) : '—'} sub={k ? `of ${num(k.received)} received · ${pct(k.received ? k.verifiedTotal / k.received : null)} passed` : ''} />
        <Kpi label="Divisions heard" value={k ? `${k.divisions} / 8` : '—'} sub="Hear Bangladesh, not just Dhaka" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="text-xl">Your Boxes</h2>
            <span className="text-sm text-muted">{data ? `${data.boxes.length} in total` : ''}</span>
          </header>
          <ul className="divide-y divide-line border-t border-line">
            {!data && <li className="h-64 animate-pulse" />}
            {data?.boxes.map((b) => (
              <li key={b.id}>
                <Link to={`/org/boxes/${b.id}`} className="grid gap-3 px-6 py-4 hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_200px_110px_20px] md:items-center">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusPill status={b.status} />
                      <span className="text-xs text-muted">{b.topic}</span>
                      {b.sample && <span className="example">Sample</span>}
                    </div>
                    <p className="truncate font-display text-lg font-extrabold">{b.title}</p>
                    <p className="text-sm text-muted">
                      {b.status === 'live' ? timeLeft(b.closesAt) : b.status === 'closed' && b.closedAt ? `Closed ${dateShort(b.closedAt)}` : 'Draft · not launched yet'} · {tk(b.pool)} pool
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted">Verified quota</span>
                      <span className="tnum font-semibold">
                        {num(b.verified)} / {num(b.target)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-off">
                      <span className="block h-full rounded-full bg-amber transition-[width] duration-700" style={{ width: `${Math.min(1, b.verified / b.target) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-sm md:text-right">
                    <span className="tnum font-semibold">{pct(b.passRate)}</span> <span className="text-muted">passed</span>
                  </div>
                  <ArrowRight size={16} className="hidden text-muted md:block" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <LiveFeed initial={data?.recent ?? []} />
      </div>
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="eyebrow !text-muted">{label}</p>
      <p className="tnum mt-2 font-display text-4xl leading-none font-extrabold">{value}</p>
      {sub && <p className="mt-2 text-[13px] text-muted">{sub}</p>}
    </div>
  );
}

/** Verified answers, newest first. New ones pop in as players submit. */
export function LiveFeed({ initial, boxId, title = 'Verified answers, live' }: { initial: Answer[]; boxId?: number; title?: string }) {
  const user = useUser();
  const { setUser } = useAuth();
  const { answers, freshAnswers, connected } = useLive();
  const [saving, setSaving] = useState(false);

  const feed = useMemo(() => {
    const seen = new Set<number>();
    return [...answers.filter((a) => boxId === undefined || a.boxId === boxId), ...initial]
      .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);
  }, [answers, initial, boxId]);

  async function toggle(on: boolean) {
    setSaving(true);
    try {
      const r = await api<{ user: User }>('/me', { method: 'PATCH', body: { demoFeed: on } });
      setUser(r.user);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card flex flex-col overflow-hidden">
      <header className="px-6 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl">
            <span className="live-dot" data-off={!connected} aria-hidden />
            {title}
          </h2>
          <VoiceWave bars={9} height={22} className="w-16 !text-amber" />
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-3 py-2 text-sm">
          <span className="text-muted">Simulate sample players answering</span>
          <Switch checked={user.demoFeed} onChange={toggle} disabled={saving} label="Simulate sample players answering" />
        </label>
      </header>
      {feed.length === 0 ? (
        <p className="border-t border-line px-6 py-10 text-center text-sm text-muted">Waiting for the first verified answer. Answers appear here the moment they pass every check.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {feed.map((a) => (
            <li key={a.id} className={`px-6 py-4 ${freshAnswers.has(a.id) ? 'animate-pop animate-arrive' : ''}`}>
              <p className="text-[15px] leading-snug">“{a.idea}”</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {a.themeLabel && <span className="pill bg-warn-soft !font-semibold text-[var(--amber-text-light)]">{a.themeLabel}</span>}
                <span>
                  {a.division} · {a.gender === 'Prefer not to say' ? 'Gender not given' : a.gender} · {a.ageBand}
                </span>
                <span>· {timeAgo(a.createdAt)}</span>
              </div>
              {boxId === undefined && <p className="mt-1 truncate text-xs font-semibold">{a.boxTitle}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
