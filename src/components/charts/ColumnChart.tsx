import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const TICK = { fill: 'var(--muted)', fontSize: 12 };

/** A single-series column chart (one colour), with a hover tooltip. */
export function ColumnChart({
  data,
  color,
  height = 220,
  format = (v: number) => String(v),
  tickFormat = (l: string) => l,
  unit,
}: {
  data: { label: string; value: number }[];
  color: string;
  height?: number;
  format?: (v: number) => string;
  tickFormat?: (l: string) => string;
  unit: string;
}) {
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickFormatter={tickFormat} tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={16} interval="preserveStartEnd" tickMargin={8} />
          <YAxis allowDecimals={false} tickFormatter={(v: number) => format(v)} tick={TICK} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: 'color-mix(in srgb, var(--fg) 6%, transparent)' }}
            isAnimationActive={false}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-pop)]">
                  <div className="font-semibold">{tickFormat(String(label))}</div>
                  <div className="tnum" style={{ color: 'var(--muted)' }}>
                    {format(Number(payload[0].value))} {unit}
                  </div>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
