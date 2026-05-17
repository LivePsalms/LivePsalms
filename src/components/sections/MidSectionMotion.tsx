import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  BEATS,
  MID_SECTION_PIN_TIMING,
  MID_SECTION_VIDEO_DURATION,
} from './mid-section-motion-content';

gsap.registerPlugin(ScrollTrigger);

const TIMING = [
  MID_SECTION_PIN_TIMING.beat1,
  MID_SECTION_PIN_TIMING.beat2,
  MID_SECTION_PIN_TIMING.beat3,
  MID_SECTION_PIN_TIMING.beat4,
  MID_SECTION_PIN_TIMING.beat5,
] as const;

export function MidSectionMotion() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const beatRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  // Reduced-motion path uses a separate set of refs to keep the two paths cleanly isolated.
  const reducedBeatRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /* ── Full-motion path: pinned, scrubbed video + 5-beat slideshow ── */
  useEffect(() => {
    if (prefersReducedMotion) return;

    const wrapperEl = wrapperRef.current;
    const stageEl = stageRef.current;
    const videoEl = videoRef.current;
    const beatEls = beatRefs.current.slice(0, 5);
    if (!wrapperEl || !stageEl || !videoEl || beatEls.some((b) => !b)) return;

    const ctx = gsap.context(() => {
      // Initial states — beats hidden and offset below resting position; video at frame 0.
      gsap.set(beatEls, { opacity: 0, y: 20 });
      videoEl.currentTime = 0;

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

      // Video scrub — single continuous tween of currentTime across the entire timeline.
      // GSAP tweens any numeric property; videoEl.currentTime ramps 0 → duration linearly.
      tl.to(
        videoEl,
        { currentTime: MID_SECTION_VIDEO_DURATION, ease: 'none', duration: 1 },
        0,
      );

      // Per-beat enter / exit tweens at MID_SECTION_PIN_TIMING positions.
      TIMING.forEach((t, i) => {
        const beat = beatEls[i];
        if (!beat) return;

        // Enter tween — fade in + rise from y:20 to y:0. Skip if enter === holdStart (no entry window).
        if (t.enter < t.holdStart) {
          tl.to(
            beat,
            { opacity: 1, y: 0, ease: 'power2.out', duration: t.holdStart - t.enter },
            t.enter,
          );
        } else {
          // No entry window — beat starts at full opacity at progress 0 (i.e., beat 1 only).
          tl.set(beat, { opacity: 1, y: 0 }, t.enter);
        }

        // Exit tween — fade out + lift to y:−20. Skip if holdEnd === exit (no exit window).
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
  }, [prefersReducedMotion]);

  /* ── Reduced-motion fallback: IntersectionObserver fades on five stacked blocks ── */
  useEffect(() => {
    if (!prefersReducedMotion) return;

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
  }, [prefersReducedMotion]);

  // ─── Reduced-motion JSX: five stacked blocks with poster + beat, no pin, no video element ───
  if (prefersReducedMotion) {
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

  // ─── Full-motion JSX: 500vh wrapper, sticky 100vh stage, full-bleed video + 5 absolute-centered beats ───
  return (
    <section
      ref={wrapperRef}
      className="mid-section-wrapper"
      aria-label="Reflection"
    >
      <div ref={stageRef} className="mid-section-stage">
        <video
          ref={videoRef}
          src="/mid-section-video.mp4"
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          disablePictureInPicture
          disableRemotePlayback
          className="mid-section-video"
        />
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
