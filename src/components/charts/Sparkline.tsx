/** Tiny trend line: de-emphasised history with the latest point in the accent. */
export function Sparkline({ values, width = 88, height = 32 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pad = 4;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke="var(--line-strong)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={3.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
