// src/notepad/bible/useDragResize.ts
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/** The chat (bottom) pane may occupy between 20% and 80% of the split height. */
export const SPLIT_MIN = 0.2;
export const SPLIT_MAX = 0.8;
export const SPLIT_DEFAULT = 0.5;
export const SPLIT_STORAGE_KEY = 'lamplight-chat-split-fraction';

export function clampFraction(f: number, min = SPLIT_MIN, max = SPLIT_MAX): number {
  if (Number.isNaN(f)) return SPLIT_DEFAULT;
  return Math.min(max, Math.max(min, f));
}

/**
 * Fraction of the container height occupied by the chat (bottom) pane, derived
 * from the pointer's Y. Dragging up (smaller Y) grows the chat; clamped to [min, max].
 */
export function fractionFromPointer(pointerY: number, top: number, height: number, min = SPLIT_MIN, max = SPLIT_MAX): number {
  if (height <= 0) return SPLIT_DEFAULT;
  return clampFraction((top + height - pointerY) / height, min, max);
}

function readStoredFraction(): number {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    return raw == null ? SPLIT_DEFAULT : clampFraction(parseFloat(raw));
  } catch {
    return SPLIT_DEFAULT;
  }
}

export interface DragResize {
  /** Chat (bottom) pane height as a fraction of the split container. */
  fraction: number;
  /** Reset the split to the default 50/50 and persist it. */
  reset: () => void;
  /** Spread onto the resize handle element. */
  handleProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onDoubleClick: () => void;
  };
}

/**
 * Drives a draggable vertical split. `containerRef` must point at the element
 * whose height the fraction is measured against (reader + handle + chat).
 */
export function useDragResize(containerRef: RefObject<HTMLElement | null>): DragResize {
  const [fraction, setFraction] = useState<number>(readStoredFraction);
  const fractionRef = useRef(fraction);
  // Holds the active drag's controller; aborting it detaches both window listeners.
  const abortRef = useRef<AbortController | null>(null);

  const apply = useCallback((f: number) => {
    fractionRef.current = f;
    setFraction(f);
  }, []);

  const persist = useCallback((f: number) => {
    try { localStorage.setItem(SPLIT_STORAGE_KEY, String(f)); } catch { /* storage unavailable */ }
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    abortRef.current?.abort(); // end any prior drag before starting a new one
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    window.addEventListener('pointermove', (ev) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      apply(fractionFromPointer(ev.clientY, rect.top, rect.height));
    }, { signal });
    window.addEventListener('pointerup', () => {
      controller.abort();
      abortRef.current = null;
      persist(fractionRef.current);
    }, { signal });
  }, [containerRef, apply, persist]);

  const reset = useCallback(() => { apply(SPLIT_DEFAULT); persist(SPLIT_DEFAULT); }, [apply, persist]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { fraction, reset, handleProps: { onPointerDown, onDoubleClick: reset } };
}
