import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

interface HeroLoadingOverlayProps {
  active: boolean;
  onCrossfadeComplete?: () => void;
}

/**
 * Universal loading overlay. Plays the heartbeat-A loop while `active`,
 * crossfades out when `active` flips to false, then calls onCrossfadeComplete
 * (so the parent can unmount the component if desired).
 *
 * Visuals match the home hero intro: same dark canvas radial gradient,
 * same glow aura, same heartbeat keyframes.
 */
export function HeroLoadingOverlay({ active, onCrossfadeComplete }: HeroLoadingOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<SVGGElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);

  // Heartbeat loop while active
  useLayoutEffect(() => {
    if (!active) return;
    const glyph = glyphRef.current;
    const aura = auraRef.current;
    if (!glyph || !aura) return;

    gsap.set(glyph, { scale: 1, transformOrigin: '50% 50%' });
    gsap.set(aura, { opacity: 0.18, scale: 1 });

    const tl = gsap.timeline({ repeat: -1, paused: true });

    // Lub
    tl.to(glyph, { scale: 1.022, duration: 0.18, ease: 'power2.out' }, 0);
    tl.to(glyph, { scale: 1.0,   duration: 0.32, ease: 'power3.out' }, 0.18);
    tl.to(aura,  { opacity: 0.42, scale: 1.08, duration: 0.18, ease: 'power2.out' }, 0);
    tl.to(aura,  { opacity: 0.18, scale: 1.0,  duration: 0.32, ease: 'power2.out' }, 0.18);

    // Dub at 0.75s
    const dub = 0.75;
    tl.to(glyph, { scale: 1.042, duration: 0.22, ease: 'power2.out' }, dub);
    tl.to(glyph, { scale: 1.0,   duration: 0.50, ease: 'power3.out' }, dub + 0.22);
    tl.to(aura,  { opacity: 0.78, scale: 1.18, duration: 0.22, ease: 'power2.out' }, dub);
    tl.to(aura,  { opacity: 0.18, scale: 1.0,  duration: 0.50, ease: 'power2.out' }, dub + 0.22);

    // Rest gap so the cycle is ~1.95s total
    tl.set({}, {}, 1.95);

    tl.play(0);
    return () => {
      tl.kill();
    };
  }, [active]);

  // Dissolve-and-crossfade out when active flips to false.
  // Two overlapping phases:
  //   1. The A glyph ascends and dissolves (upward translate, slight scale-up,
  //      blur, opacity → 0) — "into the sky". The aura fades alongside so no
  //      ghost glow lingers.
  //   2. The dark canvas (the overlay root) crossfades opacity → 0, starting
  //      after the A is mostly dissolved.
  useEffect(() => {
    if (active) return;
    const root = rootRef.current;
    const glyph = glyphRef.current;
    const aura = auraRef.current;
    if (!root || !glyph || !aura) return;

    const tl = gsap.timeline({
      onComplete: () => {
        onCrossfadeComplete?.();
      },
    });

    // Phase 1 — A dissolves into the sky. y is in SVG userspace units;
    // -100 is ~35% of the viewBox height (282).
    tl.to(
      glyph,
      {
        y: -100,
        scale: 1.15,
        opacity: 0,
        filter: 'blur(5px)',
        duration: 1.2,
        ease: 'power2.out',
      },
      0,
    );

    // Aura fades alongside the A so no ghost glow lingers in mid-air.
    tl.to(
      aura,
      {
        opacity: 0,
        duration: 1.0,
        ease: 'power2.out',
      },
      0,
    );

    // Phase 2 — dark canvas crossfade. Starts after the A is mostly gone
    // so the upward motion reads against the dark background, not the
    // brightening plaster underneath.
    tl.to(
      root,
      {
        opacity: 0,
        duration: 0.9,
        ease: 'power2.inOut',
      },
      0.6,
    );

    return () => {
      tl.kill();
    };
  }, [active, onCrossfadeComplete]);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-busy={active}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        opacity: 1,
        pointerEvents: active ? 'auto' : 'none',
        background:
          'radial-gradient(ellipse 90% 70% at 50% 50%, #0e0c10 0%, #08070a 60%, #050507 100%), #0a0a0c',
      }}
    >
      <span className="sr-only">Loading</span>

      {/* Glow aura — sits behind the A */}
      <div
        ref={auraRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 'min(220px, 30vw)',
          height: 'min(220px, 30vw)',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle at center, rgba(246, 244, 240, 0.32) 0%, rgba(246, 244, 240, 0.12) 22%, rgba(246, 244, 240, 0.04) 45%, rgba(246, 244, 240, 0) 72%)',
          borderRadius: '50%',
          opacity: 0,
          mixBlendMode: 'screen',
          filter: 'blur(14px)',
          willChange: 'opacity, transform',
          pointerEvents: 'none',
        }}
      />

      {/* A glyph SVG — overflow:visible so the heartbeat scale doesn't clip the
          glyph at its viewBox edges. The path fills the box edge-to-edge and
          scales up by 1.042 at the dub peak, which extends ~6 units past each
          edge; without overflow:visible those edges get cropped. */}
      <svg
        aria-hidden="true"
        overflow="visible"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 'min(120px, 12vw)',
          height: 'auto',
          transform: 'translate(-50%, -50%)',
          color: '#f6f4f0',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
        viewBox="0 0 251 282"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g ref={glyphRef} fill="currentColor">
          <path d="M 124.625 0 L 250.734375 281.515625 L 216.578125 281.515625 L 170.03125 178.296875 C 170.03125 191.308594 167.96875 204.007812 163.84375 216.390625 C 159.71875 228.777344 153.648438 239.851562 145.640625 249.609375 C 137.628906 259.371094 127.742188 267.132812 115.984375 272.890625 C 104.222656 278.640625 90.710938 281.515625 75.453125 281.515625 C 58.929688 281.515625 44.789062 277.953125 33.03125 270.828125 C 21.269531 263.695312 12.507812 253.933594 6.75 241.546875 C 1 229.152344 -1 215.074219 0.75 199.3125 C 2 187.804688 4.9375 176.605469 9.5625 165.71875 C 14.195312 154.835938 19.640625 144.261719 25.890625 134 C 32.148438 123.742188 38.410156 113.980469 44.671875 104.71875 C 52.421875 93.210938 59.363281 82.199219 65.5 71.6875 C 71.632812 61.179688 76.828125 50.105469 81.078125 38.46875 C 85.328125 26.835938 88.332031 14.011719 90.09375 0 Z M 161.40625 159.15625 L 94.59375 10.125 C 91.84375 25.648438 87.398438 40.351562 81.265625 54.234375 C 75.128906 68.121094 68.0625 82.074219 60.0625 96.09375 C 54.550781 106.105469 48.789062 116.804688 42.78125 128.1875 C 36.78125 139.574219 31.898438 151.210938 28.140625 163.09375 C 24.390625 174.980469 23.140625 186.929688 24.390625 198.9375 C 25.648438 211.199219 29.59375 222.023438 36.21875 231.40625 C 42.851562 240.792969 51.675781 247.617188 62.6875 251.875 C 73.695312 256.125 86.457031 256.996094 100.96875 254.484375 C 110.226562 252.984375 119.300781 248.859375 128.1875 242.109375 C 137.070312 235.351562 144.703125 227.214844 151.078125 217.703125 C 157.460938 208.195312 161.78125 198.308594 164.03125 188.046875 C 166.28125 177.789062 165.40625 168.15625 161.40625 159.15625 Z M 161.40625 159.15625 " />
        </g>
      </svg>
    </div>
  );
}
