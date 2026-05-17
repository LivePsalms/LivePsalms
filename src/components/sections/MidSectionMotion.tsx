import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  BEATS,
  MID_SECTION_PIN_TIMING,
} from './mid-section-motion-content';
import { mountCurlLinesScene } from './mid-section-webgpu-scene';

gsap.registerPlugin(ScrollTrigger);

const TIMING = [
  MID_SECTION_PIN_TIMING.beat1,
  MID_SECTION_PIN_TIMING.beat2,
  MID_SECTION_PIN_TIMING.beat3,
  MID_SECTION_PIN_TIMING.beat4,
  MID_SECTION_PIN_TIMING.beat5,
] as const;

type RenderMode = 'webgpu' | 'video' | 'reduced';

function initialRenderMode(): RenderMode {
  if (typeof window === 'undefined') return 'video';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  if ('gpu' in navigator) return 'webgpu';
  return 'video';
}

export function MidSectionMotion() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beatRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  // Reduced-motion path uses a separate set of refs to keep the two paths cleanly isolated.
  const reducedBeatRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  const [renderMode, setRenderMode] = useState<RenderMode>(initialRenderMode);

  /* ── WebGPU mount path: live curl-lines canvas ── */
  useEffect(() => {
    if (renderMode !== 'webgpu') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let mountedHandle: { dispose: () => void } | null = null;

    mountCurlLinesScene(canvas)
      .then((handle) => {
        if (disposed) {
          handle.dispose();
          return;
        }
        mountedHandle = handle;
      })
      .catch((err) => {
        // navigator.gpu existed but mount failed (requestAdapter returned null,
        // or the renderer init threw). Escalate to MP4 fallback.
        console.warn('[MidSectionMotion] WebGPU init failed, falling back to video', err);
        if (!disposed) setRenderMode('video');
      });

    return () => {
      disposed = true;
      mountedHandle?.dispose();
    };
  }, [renderMode]);

  /* ── Full-motion path: pinned stage + 5-beat slideshow (shared by webgpu and video modes) ── */
  useEffect(() => {
    if (renderMode !== 'webgpu' && renderMode !== 'video') return;

    const wrapperEl = wrapperRef.current;
    const stageEl = stageRef.current;
    const beatEls = beatRefs.current.slice(0, 5);
    if (!wrapperEl || !stageEl || beatEls.some((b) => !b)) return;

    const ctx = gsap.context(() => {
      // Initial states — beats hidden and offset below resting position.
      gsap.set(beatEls, { opacity: 0, y: 20 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapperEl,
          start: 'top top',
          end: 'bottom bottom',
          pin: stageEl,
          scrub: 2,
          invalidateOnRefresh: true,
        },
      });

      // Per-beat enter / exit tweens at MID_SECTION_PIN_TIMING positions.
      // The video.currentTime tween that was here in the prior revision is intentionally
      // removed — the WebGPU canvas runs its own animation loop and the video fallback
      // auto-plays in a loop. Both background paths are continuously animated, decoupled
      // from scroll.
      TIMING.forEach((t, i) => {
        const beat = beatEls[i];
        if (!beat) return;

        // Enter tween — fade in + rise from y:20 to y:0.
        if (t.enter < t.holdStart) {
          tl.to(
            beat,
            { opacity: 1, y: 0, ease: 'power2.out', duration: t.holdStart - t.enter },
            t.enter,
          );
        } else {
          tl.set(beat, { opacity: 1, y: 0 }, t.enter);
        }

        // Exit tween — fade out + lift to y:−20.
        if (t.holdEnd < t.exit) {
          tl.to(
            beat,
            { opacity: 0, y: -20, ease: 'power1.in', duration: t.exit - t.holdEnd },
            t.holdEnd,
          );
        }
      });
    }, wrapperEl);

    return () => ctx.revert();
  }, [renderMode]);

  /* ── Reduced-motion fallback: IntersectionObserver fades on five stacked blocks ── */
  useEffect(() => {
    if (renderMode !== 'reduced') return;

    const blocks = reducedBeatRefs.current.filter(
      (el): el is HTMLParagraphElement => el !== null,
    );
    if (blocks.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.visible = 'true';
          }
        }
      },
      { threshold: 0.4 },
    );

    for (const block of blocks) observer.observe(block);
    return () => observer.disconnect();
  }, [renderMode]);

  // ─── Reduced-motion JSX: five stacked blocks with poster + beat, no pin, no video element ───
  if (renderMode === 'reduced') {
    return (
      <section className="mid-section-reduced" aria-label="Reflection">
        {BEATS.map((text, i) => (
          <div key={i} className="mid-section-reduced-block">
            <img
              src="/mid-section-poster.jpg"
              alt=""
              aria-hidden="true"
              className="mid-section-reduced-poster"
            />
            <p
              ref={(el) => {
                reducedBeatRefs.current[i] = el;
              }}
              className="mid-section-reduced-beat"
            >
              {text}
            </p>
          </div>
        ))}
      </section>
    );
  }

  // ─── Full-motion JSX: 500vh wrapper, sticky 100vh stage, scene/video + 5 absolute-centered beats ───
  return (
    <section
      ref={wrapperRef}
      className="mid-section-wrapper"
      aria-label="Reflection"
    >
      <div ref={stageRef} className="mid-section-stage">
        {renderMode === 'webgpu' ? (
          <canvas
            ref={canvasRef}
            className="mid-section-video"
            aria-hidden="true"
          />
        ) : (
          <video
            ref={videoRef}
            src="/mid-section-video.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            disablePictureInPicture
            disableRemotePlayback
            className="mid-section-video"
          />
        )}
        <div className="mid-section-scrim" aria-hidden="true" />
        <div className="mid-section-beats">
          {BEATS.map((text, i) => (
            <p
              key={i}
              ref={(el) => {
                beatRefs.current[i] = el;
              }}
              className="mid-section-beat"
            >
              {text}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
