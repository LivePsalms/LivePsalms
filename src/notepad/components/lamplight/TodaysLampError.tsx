import { emptyStateInsufficientNotes, generationFailedToast } from '../../lamplight/lamplight-copy';

export type TodaysLampErrorReason = 'no_notes' | 'validators_failed' | 'network';

export interface TodaysLampErrorProps {
  reason: TodaysLampErrorReason;
  firstName: string | null;
  onRetry: () => void;
}

function copyFor(reason: TodaysLampErrorReason, firstName: string | null): { heading: string; body: string } {
  if (reason === 'no_notes') {
    return {
      heading: 'Lamplight needs your notes to begin.',
      body: emptyStateInsufficientNotes(firstName),
    };
  }
  if (reason === 'validators_failed') {
    return {
      heading: 'Lamplight had trouble lighting today.',
      body: generationFailedToast(firstName),
    };
  }
  return {
    heading: 'Couldn’t reach Lamplight just now.',
    body: generationFailedToast(firstName),
  };
}

export function TodaysLampError({ reason, firstName, onRetry }: TodaysLampErrorProps) {
  const copy = copyFor(reason, firstName);
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
