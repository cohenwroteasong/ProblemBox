import { Link } from 'react-router-dom';
import type { Problem } from '../../shared/types';
import { timeAgo } from '../lib/format';
import { BoxChip, PriorityBadge, PriorityBar, SimulatedTag, StatusBadge } from './Badges';

export function ProblemRow({
  problem: p,
  active = false,
  fresh = false,
  compact = false,
  search = '',
}: {
  problem: Problem;
  active?: boolean;
  fresh?: boolean;
  compact?: boolean;
  /** Query string to keep when opening the problem (inbox filters). */
  search?: string;
}) {
  return (
    <Link
      to={`/inbox/${p.id}${search}`}
      className={`group relative flex gap-3 px-4 py-3 transition-colors ${fresh ? 'animate-pop animate-arrive' : ''} ${
        active ? 'bg-brand-soft' : 'hover:bg-surface-2'
      }`}
      aria-current={active ? 'true' : undefined}
    >
      <PriorityBar priority={p.priority} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className={`min-w-0 text-[14px] leading-snug font-semibold ${compact ? 'truncate' : 'line-clamp-2'} ${p.status === 'resolved' || p.status === 'dismissed' ? 'text-ink-2' : 'text-ink'}`}>
            {p.title}
          </p>
          <span className="shrink-0 pt-px text-xs whitespace-nowrap text-ink-3">{timeAgo(p.createdAt)}</span>
        </div>
        {!compact && p.body && <p className="mt-0.5 truncate text-[13px] text-ink-3">{p.body}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <StatusBadge status={p.status} size="sm" />
          {(p.priority === 'urgent' || p.priority === 'high') && <PriorityBadge priority={p.priority} size="sm" />}
          <BoxChip name={p.boxName} color={p.boxColor} className="max-w-[160px]" />
          {!compact && <span className="text-xs text-ink-3">{p.category}</span>}
          {p.source === 'demo' && <SimulatedTag />}
        </div>
      </div>
    </Link>
  );
}
