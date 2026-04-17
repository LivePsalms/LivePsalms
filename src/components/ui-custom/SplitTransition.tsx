import { motion, AnimatePresence } from 'framer-motion';

export type TransitionPhase = 'expanding' | 'revealing' | 'idle';

interface SplitTransitionProps {
  isActive: boolean;
  overlayColor: string;
  phase: TransitionPhase;
  onPhaseComplete: () => void;
}

const EASE = [0.65, 0, 0.35, 1] as const;

export function SplitTransition({
  isActive,
  overlayColor,
  phase,
  onPhaseComplete,
}: SplitTransitionProps) {
  const isExpanding = phase === 'expanding';
  const isRevealing = phase === 'revealing';

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Static seam cover — sits above both panels during expand
              to hide the sub-pixel anti-aliasing gap from scaleX transforms */}
          {!isRevealing && (
            <div
              className="fixed top-0 bottom-0 z-[51] pointer-events-none"
              style={{
                left: 'calc(50% - 3px)',
                width: '6px',
                backgroundColor: overlayColor,
              }}
              aria-hidden="true"
            />
          )}

          {/* Left panel */}
          <motion.div
            className="fixed top-0 bottom-0 left-0 z-50 pointer-events-none"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isRevealing ? 0 : 1 }}
            style={{
              right: 'calc(50% - 4px)',
              backgroundColor: overlayColor,
              transformOrigin: isRevealing ? 'left' : 'right',
            }}
            transition={{
              duration: isExpanding ? 0.7 : 0.6,
              ease: EASE,
              delay: isRevealing ? 0.2 : 0,
            }}
            onAnimationComplete={() => {
              if (isExpanding || isRevealing) {
                onPhaseComplete();
              }
            }}
            aria-hidden="true"
          />

          {/* Right panel */}
          <motion.div
            className="fixed top-0 bottom-0 right-0 z-50 pointer-events-none"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isRevealing ? 0 : 1 }}
            style={{
              left: 'calc(50% - 4px)',
              backgroundColor: overlayColor,
              transformOrigin: isRevealing ? 'right' : 'left',
            }}
            transition={{
              duration: isExpanding ? 0.7 : 0.6,
              ease: EASE,
              delay: isRevealing ? 0.2 : 0,
            }}
            aria-hidden="true"
          />
        </>
      )}
    </AnimatePresence>
  );
}
