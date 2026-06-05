export interface ConsentCardProps {
  onTurnOn: () => void;
  onMaybeLater: () => void;
}

export function ConsentCard({ onTurnOn, onMaybeLater }: ConsentCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 py-10 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3" aria-hidden>🕯</div>
      <h3
        className="text-xl mb-3"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        Welcome the lamp.
      </h3>
      <p
        className="text-sm max-w-md leading-relaxed mb-4"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        A quiet companion that draws a daily devotion from your own journey.
        It reads only your notes, cites every verse, and never trains on your data.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onTurnOn}
          className="px-4 py-2 text-xs rounded"
          style={{
            background: 'var(--deep-umber)', color: 'var(--alabaster)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          Turn on Lamplight
        </button>
        <button
          type="button"
          onClick={onMaybeLater}
          className="px-4 py-2 text-xs rounded"
          style={{
            background: 'transparent',
            border: '1px solid var(--pale-stone)',
            color: 'var(--deep-umber)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
