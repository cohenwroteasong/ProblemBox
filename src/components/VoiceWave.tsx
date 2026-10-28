const HEIGHTS = [0.25, 0.5, 0.8, 0.45, 1, 0.6, 0.35, 0.75, 0.95, 0.5, 0.3, 0.65, 0.85, 0.4, 0.6, 0.25, 0.7, 0.45];

/** The website's voice wave: amber bars rippling, used as a quiet "live" accent. */
export function VoiceWave({ bars = 18, height = 56, className = '' }: { bars?: number; height?: number; className?: string }) {
  return (
    <div className={`voicewave ${className}`} style={{ height }} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} style={{ ['--h' as string]: HEIGHTS[i % HEIGHTS.length], ['--d' as string]: i }} />
      ))}
    </div>
  );
}
