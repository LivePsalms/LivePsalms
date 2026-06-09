// src/notepad-landing/sections/garden-scene/stations/06-tier-path.tsx
import { copy } from '../../../data/copy';

interface Props {
  isActive: boolean;
}

export function StationTierPath({ isActive }: Props) {
  const { eyebrow, h2, supporting, body, pullQuote } = copy.section07;
  return (
    <article
      id="section-07"
      className={`garden-station garden-station--tier-path${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair">
        <div className="tier-path-image-wrap">
          <img
            className="tier-path-image"
            src="/spark_tier_image.png"
            alt="An example tier card — Spark — with its anchor verse, Psalm 27:1: The Lord is my light and my salvation."
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="garden-station-content garden-station-content--right">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="supporting">{supporting}</p>
          <p className="body">{body}</p>
          <blockquote className="tier-pullquote">{pullQuote}</blockquote>
        </div>
      </div>
    </article>
  );
}
