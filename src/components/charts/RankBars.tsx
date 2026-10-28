import type { ThemeResult } from '../../../shared/types';
import { pct } from '../../lib/format';

/**
 * Idea themes ranked by how many verified answers fell in each, as on the
 * website's sample report: the #1 theme in amber, the rest quiet, with the
 * rank points each answer in that theme earns.
 */
export function RankBars({ themes, mine, showPoints = true }: { themes: ThemeResult[]; mine?: string | null; showPoints?: boolean }) {
  const max = Math.max(1, ...themes.map((t) => t.count));
  return (
    <ol className="flex flex-col gap-4">
      {themes.map((t) => {
        const top = t.rank === 1 && t.count > 0 && t.id !== 'other';
        const isMine = mine !== undefined && mine !== null && t.label === mine;
        return (
          <li key={t.id} className={isMine ? '-mx-3 rounded-2xl px-3 py-2' : ''} style={isMine ? { background: 'color-mix(in srgb, var(--amber) 14%, transparent)' } : undefined}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <b
                  className="grid size-6 shrink-0 place-items-center rounded-full text-xs"
                  style={top ? { background: 'var(--amber)', color: 'var(--ink)' } : { background: 'var(--off-bg)', color: 'var(--fg)' }}
                >
                  {t.id === 'other' ? '·' : t.rank}
                </b>
                <span className="min-w-0">{t.label}</span>
                {isMine && <span className="sticker sticker-flat !px-2 !py-0.5 !text-[11px]">Your idea</span>}
              </span>
              <span className="tnum flex items-center gap-2 text-sm whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                {pct(t.share)} · {t.count.toLocaleString('en-IN')}
                {showPoints && (
                  <span className="rounded-full border px-2 text-xs font-semibold" style={{ borderColor: 'var(--line-strong)', color: 'var(--fg)' }}>
                    {t.points} pt{t.points === 1 ? '' : 's'}
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full" style={{ background: 'var(--off-bg)' }}>
              <span className="animate-bar block h-full rounded-full" style={{ width: `${(t.count / max) * 100}%`, background: top ? 'var(--amber)' : 'var(--line-strong)' }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
