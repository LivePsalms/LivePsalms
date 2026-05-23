// src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx
import { copy } from '../../../data/copy';

interface Props {
  isActive: boolean;
}

export function StationSevenPapers({ isActive }: Props) {
  const { eyebrow, h2, body } = copy.section06;
  return (
    <article
      id="section-06"
      className={`garden-station garden-station--seven-papers${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
      </div>
    </article>
  );
}
