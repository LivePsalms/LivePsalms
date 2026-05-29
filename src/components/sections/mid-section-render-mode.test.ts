// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('initialRenderMode (mobile branch)', () => {
  let originalGpu: unknown;

  beforeEach(() => {
    originalGpu = (navigator as unknown as { gpu?: unknown }).gpu;
    (navigator as unknown as { gpu: unknown }).gpu = {}; // simulate WebGPU available
  });

  afterEach(() => {
    if (originalGpu === undefined) {
      delete (navigator as unknown as { gpu?: unknown }).gpu;
    } else {
      (navigator as unknown as { gpu: unknown }).gpu = originalGpu;
    }
    vi.restoreAllMocks();
  });

  it('returns "reduced" on mobile even when WebGPU is available', async () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('reduce') ? false : false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    vi.resetModules();
    const mod = await import('./mid-section-render-mode');
    expect(mod.initialRenderMode()).toBe('reduced');
  });

  it('returns "webgpu" on desktop (≥ 768) when WebGPU is available', async () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    vi.resetModules();
    const mod = await import('./mid-section-render-mode');
    expect(mod.initialRenderMode()).toBe('webgpu');
  });

  it('returns "reduced" when prefers-reduced-motion is set, regardless of viewport', async () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    vi.resetModules();
    const mod = await import('./mid-section-render-mode');
    expect(mod.initialRenderMode()).toBe('reduced');
  });
});
