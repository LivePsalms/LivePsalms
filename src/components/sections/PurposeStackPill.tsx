// src/components/sections/PurposeStackPill.tsx
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { PillData } from './purpose-stack-data';

export interface PurposeStackPillHandle {
  /** Animate to a new devotion: rise four text stacks + crossfade color. */
  morphTo: (data: PillData) => void;
  /** Direct reset (no animation) — used for reduced motion and on remount. */
  setStatic: (data: PillData) => void;
  /** Underlying root element for click/expand morph. */
  getRoot: () => HTMLDivElement | null;
}

interface Props {
  /** Initial frame shown on first paint, before any morph. */
  initial: PillData;
  /** Click handler (fires when user clicks/keypresses the pill). */
  onActivate: () => void;
}

export const PurposeStackPill = forwardRef<PurposeStackPillHandle, Props>(function PurposeStackPill(
  { initial, onActivate },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shapeRef = useRef<HTMLDivElement>(null);
  const stackLabelRef = useRef<HTMLDivElement>(null);
  const stackTitleRef = useRef<HTMLDivElement>(null);
  const stackCategoryRef = useRef<HTMLDivElement>(null);
  const stackScriptureRef = useRef<HTMLDivElement>(null);
  const maskLabelRef = useRef<HTMLDivElement>(null);
  const maskTitleRef = useRef<HTMLDivElement>(null);
  const maskCategoryRef = useRef<HTMLDivElement>(null);
  const maskScriptureRef = useRef<HTMLDivElement>(null);

  // Lock each mask's height to its single-frame natural height so that
  // during a morph (when the stack briefly contains 2 frames) overflow:hidden
  // actually clips. Without this, the mask grows to fit both frames and they
  // render simultaneously instead of one sliding behind the other.
  useLayoutEffect(() => {
    const pairs = [
      [maskLabelRef, stackLabelRef],
      [maskTitleRef, stackTitleRef],
      [maskCategoryRef, stackCategoryRef],
      [maskScriptureRef, stackScriptureRef],
    ] as const;

    const measure = () => {
      for (const [maskRef, stackRef] of pairs) {
        const mask = maskRef.current;
        const stack = stackRef.current;
        if (!mask || !stack) continue;
        // Skip if a morph is mid-flight — measuring then would capture 2×.
        if (stack.children.length !== 1) continue;
        mask.style.height = '';
        const h = mask.offsetHeight;
        if (h > 0) mask.style.height = `${h}px`;
      }
    };

    measure();

    let rafId = 0;
    const onResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getRoot: () => rootRef.current,
    setStatic: (data) => {
      if (shapeRef.current) shapeRef.current.style.backgroundColor = data.pillColor;
      resetStack(stackLabelRef.current,     `<span class="pl-lbl">${escapeHtml(data.label)}</span>`);
      resetStack(stackTitleRef.current,     `<span class="pl-title">${escapeHtml(data.title)}</span>`);
      resetStack(stackCategoryRef.current,  `<span class="pl-meta">${escapeHtml(data.category)}</span>`);
      resetStack(stackScriptureRef.current, `<span class="pl-meta">${scriptureHtml(data.scripture)}</span>`);
    },
    morphTo: (data) => {
      if (shapeRef.current) shapeRef.current.style.backgroundColor = data.pillColor;
      pushFrame(stackLabelRef.current,     `<span class="pl-lbl">${escapeHtml(data.label)}</span>`);
      pushFrame(stackTitleRef.current,     `<span class="pl-title">${escapeHtml(data.title)}</span>`);
      pushFrame(stackCategoryRef.current,  `<span class="pl-meta">${escapeHtml(data.category)}</span>`);
      pushFrame(stackScriptureRef.current, `<span class="pl-meta">${scriptureHtml(data.scripture)}</span>`);
    },
  }), []);

  const initialScriptureHtml = `<span class="pl-meta">${scriptureHtml(initial.scripture)}</span>`;

  return (
    <div
      ref={rootRef}
      role="link"
      tabIndex={0}
      aria-label={`Open devotion: ${initial.title}`}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
      }}
      className="ps-pill absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{ zIndex: 50 }}
    >
      <div
        ref={shapeRef}
        className="ps-pill-shape absolute inset-0"
        style={{
          backgroundColor: initial.pillColor,
          clipPath: 'url(#hero-mask-clip)',
          boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)',
          transition: 'background-color 0.55s cubic-bezier(0.65,0,0.25,1)',
        }}
      />
      <div
        className="ps-pill-content absolute inset-0 grid items-center text-white"
        style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
        }}
      >
        <div className="flex flex-col gap-1 text-left">
          <Mask ref={maskLabelRef} alignEnd={false}>
            <Stack ref={stackLabelRef} innerHtml={`<span class="pl-lbl">${escapeHtml(initial.label)}</span>`} />
          </Mask>
          <Mask ref={maskTitleRef} alignEnd={false} className="ps-mask-title">
            <Stack ref={stackTitleRef} innerHtml={`<span class="pl-title">${escapeHtml(initial.title)}</span>`} />
          </Mask>
        </div>
        <img
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="ps-pill-logo w-10 opacity-25 invert pointer-events-none"
        />
        <div className="flex flex-col gap-1 text-right">
          <Mask ref={maskCategoryRef} alignEnd>
            <Stack ref={stackCategoryRef} innerHtml={`<span class="pl-meta">${escapeHtml(initial.category)}</span>`} />
          </Mask>
          <Mask ref={maskScriptureRef} alignEnd>
            <Stack ref={stackScriptureRef} innerHtml={initialScriptureHtml} />
          </Mask>
        </div>
      </div>
      <style>{`
        .ps-pill { width: min(62vw, 920px); aspect-ratio: 11 / 3.2; }
        .ps-pill-content { grid-template-columns: 1fr auto 1fr; padding: 0 10%; }
        .ps-pill .pl-lbl  { font-family: ui-sans-serif, system-ui; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
        .ps-pill .pl-title{ font-style: italic; font-weight: 300; font-size: 28px; line-height: 1; color: rgba(255,255,255,0.95); }
        .ps-pill .pl-meta { font-family: ui-sans-serif, system-ui; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.7); display: block; }
        .ps-pill .ps-mask { position: relative; overflow: hidden; display: block; }
        .ps-pill .ps-mask.r { text-align: right; }
        .ps-pill .ps-stack { display: flex; flex-direction: column; will-change: transform; transition: transform 0.55s cubic-bezier(0.65,0,0.25,1); }
        .ps-pill .ps-stack > .frame { flex: 0 0 100%; }
        .ps-pill-logo { transform: translateY(22px); }

        /* Mobile: at 62vw the pill collapses to ~242×70px, so the 28px title wraps
           and overflows the shape. Widen the pill and run a title-led layout — a
           larger 24px title centered on the pill's midline, with the DEVOTION label
           above it. Aspect-ratio stays near the desktop 3.44 so the objectBoundingBox
           clip-path keeps its proportions (it stretches to the box). At 24px every
           devotion title fits in two lines, so the pill height is uniform across
           devotions; the title mask reserves those two lines (min-height) so the
           slide-morph between titles is never clipped by the height lock in
           useLayoutEffect. */
        @media (max-width: 767px) {
          .ps-pill { width: 92vw; aspect-ratio: 11 / 3.9; }
          /* The clip-path carves a stepped foot out of the bottom-left of the
             shape: below ~y0.48 the grey only exists for x >= ~0.10. At a
             symmetric 6% pad the title column starts at x~0.06, so a wrapped
             two-line title drops its lower line into that carved-out region and
             renders off the pill. Pad the left in past the foot (x~0.11) and
             let the right column — which only holds the short category +
             scripture — absorb the difference. The widest title still fits two
             lines and the longest scripture ref ("2 Corinthians 5:17 ↗") still
             fits one line on the grey at this split. */
          .ps-pill-content { padding: 0 3% 0 11%; }
          .ps-pill .pl-lbl  { font-size: 9px; letter-spacing: 0.2em; }
          .ps-pill .pl-title{ font-size: 24px; line-height: 1.12; }
          .ps-pill .pl-meta { font-size: 9px; letter-spacing: 0.12em; }
          /* Scripture reference (last meta in the right column) reads a touch larger. */
          .ps-pill-content > div:last-of-type .ps-mask:last-of-type .pl-meta { font-size: 10px; letter-spacing: 0.1em; }
          /* Reserve two lines for the title so the height lock captures the tall
             measurement and the morph isn't clipped. Center each frame so a rare
             single-line title isn't top-heavy in the two-line box. */
          .ps-pill .ps-mask-title { min-height: 56px; }
          .ps-pill .ps-mask-title .frame { display: flex; flex-direction: column; justify-content: center; min-height: 56px; }
          .ps-pill-logo { width: 1.75rem; transform: translateY(12px); }
        }
      `}</style>
    </div>
  );
});

