import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface ScriptureMarginProps {
  prm: boolean;
}

export function ScriptureMargin({ prm }: ScriptureMarginProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, supporting } = copy.section05;

  return (
    <section
      ref={ref}
      className={`section scripture-margin${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec05-h2"
    >
      <div className="section-grid">
        <div className="section-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="sec05-h2">{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
        </div>
        <div className="section-media">
          <video
            className="section-video"
            autoPlay={!prm}
            muted
            loop
            playsInline
            preload="metadata"
            poster="/notepad-landing/templates/t1-poster.jpg"
            controls={prm}
            aria-label="Closeup of scripture hover-preview inside the notepad"
          >
            <source src="/notepad-landing/templates/t1.webm" type="video/webm" />
            <source src="/notepad-landing/templates/t1.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
