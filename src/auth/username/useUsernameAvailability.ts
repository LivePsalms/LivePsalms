import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { UsernameAvailability, type AvailabilityStatus } from './username-availability';

export interface UseUsernameAvailabilityArgs {
  checkAvailable: (name: string) => Promise<boolean>;
  name: string; // normalized username (caller passes normalizeUsername(value))
  eligible: boolean; // caller passes validateUsername(value).valid
  debounceMs?: number; // default 300
}

export interface UseUsernameAvailabilityResult {
  status: AvailabilityStatus;
  markTaken: () => void;
}

export function useUsernameAvailability({
  checkAvailable,
  name,
  eligible,
  debounceMs = 300,
}: UseUsernameAvailabilityArgs): UseUsernameAvailabilityResult {
  // Captured via ref so an unstable inline checkAvailable doesn't recreate the controller.
  const checkRef = useRef(checkAvailable);
  checkRef.current = checkAvailable;

  const controller = useMemo(
    // Production omits setTimer so the controller uses real setTimeout.
    () => new UsernameAvailability({ checkAvailable: (n) => checkRef.current(n) }),
    [],
  );

  const status = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => {
    controller.setInputs({ name, eligible, debounceMs });
  }, [controller, name, eligible, debounceMs]);

  useEffect(() => () => controller.dispose(), [controller]);

  const markTaken = useCallback(() => controller.markTaken(), [controller]);

  return { status, markTaken };
}
