import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TextStaggerHover,
  TextStaggerHoverActive,
  TextStaggerHoverHidden,
} from '@/components/ui/text-stagger-hover';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const FIELD_LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '10px',
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: 'hsl(var(--mersi-dark) / 0.55)',
  marginBottom: '6px',
  display: 'block',
};

const FIELD_INPUT_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '14px',
  color: 'hsl(var(--mersi-dark))',
  width: '100%',
  background: 'transparent',
  border: 0,
  outline: 0,
  padding: '6px 0 10px',
  borderBottom: '1px solid hsl(var(--mersi-dark) / 0.22)',
};

export function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    // Show the confirmation modal. No backend wiring requested.
    setStatus('success');
    setIsModalOpen(true);
  };

  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setName('');
      setEmail('');
      setSubject('');
      setStatus('idle');
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 md:px-8 py-32"
      style={{ background: 'var(--app-bg)' }}
      aria-label="Contact"
    >
      <div className="max-w-[640px] w-full text-center">
        <p
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '11px',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'hsl(var(--mersi-dark) / 0.6)',
            margin: '0 0 24px',
          }}
        >
          Contact
        </p>
        <h1
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 'clamp(28px, 3.6vw, 40px)',
            lineHeight: 1.3,
            color: 'hsl(var(--mersi-dark))',
            margin: '0 auto 40px',
            maxWidth: '560px',
          }}
        >
          Feel free to reach out to us with any Prayer Request or any questions.
          We'd love to hear from you and any feedback you have.
        </h1>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[480px] mx-auto text-left flex flex-col gap-6"
          aria-label="Contact form"
        >
          <div>
            <label htmlFor="contact-name" style={FIELD_LABEL_STYLE}>
              Name
            </label>
            <input
              id="contact-name"
              ref={nameInputRef}
              type="text"
              name="name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status === 'submitting'}
              style={FIELD_INPUT_STYLE}
            />
          </div>

          <div>
            <label htmlFor="contact-email" style={FIELD_LABEL_STYLE}>
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              name="email"
              required
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'submitting'}
              style={FIELD_INPUT_STYLE}
            />
          </div>

          <div>
            <label htmlFor="contact-subject" style={FIELD_LABEL_STYLE}>
              Subject
            </label>
            <textarea
              id="contact-subject"
              name="subject"
              required
              rows={4}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={status === 'submitting'}
              style={{
                ...FIELD_INPUT_STYLE,
                resize: 'vertical',
                minHeight: '96px',
              }}
            />
          </div>

          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={status === 'submitting'}
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '10px',
                letterSpacing: '0.24em',
                padding: '12px 28px',
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
                  <TextStaggerHoverActive animation="blur">Submit</TextStaggerHoverActive>
                  <TextStaggerHoverHidden animation="blur">Submit</TextStaggerHoverHidden>
                </TextStaggerHover>
              )}
            </button>
          </div>
        </form>
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleModalChange}>
        <DialogContent
          className="border-0 shadow-xl"
          style={{ background: 'var(--app-bg)' }}
        >
          <DialogTitle
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontWeight: 400,
              fontStyle: 'italic',
              fontSize: 'clamp(24px, 3vw, 32px)',
              lineHeight: 1.2,
              color: 'hsl(var(--mersi-dark))',
              textAlign: 'center',
              margin: '8px 0 16px',
            }}
          >
            Thank you for your support.
          </DialogTitle>
          <DialogDescription
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: '18px',
              lineHeight: 1.5,
              color: 'hsl(var(--mersi-dark) / 0.78)',
              textAlign: 'center',
              margin: '0 0 8px',
            }}
          >
            We will reach out to you as soon as we can. God Bless.
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </main>
  );
}
