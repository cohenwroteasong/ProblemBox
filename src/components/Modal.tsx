import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({ title, onClose, children, footer, width = 460, theme }: { title: string; onClose(): void; children: ReactNode; footer?: ReactNode; width?: number; theme: 't-player' | 't-org' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])')?.focus();
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
    <div className={`${theme} animate-fade fixed inset-0 z-50 flex items-end justify-center !bg-black/50 sm:items-center sm:p-4`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="animate-pop w-full rounded-t-[22px] border border-line bg-surface text-fg shadow-[var(--shadow-pop)] sm:rounded-[22px]" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl">{title}</h2>
          <button data-close className="btn btn-quiet btn-sm -mr-3 px-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pt-3 pb-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
