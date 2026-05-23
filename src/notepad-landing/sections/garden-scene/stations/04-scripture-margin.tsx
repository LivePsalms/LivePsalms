// src/notepad-landing/sections/garden-scene/stations/04-scripture-margin.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationScriptureMargin({ isActive }: Props) {
  const { eyebrow, h2, body, supporting } = copy.section05;
  return (
    <article
      id="section-05"
      className={`garden-station garden-station--scripture-margin${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair">
        <div className="garden-station-content garden-station-content--right">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
        </div>
        <div className="scripture-margin-video-wrap">
          <video
            className="scripture-margin-video"
            poster="/notepad-landing/verses-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="The Notepad with inline scripture references — typing a verse reference makes it a live, clickable link inside the prose."
          >
            <source src="/notepad-landing/verses.webm" type="video/webm" />
            <source src="/notepad-landing/verses.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
