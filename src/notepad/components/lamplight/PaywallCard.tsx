import { Link } from 'react-router-dom';

export function PaywallCard() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-2xl mb-3" aria-hidden>🕯</div>
      <p
        className="text-sm max-w-sm mb-4"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        Lamplight is no longer included free.
      </p>
      <Link
        to="/contact"
        className="text-xs underline"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        Contact us for access
      </Link>
    </div>
  );
}
