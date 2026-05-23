// src/notepad-landing/sections/garden-scene/stations/06-tier-path.tsx
import { copy } from '../../../data/copy';

// Per spec §3.3 — 8 tier markers along the deep dolly path. These are
// reveal beats, intentionally low-fidelity placeholders pending the
// brand team's formal tier naming. Easy to swap for a richer list later.
const TIER_BEATS: readonly string[] = [
  'New Flame',
  'Steady Light',
  'Companion',
  'Witness',
  'Builder',
  'Anchor',
  'Pillar',
  'Glory',
];

interface Props {
  isActive: boolean;
  itemIndex: number; // 0..7
}

export function StationTierPath({ isActive, itemIndex }: Props) {
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
        <ol className="tier-list">
          {TIER_BEATS.map((name, i) => {
            const revealed = i <= itemIndex;
            return (
              <li
                key={name}
                className={`tier-item${revealed ? ' revealed' : ''}`}
                aria-hidden={revealed ? undefined : 'true'}
              >
                <span className="tier-numeral">{String(i + 1).padStart(2, '0')}</span>
                <span className="tier-name">{name}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}
