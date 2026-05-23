// src/notepad-landing/sections/garden-scene/stations/06-tier-path.tsx
import { copy } from '../../../data/copy';

interface Props {
  isActive: boolean;
}

export function StationTierPath({ isActive }: Props) {
  const { eyebrow, h2, body, pullQuote, bodyContinued } = copy.section07;
  return (
    <article
      id="section-07"
      className={`garden-station garden-station--tier-path${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <blockquote className="tier-pullquote">{pullQuote}</blockquote>
        <p className="body">{bodyContinued}</p>
      </div>
    </article>
  );
}
