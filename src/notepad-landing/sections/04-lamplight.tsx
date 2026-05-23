import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface LamplightProps {
  prm: boolean;
}

export function Lamplight({ prm: _prm }: LamplightProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, cards, trust } = copy.section04;

  return (
    <section
      ref={ref}
      className={`section lamplight${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec04-h2"
    >
      <div className="lamplight-content">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec04-h2">{h2}</h2>
        <p className="body lamplight-body">{body}</p>

        <div className="lamplight-cards">
          {cards.map((card) => (
            <article key={card.title} className="lamplight-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>

        <p className="lamplight-trust">{trust}</p>
      </div>
    </section>
  );
}
