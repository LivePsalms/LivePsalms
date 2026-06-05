import { useEffect, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface SevenPapersProps {
  prm: boolean;
}

const AUTO_ADVANCE_MS = 5000;

export function SevenPapers({ prm }: SevenPapersProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const { eyebrow, h2, body, papers } = copy.section06;

  useEffect(() => {
    if (prm || !staged) return;
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % papers.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [prm, staged, papers.length]);

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

        <div className="paper-stage">
          {papers.map((paper, i) => (
            <video
              key={paper.name + i}
              className={`paper-clip${i === activeIdx ? ' is-active' : ''}`}
              autoPlay={!prm}
              muted
              loop
              playsInline
              preload="metadata"
              poster={`${paper.clip}-poster.jpg`}
              aria-hidden={i !== activeIdx}
            >
              <source src={`${paper.clip}.webm`} type="video/webm" />
              <source src={`${paper.clip}.mp4`} type="video/mp4" />
            </video>
          ))}
        </div>

        <div className="paper-label" aria-live="polite">
          <p className="paper-name">{papers[activeIdx].name}</p>
          <p className="paper-blurb">{papers[activeIdx].blurb}</p>
        </div>

        <div className="paper-dots" role="tablist" aria-label="Choose a paper style">
          {papers.map((paper, i) => (
            <button
              key={paper.name}
              role="tab"
              aria-selected={i === activeIdx}
              aria-label={paper.name}
              className={`paper-dot${i === activeIdx ? ' is-active' : ''}`}
              onClick={() => setActiveIdx(i)}
              type="button"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
