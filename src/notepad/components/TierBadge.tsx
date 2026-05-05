import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Tier } from '../gamification/tiers';

interface TierBadgeProps {
  tier: Tier;
  noteCount: number;
}

export function TierBadge({ tier, noteCount }: TierBadgeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 transition-colors cursor-pointer"
        >
          <span className="text-xs">🔥</span>
          <span
            className="text-[10px] font-medium tracking-wider"
            style={{
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {tier.name}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 p-4"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
        }}
      >
        <p
          className="text-[10px] tracking-[0.2em] font-medium mb-2"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          JOURNEY RANK
        </p>
        <p
          className="text-lg font-medium mb-1"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
          }}
        >
          {tier.name}
        </p>
        <p
          className="text-xs italic mb-3"
          style={{
            color: 'var(--silica)',
            fontFamily: 'Cormorant Garamond, serif',
          }}
        >
          "{tier.scripture}" — {tier.reference}
        </p>
        <p
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          {noteCount} {noteCount === 1 ? 'note' : 'notes'} written
        </p>
      </PopoverContent>
    </Popover>
  );
}
