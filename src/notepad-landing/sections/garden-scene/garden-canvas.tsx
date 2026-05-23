// src/notepad-landing/sections/garden-scene/garden-canvas.tsx
import { useEffect, useRef } from 'react';

interface GardenCanvasProps {
  scrollProgress: { current: number };
  onStationChange: (i: number) => void;
}

export function GardenCanvas({ scrollProgress, onStationChange }: GardenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cleanup = () => {};
    let cancelled = false;

    import('../../three/garden/mount-garden').then(({ mountGarden }) => {
      if (cancelled || !canvasRef.current) return;
      const handle = mountGarden(canvasRef.current, {
        scrollProgress,
        onStationChange,
      });
      cleanup = handle.cleanup;
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  // scrollProgress is a ref object so its identity is stable; onStationChange
  // is expected to be stable (wrapped in useCallback by the parent).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="garden-canvas"
      aria-hidden="true"
      role="presentation"
    />
  );
}
