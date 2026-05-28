import { loadingState } from '../../lamplight/lamplight-copy';

export interface TodaysLampLoadingProps {
  step: 0 | 1 | 2;
  firstName: string | null;
}

export function TodaysLampLoading({ step, firstName }: TodaysLampLoadingProps) {
  const copyByStep: Record<0 | 1 | 2, string> = {
    0: 'Reading your recent notes…',
    1: 'Searching Scripture…',
    2: loadingState(firstName),
  };
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
        {copyByStep[step]}
      </p>
    </div>
  );
}
