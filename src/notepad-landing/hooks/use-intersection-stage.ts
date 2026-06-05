import { useEffect, useState, type RefObject } from 'react';

export interface IntersectionStageOptions {
  rootMargin?: string;
  threshold?: number;
}

export function useIntersectionStage<T extends Element>(
  ref: RefObject<T | null>,
  options: IntersectionStageOptions = {},
): boolean {
  const { rootMargin = '0px 0px -10% 0px', threshold = 0.15 } = options;
  const [staged, setStaged] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setStaged(true);
      return;
    }
    if (staged) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setStaged(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin, threshold },
    );
    const node = ref.current;
    if (node) {
      observer.observe(node);
    }
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold, staged]);

  return staged;
}
