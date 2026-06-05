import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface LivingGraphProps {
  prm: boolean;
}

export function LivingGraph({ prm }: LivingGraphProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, supporting, caption } = copy.section03;

  return (
    <section
      ref={ref}
      className={`section living-graph${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec03-h2"
    >
      <div className="living-graph-media">
        <video
          className="living-graph-video"
          autoPlay={!prm}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/notepad-landing/graph-poster.jpg"
          controls={prm}
          aria-label="The Live Psalms knowledge graph showing notes connected by shared scripture"
        >
          <source src="/notepad-landing/graph.webm" type="video/webm" />
          <source src="/notepad-landing/graph.mp4" type="video/mp4" />
        </video>
        <div className="living-graph-overlay">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="sec03-h2">{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
        </div>
        <p className="living-graph-caption">{caption}</p>
      </div>
    </section>
  );
}
