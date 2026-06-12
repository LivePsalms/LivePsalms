import { useCallback, useEffect, useRef, useState } from 'react';
import { animate } from 'animejs';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { TOUR_STEPS, TOUR_SIGNUP_CARD } from './tour-steps';

interface SpotlightTourProps {
  onComplete: () => void;
  onSkip: () => void;
  onSignUp?: () => void;
}

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 300;
const CARD_GAP = 16;
const SIGNUP_INDEX = TOUR_STEPS.length; // 5

function readRect(selector: string): AnchorRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // jsdom returns zeros; treat an all-zero rect as "no usable anchor".
  if (r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function SpotlightTour({ onComplete, onSkip, onSignUp }: SpotlightTourProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  const isSignup = index >= SIGNUP_INDEX;
  const step = isSignup ? null : TOUR_STEPS[index];

  // Recompute the anchor rect for the active step; throttle resize/scroll via rAF.
  // Scheduling the read (rather than calling setState synchronously in the effect
  // body) avoids cascading renders and keeps the no-anchor path rendering instantly.
  useEffect(() => {
    if (!step) {
      return;
    }
    const selector = step.anchor;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setRect(readRect(selector));
      });
    };
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [step]);

  // Clear the prior step's rect immediately when the active step changes so a stale
  // cutout never lingers; the effect above then schedules the fresh measurement.
  const lastStepRef = useRef(step);
  if (lastStepRef.current !== step) {
    lastStepRef.current = step;
    if (rect !== null) setRect(null);
  }

  // Escape skips the tour.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  // Animate the card on step change (skipped under reduced motion; never throws).
  useEffect(() => {
    if (reduced) return;
    const node = cardRef.current;
    if (!node) return;
    try {
      animate(node, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 280,
        ease: 'out(3)',
      });
    } catch {
      // Animation is a progressive enhancement — rendering must never depend on it.
    }
  }, [index, reduced]);

  const advance = useCallback(() => {
    setIndex((current) => current + 1);
  }, []);

  // Position the card next to the anchor, clamped to the viewport, else centered.
  const cardStyle: React.CSSProperties = {
    width: CARD_WIDTH,
    maxWidth: 'calc(100vw - 32px)',
  };
  if (rect && step) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    let left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    let top = rect.top + rect.height + CARD_GAP;
    if (step.placement === 'top') top = rect.top - CARD_GAP;
    if (step.placement === 'left') {
      left = rect.left - CARD_WIDTH - CARD_GAP;
      top = rect.top;
    }
    if (step.placement === 'right') {
      left = rect.left + rect.width + CARD_GAP;
      top = rect.top;
    }
    left = Math.max(16, Math.min(left, vw - CARD_WIDTH - 16));
    cardStyle.position = 'fixed';
    cardStyle.left = left;
    cardStyle.top = Math.max(16, top);
  } else {
    cardStyle.position = 'fixed';
    cardStyle.left = '50%';
    cardStyle.top = '50%';
    cardStyle.transform = 'translate(-50%, -50%)';
  }

  const isLastSpotlight = !isSignup && index === SIGNUP_INDEX - 1;

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{ fontFamily: 'Outfit, sans-serif' }}
      role="dialog"
      aria-modal="true"
      aria-label={isSignup ? TOUR_SIGNUP_CARD.title : step?.title}
    >
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(38, 30, 22, 0.55)' }}
        aria-hidden="true"
      />

      {/* Cutout ring around the anchored element (only when a rect exists) */}
      {rect && !isSignup && (
        <div
          className="absolute rounded-lg pointer-events-none"
          aria-hidden="true"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(38, 30, 22, 0.55), 0 0 0 2px var(--marigold, #e8a93a)',
          }}
        />
      )}

      {/* Tooltip / sign-up card */}
      <div
        ref={cardRef}
        className="rounded-xl p-5 shadow-xl"
        style={{
          ...cardStyle,
          background: 'var(--alabaster, #f7f3ec)',
          border: '1px solid var(--pale-stone, #e5ded3)',
        }}
      >
        {isSignup ? (
          <>
            <h2
              className="text-lg font-semibold mb-1.5"
              style={{ color: 'var(--deep-umber, #3a2f24)', fontFamily: 'Cormorant Garamond, serif' }}
            >
              {TOUR_SIGNUP_CARD.title}
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--silica, #8a8175)' }}>
              {TOUR_SIGNUP_CARD.body}
            </p>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onComplete}
                className="text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: 'var(--silica, #8a8175)' }}
              >
                Maybe later
              </button>
              <button
                type="button"
                onClick={() => {
                  onSignUp?.();
                  onComplete();
                }}
                className="px-5 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--deep-umber, #3a2f24)', color: 'var(--plaster, #f7f3ec)' }}
              >
                {TOUR_SIGNUP_CARD.cta}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              className="text-lg font-semibold mb-1.5"
              style={{ color: 'var(--deep-umber, #3a2f24)', fontFamily: 'Cormorant Garamond, serif' }}
            >
              {step?.title}
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--silica, #8a8175)' }}>
              {step?.body}
            </p>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: 'var(--silica, #8a8175)' }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={advance}
                className="px-5 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--deep-umber, #3a2f24)', color: 'var(--plaster, #f7f3ec)' }}
              >
                {isLastSpotlight ? 'Done' : 'Next'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
