import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface SevenPapersProps {
  prm: boolean;
}

export function SevenPapers({ prm }: SevenPapersProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body } = copy.section06;

  return (
    <section
      ref={ref}
      className={`section seven-papers${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec06-h2"
    >
      <div className="seven-papers-content">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec06-h2">{h2}</h2>
        <p className="body">{body}</p>

        <div className="seven-papers-media">
          <video
            className="seven-papers-feature-video"
            autoPlay={!prm}
            muted
            loop
            playsInline
            preload="metadata"
            poster="/notepad-highlight-deco-feature-poster.jpg"
            controls={prm}
            aria-label="The Notepad's spiritual canvas — textured ink highlights and hand-drawn marks placed directly on a note."
          >
            <source src="/notepad-highlight-deco-feature.webm" type="video/webm" />
            <source src="/notepad-highlight-deco-feature.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
