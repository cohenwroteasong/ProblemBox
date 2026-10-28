/** The verification funnel: how received answers became verified ones. */
export function Funnel({ steps }: { steps: { label: string; count: number; note: string }[] }) {
  const max = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">
              <span className="mr-2 inline-grid size-5 place-items-center rounded-full text-[11px] font-bold" style={{ background: i === steps.length - 1 ? 'var(--amber)' : 'var(--off-bg)', color: 'var(--ink)' }}>
                {i + 1}
              </span>
              {s.label}
            </span>
            <span className="tnum font-display text-lg font-extrabold">{s.count.toLocaleString('en-IN')}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--off-bg)' }}>
            <span className="animate-bar block h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: i === steps.length - 1 ? 'var(--amber)' : 'var(--fg)' }} />
          </div>
          {s.note && i > 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {s.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
