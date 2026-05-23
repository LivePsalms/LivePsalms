// src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationLivingGraph({ isActive }: Props) {
  const { eyebrow, h2, body, supporting, caption } = copy.section03;
  return (
    <article
      id="section-03"
      className={`garden-station garden-station--living-graph${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair">
        <div className="garden-station-content garden-station-content--left">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
          <p className="caption">{caption}</p>
        </div>
        <div className="living-graph-video-wrap">
          <video
            className="living-graph-video"
            poster="/notepad-landing/graph-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="The Notepad Living Graph in motion — nodes representing scriptures and notes connect as the user navigates them."
          >
            <source src="/notepad-landing/graph.webm" type="video/webm" />
            <source src="/notepad-landing/graph.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
