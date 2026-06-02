import { useEffect } from 'react';

interface LegalPageProps {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  children: React.ReactNode;
}

const TITLE_STYLE: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontStyle: 'italic',
  fontWeight: 500,
  fontSize: 'clamp(2rem, 5vw, 3rem)',
  lineHeight: 1.1,
  color: 'hsl(var(--mersi-dark))',
  margin: 0,
};

const META_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '11px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'hsl(var(--mersi-dark) / 0.55)',
  marginTop: '14px',
};

export function LegalPage({ title, effectiveDate, lastUpdated, children }: LegalPageProps) {
  useEffect(() => {
    document.title = `${title} — Live Psalms`;
    window.scrollTo?.(0, 0);
  }, [title]);

  return (
    <main
      className="min-h-screen px-6 md:px-8 pt-32 pb-24"
      style={{ background: 'var(--app-bg)' }}
      aria-label={title}
    >
      <div className="max-w-[760px] mx-auto w-full">
        <header className="mb-12">
          <h1 style={TITLE_STYLE}>{title}</h1>
          <p style={META_STYLE}>
            Effective Date: {effectiveDate} · Last Updated: {lastUpdated}
          </p>
        </header>
        <div className="legal-prose">{children}</div>
      </div>
    </main>
  );
}
