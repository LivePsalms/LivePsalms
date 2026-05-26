import { Link } from 'react-router-dom';

export function SignInGate() {
  return (
    <div
      className="relative flex items-center justify-center min-h-[420px] px-6"
      style={{ background: 'linear-gradient(180deg, var(--plaster) 0%, var(--alabaster) 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ filter: 'blur(8px)', opacity: 0.4 }}>
        <div className="p-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--silica)' }}>
            Today's Lamp
          </div>
          <div className="text-base leading-relaxed" style={{ color: 'var(--deep-umber)' }}>
            "You've been writing about waiting. Three notes mention Psalm 27…"
          </div>
        </div>
      </div>
      <div
        className="relative z-10 max-w-sm w-full text-center px-6 py-6 rounded-lg"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div className="text-2xl mb-2" aria-hidden>🕯</div>
        <h3
          className="text-base mb-1"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
        >
          Today's Lamp is waiting for you.
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
          Sign in to begin.
        </p>
        <div className="flex gap-2 justify-center mb-3">
          <Link
            to="/login"
            className="px-4 py-2 text-xs rounded transition-colors"
            style={{
              background: 'var(--deep-umber)',
              color: 'var(--alabaster)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 text-xs rounded transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid var(--pale-stone)',
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Sign up
          </Link>
        </div>
        <a
          href="https://livepsalms.com/privacy#lamplight"
          target="_blank"
          rel="noreferrer"
          aria-label="Lamplight privacy details"
          className="text-[10px] underline"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Why sign in?
        </a>
      </div>
    </div>
  );
}
