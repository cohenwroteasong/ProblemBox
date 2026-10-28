import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLive } from '../lib/live';
import { BoxChip, PriorityBadge } from './Badges';

export function Toasts() {
  const { toasts, dismissToast } = useLive();
  const navigate = useNavigate();

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map(({ key, problem }) => (
        <div key={key} className="animate-toast pointer-events-auto relative overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <button
            className="block w-full p-3.5 pr-10 text-left"
            onClick={() => {
              dismissToast(key);
              navigate(`/inbox/${problem.id}`);
            }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="live-dot" aria-hidden />
              <span className="text-xs font-semibold text-ink-2">New problem</span>
              <span className="text-ink-3">·</span>
              <BoxChip name={problem.boxName} color={problem.boxColor} />
            </div>
            <p className="line-clamp-2 text-sm leading-snug font-semibold">{problem.title}</p>
            {(problem.priority === 'urgent' || problem.priority === 'high') && (
              <div className="mt-2">
                <PriorityBadge priority={problem.priority} size="sm" />
              </div>
            )}
          </button>
          <button className="absolute top-2.5 right-2.5 rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink" onClick={() => dismissToast(key)} aria-label="Dismiss">
            <X size={15} />
          </button>
          <span className="absolute bottom-0 left-0 h-0.5 bg-brand" style={{ animation: 'toast-timer 6.5s linear both' }} />
        </div>
      ))}
      <style>{`@keyframes toast-timer { from { width: 100% } to { width: 0 } }`}</style>
    </div>
  );
}
