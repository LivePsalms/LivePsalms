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
    offset: ['start 50%', 'end 50%'],
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

  // Image: curtain wipe whose direction alternates per index. Even tiles
  // wipe left→right (clipped from the right, inset right = 100% → 0%);
  // odd tiles wipe right→left (clipped from the left, inset left = 100% → 0%).
  // Wipe direction is in lockstep with the text-anchor side so the curtain
  // always pulls toward the text.
  const wipeDirection: 'ltr' | 'rtl' = index % 2 === 0 ? 'ltr' : 'rtl';
  const imageInsetValue = useTransform(latchedProgress, [0, 0.85], [100, 0], { ease });
  const imageClipPath = useTransform(imageInsetValue, (v) =>
    wipeDirection === 'ltr' ? `inset(0 ${v}% 0 0)` : `inset(0 0 0 ${v}%)`
  );
  const imageOpacity = useTransform(latchedProgress, [0, 0.85], [0, 1], { ease });

  // Text: drops in from 60px above with a 14px blur clearing. Lags the
  // image and finishes after it.
  const textOpacity = useTransform(latchedProgress, [0.2, 0.95], [0, 1], { ease });
  const textY = useTransform(latchedProgress, [0.2, 0.95], [-60, 0], { ease });
  const textBlurPx = useTransform(latchedProgress, [0.2, 0.95], [14, 0], { ease });
  const textFilter = useTransform(textBlurPx, (v) => `blur(${v}px)`);

  const textAnchor: 'left' | 'right' = order === 'text-image' ? 'left' : 'right';

  return (
    <button
      ref={tileRef}
      type="button"
      data-testid="mobile-project-tile"
      data-tile-order={order}
      onClick={() => onProjectClick(project)}
      aria-label={ariaLabel}
      className="relative block w-full aspect-[3/4] overflow-hidden text-left"
    >
      <motion.div
        data-testid="tile-image"
        data-wipe-direction={wipeDirection}
        className="absolute inset-0"
        style={
          reduced
            ? undefined
            : { clipPath: imageClipPath, opacity: imageOpacity }
        }
      >
        <img
          src={project.thumbnail}
          alt={project.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
          style={{
            background:
              'linear-gradient(0deg, rgba(40,30,20,0.55) 0%, rgba(40,30,20,0) 100%)',
          }}
        />
      </motion.div>
      <motion.div
        data-testid="tile-text"
        data-text-anchor={textAnchor}
        className={`absolute bottom-6 z-10 flex flex-col gap-2 ${
          textAnchor === 'left' ? 'left-6 text-left' : 'right-6 text-right'
        }`}
        style={
          reduced
            ? undefined
            : { opacity: textOpacity, y: textY, filter: textFilter }
        }
      >
        <span
          aria-hidden="true"
          className="text-[10px] tracking-[0.3em] uppercase text-white/60"
          style={{ textShadow: '0 1px 8px rgba(0,0,0,0.55)' }}
        >
          {eyebrow}
        </span>
        <span
          data-testid="tile-title"
          className="text-[26px] leading-[1.05] italic text-white"
          style={{
            fontFamily: '"Cormorant Garamond", serif',
            textShadow: '0 1px 12px rgba(0,0,0,0.45)',
          }}
        >
          {title}
        </span>
        {scripture && (
          <span
            data-testid="tile-scripture"
            className="text-[10px] tracking-[0.12em] uppercase text-white/70"
            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.55)' }}
          >
            {scripture}
          </span>
        )}
      </motion.div>
    </button>
  );
}
