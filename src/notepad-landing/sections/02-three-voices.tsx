import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface ThreeVoicesProps {
  prm: boolean;
}

export function ThreeVoices({ prm }: ThreeVoicesProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, supporting } = copy.section02;

  return (
    <section
      ref={ref}
      id="section-02"
      className={`section three-voices${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec02-h2"
    >
      <div className="section-grid">
        <div className="section-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="sec02-h2">{h2}</h2>
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
            poster="/notepad-landing/notepad-poster.jpg"
            controls={prm}
            aria-label="The Live Psalms Notepad UI showing devotion, sermon, and theme writing modes"
          >
            <source src="/notepad-landing/notepad.webm" type="video/webm" />
            <source src="/notepad-landing/notepad.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
