import { Link } from 'react-router-dom';
import type { LamplightVoice, LamplightTradition } from '../../storage/lamplight-adapter';

export interface OptedInPlaceholderProps {
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
}

export function OptedInPlaceholder({
  voicePreference,
  traditionHint,
}: OptedInPlaceholderProps) {
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
        You're set up.
      </h3>
      <p
        className="text-xs mb-3"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Lamplight will appear here when ready.
      </p>
      <p
        className="text-[11px] mb-1"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', opacity: 0.7 }}
      >
        {`Voice: ${voicePreference}`}
      </p>
      <p
        className="text-[11px] mb-4"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', opacity: 0.7 }}
      >
        {`Tradition: ${traditionHint}`}
      </p>
      <Link
        to="/profile"
        className="text-[11px] underline"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        Edit preferences →
      </Link>
    </div>
  );
}
