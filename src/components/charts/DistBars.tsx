import { useState } from 'react';
import type { Distribution } from '../../../shared/types';
import { pct } from '../../lib/format';

/** One series of horizontal bars, every bar the same colour, share at the tip. */
export function DistBars({ rows, color = 'var(--fg)', labelWidth = 170 }: { rows: Distribution[]; color?: string; labelWidth?: number }) {
  const max = Math.max(0.0001, ...rows.map((r) => r.share));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li
          key={r.label}
          tabIndex={0}
          onMouseEnter={() => setHover(r.label)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(r.label)}
          onBlur={() => setHover(null)}
          className="relative grid min-h-8 items-center gap-3 rounded-lg outline-none"
          style={{ gridTemplateColumns: `minmax(0, ${labelWidth}px) minmax(0, 1fr)` }}
        >
          <span className="truncate text-sm">{r.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="animate-bar h-3 shrink-0 rounded-r-[4px]" style={{ width: `calc((100% - 52px) * ${r.share / max})`, minWidth: r.count ? 2 : 0, background: color }} />
            <span className="tnum shrink-0 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              {pct(r.share)}
            </span>
          </span>
          {hover === r.label && (
            <span className="animate-fade pointer-events-none absolute bottom-full left-1/3 z-10 mb-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs whitespace-nowrap shadow-[var(--shadow-pop)]">
              <b>{r.label}</b> · {r.count.toLocaleString('en-IN')} answers · {pct(r.share)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
