import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  BEATS,
  MID_SECTION_PIN_TIMING,
} from './mid-section-motion-content';
import {
  mountCurlLinesScene,
  type CurlLinesIntensity,
} from './mid-section-webgpu-scene';

gsap.registerPlugin(ScrollTrigger);

const TIMING = [
  MID_SECTION_PIN_TIMING.beat1,
  MID_SECTION_PIN_TIMING.beat2,
  MID_SECTION_PIN_TIMING.beat3,
  MID_SECTION_PIN_TIMING.beat4,
  MID_SECTION_PIN_TIMING.beat5,
] as const;

// Three-act intensity sequence for WebGPU mode.
// Wrapper grows 500vh → 600vh; text occupies the first 5/6 (≈0.833) of the timeline,
// outro re-bright occupies the last 1/6 (≈0.167). Overture re-bright→normal fires
// over text 1's entry window (first 1/6 of the text range = 5/6 × 1/6 ≈ 0.028).
const WEBGPU_TEXT_SCALE = 5 / 6;
const OVERTURE_END = TIMING[0].holdStart * WEBGPU_TEXT_SCALE; // ≈ 0.0333
const OUTRO_START = WEBGPU_TEXT_SCALE; // 0.8333
const INTENSITY_BRIGHT = { brightness: 3.45, bloomStrength: 3.30, bloomThreshold: 0.14 };
const INTENSITY_NORMAL = { brightness: 1.20, bloomStrength: 2.20, bloomThreshold: 0.15 };

type RenderMode = 'webgpu' | 'video' | 'reduced';

function initialRenderMode(): RenderMode {
  if (typeof window === 'undefined') return 'video';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  if ('gpu' in navigator) return 'webgpu';
  return 'video';
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function MidSectionMotion() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beatRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  // Reduced-motion path uses a separate set of refs to keep the two paths cleanly isolated.
  const reducedBeatRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  // WebGPU scene's mutable intensity object — set after mount completes.
  const intensityRef = useRef<CurlLinesIntensity | null>(null);

  const [renderMode, setRenderMode] = useState<RenderMode>(initialRenderMode);
  // Flips to true once the WebGPU scene has mounted and exposed its intensity API,
  // which triggers the intensity ScrollTrigger to attach.
  const [intensityReady, setIntensityReady] = useState(false);

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
        intensityRef.current = handle.intensity;
        setIntensityReady(true);
      })
      .catch((err) => {
        // navigator.gpu existed but mount failed (requestAdapter returned null,
        // or the renderer init threw). Escalate to MP4 fallback.
        console.warn('[MidSectionMotion] WebGPU init failed, falling back to video', err);
        if (!disposed) setRenderMode('video');
      });

    return () => {
      disposed = true;
      intensityRef.current = null;
      setIntensityReady(false);
      mountedHandle?.dispose();
    };
  }, [renderMode]);

  /* ── Full-motion path: pinned stage + 5-beat slideshow ──
     Text tweens scale by WEBGPU_TEXT_SCALE in webgpu mode so beat 5 exits at
     progress 0.833, leaving 0.833 → 1.0 of the timeline for the intensity outro.
     In video mode, scale = 1 and beat 5 exits at progress 1.0 (no outro). */
  useEffect(() => {
    if (renderMode !== 'webgpu' && renderMode !== 'video') return;

    const wrapperEl = wrapperRef.current;
    const stageEl = stageRef.current;
    const beatEls = beatRefs.current.slice(0, 5);
    if (!wrapperEl || !stageEl || beatEls.some((b) => !b)) return;

    const textScale = renderMode === 'webgpu' ? WEBGPU_TEXT_SCALE : 1;

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

      // In webgpu mode the last text tween ends at timeline-position WEBGPU_TEXT_SCALE
      // (≈ 0.833), but ScrollTrigger.scrub maps its 0..1 progress onto the timeline's
      // totalDuration. Without padding, scroll progress 1.0 would only reach timeline
      // position 0.833 — beat 5 would stay visible through the entire outro. Pad with
      // a phantom set at position 1 so timeline totalDuration matches the scroll range.
      if (renderMode === 'webgpu') {
        tl.set({}, {}, 1);
      }

      // Per-beat enter / exit tweens, positions and durations scaled by textScale.
      TIMING.forEach((t, i) => {
        const beat = beatEls[i];
        if (!beat) return;

        const enter = t.enter * textScale;
        const holdStart = t.holdStart * textScale;
        const holdEnd = t.holdEnd * textScale;
        const exit = t.exit * textScale;

        // Enter tween — fade in + rise from y:20 to y:0.
        if (enter < holdStart) {
          tl.to(
            beat,
            { opacity: 1, y: 0, ease: 'power2.out', duration: holdStart - enter },
            enter,
          );
        } else {
          tl.set(beat, { opacity: 1, y: 0 }, enter);
        }

        // Exit tween — fade out + lift to y:−20.
        if (holdEnd < exit) {
          tl.to(
            beat,
            { opacity: 0, y: -20, ease: 'power1.in', duration: exit - holdEnd },
            holdEnd,
          );
        }
      });
    }, wrapperEl);

    return () => ctx.revert();
  }, [renderMode]);

  /* ── WebGPU intensity ScrollTrigger ──
     Drives the three-act brightness / bloom sequence on top of the continuously
     running curl-noise simulation. Hand-computes target values from progress
     (one onUpdate callback) rather than building a parallel GSAP timeline. */
  useEffect(() => {
    if (renderMode !== 'webgpu' || !intensityReady) return;
    const intensity = intensityRef.current;
    const wrapperEl = wrapperRef.current;
    if (!intensity || !wrapperEl) return;

    const st = ScrollTrigger.create({
      trigger: wrapperEl,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 2,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        if (p < OVERTURE_END) {
          // Act 1 — overture: bright → normal during text 1's entry window.
          const t = p / OVERTURE_END;
          intensity.brightness = lerp(INTENSITY_BRIGHT.brightness, INTENSITY_NORMAL.brightness, t);
          intensity.bloomStrength = lerp(INTENSITY_BRIGHT.bloomStrength, INTENSITY_NORMAL.bloomStrength, t);
          intensity.bloomThreshold = lerp(INTENSITY_BRIGHT.bloomThreshold, INTENSITY_NORMAL.bloomThreshold, t);
        } else if (p > OUTRO_START) {
          // Act 3 — outro: normal → bright after beat 5 exits.
          const t = (p - OUTRO_START) / (1 - OUTRO_START);
          intensity.brightness = lerp(INTENSITY_NORMAL.brightness, INTENSITY_BRIGHT.brightness, t);
          intensity.bloomStrength = lerp(INTENSITY_NORMAL.bloomStrength, INTENSITY_BRIGHT.bloomStrength, t);
          intensity.bloomThreshold = lerp(INTENSITY_NORMAL.bloomThreshold, INTENSITY_BRIGHT.bloomThreshold, t);
        } else {
          // Act 2 — reading: hold at normal values.
          intensity.brightness = INTENSITY_NORMAL.brightness;
          intensity.bloomStrength = INTENSITY_NORMAL.bloomStrength;
          intensity.bloomThreshold = INTENSITY_NORMAL.bloomThreshold;
        }
      },
    });

    return () => st.kill();
  }, [renderMode, intensityReady]);

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

  // ─── Full-motion JSX: wrapper height 600vh (webgpu) or 500vh (video), sticky 100vh stage ───
  const wrapperHeight = renderMode === 'webgpu' ? '600vh' : '500vh';
  return (
    <section
      ref={wrapperRef}
      className="mid-section-wrapper"
      style={{ height: wrapperHeight }}
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
