export function ConnectionCardsLoading() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[280px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div
        className="text-2xl mb-3 animate-pulse motion-reduce:animate-none"
        aria-hidden
      >
        🕯
      </div>
      <p
        className="text-xs"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        role="status"
        aria-live="polite"
      >
        Lamplight is reading this note…
      </p>
    </div>
  );
}
