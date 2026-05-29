import { useRef, useMemo } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
  cubicBezier,
} from 'framer-motion';
import { categoryLabel, overlayLabelById } from '@/data/projects';
import { devotions } from '@/data/devotions';
import type { Project } from '@/types';

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
    offset: ['start 60%', 'start 5%'],
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

  // Image: left-to-right curtain wipe. At progress 0 the image is clipped
  // from the right (inset right = 100%) and invisible; it unveils to fully
  // visible at progress 0.75.
  const imageInsetRight = useTransform(latchedProgress, [0, 0.75], [100, 0], { ease });
  const imageClipPath = useTransform(
    imageInsetRight,
    (v) => `inset(0 ${v}% 0 0)`
  );
  const imageOpacity = useTransform(latchedProgress, [0, 0.75], [0, 1], { ease });

  // Text: drops in from 50px above. Lags the image and finishes after it.
  const textOpacity = useTransform(latchedProgress, [0.15, 0.85], [0, 1], { ease });
  const textY = useTransform(latchedProgress, [0.15, 0.85], [-50, 0], { ease });

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
            : { opacity: textOpacity, y: textY }
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
