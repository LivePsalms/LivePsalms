import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  subscribe,
  type NewsletterClient,
  type SubscribeResult,
} from './newsletter-actions';
import {
  TextStaggerHover,
  TextStaggerHoverActive,
  TextStaggerHoverHidden,
} from '@/components/ui/text-stagger-hover';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function CommunityComingSoon() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    const result: SubscribeResult = await subscribe({
      email,
      source: 'community-coming-soon',
      client: supabase as unknown as NewsletterClient | null,
    });
    if (result.kind === 'success') {
      setAlreadySubscribed(result.alreadySubscribed);
      setStatus('success');
      return;
    }
    setStatus('error');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 md:px-8 py-32"
      style={{ background: 'var(--app-bg)' }}
      aria-label="Community feature — coming soon"
    >
      <div className="max-w-[640px] w-full text-center">
        <p
          className="text-mersi-dark"
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '11px',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'hsl(var(--mersi-dark) / 0.6)',
            margin: '0 0 24px',
          }}
        >
          Community
        </p>
        <h1
          className="text-mersi-dark"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 'clamp(36px, 5vw, 56px)',
            lineHeight: 1.15,
            margin: '0 0 20px',
          }}
        >
          Community Feature Coming Soon
        </h1>
        <p
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontSize: 'clamp(18px, 2vw, 22px)',
            lineHeight: 1.5,
            color: 'hsl(var(--mersi-dark) / 0.72)',
            maxWidth: '520px',
            margin: '0 auto 36px',
          }}
        >
          Sign up for our free newsletter to stay updated when new features release.
        </p>

        <div
          className="w-full max-w-[420px] mx-auto"
          aria-live="polite"
        >
          {status === 'success' ? (
            <p
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontStyle: 'italic',
                fontSize: '18px',
                color: 'hsl(var(--mersi-dark) / 0.85)',
                margin: 0,
              }}
            >
              {alreadySubscribed
                ? "You're already in."
                : 'Thanks — keep an eye on your inbox.'}
            </p>
          ) : (
            <>
              <form
                className="newsletter-form flex items-center gap-2"
                aria-label="Newsletter subscription"
                style={{
                  borderBottom: '1px solid hsl(var(--mersi-dark) / 0.22)',
                  paddingBottom: '8px',
                  transition: 'border-color 200ms ease-out',
                }}
                onSubmit={handleSubmit}
              >
                <label htmlFor="community-newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="community-newsletter-email"
                  ref={inputRef}
                  type="email"
                  name="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'submitting'}
                  className="flex-1 bg-transparent border-0 outline-0 disabled:opacity-50"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '13px',
                    color: 'hsl(var(--mersi-dark))',
                  }}
                />
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '10px',
                    letterSpacing: '0.24em',
                    padding: '8px 14px',
                    border: '1px solid hsl(var(--mersi-dark))',
                    background: 'transparent',
                    color: 'hsl(var(--mersi-dark))',
                    textTransform: 'uppercase',
                    cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                    opacity: status === 'submitting' ? 0.5 : 1,
                  }}
                >
                  {status === 'submitting' ? (
                    '…'
                  ) : (
                    <TextStaggerHover as="span">
                      <TextStaggerHoverActive animation="blur">Subscribe</TextStaggerHoverActive>
                      <TextStaggerHoverHidden animation="blur">Subscribe</TextStaggerHoverHidden>
                    </TextStaggerHover>
                  )}
                </button>
              </form>
              {status === 'error' && (
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
    </main>
  );
}
