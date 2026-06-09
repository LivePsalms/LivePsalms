import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

export function TrustImport() {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, supporting, lines } = copy.section08;

  return (
    <section
      ref={ref}
      className={`section trust-import${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec08-h2"
    >
      <div className="trust-content">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec08-h2">{h2}</h2>
        <p className="supporting trust-built">{supporting}</p>
        <ul className="trust-triptych">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
