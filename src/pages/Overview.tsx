import { ArrowRight, Bell, CircleCheck, Clock, ExternalLink, Inbox, Package, Plus, Radio, Share2, Sparkles, Timer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Analytics, Box, Problem, ProblemList, User } from '../../shared/types';
import { BoxFormModal } from '../components/BoxFormModal';
import { ChartCard, LegendItem } from '../components/charts/ChartCard';
import { TrendChart } from '../components/charts/TrendChart';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ProblemRow } from '../components/ProblemRow';
import { StatTile } from '../components/StatTile';
import { Switch } from '../components/Switch';
import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { change, duration, greeting, shortDate } from '../lib/format';
import { useLive } from '../lib/live';
import { useFetch } from '../lib/useFetch';

const tz = new Date().getTimezoneOffset();

export function Overview() {
  const user = useUser();
  const { tick } = useLive();
  const boxes = useFetch<{ boxes: Box[] }>('/boxes');
  const week = useFetch<Analytics>(`/analytics?range=7&tz=${tz}`);
  const fortnight = useFetch<Analytics>(`/analytics?range=14&tz=${tz}`);
  const attention = useFetch<ProblemList>('/problems?status=open&priority=urgent,high&sort=priority&limit=5');
  const recent = useFetch<ProblemList>('/problems?limit=8');

  useEffect(() => {
    if (!tick) return;
    void week.reload();
    void fortnight.reload();
    void attention.reload();
    void recent.reload();
    void boxes.reload();
  }, [tick, week.reload, fortnight.reload, attention.reload, recent.reload, boxes.reload]);

  const firstName = user.name.split(' ')[0];

  if (boxes.data && boxes.data.boxes.length === 0) {
    return <Welcome user={user} onCreated={() => boxes.reload()} />;
  }

  const k = week.data?.kpis;
  const daily = fortnight.data?.daily ?? [];
  const totals = daily.reduce((a, d) => ({ received: a.received + d.received, resolved: a.resolved + d.resolved }), { received: 0, resolved: 0 });

  return (
    <div className="animate-rise">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={
          <>
            Here’s what people are telling {user.org ? <span className="font-medium text-ink">{user.org}</span> : 'you'} right now.
          </>
        }
        actions={
          <>
            <Link to="/boxes" className="btn btn-secondary">
              <Share2 size={16} /> Share a box
            </Link>
            <Link to="/inbox?status=new" className="btn btn-primary">
              <Inbox size={16} /> Open inbox
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Open problems" value={k?.openNow ?? '—'} hint={k ? `${k.newNow} not picked up yet` : undefined} icon={<Inbox size={16} />} />
        <StatTile
          label="Received · 7 days"
          value={k?.received ?? '—'}
          delta={k ? change(k.received, k.receivedPrev) : null}
          upIsGood={null}
          hint="vs prior week"
          trend={daily.map((d) => d.received)}
        />
        <StatTile
          label="Resolved · 7 days"
          value={k?.resolved ?? '—'}
          delta={k ? change(k.resolved, k.resolvedPrev) : null}
          hint="vs prior week"
          trend={daily.map((d) => d.resolved)}
          icon={<CircleCheck size={16} />}
        />
        <StatTile
          label="Median time to resolve"
          value={k ? duration(k.medianResolveHours) : '—'}
          delta={k ? change(k.medianResolveHours, k.medianResolveHoursPrev) : null}
          upIsGood={false}
          hint={k ? `first reply in ${duration(k.medianFirstResponseHours)}` : undefined}
          icon={<Clock size={16} />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ChartCard
            title="Received vs resolved"
            subtitle="Last 14 days"
            legend={
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <LegendItem color="var(--series-1)" label="Received" value={totals.received} />
                <LegendItem color="var(--series-2)" label="Resolved" value={totals.resolved} />
              </div>
            }
            table={{ columns: ['Day', 'Received', 'Resolved'], rows: daily.map((d) => [shortDate(d.date), d.received, d.resolved]) }}
            action={
              <Link to="/analytics" className="btn btn-ghost btn-sm">
                Analytics <ArrowRight size={14} />
              </Link>
            }
          >
            {daily.length ? <TrendChart data={daily} height={240} /> : <div className="h-[240px] animate-pulse rounded-xl bg-surface-2" />}
          </ChartCard>

          <section className="card overflow-hidden">
            <header className="flex items-center justify-between px-5 pt-4 pb-3">
              <div>
                <h2 className="text-[15px] font-bold">Needs attention</h2>
                <p className="mt-0.5 text-[13px] text-ink-3">Open urgent and high-priority problems, longest waiting first</p>
              </div>
              <Link to="/inbox?status=open&priority=urgent,high&sort=priority" className="btn btn-ghost btn-sm">
                View all <ArrowRight size={14} />
              </Link>
            </header>
            {attention.data && attention.data.items.length === 0 ? (
              <EmptyState icon={<CircleCheck size={22} />} title="Nothing urgent">
                Every urgent and high-priority problem has been handled. Nice.
              </EmptyState>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {(attention.data?.items ?? []).map((p) => (
                  <ProblemRow key={p.id} problem={p} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <LiveFeed recent={recent.data?.items ?? []} />
          <BoxesSummary boxes={boxes.data?.boxes ?? []} />
        </div>
      </div>
    </div>
  );
}

function LiveFeed({ recent }: { recent: Problem[] }) {
  const user = useUser();
  const { setUser } = useAuth();
  const { arrivals, fresh, connected, popups, setPopups } = useLive();
  const [saving, setSaving] = useState(false);

  const feed = useMemo(() => {
    const seen = new Set<number>();
    return [...arrivals, ...recent]
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
  }, [arrivals, recent]);

  async function toggleDemo(on: boolean) {
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
      <header className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <span className="live-dot" data-off={!connected} aria-hidden />
            Live feed
          </h2>
          <span className="text-xs text-ink-3">{connected ? 'Listening' : 'Reconnecting…'}</span>
        </div>
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-2.5">
          <label className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 text-ink-2">
              <Sparkles size={14} className="text-brand" />
              Simulate incoming problems
            </span>
            <Switch checked={user.demoFeed} onChange={toggleDemo} disabled={saving} label="Simulate incoming problems" />
          </label>
          <label className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 text-ink-2">
              <Bell size={14} className="text-brand" />
              Pop-up for each new problem
            </span>
            <Switch checked={popups} onChange={setPopups} label="Pop-up notifications" />
          </label>
        </div>
      </header>
      {feed.length === 0 ? (
        <EmptyState icon={<Radio size={22} />} title="Waiting for the first problem">
          Share a box link — submissions appear here the second they’re sent.
        </EmptyState>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {feed.map((p) => (
            <ProblemRow key={p.id} problem={p} fresh={fresh.has(p.id)} compact />
          ))}
        </div>
      )}
    </section>
  );
}

function BoxesSummary({ boxes }: { boxes: Box[] }) {
  const first = boxes.find((b) => b.isOpen);
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-bold">Problem boxes</h2>
        <Link to="/boxes" className="btn btn-ghost btn-sm">
          Manage <ArrowRight size={14} />
        </Link>
      </header>
      <ul className="divide-y divide-line border-t border-line">
        {boxes.map((b) => (
          <li key={b.id}>
            <Link to={`/inbox?box=${b.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{b.name}</span>
              {!b.isOpen && <span className="text-[11px] font-semibold text-ink-3 uppercase">Closed</span>}
              <span className="tnum text-[13px] text-ink-2">
                <span className="font-semibold text-ink">{b.open}</span> open
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {first && (
        <div className="border-t border-line bg-surface-2 px-5 py-3 text-[13px] text-ink-2">
          <span className="font-semibold text-ink">Try it:</span> open{' '}
          <a href={`/b/${first.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
            {first.name}’s public page <ExternalLink size={12} />
          </a>{' '}
          in another tab, send a problem, and watch it pop up here.
        </div>
      )}
    </section>
  );
}

function Welcome({ user, onCreated }: { user: User; onCreated(): void }) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSample() {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ user: User }>('/sample-data', { body: {} });
      setUser(r.user);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sample data.');
      setLoading(false);
    }
  }

  const steps = [
    { icon: Package, title: 'Create a problem box', text: 'One per topic or place — facilities, IT, a branch office, a product.' },
    { icon: Share2, title: 'Share its link', text: 'Post it on a notice board, in a group chat or behind a QR code. No sign-up needed to report.' },
    { icon: Timer, title: 'Watch problems arrive', text: 'Each one pops into your live inbox. Triage, resolve and track response times.' },
  ];

  return (
    <div className="animate-rise">
      <PageHeader title={`Welcome to Kontho, ${user.name.split(' ')[0]}`} subtitle="Let’s get your first problem box live." />
      <div className="card overflow-hidden">
        <div className="grid gap-px bg-line md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="bg-surface p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <s.icon size={19} />
                </span>
                <span className="eyebrow">Step {i + 1}</span>
              </div>
              <h3 className="text-[15px] font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-start gap-3 border-t border-line bg-surface-2 p-6 sm:flex-row sm:items-center">
          <button className="btn btn-primary h-11" onClick={() => setCreating(true)}>
            <Plus size={17} /> Create your first box
          </button>
          <button className="btn btn-secondary h-11" onClick={loadSample} disabled={loading}>
            <Sparkles size={16} /> {loading ? 'Loading sample data…' : 'Explore with sample data'}
          </button>
          {error && <p className="text-[13px] font-medium text-[var(--pr-urgent)]">{error}</p>}
        </div>
      </div>
      {creating && (
        <BoxFormModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            onCreated();
            navigate('/boxes');
          }}
        />
      )}
    </div>
  );
}
