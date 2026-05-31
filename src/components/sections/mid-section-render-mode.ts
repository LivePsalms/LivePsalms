export type RenderMode = 'webgpu' | 'video' | 'reduced';

/**
 * Picks the render mode at first mount. Order of precedence:
 *  1. SSR (no `window`) → `'video'` (safe placeholder; client effect will swap on mount).
 *  2. `prefers-reduced-motion` → `'reduced'`.
 *  3. WebGPU available → `'webgpu'`.
 *  4. Otherwise → `'video'`.
 */
export function initialRenderMode(): RenderMode {
  if (typeof window === 'undefined') return 'video';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  if ('gpu' in navigator) return 'webgpu';
  return 'video';
}
