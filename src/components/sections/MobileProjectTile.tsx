import { useRef, useMemo } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
  cubicBezier,
} from 'framer-motion';
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

function usePrefersReducedMotion(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
}

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

  const tileRef = useRef<HTMLButtonElement>(null);
  const reduced = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: tileRef,
    offset: ['start 85%', 'start 30%'],
  });

  // One-way latched progress: only ever increases. Drives all reveal
  // transforms so that scrolling back up does not reverse the animation.
  const latchedProgress = useMotionValue(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v > latchedProgress.get()) {
      latchedProgress.set(v);
    }
  });

  const ease = cubicBezier(0.22, 1, 0.36, 1);

  // Image clip-path: clipped from the bottom at progress 0 (inset bottom = 100%)
  // unwinds to fully revealed at progress 0.6.
  const imageInsetBottom = useTransform(latchedProgress, [0, 0.6], [100, 0], { ease });
  const imageClipPath = useTransform(
    imageInsetBottom,
    (v) => `inset(0 0 ${v}% 0)`
  );
  const imageOpacity = useTransform(latchedProgress, [0, 0.6], [0, 1], { ease });

  // Text: lags the image by 0.1.
  const textOpacity = useTransform(latchedProgress, [0.1, 0.7], [0, 1], { ease });
  const textY = useTransform(latchedProgress, [0.1, 0.7], [20, 0], { ease });
  const textBlurPx = useTransform(latchedProgress, [0.1, 0.7], [6, 0], { ease });
  const textFilter = useTransform(textBlurPx, (v) => `blur(${v}px)`);

  return (
    <button
      ref={tileRef}
      type="button"
      data-testid="mobile-project-tile"
      data-tile-order={order}
      onClick={() => onProjectClick(project)}
      aria-label={ariaLabel}
      className={`group flex w-full items-center gap-6 px-6 min-h-[70vh] text-left ${
        order === 'image-text' ? 'flex-row-reverse' : ''
      }`}
    >
      <motion.div
        data-testid="tile-text"
        className="flex-1 flex flex-col gap-2"
        style={
          reduced
            ? undefined
            : { opacity: textOpacity, y: textY, filter: textFilter }
        }
      >
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
      </motion.div>
      <motion.div
        data-testid="tile-image"
        className="flex-[1.15] aspect-[3/4] overflow-hidden"
        style={
          reduced
            ? { borderRadius: '2px' }
            : { borderRadius: '2px', clipPath: imageClipPath, opacity: imageOpacity }
        }
      >
        <img
          src={project.thumbnail}
          alt={project.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </motion.div>
    </button>
  );
}
