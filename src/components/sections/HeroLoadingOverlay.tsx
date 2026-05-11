import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface HeroLoadingOverlayProps {
  active: boolean;
  onCrossfadeComplete?: () => void;
}

/**
 * Visual lifecycle. We need three states (not just `active`) so the overlay:
 *   - stays out of the DOM entirely when there's nothing to show (so it never
 *     covers the home hero intro on `/`),
 *   - mounts cleanly when activation begins,
 *   - keeps the dissolve playing after `active` flips back to false.
 */
type Phase = 'invisible' | 'active' | 'dissolving';

interface Particle {
  cx: number;
  cy: number;
  r: number;
  riseY: number;   // SVG userspace units of upward travel (negative = up)
  driftX: number;  // small horizontal sway
  delay: number;   // when this particle starts its ascent (seconds)
  duration: number; // travel duration (seconds)
}

const VIEWBOX_W = 251;
const VIEWBOX_H = 282;
const PARTICLE_COUNT = 60;
const PARTICLE_SEED = 0xa1f5b;

// Deterministic pseudo-random so particle positions are stable across remounts
// and across HMR — prevents the dissolve from "shuffling" on dev reload.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateParticles(pathEl: SVGPathElement | null): Particle[] {
  const rand = mulberry32(PARTICLE_SEED);
  const particles: Particle[] = [];
  let attempts = 0;
  const MAX_ATTEMPTS = 4000;

  while (particles.length < PARTICLE_COUNT && attempts < MAX_ATTEMPTS) {
    const cx = rand() * VIEWBOX_W;
    const cy = rand() * VIEWBOX_H;
    let inside = true;

    if (pathEl) {
      try {
        const pt = new DOMPoint(cx, cy);
        inside = pathEl.isPointInFill(pt);
      } catch {
        // isPointInFill / DOMPoint unsupported — fall through and accept point
      }
    }

    if (inside) {
      particles.push({
        cx,
        cy,
        r: 0.7 + rand() * 1.8,          // 0.7 → 2.5
        riseY: -(170 + rand() * 200),    // -170 → -370
        driftX: (rand() - 0.5) * 50,    // -25 → +25
        delay: rand() * 0.30,            // 0 → 0.30s
        duration: 1.0 + rand() * 0.6,    // 1.0 → 1.6s
      });
    }
    attempts++;
  }
  return particles;
}

/**
 * Universal loading overlay. Plays the heartbeat-A loop while `active`,
 * then on deactivation: the A's silhouette breaks into ~60 specks that
 * ascend into the sky, each visible until it dissolves; the dark canvas
 * crossfades only after the specks are well underway.
 *
 * Visuals match the home hero intro: same dark canvas radial gradient,
 * same glow aura, same heartbeat keyframes.
 */
