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
      <div className="scripture-margin-content">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec05-h2">{h2}</h2>
        <p className="body">{body}</p>
        <p className="supporting">{supporting}</p>

        <div className="scripture-margin-media">
          <video
            className="scripture-margin-feature-video"
            autoPlay={!prm}
            muted
            loop
            playsInline
            preload="metadata"
            poster="/notepad-bible-study-video-poster.jpg"
            controls={prm}
            aria-label="Personal Bible study inside the Notepad — opening a passage, searching to a verse, and asking about it with your own notes in hand."
          >
            <source src="/notepad-bible-study-video.webm" type="video/webm" />
            <source src="/notepad-bible-study-video.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
