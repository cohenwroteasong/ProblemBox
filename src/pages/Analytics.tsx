import { Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Analytics as Data, Box } from '../../shared/types';
import { PriorityBadge } from '../components/Badges';
import { BarList } from '../components/charts/BarList';
import { ChartCard, LegendItem } from '../components/charts/ChartCard';
import { Heatmap } from '../components/charts/Heatmap';
import { TrendChart } from '../components/charts/TrendChart';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { StatTile } from '../components/StatTile';
import { PRIORITY_LABEL, change, duration, percent, shortDate } from '../lib/format';
import { useLive } from '../lib/live';
import { useFetch } from '../lib/useFetch';

const tz = new Date().getTimezoneOffset();
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function Analytics() {
  const [range, setRange] = useState(30);
  const [box, setBox] = useState('');
  const { tick } = useLive();
  const boxes = useFetch<{ boxes: Box[] }>('/boxes');
  const { data, reload, loading } = useFetch<Data>(`/analytics?range=${range}&tz=${tz}${box ? `&box=${box}` : ''}`);

  useEffect(() => {
    if (tick) void reload();
  }, [tick, reload]);

  const k = data?.kpis;
  const totals = useMemo(() => (data?.daily ?? []).reduce((a, d) => ({ received: a.received + d.received, resolved: a.resolved + d.resolved }), { received: 0, resolved: 0 }), [data]);
  const insights = useMemo(() => (data ? buildInsights(data) : []), [data]);
  const periodLabel = `vs previous ${range} days`;

  return (
    <div className="animate-rise">
      <PageHeader title="Analytics" subtitle="How many problems are coming in, where from, and how quickly your team is resolving them." />

      {/* One filter row scopes every chart on the page. */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<number>
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: 7, label: '7 days' },
            { value: 30, label: '30 days' },
            { value: 90, label: '90 days' },
          ]}
        />
        <select className="input input-sm w-auto min-w-[180px]" value={box} onChange={(e) => setBox(e.target.value)} aria-label="Box">
          <option value="">All boxes</option>
          {boxes.data?.boxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {loading && data && <span className="text-xs text-ink-3">Updating…</span>}
      </div>

      <div className={`transition-opacity ${loading && data ? 'opacity-70' : ''}`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
          <StatTile label="Received" value={k?.received ?? '—'} delta={k ? change(k.received, k.receivedPrev) : null} upIsGood={null} hint={periodLabel} />
          <StatTile label="Resolved" value={k?.resolved ?? '—'} delta={k ? change(k.resolved, k.resolvedPrev) : null} hint={periodLabel} />
          <StatTile
            label="Clearance rate"
            value={k ? percent(k.clearanceRate) : '—'}
            delta={k ? change(k.clearanceRate, k.clearanceRatePrev) : null}
            hint={k?.clearanceRate == null ? undefined : k.clearanceRate >= 1 ? 'backlog shrinking' : 'backlog growing'}
          />
          <StatTile
            label="Median time to resolve"
            value={k ? duration(k.medianResolveHours) : '—'}
            delta={k ? change(k.medianResolveHours, k.medianResolveHoursPrev) : null}
            upIsGood={false}
            hint={periodLabel}
          />
          <StatTile
            label="Median first response"
            value={k ? duration(k.medianFirstResponseHours) : '—'}
            delta={k ? change(k.medianFirstResponseHours, k.medianFirstResponseHoursPrev) : null}
            upIsGood={false}
            hint={periodLabel}
          />
        </div>

        {insights.length > 0 && (
          <section className="card mt-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Lightbulb size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold">What stands out</h2>
              <ul className="mt-2 grid gap-x-8 gap-y-1.5 text-sm text-ink-2 lg:grid-cols-2">
                {insights.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <ChartCard
          className="mt-4"
          title="Received vs resolved"
          subtitle={`Per day, last ${range} days`}
          legend={
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <LegendItem color="var(--series-1)" label="Received" value={totals.received} />
              <LegendItem color="var(--series-2)" label="Resolved" value={totals.resolved} />
            </div>
          }
          table={{ columns: ['Day', 'Received', 'Resolved'], rows: (data?.daily ?? []).map((d) => [shortDate(d.date), d.received, d.resolved]) }}
        >
          {data ? <TrendChart data={data.daily} height={280} /> : <div className="h-[280px] animate-pulse rounded-xl bg-surface-2" />}
        </ChartCard>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="By category"
            subtitle={`Problems received in the last ${range} days`}
            table={{ columns: ['Category', 'Received', 'Still open'], rows: (data?.byCategory ?? []).map((c) => [c.category, c.count, c.open]) }}
          >
            {data && data.byCategory.length === 0 ? (
              <Empty />
            ) : (
              <BarList
                reserve={96}
                rows={(data?.byCategory ?? []).map((c) => ({
                  key: c.category,
                  label: c.category,
                  value: c.count,
                  aside: c.open ? `· ${c.open} open` : undefined,
                  tooltip: (
                    <>
                      <span className="font-semibold">{c.category}</span> · {c.count} received · {c.open} still open
                    </>
                  ),
                }))}
              />
            )}
          </ChartCard>

          <ChartCard
            title="By box"
            subtitle="Where problems are reported"
            table={{ columns: ['Box', 'Received', 'Open', 'Resolved'], rows: (data?.byBox ?? []).map((b) => [b.name, b.count, b.open, b.resolved]) }}
          >
            {data && data.byBox.every((b) => b.count === 0) ? (
              <Empty />
            ) : (
              <BarList
                reserve={140}
                labelWidth={128}
                rows={(data?.byBox ?? []).map((b) => ({
                  key: String(b.boxId),
                  label: (
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: b.color }} />
                      <span className="truncate">{b.name}</span>
                    </span>
                  ),
                  value: b.count,
                  aside: b.count ? `· ${Math.round((b.resolved / b.count) * 100)}% done` : undefined,
                  tooltip: (
                    <>
                      <span className="font-semibold">{b.name}</span> · {b.count} received · {b.open} open · {b.resolved} resolved
                    </>
                  ),
                }))}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Busiest times"
            subtitle="When problems are submitted (your local time)"
            table={{
              columns: ['Day', 'Busiest hour', 'Received'],
              rows: (data?.heatmap ?? []).map((row, d) => {
                const max = Math.max(...row);
                return [DAYS[d], max ? `${row.indexOf(max)}:00` : '—', row.reduce((a, b) => a + b, 0)];
              }),
            }}
          >
            {data ? <Heatmap grid={data.heatmap} /> : <div className="h-[200px] animate-pulse rounded-xl bg-surface-2" />}
          </ChartCard>

          <ChartCard
            title="Open backlog by priority"
            subtitle="Everything not yet resolved or dismissed, right now"
            table={{ columns: ['Priority', 'Open'], rows: (data?.backlogByPriority ?? []).map((p) => [PRIORITY_LABEL[p.priority], p.count]) }}
          >
            <BarList
              labelWidth={96}
              rows={(data?.backlogByPriority ?? []).map((p) => ({
                key: p.priority,
                label: <PriorityBadge priority={p.priority} size="sm" />,
                value: p.count,
                tooltip: (
                  <>
                    <span className="font-semibold">{PRIORITY_LABEL[p.priority]}</span> · {p.count} open
                  </>
                ),
              }))}
            />
            {k && (
              <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-2">
                <span className="font-semibold text-ink">{k.openNow}</span> open in total, <span className="font-semibold text-ink">{k.newNow}</span> not picked up yet.
              </p>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-10 text-center text-sm text-ink-3">No problems in this period.</p>;
}

function buildInsights(d: Data): string[] {
  const out: string[] = [];
  const k = d.kpis;
  const total = d.byCategory.reduce((a, c) => a + c.count, 0);
  if (total > 0 && d.byCategory[0]) {
    const top = d.byCategory[0];
    out.push(`${top.category} is the most reported category — ${Math.round((top.count / total) * 100)}% of everything received.`);
  }
  if (k.clearanceRate !== null) {
    out.push(
      k.clearanceRate >= 1
        ? `You resolved ${percent(k.clearanceRate)} as many problems as came in, so the backlog is shrinking.`
        : `You resolved ${percent(k.clearanceRate)} as many problems as came in, so the backlog grew by ${k.received - k.resolved}.`,
    );
  }
  const r = change(k.medianResolveHours, k.medianResolveHoursPrev);
  if (r !== null && Math.abs(r) >= 0.05) {
    out.push(`Problems are being resolved ${Math.abs(Math.round(r * 100))}% ${r < 0 ? 'faster' : 'slower'} than the previous period (median ${duration(k.medianResolveHours)}).`);
  }
  let best = { d: 0, h: 0, v: 0 };
  d.heatmap.forEach((row, di) => row.forEach((v, h) => v > best.v && (best = { d: di, h, v })));
  if (best.v > 0) out.push(`The busiest hour is ${DAYS[best.d]} around ${best.h % 12 || 12}${best.h < 12 ? 'am' : 'pm'}.`);
  const peak = d.daily.reduce((a, b) => (b.received > a.received ? b : a), d.daily[0]);
  if (peak && peak.received > 0) out.push(`The busiest day was ${shortDate(peak.date)} with ${peak.received} problems.`);
  if (k.urgentOpen > 0) out.push(`${k.urgentOpen} urgent problem${k.urgentOpen === 1 ? ' is' : 's are'} still open.`);
  return out;
}
