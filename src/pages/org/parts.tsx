import { CircleCheck, CircleDashed } from 'lucide-react';
import type { BoxStatus } from '../../../shared/types';

/** Box state, always as an icon plus a word. */
export function StatusPill({ status }: { status: BoxStatus }) {
  if (status === 'live')
    return (
      <span className="pill bg-good-soft text-good">
        <span className="live-dot" aria-hidden /> Live
      </span>
    );
  if (status === 'draft')
    return (
      <span className="pill bg-off text-muted">
        <CircleDashed size={12} /> Draft
      </span>
    );
  return (
    <span className="pill border border-line-strong text-fg">
      <CircleCheck size={12} /> Closed
    </span>
  );
}