const Mask = forwardRef<
  HTMLDivElement,
  { alignEnd: boolean; className?: string; children: React.ReactNode }
>(function Mask({ alignEnd, className = '', children }, ref) {
  return <div ref={ref} className={`ps-mask ${alignEnd ? 'r' : ''} ${className}`}>{children}</div>;
});

const Stack = forwardRef<HTMLDivElement, { innerHtml: string }>(function Stack({ innerHtml }, ref) {
  return (
    <div ref={ref} className="ps-stack">
      <div className="frame" dangerouslySetInnerHTML={{ __html: innerHtml }} />
    </div>
  );
});

function pushFrame(stack: HTMLDivElement | null, html: string): void {
  if (!stack) return;
  const frame = document.createElement('div');
  frame.className = 'frame';
  frame.innerHTML = html;
  stack.appendChild(frame);

  requestAnimationFrame(() => {
    stack.style.transform = 'translateY(-100%)';
  });

  const onEnd = () => {
    if (stack.firstElementChild) stack.removeChild(stack.firstElementChild);
    stack.style.transition = 'none';
    stack.style.transform = 'translateY(0)';
    void stack.offsetHeight; // reflow
    stack.style.transition = '';
  };
  stack.addEventListener('transitionend', onEnd, { once: true });
}

function resetStack(stack: HTMLDivElement | null, html: string): void {
  if (!stack) return;
  stack.style.transition = 'none';
  stack.style.transform = 'translateY(0)';
  stack.innerHTML = `<div class="frame">${html}</div>`;
  void stack.offsetHeight;
  stack.style.transition = '';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scriptureHtml(s: string): string {
  return s ? `${escapeHtml(s)} ↗` : '';
}
