export type TodaysLampErrorReason = 'no_notes' | 'validators_failed' | 'network';

export interface TodaysLampErrorProps {
  reason: TodaysLampErrorReason;
  onRetry: () => void;
}

const ERROR_COPY: Record<TodaysLampErrorReason, { heading: string; body: string }> = {
  no_notes: {
    heading: 'Lamplight needs your notes to begin.',
    body: 'Write a few entries in the notepad and come back. Today’s lamp draws from what you’ve been writing.',
  },
  validators_failed: {
    heading: 'Lamplight had trouble lighting today.',
    body: 'Something didn’t come together this time. Try again in a moment.',
  },
  network: {
    heading: 'Couldn’t reach Lamplight just now.',
    body: 'Check your connection and try again.',
  },
};

export function TodaysLampError({ reason, onRetry }: TodaysLampErrorProps) {
  const copy = ERROR_COPY[reason];
  const showRetry = reason !== 'no_notes';
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3" aria-hidden>🕯</div>
      <h3
        className="text-base mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        {copy.heading}
      </h3>
      <p
        className="text-xs mb-4 max-w-[320px]"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        {copy.body}
      </p>
      {showRetry && (
        <button
          onClick={onRetry}
          className="text-[11px] underline cursor-pointer"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
