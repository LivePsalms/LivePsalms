import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BEATS } from './mid-section-motion-content';
// Type-only import — erased at build, so it does NOT pull `three/webgpu` into
// this chunk. The scene module (and three) is loaded lazily via dynamic
// import() inside the mount effect below, only when renderMode === 'webgpu'.
import type { CurlLinesIntensity } from './mid-section-webgpu-scene';
import { computeIntensityState } from './mid-section-intensity';
import { applyKeyframes } from './motion-keyframes';
import { buildMidSectionBeatKeyframes } from './mid-section-beat-keyframes';
import { initialRenderMode, type RenderMode } from './mid-section-render-mode';

gsap.registerPlugin(ScrollTrigger);

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

    // Lazy-load the WebGPU scene (and three) only now that we know this browser
    // is in webgpu render mode. Keeps three/webgpu out of the homepage's main
    // bundle for every non-WebGPU visitor.
    import('./mid-section-webgpu-scene')
      .then(({ mountCurlLinesScene }) => mountCurlLinesScene(canvas))
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
        // navigator.gpu existed but the chunk failed to load, or mount failed
        // (requestAdapter returned null, or the renderer init threw). Escalate
        // to MP4 fallback.
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
     WebGPU mode maps beat positions through mapBeatProgressWebGPU, offsetting them
     into the reading band (INTRO_END → OUTRO_START, i.e. 1/7 → 6/7 ≈ 0.143 → 0.857).
     Beat 5 exits at OUTRO_START, leaving the final 1/7 of the timeline for the
     intensity outro. In video mode, beat positions are used raw and beat 5 exits
     at progress 1.0 (no outro). */
  useEffect(() => {
    if (renderMode !== 'webgpu' && renderMode !== 'video') return;

    const wrapperEl = wrapperRef.current;
    const stageEl = stageRef.current;
    const beatEls = beatRefs.current.slice(0, 5);
    if (!wrapperEl || !stageEl || beatEls.some((b) => !b)) return;

    const ctx = gsap.context(() => {
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

      // In webgpu mode the last text tween ends at timeline-position OUTRO_START
      // (≈ 0.857), but ScrollTrigger.scrub maps its 0..1 progress onto the timeline's
      // totalDuration. Without padding, scroll progress 1.0 would only reach timeline
      // position 0.857 — beat 5 would stay visible through the entire outro. Pad with
      // a phantom set at position 1 so timeline totalDuration matches the scroll range.
      // (Scrub mechanics, not beat data — stays in the harness.)
      if (renderMode === 'webgpu') {
        tl.set({}, {}, 1);
      }

      // Resolve abstract beat names → DOM elements, then play the declarative
      // keyframe data onto the timeline. The initial hidden state (opacity 0, y 20)
      // is folded into each beat's enter fromTo inside buildMidSectionBeatKeyframes.
      const targets = {
        beat1: beatEls[0],
        beat2: beatEls[1],
        beat3: beatEls[2],
        beat4: beatEls[3],
        beat5: beatEls[4],
      };
      applyKeyframes(tl, buildMidSectionBeatKeyframes(renderMode), targets);
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
        const state = computeIntensityState(self.progress);
        intensity.brightness = state.brightness;
        intensity.bloomStrength = state.bloomStrength;
        intensity.bloomThreshold = state.bloomThreshold;
        intensity.simSpeed = state.simSpeed;
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

  // ─── Full-motion JSX: wrapper height 700vh (webgpu) or 500vh (video), sticky 100vh stage ───
  const wrapperHeight = renderMode === 'webgpu' ? '700vh' : '500vh';
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
              className={
                i === BEATS.length - 1
                  ? 'mid-section-beat mid-section-beat--long'
                  : 'mid-section-beat'
              }
            >
              {text}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
