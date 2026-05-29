import { categoryLabel } from '@/data/projects';
import { devotions } from '@/data/devotions';
import type { Project } from '@/types';

const overlayLabelById: Record<string, string> = {
  peace: 'Restoration of Peace',
  hope: 'Restoration of Hope',
  strength: 'Restoration of Strength',
  wholeness: 'Restoration of Wholeness',
  purpose: 'Restoration of Purpose',
  connection: 'Restoration of Connection',
  identity: 'Restoration of Identity',
  joy: 'Restoration of Joy',
  forgiveness: 'Serenity of Forgiveness',
  surrender: 'Serenity of Surrender',
  trust: 'Serenity of Trust',
};

export interface MobileProjectTileProps {
  project: Project;
  index: number;
  onProjectClick: (project: Project) => void;
}

export function MobileProjectTile({
  project,
  index,
  onProjectClick,
}: MobileProjectTileProps) {
  const devotion = devotions[project.id];
  const eyebrow = categoryLabel[project.category];
  const title = devotion?.title ?? overlayLabelById[project.id] ?? eyebrow;
  const scripture = devotion?.scriptureRef ?? null;
  const order: 'text-image' | 'image-text' = index % 2 === 0 ? 'text-image' : 'image-text';

  const ariaLabel = scripture
    ? `${eyebrow} — ${title}, ${scripture}`
    : `${eyebrow} — ${title}`;

  return (
    <button
      type="button"
      data-testid="mobile-project-tile"
      data-tile-order={order}
      onClick={() => onProjectClick(project)}
      aria-label={ariaLabel}
      className={`group flex w-full items-center gap-6 px-6 min-h-[70vh] text-left ${
        order === 'image-text' ? 'flex-row-reverse' : ''
      }`}
    >
      <div className="flex-1 flex flex-col gap-2">
        <span
          aria-hidden="true"
          className="text-[10px] tracking-[0.3em] uppercase text-white/60"
        >
          {eyebrow}
        </span>
        <span
          data-testid="tile-title"
          className="text-[26px] leading-[1.05] italic text-white"
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
        >
          {title}
        </span>
        {scripture && (
          <span
            data-testid="tile-scripture"
            className="text-[10px] tracking-[0.12em] uppercase text-white/70"
          >
            {scripture}
          </span>
        )}
      </div>
      <div className="flex-[1.15] aspect-[3/4] overflow-hidden" style={{ borderRadius: '2px' }}>
        <img
          src={project.thumbnail}
          alt={project.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    </button>
  );
}
