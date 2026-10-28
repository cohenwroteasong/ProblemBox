export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange(v: T): void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-[11px] border border-line bg-surface-3/60 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${active ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'}`}
          >
            {o.label}
            {o.count !== undefined && <span className={`tnum text-xs ${active ? 'text-ink-2' : 'text-ink-3'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
