import { useEffect } from 'react';
import { setNavTheme, type NavTheme } from '@/lib/nav-theme';

interface SectionTheme {
  readonly selector: string;
  readonly theme: 'dark' | 'light';
}

// Y-coordinate (px from viewport top) used to probe which section sits
// directly behind the nav text. The nav itself is centered around y≈30–40px,
// so 40 lands in the visual middle of the nav strip.
const NAV_PROBE_Y = 40;

// Drives the global nav-theme override based on which page section currently
// sits behind the nav. Resets the override to null on unmount so other routes
// fall back to their own per-route darkText prop.
export function useAdaptiveNavTheme(sections: readonly SectionTheme[]): void {
  useEffect(() => {
    const entries: { el: Element; theme: 'dark' | 'light' }[] = [];
    for (const { selector, theme } of sections) {
      document.querySelectorAll(selector).forEach((el) => {
        entries.push({ el, theme });
      });
    }
    if (entries.length === 0) return;

    let rafId: number | null = null;
    let lastTheme: NavTheme = null;

    const computeTheme = (): void => {
      rafId = null;
      for (const { el, theme } of entries) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= NAV_PROBE_Y && rect.bottom > NAV_PROBE_Y) {
          if (theme !== lastTheme) {
            lastTheme = theme;
            setNavTheme(theme);
          }
          return;
        }
      }
      if (lastTheme !== null) {
        lastTheme = null;
        setNavTheme(null);
      }
    };

    const schedule = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(computeTheme);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      setNavTheme(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
