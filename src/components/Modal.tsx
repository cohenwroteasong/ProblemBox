import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({ title, onClose, children, footer, width = 480 }: { title: string; onClose(): void; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="animate-pop w-full rounded-t-2xl border border-line bg-surface shadow-pop sm:rounded-2xl" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <h2 className="text-base font-bold">{title}</h2>
          <button data-close className="btn btn-ghost btn-sm -mr-2 px-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pt-2 pb-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
