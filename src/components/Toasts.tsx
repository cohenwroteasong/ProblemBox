import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLive } from '../lib/live';

export function Toasts() {
  const { toasts, dismiss } = useLive();
  const navigate = useNavigate();
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-24 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.key}
          className="animate-toast pointer-events-auto relative overflow-hidden rounded-[18px] border shadow-[var(--shadow-pop)]"
          style={
            t.tone === 'amber'
              ? { background: 'var(--amber)', color: 'var(--ink)', borderColor: 'var(--amber)' }
              : t.tone === 'mint'
                ? { background: 'var(--ink)', color: 'var(--cream)', borderColor: 'var(--mint)' }
                : { background: 'var(--surface)', color: 'var(--fg)', borderColor: 'var(--line)' }
          }
        >
          <button
            className="block w-full p-4 pr-11 text-left"
            onClick={() => {
              dismiss(t.key);
              if (t.href) navigate(t.href);
            }}
          >
            <div className="mb-1 flex items-center gap-2 text-xs font-bold tracking-[0.12em] uppercase" style={{ color: t.tone === 'mint' ? 'var(--mint)' : 'inherit', opacity: t.tone === 'plain' ? 0.7 : 1 }}>
              <span className="live-dot" style={t.tone === 'amber' ? { background: 'var(--ink)' } : undefined} aria-hidden />
              {t.eyebrow}
            </div>
            <p className="line-clamp-2 font-display text-[17px] leading-snug font-extrabold tracking-tight">{t.title}</p>
            {t.body && <p className="mt-0.5 truncate text-sm opacity-75">{t.body}</p>}
          </button>
          <button className="absolute top-3 right-3 grid size-8 place-items-center rounded-full opacity-60 hover:opacity-100" onClick={() => dismiss(t.key)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
