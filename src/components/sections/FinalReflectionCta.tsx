import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  subscribe,
  type NewsletterClient,
  type SubscribeResult,
} from './newsletter-actions';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface NewsletterState {
  status: Status;
  alreadySubscribed: boolean;
}

export function FinalReflectionCta() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<NewsletterState>({
    status: 'idle',
    alreadySubscribed: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.status === 'submitting') return;
    setState({ status: 'submitting', alreadySubscribed: false });
    const result: SubscribeResult = await subscribe({
      email,
      source: 'home-final-cta',
      // Supabase's PostgrestFilterBuilder is thenable but not structurally
      // a Promise; the runtime shape matches NewsletterClient so we narrow it
      // here at the boundary.
      client: supabase as unknown as NewsletterClient | null,
    });
    if (result.kind === 'success') {
      setState({ status: 'success', alreadySubscribed: result.alreadySubscribed });
      return;
    }
    setState({ status: 'error', alreadySubscribed: false });
    // Refocus the input so the user can correct and retry.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <section
      className="final-reflection-cta py-32 md:py-40 px-4 md:px-8"
      style={{ background: 'var(--app-bg)' }}
      aria-label="Final reflection"
    >
      <div className="max-w-[720px]">
        <p
          className="text-mersi-dark"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 'clamp(28px, 4vw, 44px)',
            lineHeight: 1.22,
            margin: '0 0 14px',
          }}
        >
          God's been revealing things to you all along.
        </p>
        <p
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontSize: 'clamp(18px, 2vw, 22px)',
            lineHeight: 1.45,
            color: 'hsla(var(--mersi-dark), 0.72)',
            maxWidth: '600px',
            margin: '0 0 28px',
          }}
        >
          In the verses you underlined, the prayers you wrote. Add your notes and journals here and see what He's been revealing about you — to you.
        </p>
        <Link
          to="/notepad"
          aria-label="Open your notepad"
          className="final-reflection-notepad-cta"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: '18px',
            color: 'hsl(var(--mersi-dark))',
            borderBottom: '1px solid currentColor',
            paddingBottom: '2px',
            textDecoration: 'none',
          }}
        >
          Open your notepad →
        </Link>

        <div
          className="final-reflection-newsletter flex flex-col gap-4 md:flex-row md:items-end md:gap-6"
          style={{
            marginTop: '48px',
            paddingTop: '24px',
            borderTop: '1px solid hsla(var(--mersi-dark), 0.22)',
          }}
        >
          <p
            className="flex-1"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'hsla(var(--mersi-dark), 0.7)',
              margin: 0,
            }}
          >
            Subscribe to our newsletter for more devotions and deep dives into God's word.
          </p>

          <div className="flex-[1.2]" aria-live="polite">
            {state.status === 'success' ? (
              <p
                style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '16px',
                  color: 'hsla(var(--mersi-dark), 0.78)',
                  margin: 0,
                }}
              >
                {state.alreadySubscribed
                  ? "You're already in."
                  : 'Thanks — keep an eye on your inbox.'}
              </p>
            ) : (
              <>
                <form
                  className="final-reflection-form flex items-center gap-2"
                  aria-label="Newsletter subscription"
                  style={{
                    borderBottom: '1px solid hsla(var(--mersi-dark), 0.22)',
                    paddingBottom: '8px',
                    transition: 'border-color 200ms ease-out',
                  }}
                  onSubmit={handleSubmit}
                >
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="newsletter-email"
                    ref={inputRef}
                    type="email"
                    name="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={state.status === 'submitting'}
                    className="flex-1 bg-transparent border-0 outline-0 disabled:opacity-50"
                    style={{
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '13px',
                      color: 'hsla(var(--mersi-dark), 0.85)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={state.status === 'submitting'}
                    style={{
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '10px',
                      letterSpacing: '0.24em',
                      padding: '8px 14px',
                      border: '1px solid hsl(var(--mersi-dark))',
                      background: 'transparent',
                      color: 'hsl(var(--mersi-dark))',
                      textTransform: 'uppercase',
                      cursor: state.status === 'submitting' ? 'not-allowed' : 'pointer',
                      opacity: state.status === 'submitting' ? 0.5 : 1,
                    }}
                  >
                    {state.status === 'submitting' ? '…' : 'Subscribe'}
                  </button>
                </form>
                {state.status === 'error' && (
                  <p
                    style={{
                      marginTop: '8px',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '11px',
                      color: 'hsl(var(--mersi-orange))',
                    }}
                  >
                    Try that again?
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
