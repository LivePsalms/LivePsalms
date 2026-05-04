import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Tier } from '../gamification/tiers';

interface LevelUpModalProps {
  open: boolean;
  tier: Tier | null;
  onDismiss: () => void;
}

export function LevelUpModal({ open, tier, onDismiss }: LevelUpModalProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setAnimate(true), 100);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
    }
  }, [open]);

  if (!tier) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent
        className="flex flex-col items-center text-center p-10 max-w-sm"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        <DialogTitle className="sr-only">Level Up</DialogTitle>

        {/* Fire animation glow */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'radial-gradient(circle, rgba(232, 169, 58, 0.3) 0%, transparent 70%)',
            boxShadow: animate
              ? '0 0 40px rgba(232, 169, 58, 0.4), 0 0 80px rgba(232, 169, 58, 0.2)'
              : 'none',
            transition: 'box-shadow 0.8s ease-out',
          }}
        >
          <span
            className="text-5xl"
            style={{
              filter: animate ? 'brightness(1.2)' : 'brightness(1)',
              transition: 'filter 0.8s ease-out',
            }}
          >
            🔥
          </span>
        </div>

        {/* Tier name */}
        <p
          className="text-[10px] tracking-[0.25em] font-medium mb-2"
          style={{ color: 'var(--silica)' }}
        >
          YOU HAVE REACHED
        </p>
        <h2
          className="text-3xl font-semibold mb-4"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
            transform: animate ? 'scale(1)' : 'scale(0.8)',
            opacity: animate ? 1 : 0,
            transition: 'transform 0.6s ease-out, opacity 0.6s ease-out',
          }}
        >
          {tier.name}
        </h2>

        {/* Scripture */}
        <p
          className="text-sm italic mb-1"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
            opacity: animate ? 1 : 0,
            transition: 'opacity 0.8s ease-out 0.3s',
          }}
        >
          "{tier.scripture}"
        </p>
        <p
          className="text-xs mb-8"
          style={{
            color: 'var(--silica)',
            fontFamily: 'Outfit, sans-serif',
            opacity: animate ? 1 : 0,
            transition: 'opacity 0.8s ease-out 0.4s',
          }}
        >
          — {tier.reference}
        </p>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="px-8 py-2.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{
            background: 'var(--deep-umber)',
            color: 'var(--plaster)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          Continue
        </button>
      </DialogContent>
    </Dialog>
  );
}
