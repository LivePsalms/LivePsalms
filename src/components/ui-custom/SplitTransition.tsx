import { motion, AnimatePresence } from 'framer-motion';

interface SplitTransitionProps {
  isActive: boolean;
  overlayColor: string;
  onComplete: () => void;
}

const EASE = [0.65, 0, 0.35, 1] as const;

export function SplitTransition({
  isActive,
  overlayColor,
  onComplete,
}: SplitTransitionProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Left panel — scales from center seam outward to the left */}
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            style={{ left: 0, right: '50%', backgroundColor: overlayColor }}
            initial={{ scaleX: 0, originX: 1 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0, originX: 1 }}
            transition={{
              duration: 0.7,
              ease: EASE,
              exit: { duration: 0.6, delay: 0.2 },
            }}
            onAnimationComplete={(definition: Record<string, unknown>) => {
              if (definition.scaleX === 0) {
                onComplete();
              }
            }}
            aria-hidden="true"
          />

          {/* Right panel — scales from center seam outward to the right */}
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            style={{ left: '50%', right: 0, backgroundColor: overlayColor }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0, originX: 0 }}
            transition={{
              duration: 0.7,
              ease: EASE,
              exit: { duration: 0.6, delay: 0.2 },
            }}
            aria-hidden="true"
          />
        </>
      )}
    </AnimatePresence>
  );
}
