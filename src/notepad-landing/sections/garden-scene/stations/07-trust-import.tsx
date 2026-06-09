// src/notepad-landing/sections/garden-scene/stations/07-trust-import.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationTrustImport({ isActive }: Props) {
  const { eyebrow, h2, supporting, lines } = copy.section08;
  return (
    <article
      id="section-08"
      className={`garden-station garden-station--trust-import${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="supporting">{supporting}</p>
        <ul className="trust-lines">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </article>
  );
}
