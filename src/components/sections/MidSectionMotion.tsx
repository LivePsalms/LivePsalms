import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const VIDEO_SRC = '/mid-section-motion.mp4';
const POSTER_SRC = '/mid-section-motion-last-frame.jpg';

export function MidSectionMotion() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const sectionEl = sectionRef.current;
    const pinEl = pinRef.current;
    const videoEl = videoRef.current;
    if (!sectionEl || !pinEl || !videoEl) return;

    const ctx = gsap.context(() => {
      let duration = 0;
      let ready = false;

      const onMeta = () => {
        duration = videoEl.duration;
        ready = Number.isFinite(duration) && duration > 0;
      };
      if (videoEl.readyState >= 1) {
        onMeta();
      } else {
        videoEl.addEventListener('loadedmetadata', onMeta);
      }

      const setTime = gsap.quickSetter(videoEl, 'currentTime') as (value: number) => void;

      ScrollTrigger.create({
        trigger: sectionEl,
        start: 'top top',
        end: 'bottom bottom',
        pin: pinEl,
        scrub: true,
        onUpdate: (self) => {
          if (!ready) return;
          setTime(self.progress * duration);
        },
      });

      return () => {
        videoEl.removeEventListener('loadedmetadata', onMeta);
      };
    }, sectionEl);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <section
        ref={sectionRef}
        className="relative w-full overflow-hidden"
        style={{ height: '100vh' }}
        aria-hidden="true"
      >
        <img
          src={POSTER_SRC}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: '200vh' }}
      aria-hidden="true"
    >
      <div ref={pinRef} className="relative h-screen w-full overflow-hidden">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </section>
  );
}
