/** The Kontho mark: ক with a voice line, on an Ink tile. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return <img src="/brand/kontho-mark.svg" width={size} height={size} alt="" aria-hidden className="shrink-0 rounded-[22%]" />;
}

/** Horizontal logo; `reversed` is the Cream version for Ink grounds. */
export function Logo({ reversed = false, height = 30 }: { reversed?: boolean; height?: number }) {
  return (
    <img
      src={reversed ? '/brand/kontho-logo-horizontal-reversed.svg' : '/brand/kontho-logo-horizontal.svg'}
      alt="Kontho (কণ্ঠ)"
      style={{ height, width: 'auto' }}
      className="block shrink-0 self-start"
    />
  );
}
