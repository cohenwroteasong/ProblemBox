import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Sparkline } from './charts/Sparkline';

export function StatTile({
  label,
  value,
  delta,
  upIsGood = true,
  hint,
  trend,
  icon,
}: {
  label: string;
  value: ReactNode;
  /** Relative change vs the previous period, e.g. 0.12 for +12%. */
  delta?: number | null;
  /** null = the direction is neither good nor bad, so the delta stays neutral. */
  upIsGood?: boolean | null;
  hint?: ReactNode;
  trend?: number[];
  icon?: ReactNode;
}) {
  const good = delta == null || upIsGood === null || Math.abs(delta) < 0.005 ? null : delta > 0 === upIsGood;
  return (
    <div className="card flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[1.75rem] leading-none font-bold tracking-tight">{value}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {delta != null && (
              <span
                className="inline-flex items-center gap-0.5 font-semibold"
                style={{ color: good === null ? 'var(--ink-3)' : good ? 'var(--st-resolved)' : 'var(--pr-urgent)' }}
              >
                {delta >= 0 ? <ArrowUpRight size={13} strokeWidth={2.5} /> : <ArrowDownRight size={13} strokeWidth={2.5} />}
                {Math.abs(Math.round(delta * 100))}%
              </span>
            )}
            {hint && <span className="text-ink-3">{hint}</span>}
          </div>
        </div>
        {trend && trend.length > 1 && (
          <span className="hidden sm:block">
            <Sparkline values={trend} />
          </span>
        )}
      </div>
    </div>
  );
}
