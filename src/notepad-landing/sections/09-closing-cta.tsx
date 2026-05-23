import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';
import { mountParticleSystem } from '../three/particle-system';

interface ClosingCTAProps {
  prm: boolean;
}

export function ClosingCTA({ prm }: ClosingCTAProps) {
  const ref = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staged = useIntersectionStage(ref, { rootMargin: '0px 0px -20% 0px', threshold: 0.2 });
  const { h2, sub, ctaPrimary, ctaSecondary } = copy.section09;

  useEffect(() => {
    if (!staged || !canvasRef.current) return;
    const handle = mountParticleSystem(canvasRef.current, { prm });
    // Settle on the Journal shape (index 2)
    handle.setShape(2);
    return handle.cleanup;
  }, [prm, staged]);

  return (
    <section
      ref={ref}
      className={`section closing-cta${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec09-h2"
    >
      <canvas ref={canvasRef} className="closing-canvas" aria-hidden="true" />
      <div className="closing-content">
        <h2 id="sec09-h2">{h2}</h2>
        <p className="closing-sub">{sub}</p>
        <Link to="/notepad/notes" className="cta-primary closing-cta-primary">{ctaPrimary}</Link>
        <Link to="/login" className="closing-cta-secondary">{ctaSecondary}</Link>
      </div>
    </section>
  );
}
