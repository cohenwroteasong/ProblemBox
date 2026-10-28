import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shortDate } from '../../lib/format';

interface Point {
  date: string;
  received: number;
  resolved: number;
}

const TICK = { fill: 'var(--muted)', fontSize: 12 };
const HEIGHT = 260;

/** Received vs resolved per day. Two series on one shared count axis. */
export function TrendChart({ data, height = HEIGHT }: { data: Point[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.received, d.resolved)));
  const last = data[data.length - 1];
  // End labels only when they won't collide; otherwise the legend and tooltip carry the values.
  const endLabels = !!last && (Math.abs(last.received - last.resolved) / max) * (height - 40) >= 16;

  const endLabel = (key: 'received' | 'resolved') =>
    function EndLabel(props: { x?: number | string; y?: number | string; index?: number; value?: unknown }) {
      if (!endLabels || props.index !== data.length - 1) return null;
      return (
        <text x={Number(props.x) + 8} y={Number(props.y)} dy={4} fill="var(--ink-2)" fontSize={12} fontWeight={600} className="tnum">
          {String(props.value)}
          <title>{key}</title>
        </text>
      );
    };

  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            minTickGap={28}
            interval="preserveStartEnd"
            tickMargin={8}
          />
          <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={36} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }} isAnimationActive={false} />
          <Area
            type="monotone"
            dataKey="received"
            name="Received"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="var(--series-1)"
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--series-1)' }}
            label={endLabel('received')}
            animationDuration={500}
          />
          <Line
            type="monotone"
            dataKey="resolved"
            name="Resolved"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--series-2)' }}
            label={endLabel('resolved')}
            animationDuration={500}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  const rows = [
    { key: 'received', name: 'Received', color: 'var(--series-1)' },
    { key: 'resolved', name: 'Resolved', color: 'var(--series-2)' },
  ];
  return (
    <div className="min-w-[150px] rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] shadow-pop">
      <div className="mb-1.5 font-semibold">{new Date(`${label}T00:00:00`).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-2 text-ink-2">
            <span className="h-[3px] w-3 rounded-full" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="tnum font-semibold">{payload.find((p) => p.dataKey === r.key)?.value ?? 0}</span>
        </div>
      ))}
    </div>
  );
}
