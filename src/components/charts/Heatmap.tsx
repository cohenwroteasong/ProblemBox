import { useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STEPS = 6;

function hourLabel(h: number) {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

/** Weekday × hour grid on a single-hue sequential ramp. */
export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const step = (v: number) => (v === 0 ? 0 : Math.min(STEPS, Math.ceil((v / max) * STEPS)));

  return (
    <div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: '30px repeat(24, minmax(0, 1fr))' }} onMouseLeave={() => setHover(null)}>
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <div className="flex items-center text-[11px] text-ink-3">{DAYS[d]}</div>
            {row.map((v, h) => (
              <div
                key={h}
                onMouseEnter={() => setHover({ d, h })}
                className="relative aspect-square min-h-2.5 rounded-[3px] transition-transform hover:z-10 hover:scale-125"
                style={{ background: `var(--heat-${step(v)})`, outline: hover?.d === d && hover.h === h ? '2px solid var(--ink)' : undefined }}
                aria-label={`${DAYS[d]} ${hourLabel(h)}: ${v} problems`}
              />
            ))}
          </div>
        ))}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="pt-1 text-center text-[10px] text-ink-3">
            {h % 3 === 0 ? hourLabel(h) : ''}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
        <span className="min-h-4 text-ink-2">
          {hover ? (
            <>
              <span className="font-semibold text-ink">{DAYS[hover.d]}</span> {hourLabel(hover.h)}–{hourLabel((hover.h + 1) % 24)} ·{' '}
              <span className="tnum font-semibold text-ink">{grid[hover.d][hover.h]}</span> received
            </>
          ) : (
            'Hover a cell for the count'
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          Fewer
          {Array.from({ length: STEPS + 1 }, (_, i) => (
            <span key={i} className="size-3 rounded-[3px]" style={{ background: `var(--heat-${i})` }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
