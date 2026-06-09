import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

export function ScriptureMargin() {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, supporting } = copy.section05;

  return (
    <section
      ref={ref}
      className={`section scripture-margin${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec05-h2"
    >
      <div className="scripture-margin-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec05-h2">{h2}</h2>
        <p className="body">{body}</p>
        <p className="supporting">{supporting}</p>
      </div>
    </section>
  );
}
