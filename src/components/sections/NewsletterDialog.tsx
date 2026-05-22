import { useId, useRef, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

interface NewsletterState {
  status: Status;
  alreadySubscribed: boolean;
}

interface NewsletterDialogProps {
  /** The element rendered as the dialog trigger. Passed through DialogTrigger asChild. */
  children: ReactNode;
  /** Subscribe-source label written to the newsletter_subscribers row. */
  source?: string;
}

export function NewsletterDialog({ children, source = 'restoration-cta' }: NewsletterDialogProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<NewsletterState>({ status: 'idle', alreadySubscribed: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.status === 'submitting') return;
    setState({ status: 'submitting', alreadySubscribed: false });
    const result: SubscribeResult = await subscribe({
      email,
      source,
      // Supabase's PostgrestFilterBuilder is thenable but not structurally
      // a Promise; the runtime shape matches NewsletterClient so we narrow it
      // here at the boundary. (Same cast as FinalReflectionCta.)
      client: supabase as unknown as NewsletterClient | null,
    });
    if (result.kind === 'success') {
      setState({ status: 'success', alreadySubscribed: result.alreadySubscribed });
      return;
    }
    setState({ status: 'error', alreadySubscribed: false });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // When the dialog closes, reset the form so the next open is fresh.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setEmail('');
      setState({ status: 'idle', alreadySubscribed: false });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(22px, 2.4vw, 28px)',
              lineHeight: 1.25,
            }}
          >
            Receive devotions in your inbox
          </DialogTitle>
          <DialogDescription
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'hsl(var(--mersi-dark) / 0.7)',
            }}
          >
            A short note from us each week.
          </DialogDescription>
        </DialogHeader>

        <div aria-live="polite">
          {state.status === 'success' ? (
            <p
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontStyle: 'italic',
                fontSize: '16px',
                color: 'hsl(var(--mersi-dark) / 0.78)',
                margin: 0,
              }}
            >
              {state.alreadySubscribed
                ? "You're already in."
                : 'Thanks — keep an eye on your inbox.'}
            </p>
          ) : (
            <form
              className="flex items-center gap-2"
              aria-label="Newsletter subscription"
              style={{
                borderBottom: '1px solid hsl(var(--mersi-dark) / 0.22)',
                paddingBottom: '8px',
              }}
              onSubmit={handleSubmit}
            >
              <label htmlFor={inputId} className="sr-only">
                Email address
              </label>
              <input
                id={inputId}
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
                  color: 'hsl(var(--mersi-dark) / 0.85)',
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
                {state.status === 'submitting' ? (
                  '…'
                ) : (
                  <TextStaggerHover as="span">
                    <TextStaggerHoverActive animation="blur">Subscribe</TextStaggerHoverActive>
                    <TextStaggerHoverHidden animation="blur">Subscribe</TextStaggerHoverHidden>
                  </TextStaggerHover>
                )}
              </button>
            </form>
          )}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
