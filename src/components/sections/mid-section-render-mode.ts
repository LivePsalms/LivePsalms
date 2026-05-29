import { MOBILE_BREAKPOINT } from '@/hooks/use-mobile';

export type RenderMode = 'webgpu' | 'video' | 'reduced';

/**
 * Picks the render mode at first mount. Order of precedence:
 *  1. SSR (no `window`) → `'video'` (safe placeholder; client effect will swap on mount).
 *  2. `prefers-reduced-motion` → `'reduced'`.
 *  3. Viewport width < 768 (mobile) → `'reduced'`. Mobile reuses the lightweight
 *     reduced-motion JSX (stacked blocks with posters + IntersectionObserver fades)
 *     because the video/webgpu paths assume a scroll-pinned sticky stage that
 *     mobile address-bar resizes fight against. See spec
 *     docs/superpowers/specs/2026-05-28-mobile-home-page-design.md (Decision 7).
 *  4. WebGPU available → `'webgpu'`.
 *  5. Otherwise → `'video'`.
 */
export function initialRenderMode(): RenderMode {
  if (typeof window === 'undefined') return 'video';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  if (window.innerWidth < MOBILE_BREAKPOINT) return 'reduced';
  if ('gpu' in navigator) return 'webgpu';
  return 'video';
}
