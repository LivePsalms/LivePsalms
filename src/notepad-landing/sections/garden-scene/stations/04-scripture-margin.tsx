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
      <div className="garden-station-content garden-station-content--right">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <p className="supporting">{supporting}</p>
      </div>
    </article>
  );
}
