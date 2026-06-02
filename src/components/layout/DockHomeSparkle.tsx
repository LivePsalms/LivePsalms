import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  type CSSProperties,
} from 'react';
import { usePrefersReducedMotion } from '@/notepad-landing/hooks/use-prefers-reduced-motion';

export interface DockHomeSparkleHandle {
  burst: () => void;
}

interface Particle {
  id: number;
  kind: 'ring' | 'ember';
  style: CSSProperties;
}

const EMBER_COUNT = 8;
const TILE = 44; // .dock-home is h-11 w-11 = 44px
const CENTER = TILE / 2;

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

let seq = 0;
const nextId = () => (seq += 1);

function buildParticles(): Particle[] {
  const particles: Particle[] = [];

  // One ripple ring, centered on the tile.
  particles.push({
    id: nextId(),
    kind: 'ring',
    style: {
      left: `${CENTER}px`,
      top: `${CENTER}px`,
      width: '14px',
      height: '14px',
      marginLeft: '-7px',
      marginTop: '-7px',
      border: '2px solid rgba(255,253,248,0.9)',
      background: 'transparent',
      boxShadow: '0 0 6px rgba(255,253,248,0.5)',
      animation: 'dock-sparkle-ring 900ms cubic-bezier(0.22,0.61,0.36,1) forwards',
    },
  });

  // Embers ignite ~10px above the tile center so they are never briefly
  // hidden against the cream tile in the dark-section dock theme.
  const originY = CENTER - 10;
  for (let i = 0; i < EMBER_COUNT; i += 1) {
    const size = rnd(3.5, 6);
    const x = CENTER + rnd(-8, 8);
    const y = originY + rnd(-4, 4);
    particles.push({
      id: nextId(),
      kind: 'ember',
      style: {
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        background:
          'radial-gradient(circle, #fffdf8 0%, #f6f4f0 55%, rgba(246,244,240,0) 100%)',
        boxShadow:
          '0 0 7px 2px rgba(255,253,248,0.95), 0 0 2px 1px rgba(120,110,95,0.4)',
        ['--ex' as string]: `${rnd(-11, 11)}px`,
        ['--ey' as string]: `${rnd(-56, -34)}px`,
        animation: `dock-ember ${rnd(850, 1150)}ms cubic-bezier(0.22,0.61,0.36,1) ${rnd(0, 150)}ms forwards`,
      },
    });
  }

  return particles;
}

/**
 * Callback ref that attaches a native `animationend` listener to a particle
 * span so the cleanup works in both real browsers and jsdom (which lacks
 * AnimationEvent and therefore doesn't fire React's synthetic onAnimationEnd).
 */
function ParticleSpan({
  particle,
  onRemove,
}: {
  particle: Particle;
  onRemove: (id: number) => void;
}) {
  const callbackRef = useCallback(
    (node: HTMLSpanElement | null) => {
      if (!node) return;
      const handler = () => onRemove(particle.id);
      node.addEventListener('animationend', handler);
      // No cleanup needed: element is unmounted after removal, listener is GC'd.
    },
    // particle.id is stable for the lifetime of this element; onRemove is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <span
      ref={callbackRef}
      data-particle={particle.kind}
      style={{
        position: 'absolute',
        borderRadius: '50%',
        pointerEvents: 'none',
        willChange: 'transform, opacity',
        opacity: 0,
        ...particle.style,
      }}
    />
  );
}

/**
 * Fire-and-forget sparkle layer for the mobile bottom-dock logo tile.
 * Mirrors the WaterRipple pattern: particles live in state and remove
 * themselves on animation end. Call burst() (via ref) to fire one.
 * burst() is a no-op under prefers-reduced-motion.
 */
export const DockHomeSparkle = forwardRef<DockHomeSparkleHandle>(
  function DockHomeSparkle(_props, ref) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const reducedMotion = usePrefersReducedMotion();

    const burst = useCallback(() => {
      if (reducedMotion) return;
      setParticles((prev) => [...prev, ...buildParticles()]);
    }, [reducedMotion]);

    useImperativeHandle(ref, () => ({ burst }), [burst]);

    const remove = useCallback((id: number) => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return (
      <span
        aria-hidden="true"
        data-testid="dock-home-sparkle"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {particles.map((p) => (
          <ParticleSpan key={p.id} particle={p} onRemove={remove} />
        ))}
      </span>
    );
  },
);
