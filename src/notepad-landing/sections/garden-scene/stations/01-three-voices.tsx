// src/notepad-landing/sections/garden-scene/stations/01-three-voices.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationThreeVoices({ isActive }: Props) {
  const { eyebrow, h2, body, supporting } = copy.section02;
  return (
    <article
      id="section-02"
      className={`garden-station garden-station--three-voices${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <p className="supporting">{supporting}</p>
      </div>
    </article>
  );
}
