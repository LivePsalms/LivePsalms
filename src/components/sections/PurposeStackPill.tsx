// src/components/sections/PurposeStackPill.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';
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

  useImperativeHandle(ref, () => ({
    getRoot: () => rootRef.current,
    setStatic: (data) => {
      if (shapeRef.current) shapeRef.current.style.backgroundColor = data.pillColor;
      resetStack(stackLabelRef.current,     `<span class="pl-lbl">${escapeHtml(data.label)}</span>`);
      resetStack(stackTitleRef.current,     `<span class="pl-title">${escapeHtml(data.title)}</span>`);
      resetStack(stackCategoryRef.current,  `<span class="pl-meta">${escapeHtml(data.category)}</span>`);
      resetStack(stackScriptureRef.current, `<span class="pl-meta">${escapeHtml(data.scripture)} ${data.scripture ? '↗' : ''}</span>`);
    },
    morphTo: (data) => {
      if (shapeRef.current) shapeRef.current.style.backgroundColor = data.pillColor;
      pushFrame(stackLabelRef.current,     `<span class="pl-lbl">${escapeHtml(data.label)}</span>`);
      pushFrame(stackTitleRef.current,     `<span class="pl-title">${escapeHtml(data.title)}</span>`);
      pushFrame(stackCategoryRef.current,  `<span class="pl-meta">${escapeHtml(data.category)}</span>`);
      pushFrame(stackScriptureRef.current, `<span class="pl-meta">${escapeHtml(data.scripture)} ${data.scripture ? '↗' : ''}</span>`);
    },
  }), []);

  const initialScripture = `${escapeHtml(initial.scripture)} ${initial.scripture ? '↗' : ''}`;

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
      style={{
        width: 'min(62vw, 920px)',
        aspectRatio: '11 / 3.2',
        zIndex: 50,
      }}
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
          gridTemplateColumns: '1fr auto 1fr',
          padding: '0 10%',
          fontFamily: '"Cormorant Garamond", Georgia, serif',
        }}
      >
        <div className="flex flex-col gap-1 text-left">
          <Mask alignEnd={false}>
            <Stack ref={stackLabelRef} innerHtml={`<span class="pl-lbl">${escapeHtml(initial.label)}</span>`} />
          </Mask>
          <Mask alignEnd={false}>
            <Stack ref={stackTitleRef} innerHtml={`<span class="pl-title">${escapeHtml(initial.title)}</span>`} />
          </Mask>
        </div>
        <img
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="w-10 opacity-25 invert pointer-events-none"
          style={{ transform: 'translateY(22px)' }}
        />
        <div className="flex flex-col gap-1 text-right">
          <Mask alignEnd>
            <Stack ref={stackCategoryRef} innerHtml={`<span class="pl-meta">${escapeHtml(initial.category)}</span>`} />
          </Mask>
          <Mask alignEnd>
            <Stack ref={stackScriptureRef} innerHtml={`<span class="pl-meta">${initialScripture}</span>`} />
          </Mask>
        </div>
      </div>
      <style>{`
        .ps-pill .pl-lbl  { font-family: ui-sans-serif, system-ui; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
        .ps-pill .pl-title{ font-style: italic; font-weight: 300; font-size: 28px; line-height: 1; color: rgba(255,255,255,0.95); }
        .ps-pill .pl-meta { font-family: ui-sans-serif, system-ui; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.7); display: block; }
        .ps-pill .ps-mask { position: relative; overflow: hidden; display: block; }
        .ps-pill .ps-mask.r { text-align: right; }
        .ps-pill .ps-stack { display: flex; flex-direction: column; will-change: transform; transition: transform 0.55s cubic-bezier(0.65,0,0.25,1); }
        .ps-pill .ps-stack > .frame { flex: 0 0 100%; }
      `}</style>
    </div>
  );
});

function Mask({ alignEnd, children }: { alignEnd: boolean; children: React.ReactNode }) {
  return <div className={`ps-mask ${alignEnd ? 'r' : ''}`}>{children}</div>;
}

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
    stack.removeEventListener('transitionend', onEnd);
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
