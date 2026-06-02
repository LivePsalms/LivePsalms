// src/components/sections/notepad/mobile/MobileNewNoteFab.tsx
import { Plus } from 'lucide-react';

export interface MobileNewNoteFabProps {
  /** Create a new note directly (no menu). */
  onClick: () => void;
}

/**
 * Mobile-only floating action button shown on the editor tab's empty state.
 * A single tap creates a new note. Positioned to match the Notes-tab FAB.
 */
export function MobileNewNoteFab({ onClick }: MobileNewNoteFabProps) {
  return (
    <div
      className="absolute z-50"
      style={{ right: 16, bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        aria-label="New note"
        onClick={onClick}
        className="flex items-center justify-center rounded-full shadow-lg"
        style={{ width: 52, height: 52, background: '#b8843a', color: '#fff' }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
