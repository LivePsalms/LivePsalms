// src/notepad-landing/sections/garden-scene/stations/03-lamplight.tsx
import { copy } from '../../../data/copy';

interface Props { isActive: boolean }

export function StationLamplight({ isActive }: Props) {
  const { eyebrow, h2, body, cards, trust } = copy.section04;
  return (
    <article
      id="section-04"
      className={`garden-station garden-station--lamplight${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-content garden-station-content--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{h2}</h2>
        <p className="body">{body}</p>
        <ul className="lamplight-cards">
          {cards.map((c) => (
            <li key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
        <p className="trust">{trust}</p>
      </div>
    </article>
  );
}
