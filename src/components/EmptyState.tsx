import type { ReactNode } from 'react';

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</div>
      <h3 className="text-[15px] font-bold">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
