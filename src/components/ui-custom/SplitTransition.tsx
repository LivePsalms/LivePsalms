import { motion } from 'framer-motion';
import { useEffect } from 'react';

export type TransitionState = 'idle' | 'expanding' | 'holding' | 'revealing';

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
const EXPAND_DURATION = 0.7;   // 700ms
const REVEAL_DURATION = 0.6;   // 600ms
const HOLD_DELAY = 50;         // ms pause between phases

export function SplitTransition({
  state,
  origin,
  onExpandComplete,
  onRevealComplete,
}: SplitTransitionProps) {
  // Auto-advance from holding → revealing after a brief pause
  useEffect(() => {
    if (state !== 'holding') return;
    const timer = setTimeout(onExpandComplete, HOLD_DELAY);
    return () => clearTimeout(timer);
  }, [state, onExpandComplete]);

  if (state === 'idle' || !origin) return null;

  const isExpanding = state === 'expanding' || state === 'holding';
  const isRevealing = state === 'revealing';

  // Expanding: panels grow from card center to viewport edges
  // Revealing: panels collapse from viewport edges back to center
  const leftPanel = {
    initial: {
      left: origin.centerX,
      width: 0,
      top: origin.centerY - origin.height / 2,
      height: origin.height,
    },
    expanded: {
      left: 0,
      width: '50vw',
      top: 0,
      height: '100vh',
    },
    revealed: {
      left: '50vw',
      width: 0,
      top: 0,
      height: '100vh',
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
      left: '50vw',
      width: '50vw',
      top: 0,
      height: '100vh',
    },
    revealed: {
      left: '50vw',
      width: 0,
      top: 0,
      height: '100vh',
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

  // Only fire completion callback on the left panel (avoids double-fire)
  const handleAnimationComplete = () => {
    if (isExpanding) {
      // Will transition to 'holding', then useEffect advances to 'revealing'
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
