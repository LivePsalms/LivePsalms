import { useState } from 'react';
import { Link } from 'react-router-dom';

const BENEFITS: { icon: string; label: string; text: string }[] = [
  { icon: '🕯', label: "Today's Lamp", text: 'a piece of Scripture and a short reflection, drawn from your recent notes' },
  { icon: '💬', label: 'Reflective chat', text: 'ask about the passage and follow the thread, grounded in Scripture and your own notes' },
  { icon: '🔗', label: 'Connection Cards', text: 'see the threads linking your notes together' },
  { icon: '☁️', label: 'Saved & synced', text: 'your notepad travels with you across devices' },
  { icon: '🔒', label: 'Yours alone', text: 'your writing stays private to you' },
];

export function SignInGate() {
  const [showBenefits, setShowBenefits] = useState(false);

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
            className="inline-flex items-center justify-center px-4 py-2 text-xs rounded transition-colors"
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
            className="inline-flex items-center justify-center px-4 py-2 text-xs rounded transition-colors"
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
        <button
          type="button"
          onClick={() => setShowBenefits((v) => !v)}
          aria-expanded={showBenefits}
          aria-controls="signin-benefits"
          className="text-[10px] underline cursor-pointer bg-transparent border-0"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Why sign in?
        </button>
        {showBenefits && (
          <ul
            id="signin-benefits"
            className="mt-3 pt-3 text-left space-y-2 list-none"
            style={{ borderTop: '1px solid var(--pale-stone)' }}
          >
            {BENEFITS.map((b) => (
              <li key={b.label} className="text-[11px] leading-relaxed flex gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <span aria-hidden className="shrink-0">{b.icon}</span>
                <span style={{ color: 'var(--silica)' }}>
                  <span style={{ color: 'var(--deep-umber)', fontWeight: 600 }}>{b.label}</span> — {b.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
