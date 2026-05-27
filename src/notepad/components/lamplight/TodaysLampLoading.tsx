const LOADING_COPY = [
  'Reading your recent notes…',
  'Searching Scripture…',
  'Bringing them into conversation…',
] as const;

export interface TodaysLampLoadingProps {
  step: 0 | 1 | 2;
}

export function TodaysLampLoading({ step }: TodaysLampLoadingProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3 animate-pulse" aria-hidden>🕯</div>
      <p
        className="text-xs"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        role="status"
        aria-live="polite"
      >
        {LOADING_COPY[step]}
      </p>
    </div>
  );
}
