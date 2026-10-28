export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d="M8.5 10.5A2.5 2.5 0 0 1 11 8h10a2.5 2.5 0 0 1 2.5 2.5v7.5a2.5 2.5 0 0 1-2.5 2.5h-5.6l-4.3 3.5c-.55.45-1.35.05-1.35-.65V20.5A2.5 2.5 0 0 1 8.5 18z" fill="#fff" />
      <path d="M12.75 12.75v3.5M16 11.25v6.5M19.25 12.75v3.5" stroke="var(--brand)" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`text-[1.0625rem] font-bold tracking-tight ${light ? 'text-side-ink' : 'text-ink'}`}>Kontho</span>
    </span>
  );
}
