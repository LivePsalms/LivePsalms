export interface OptedOutCardProps {
  onChangeMind: () => void;
}

export function OptedOutCard({ onChangeMind }: OptedOutCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-2xl mb-2 opacity-50" aria-hidden>🕯</div>
      <h3
        className="text-base mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)', opacity: 0.85 }}
      >
        Lamplight is off.
      </h3>
      <p
        className="text-xs mb-4"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Your notes remain private. Nothing is being analyzed.
      </p>
      <button
        type="button"
        onClick={onChangeMind}
        className="text-xs underline"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        Change your mind? Turn on Lamplight →
      </button>
    </div>
  );
}
