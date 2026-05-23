// src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx
import { Link } from 'react-router-dom';
import { copy } from '../../../data/copy';

interface Props {
  isActive: boolean;
  itemIndex: number; // 0..6 — which paper has been "revealed" so far
}

export function StationSevenPapers({ isActive, itemIndex }: Props) {
  const { eyebrow, h2, body, papers } = copy.section06;
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
        <ol className="seven-papers-list">
          {papers.map((paper, i) => {
            const revealed = i <= itemIndex;
            return (
              <li
                key={paper.name}
                className={`seven-papers-item${revealed ? ' revealed' : ''}`}
                aria-hidden={revealed ? undefined : 'true'}
              >
                <Link to={paper.clip} className="seven-papers-link">
                  <span className="seven-papers-name">{paper.name}</span>
                  <span className="seven-papers-blurb">{paper.blurb}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}
