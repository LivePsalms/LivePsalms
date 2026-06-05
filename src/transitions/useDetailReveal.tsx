import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  PurposeDetailReveal,
  type DetailRevealDeps,
  type ExitStyles,
} from './purpose-detail-reveal';
import type { Project } from '@/types';

interface UseDetailRevealArgs {
  project: Project;
  exiting: boolean;
  onExitComplete?: () => void;
}

interface UseDetailRevealResult {
  isVisible: boolean;
  textReady: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  imageRef: React.RefObject<HTMLDivElement | null>;
}

export function useDetailReveal({
  project,
  exiting,
  onExitComplete,
}: UseDetailRevealArgs): UseDetailRevealResult {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

  const reveal = useMemo(() => {
    const applyToRef = (target: HTMLDivElement | null, styles: ExitStyles) => {
      if (!target) return;
      target.style.transition = styles.transition;
      target.style.opacity = styles.opacity;
      if (styles.transform !== undefined) target.style.transform = styles.transform;
      if (styles.filter !== undefined) target.style.filter = styles.filter;
    };
    const deps: DetailRevealDeps = {
      applyExitStyles: (target, styles) => {
        const el = target === 'content' ? contentRef.current : imageRef.current;
        applyToRef(el, styles);
      },
      setTimer: (cb, ms) => window.setTimeout(cb, ms),
      clearTimer: (handle) => window.clearTimeout(handle),
      onExitComplete: () => onExitCompleteRef.current?.(),
    };
    return new PurposeDetailReveal(deps);
  }, []);

  const state = useSyncExternalStore(reveal.subscribe, reveal.getSnapshot);

  useEffect(() => {
    reveal.reset();
  }, [project, reveal]);

  useEffect(() => {
    if (exiting) reveal.requestExit();
  }, [exiting, reveal]);

  useEffect(() => {
    return () => reveal.dispose();
  }, [reveal]);

  return {
    isVisible: state.isVisible,
    textReady: state.textReady,
    contentRef,
    imageRef,
  };
}
