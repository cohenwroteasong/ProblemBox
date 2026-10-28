export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; count?: number }[]; onChange(v: T): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            type="button"
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors"
            style={active ? { background: 'var(--fg)', color: 'var(--bg)' } : { color: 'var(--muted)' }}
          >
            {o.label}
            {o.count !== undefined && <span className="tnum opacity-70">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
