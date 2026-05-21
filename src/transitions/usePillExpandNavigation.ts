import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import gsap from 'gsap';
import { PillExpandController } from './pill-expand-controller';
import type { ExpandTiming, PillExpandDeps, RectLike } from './pill-expand-controller';

const COVER_ATTR = 'data-pill-cover';

interface StartFromPillArgs {
  pillEl: HTMLElement;
  pillColor: string;
  targetUrl: string;
  reducedMotion: boolean;
}

interface CoverHandle {
  cover: HTMLDivElement;
  clippedLayer: HTMLDivElement;
  unclippedLayer: HTMLDivElement;
}

/**
 * Drives the cinematic "pill expands to fullscreen, navigates, then fades
 * out" morph used by Zone 8 and the /purpose listing pill. The controller
 * owns the pure decisions; this hook supplies the real DOM and GSAP work.
 */
export function usePillExpandNavigation() {
  const navigate = useNavigate();
  const coverHandleRef = useRef<CoverHandle | null>(null);

  // Build the deps once; rebuild only if navigate identity changes.
  const controller = useMemo(() => {
    const deps: PillExpandDeps = {
      createCover: ({ rect, pillColor }) => {
        coverHandleRef.current = buildCoverDom(rect, pillColor);
      },
      removeCover: () => {
        const orphan = document.querySelector(`[${COVER_ATTR}]`);
        orphan?.remove();
        coverHandleRef.current = null;
      },
      runExpandTimeline: ({ timing, targetUrl }) => {
        const handle = coverHandleRef.current;
        if (!handle) return;
        runTimeline(handle, timing, targetUrl, navigate, coverHandleRef);
      },
      setBodyOverflow: (value) => { document.body.style.overflow = value; },
      hasExistingCover: () => !!document.querySelector(`[${COVER_ATTR}]`),
    };
    return new PillExpandController(deps);
  }, [navigate]);

  // Cleanup on unmount: remove orphaned cover and reset body overflow.
  useEffect(() => {
    return () => controller.cleanup();
  }, [controller]);

  const startFromPill = ({ pillEl, pillColor, targetUrl, reducedMotion }: StartFromPillArgs): void => {
    if (controller.hasNavigated()) return;
    const rect = pillEl.getBoundingClientRect();
    controller.start({
      pillRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      targetUrl,
      pillColor,
      reducedMotion,
    });
  };

  return { startFromPill };
}

function buildCoverDom(rect: RectLike, pillColor: string): CoverHandle {
  const cover = document.createElement('div');
  cover.setAttribute(COVER_ATTR, '');
  Object.assign(cover.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '100',
    pointerEvents: 'none',
    opacity: '1',
  } as Partial<CSSStyleDeclaration>);

  const clippedLayer = document.createElement('div');
  Object.assign(clippedLayer.style, {
    position: 'absolute', inset: '0',
    backgroundColor: pillColor,
    clipPath: 'url(#hero-mask-clip)',
  } as Partial<CSSStyleDeclaration>);

  const unclippedLayer = document.createElement('div');
  Object.assign(unclippedLayer.style, {
    position: 'absolute', inset: '0',
    backgroundColor: pillColor,
    opacity: '0',
  } as Partial<CSSStyleDeclaration>);

  cover.appendChild(clippedLayer);
  cover.appendChild(unclippedLayer);
  document.body.appendChild(cover);

  return { cover, clippedLayer, unclippedLayer };
}

function runTimeline(
  handle: CoverHandle,
  timing: ExpandTiming,
  targetUrl: string,
  navigate: NavigateFunction,
  coverHandleRef: React.RefObject<CoverHandle | null>,
): void {
  const { cover, clippedLayer, unclippedLayer } = handle;

  const tl = gsap.timeline();
  tl.to(
    cover,
    { top: 0, left: 0, width: '100vw', height: '100vh', duration: timing.expandSeconds, ease: 'power3.inOut' },
    0,
  );
  tl.to(clippedLayer,   { opacity: 0, duration: timing.layerFadeSeconds, ease: 'power2.out' }, timing.layerFadeStartSeconds);
  tl.to(unclippedLayer, { opacity: 1, duration: timing.layerFadeSeconds, ease: 'power2.in'  }, timing.layerFadeStartSeconds);

  tl.call(() => {
    navigate(targetUrl);
    window.setTimeout(() => {
      cover.style.transition = `opacity ${timing.coverFadeMs}ms ease-out`;
      cover.style.opacity = '0';
      window.setTimeout(() => {
        cover.remove();
        document.body.style.overflow = '';
        coverHandleRef.current = null;
      }, timing.coverFadeMs + 50);
    }, timing.postNavHoldMs);
  });
}
