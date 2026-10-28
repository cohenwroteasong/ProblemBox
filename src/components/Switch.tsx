export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange(v: boolean): void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: checked ? 'var(--amber)' : 'var(--off-bg)' }}
    >
      <span className="inline-block size-5 rounded-full shadow transition-transform" style={{ background: checked ? 'var(--ink)' : 'var(--cream)', transform: `translateX(${checked ? 24 : 4}px)` }} />
    </button>
  );
}
