import { useEffect, useRef, useState } from 'react';
import { createLoadingState, type LoadingStateMachine } from './loading-state';

interface UseLoadingOverlayOptions {
  minMs: number;
  initialActive: boolean;
}

export interface LoadingOverlay {
  active: boolean;
  trigger: () => void;
}

export function useLoadingOverlay({
  minMs,
  initialActive,
}: UseLoadingOverlayOptions): LoadingOverlay {
  const [active, setActive] = useState<boolean>(initialActive);
  const machineRef = useRef<LoadingStateMachine | null>(null);

  // Create the state machine on first render. Strict-mode-safe via the ref guard.
  if (machineRef.current === null) {
    machineRef.current = createLoadingState({
      minMs,
      initialActive,
      onChange: setActive,
    });
  }

  useEffect(() => {
    return () => {
      machineRef.current?.cleanup();
      machineRef.current = null;
    };
  }, []);

  return {
    active,
    trigger: () => machineRef.current?.trigger(),
  };
}