export function HeroLoadingOverlay({ active, onCrossfadeComplete }: HeroLoadingOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const particleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Phase state derived from the `active` prop. Initial value depends on the
  // first-render prop: if active=true at mount, start in 'active'; if
  // active=false at mount (e.g., user is on `/` for the home intro), start in
  // 'invisible' so the overlay never renders.
  const [phase, setPhase] = useState<Phase>(() => (active ? 'active' : 'invisible'));

  // Drive phase transitions from prop changes:
  //   invisible → active     (prop flips to true)
  //   active    → dissolving (prop flips to false)
  // The 'dissolving' → 'invisible' transition is fired by the dissolve
  // animation's onComplete callback (handleDissolveComplete below), not here,
  // so we don't unmount before the dissolve has actually played.
  useEffect(() => {
    if (active && phase === 'invisible') {
      setPhase('active');
    } else if (!active && phase === 'active') {
      setPhase('dissolving');
    }
  }, [active, phase]);

  const handleDissolveComplete = useCallback(() => {
    setPhase('invisible');
    onCrossfadeComplete?.();
  }, [onCrossfadeComplete]);

  // Sample particle origins from inside the A's silhouette at mount.
  useLayoutEffect(() => {
    if (phase === 'invisible') return;
    setParticles(generateParticles(pathRef.current));
  }, [phase]);

  // Heartbeat loop while active
  useLayoutEffect(() => {
    if (phase !== 'active') return;
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
  }, [phase]);

  // Particulate dissolve when active flips to false.
  //   Phase 1 (0   → 1.0):   A path fades + slight scale-up; aura starts fading.
  //   Phase 2 (0   → 1.9):   particles emerge at their origin points and rise.
  //                          Each particle stays at full opacity until its last
  //                          ~0.4s, so each speck is *seen* until it dissolves.
  //   Phase 3 (1.3 → 2.0):   dark canvas crossfades after particles are mostly
  //                          out of frame (otherwise cream specks would lose
  //                          contrast against the brightening plaster background).
  useEffect(() => {
    if (phase !== 'dissolving') return;
    const root = rootRef.current;
    const glyph = glyphRef.current;
    const aura = auraRef.current;
    if (!root || !glyph || !aura) return;

    const tl = gsap.timeline({
      onComplete: handleDissolveComplete,
    });

    // Phase 1 — A's body dematerializes underneath the rising specks.
    tl.to(
      glyph,
      {
        opacity: 0,
        scale: 1.06,
        duration: 1.0,
        ease: 'power1.inOut',
      },
      0.1,
    );

    // Aura fades alongside the A so no ghost glow lingers in mid-air.
    tl.to(
      aura,
      {
        opacity: 0,
        duration: 1.0,
        ease: 'power2.out',
      },
      0.3,
    );

    // Phase 2 — every speck rises. Each particle has its own randomized
    // delay/duration/distance baked in at mount; we just apply them here.
    particles.forEach((p, i) => {
      const el = particleRefs.current[i];
      if (!el) return;
      // Fade in quickly (the speck "ignites")
      tl.to(el, { opacity: 1, duration: 0.15, ease: 'power1.out' }, p.delay);
      // Rise + drift, keeping full opacity throughout the travel
      tl.to(
        el,
        { y: p.riseY, x: p.driftX, duration: p.duration, ease: 'power2.out' },
        p.delay,
      );
      // Final fade only at the END of the travel — the speck is *seen*
      // until it dissolves.
      tl.to(
        el,
        { opacity: 0, duration: 0.4, ease: 'power2.in' },
        p.delay + p.duration - 0.35,
      );
    });

    // Phase 3 — dark canvas crossfade. Holds dark until specks are mostly
    // through their journey.
    tl.to(
      root,
      {
        opacity: 0,
        duration: 0.7,
        ease: 'power2.inOut',
      },
      1.3,
    );

    return () => {
      tl.kill();
    };
  }, [phase, handleDissolveComplete, particles]);

  // While 'invisible', stay completely out of the DOM so we never paint
  // anything (no dark canvas, no flash) over whatever the active route is
  // showing. This is the key to coexisting with the home hero intro.
  if (phase === 'invisible') return null;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-busy={phase === 'active'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        opacity: 1,
        pointerEvents: phase === 'active' ? 'auto' : 'none',
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
          glyph at its viewBox edges, and so particles can rise far above the A
          during dissolve without being cropped. */}
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
          <path
            ref={pathRef}
            d="M 124.625 0 L 250.734375 281.515625 L 216.578125 281.515625 L 170.03125 178.296875 C 170.03125 191.308594 167.96875 204.007812 163.84375 216.390625 C 159.71875 228.777344 153.648438 239.851562 145.640625 249.609375 C 137.628906 259.371094 127.742188 267.132812 115.984375 272.890625 C 104.222656 278.640625 90.710938 281.515625 75.453125 281.515625 C 58.929688 281.515625 44.789062 277.953125 33.03125 270.828125 C 21.269531 263.695312 12.507812 253.933594 6.75 241.546875 C 1 229.152344 -1 215.074219 0.75 199.3125 C 2 187.804688 4.9375 176.605469 9.5625 165.71875 C 14.195312 154.835938 19.640625 144.261719 25.890625 134 C 32.148438 123.742188 38.410156 113.980469 44.671875 104.71875 C 52.421875 93.210938 59.363281 82.199219 65.5 71.6875 C 71.632812 61.179688 76.828125 50.105469 81.078125 38.46875 C 85.328125 26.835938 88.332031 14.011719 90.09375 0 Z M 161.40625 159.15625 L 94.59375 10.125 C 91.84375 25.648438 87.398438 40.351562 81.265625 54.234375 C 75.128906 68.121094 68.0625 82.074219 60.0625 96.09375 C 54.550781 106.105469 48.789062 116.804688 42.78125 128.1875 C 36.78125 139.574219 31.898438 151.210938 28.140625 163.09375 C 24.390625 174.980469 23.140625 186.929688 24.390625 198.9375 C 25.648438 211.199219 29.59375 222.023438 36.21875 231.40625 C 42.851562 240.792969 51.675781 247.617188 62.6875 251.875 C 73.695312 256.125 86.457031 256.996094 100.96875 254.484375 C 110.226562 252.984375 119.300781 248.859375 128.1875 242.109375 C 137.070312 235.351562 144.703125 227.214844 151.078125 217.703125 C 157.460938 208.195312 161.78125 198.308594 164.03125 188.046875 C 166.28125 177.789062 165.40625 168.15625 161.40625 159.15625 Z M 161.40625 159.15625 "
          />
        </g>

        {/* Particles — sampled from inside the A's silhouette. Hidden at rest
            (opacity 0); fade in + rise + final-fade only during dissolve. */}
        <g fill="currentColor">
          {particles.map((p, i) => (
            <circle
              key={i}
              ref={(el) => {
                particleRefs.current[i] = el;
              }}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              opacity={0}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
