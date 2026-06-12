import React, { type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextStaggerHover,
  TextStaggerHoverActive,
  TextStaggerHoverHidden,
} from '@/components/ui/text-stagger-hover';

const FADE_START = 0.02;
const FADE_END = 0.12;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Desktop opacity for the hero Notepad link.
 * - Hidden (0) until the intro is revealed.
 * - Fully visible at the start of scroll, then fades out across
 *   [FADE_START, FADE_END] so it is gone before the wordmark-collapse
 *   climax and the manifesto below.
 */
export function heroNotepadLinkOpacity(introRevealed: boolean, progress: number): number {
  if (!introRevealed) return 0;
  const t = clamp01((progress - FADE_START) / (FADE_END - FADE_START));
  return 1 - t;
}

const LINK_LABEL = 'Open Your Notepad';
const NOTEPAD_NOTES_PATH = '/notepad/notes';

export interface HeroNotepadLinkProps {
  onNavTrigger?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function HeroNotepadLink({ onNavTrigger, className, style }: HeroNotepadLinkProps) {
  const navigate = useNavigate();

  return (
    <TextStaggerHover
      as="a"
      href={NOTEPAD_NOTES_PATH}
      aria-label={LINK_LABEL}
      data-testid="hero-notepad-link"
      className={[
        'psalms-nav-link hero-notepad-link',
        'text-base md:text-lg font-bold tracking-wide',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          fontFamily: "'The Softly Serif', serif",
          ['--c-rest' as string]: 'var(--deep-umber)',
          ['--c-hover' as string]: 'var(--charred)',
          ...style,
        } as CSSProperties
      }
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        onNavTrigger?.();
        navigate(NOTEPAD_NOTES_PATH);
      }}
    >
      <TextStaggerHoverActive animation="blur">{LINK_LABEL}</TextStaggerHoverActive>
      <TextStaggerHoverHidden animation="blur">{LINK_LABEL}</TextStaggerHoverHidden>
      <span
        data-testid="hero-notepad-arrow"
        aria-hidden="true"
        className="hero-notepad-arrow inline-block"
      >
        →
      </span>
    </TextStaggerHover>
  );
}
