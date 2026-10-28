import { useState, type ReactNode } from 'react';

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  /** Shown after the value at the bar tip, e.g. "· 4 open". */
  aside?: ReactNode;
  tooltip?: ReactNode;
}

/** Horizontal bars, one series: every bar the same colour, value at the tip. */
export function BarList({
  rows,
  color = 'var(--series-1)',
  labelWidth = 136,
  reserve = 48,
}: {
  rows: BarRow[];
  color?: string;
  labelWidth?: number;
  /** Pixels kept free after the longest bar for its value label. */
  reserve?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [hover, setHover] = useState<string | null>(null);

  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li
          key={r.key}
          tabIndex={0}
          onMouseEnter={() => setHover(r.key)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(r.key)}
          onBlur={() => setHover(null)}
          className="group relative flex min-h-9 items-center gap-3 rounded-lg px-1 outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
        >
          <span className="truncate text-[13px] text-ink" style={{ width: labelWidth, flexShrink: 0 }}>
            {r.label}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="h-3 shrink-0 rounded-r-[4px] transition-[width] duration-500"
              style={{ width: `calc((100% - ${reserve}px) * ${r.value / max})`, minWidth: r.value > 0 ? 3 : 0, background: color }}
            />
            <span className="tnum shrink-0 text-[13px] font-semibold whitespace-nowrap">
              {r.value}
              {r.aside && <span className="ml-1 font-normal text-ink-3">{r.aside}</span>}
            </span>
          </span>
          {hover === r.key && r.tooltip && (
            <div className="animate-fade pointer-events-none absolute bottom-full left-1/3 z-10 mb-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] whitespace-nowrap shadow-pop">{r.tooltip}</div>
          )}
        </li>
      ))}
    </ul>
  );
}
