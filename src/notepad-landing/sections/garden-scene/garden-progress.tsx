// src/notepad-landing/sections/garden-scene/garden-progress.tsx
import { STATION_META } from './station-meta';

interface GardenProgressProps {
  current: number;
  onJump: (i: number) => void;
}

export function GardenProgress({ current, onJump }: GardenProgressProps) {
  return (
    <nav className="garden-progress" aria-label="Garden stations">
      {STATION_META.map((s) => {
        const isActive = s.index === current;
        return (
          <button
            key={s.index}
            type="button"
            className={`garden-progress-item${isActive ? ' active' : ''}`}
            aria-label={`Go to station ${s.index + 1}: ${s.name}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onJump(s.index)}
          >
            {s.roman}
          </button>
        );
      })}
    </nav>
  );
}
