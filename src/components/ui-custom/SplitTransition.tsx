import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

export type TransitionState = 'idle' | 'expanding' | 'revealing';

export interface TransitionOrigin {
  centerX: number;
  centerY: number;
  height: number;
  overlayColor: string;
}

interface SplitTransitionProps {
  state: TransitionState;
  origin: TransitionOrigin | null;
  onExpandComplete: () => void;
  onRevealComplete: () => void;
}

const EASE = [0.43, 0.13, 0.23, 0.96] as const;
const EXPAND_DURATION = 0.7;
const REVEAL_DURATION = 0.6;
const HOLD_DELAY = 50;

export function SplitTransition({
  state,
  origin,
  onExpandComplete,
  onRevealComplete,
}: SplitTransitionProps) {
  // Clean up hold timer on unmount
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  if (state === 'idle' || !origin) return null;

  const isExpanding = state === 'expanding';
  const isRevealing = state === 'revealing';

  // Use pixel values throughout for smooth Framer Motion interpolation
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const halfVw = vw / 2;

  const leftPanel = {
    initial: {
      left: origin.centerX,
      width: 0,
      top: origin.centerY - origin.height / 2,
      height: origin.height,
    },
    expanded: {
      left: 0,
      width: halfVw,
      top: 0,
      height: vh,
    },
    revealed: {
      left: halfVw,
      width: 0,
      top: 0,
      height: vh,
    },
  };

  const rightPanel = {
    initial: {
      left: origin.centerX,
      width: 0,
      top: origin.centerY - origin.height / 2,
      height: origin.height,
    },
    expanded: {
      left: halfVw,
      width: halfVw,
      top: 0,
      height: vh,
    },
    revealed: {
      left: halfVw,
      width: 0,
      top: 0,
      height: vh,
    },
  };

  const getTarget = (panel: typeof leftPanel) => {
    if (isExpanding) return panel.expanded;
    if (isRevealing) return panel.revealed;
    return panel.initial;
  };

  const getInitial = (panel: typeof leftPanel) => {
    if (isExpanding) return panel.initial;
    return panel.expanded;
  };

  const duration = isExpanding ? EXPAND_DURATION : REVEAL_DURATION;

  // Only fire completion callback on the left panel (avoids double-fire).
  // After expanding, wait HOLD_DELAY ms then advance to revealing.
  const handleAnimationComplete = () => {
    if (isExpanding) {
      holdTimer.current = setTimeout(onExpandComplete, HOLD_DELAY);
    }
    if (isRevealing) {
      onRevealComplete();
    }
  };

  return (
    <>
      {/* Left panel */}
      <motion.div
        key={`left-${state}`}
        aria-hidden="true"
        initial={getInitial(leftPanel)}
        animate={getTarget(leftPanel)}
        transition={{ duration, ease: EASE }}
        onAnimationComplete={handleAnimationComplete}
        style={{
          position: 'fixed',
          backgroundColor: origin.overlayColor,
          zIndex: 40,
          pointerEvents: 'none',
        }}
      />
      {/* Right panel */}
      <motion.div
        key={`right-${state}`}
        aria-hidden="true"
        initial={getInitial(rightPanel)}
        animate={getTarget(rightPanel)}
        transition={{ duration, ease: EASE }}
        style={{
          position: 'fixed',
          backgroundColor: origin.overlayColor,
          zIndex: 40,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
