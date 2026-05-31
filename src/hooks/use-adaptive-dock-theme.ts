import { useEffect, useState } from 'react';

export type DockTheme = 'dark' | 'light';

// Probe offset from the bottom of the viewport. Roughly the vertical center
// of the pill bar; any value over the dock's footprint works because the
// dock itself is filtered out of elementsFromPoint below.
const PROBE_OFFSET_FROM_BOTTOM = 40;

// Luminance threshold separating "dark" backgrounds (dock should invert to
// cream-on-dark) from "light" backgrounds (dock keeps default dark-on-cream).
// 0.5 is the neutral midpoint; the app's mid-taupe (~0.56) reads as light,
// the notepad hero (~0.05) reads as dark.
const DARK_LUMINANCE_THRESHOLD = 0.5;

const TRANSPARENT_RE = /^(transparent|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))$/i;

function parseRgb(s: string): [number, number, number] | null {
  const m = s.match(/rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// Walks up the tree from `start` returning the first ancestor with a
// non-transparent background. Mirrors how the browser actually paints —
// a transparent box shows whatever its ancestor paints.
function effectiveBgColor(start: Element | null): [number, number, number] | null {
  let el: Element | null = start;
  while (el) {
    const bg = window.getComputedStyle(el).backgroundColor;
    if (bg && !TRANSPARENT_RE.test(bg)) {
      const rgb = parseRgb(bg);
      if (rgb) return rgb;
    }
    el = el.parentElement;
  }
  return null;
}

function isDark(rgb: [number, number, number]): boolean {
  const L = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return L < DARK_LUMINANCE_THRESHOLD;
}

// Detects whether the page content under the mobile dock is dark or light
// and returns a theme token. Listens to scroll + resize (RAF-batched) so
// the dock can animate its surface/text colors as the user scrolls through
// alternating dark and light sections (e.g. the notepad landing's
// hero → garden → CTA progression).
export function useAdaptiveDockTheme(enabled: boolean): DockTheme {
  const [theme, setTheme] = useState<DockTheme>('light');

  useEffect(() => {
    if (!enabled) return;
    if (typeof document.elementsFromPoint !== 'function') return;

    let rafId: number | null = null;

    const compute = (): void => {
      rafId = null;
      const x = Math.floor(window.innerWidth / 2);
      const y = Math.floor(window.innerHeight - PROBE_OFFSET_FROM_BOTTOM);
      const stack = document.elementsFromPoint(x, y);
      // Skip the dock's own DOM — we want the page content behind it.
      const target = stack.find(
        (el) => !el.closest('[data-testid="mobile-bottom-dock"]'),
      );
      const rgb = effectiveBgColor(target ?? null);
      const next: DockTheme = rgb && isDark(rgb) ? 'dark' : 'light';
      setTheme((prev) => (prev === next ? prev : next));
    };

    const schedule = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(compute);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled]);

  return theme;
}
