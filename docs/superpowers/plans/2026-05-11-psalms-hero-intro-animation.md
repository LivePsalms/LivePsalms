# PSALMS Hero Intro Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the HyperFrames PSALMS logo reveal into `Hero.tsx` as a single orchestrated GSAP timeline, gated to play once per browser session, that ends in a state visually identical to today's hero first paint.

**Architecture:** One paused GSAP timeline lives in `Hero.tsx` and owns six tracks (letter motion, glow/ring, dark canvas crossfade, letter color crossfade, letter opacity crossfade, `showNav` handoff). The inline PSALMS SVG replaces `/logo-hero.png`. A pure decision module (`hero-intro-gate.ts`) computes whether to play the intro from `sessionStorage` + `matchMedia('(prefers-reduced-motion: reduce)')`; that decision is lifted into `App.tsx` so it can also disable `WaterRipple` during the intro.

**Tech Stack:** React 18, TypeScript, Vite, GSAP 3 (already in use, with ScrollTrigger), Vitest (`environment: 'node'`), Tailwind CSS.

**Reference:** Design spec at `docs/superpowers/specs/2026-05-11-psalms-hero-intro-animation-design.md`. Source animation at `public/Logo-motion/my-video/index.html` (do not load at runtime — copy values from it).

**Testing approach:** Codebase tests pure functions in Vitest's Node environment (no jsdom). Unit tests cover the gate decision module. Animation/visual behavior is verified manually in the dev server. This matches the existing convention (see `src/notepad/first-load/notepad-first-load.test.ts`).

---

## File Structure

**Files created:**

- `src/components/sections/hero-intro-gate.ts` — Pure decision module. Exports `decideHeroIntro({ storage, prefersReducedMotion }) → { playIntro: boolean; persistFlag: boolean }` and storage key constants. No React, no DOM access.
- `src/components/sections/hero-intro-gate.test.ts` — Vitest unit tests for the gate module using a fake storage analog to `src/notepad/first-load/notepad-first-load.test.ts`.
- `src/components/sections/PsalmsWordmarkSvg.tsx` — Pure presentational React component rendering the six PSALMS letter paths as an inline SVG. Each letter `<g>` has a stable id (`letter-P`, `letter-S1`, `letter-A`, `letter-L`, `letter-M`, `letter-S2`) so GSAP can select them. The component exposes a `ref` to the outer `<svg>` element.

**Files modified:**

- `src/components/sections/Hero.tsx` — Add intro props, replace the `<img>` block with `<PsalmsWordmarkSvg>`, add dark canvas + glow-aura + pulse-ring DOM, build the GSAP intro timeline, internalize `showNav`, set up the resize observer for responsive aura/ring sizing.
- `src/components/ui-custom/WaterRipple.tsx` — Add `disabled?: boolean` prop that gates click/touch/mousemove handlers (additive, no behavior change when `false` or `undefined`).
- `src/App.tsx` — Compute initial intro state via `decideHeroIntro` at App mount, hold it in state, pass `disabled` to `<WaterRipple>` and `introActive`/`onIntroComplete` to `<Hero>`.

**Files orphaned (do not delete in this plan):**

- `public/logo-hero.png` — No longer referenced. Left in place to avoid scope creep; can be deleted in a follow-up commit.

**Files untouched:**

- `public/Logo-motion/my-video/` — Stays as the design document. Not loaded at runtime.

---

## Task 1: Create the pure intro-gate decision module

**Files:**
- Create: `src/components/sections/hero-intro-gate.ts`
- Create: `src/components/sections/hero-intro-gate.test.ts`

This is the pure decision logic. No DOM. No React. Mirrors the pattern of `src/notepad/first-load/notepad-first-load.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/sections/hero-intro-gate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  INTRO_FLAG_KEY,
  decideHeroIntro,
} from './hero-intro-gate';

interface FakeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  data: Map<string, string>;
}

function makeFakeStorage(initial?: Record<string, string>): FakeStorage {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('decideHeroIntro', () => {
  it('plays the intro when no flag and reduced-motion is not preferred', () => {
    const storage = makeFakeStorage();
    const result = decideHeroIntro({
      storage,
      prefersReducedMotion: false,
    });
    expect(result).toEqual({ playIntro: true, persistFlag: false });
  });

  it('skips the intro when the session flag is already set', () => {
    const storage = makeFakeStorage({ [INTRO_FLAG_KEY]: '1' });
    const result = decideHeroIntro({
      storage,
      prefersReducedMotion: false,
    });
    expect(result).toEqual({ playIntro: false, persistFlag: false });
  });

  it('skips the intro and asks caller to persist the flag when reduced-motion is preferred', () => {
    const storage = makeFakeStorage();
    const result = decideHeroIntro({
      storage,
      prefersReducedMotion: true,
    });
    expect(result).toEqual({ playIntro: false, persistFlag: true });
  });

  it('skips the intro when both flag is set and reduced-motion is preferred', () => {
    const storage = makeFakeStorage({ [INTRO_FLAG_KEY]: '1' });
    const result = decideHeroIntro({
      storage,
      prefersReducedMotion: true,
    });
    expect(result).toEqual({ playIntro: false, persistFlag: false });
  });

  it('uses sessionStorage key "psalms-intro-played"', () => {
    expect(INTRO_FLAG_KEY).toBe('psalms-intro-played');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/components/sections/hero-intro-gate.test.ts`

Expected: FAIL with "Cannot find module './hero-intro-gate'".

- [ ] **Step 3: Implement the module**

Create `src/components/sections/hero-intro-gate.ts`:

```typescript
export const INTRO_FLAG_KEY = 'psalms-intro-played';

export interface GateStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface GateInput {
  storage: GateStorage;
  prefersReducedMotion: boolean;
}

export interface GateDecision {
  playIntro: boolean;
  persistFlag: boolean;
}

export function decideHeroIntro({ storage, prefersReducedMotion }: GateInput): GateDecision {
  const flagAlreadySet = storage.getItem(INTRO_FLAG_KEY) === '1';

  if (flagAlreadySet) {
    return { playIntro: false, persistFlag: false };
  }

  if (prefersReducedMotion) {
    return { playIntro: false, persistFlag: true };
  }

  return { playIntro: true, persistFlag: false };
}

export function persistIntroPlayed(storage: GateStorage): void {
  storage.setItem(INTRO_FLAG_KEY, '1');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/components/sections/hero-intro-gate.test.ts`

Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/hero-intro-gate.ts src/components/sections/hero-intro-gate.test.ts
git commit -m "$(cat <<'EOF'
feat(hero): pure intro-gate decision module

Decides whether the hero intro animation should play based on
sessionStorage flag + prefers-reduced-motion. Mirrors the
notepad-first-load pattern: pure function, fake-storage tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create the PsalmsWordmarkSvg component

**Files:**
- Create: `src/components/sections/PsalmsWordmarkSvg.tsx`

Renders the six PSALMS letter paths as an inline SVG. Each letter `<g>` has a stable id so GSAP can select them. The component is purely presentational. The `viewBox` is cropped to the wordmark bounding box (1500 × 320 after vertical crop, preserving the original horizontal coordinate system).

No automated test — Vitest runs in Node, can't render React without jsdom. Verified manually in Task 9.

- [ ] **Step 1: Create the component file**

Create `src/components/sections/PsalmsWordmarkSvg.tsx`:

```typescript
import { forwardRef } from 'react';

interface PsalmsWordmarkSvgProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Inline PSALMS wordmark. Six letter paths are copied verbatim from
 * public/Logo-motion/my-video/index.html. Stable ids on each letter <g>
 * let GSAP select them during the intro timeline.
 *
 * The viewBox is cropped vertically (y: 540 → 860, height 320) so the SVG
 * occupies a horizontal box matching the original /logo-hero.png framing.
 * The internal translates (translate(6,558) + per-letter translates) are
 * preserved so the path data stays unchanged from the source composition.
 */
export const PsalmsWordmarkSvg = forwardRef<SVGSVGElement, PsalmsWordmarkSvgProps>(
  function PsalmsWordmarkSvg({ className, style }, ref) {
    return (
      <svg
        ref={ref}
        className={className}
        style={style}
        viewBox="0 540 1500 320"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="PSALMS"
        role="img"
      >
        <g transform="translate(6, 558)">
          <g fill="#f6f4f0">
            {/* P */}
            <g className="letter-anchor" transform="translate(2.702454, 285.118424)">
              <g id="letter-P" className="letter">
                <path d="M 0 -281.515625 L 135.875 -281.515625 C 149.394531 -281.515625 161.972656 -278.570312 173.609375 -272.6875 C 185.242188 -266.8125 194.6875 -258.492188 201.9375 -247.734375 C 209.195312 -236.972656 212.828125 -223.960938 212.828125 -208.703125 C 212.828125 -193.429688 209.070312 -180.414062 201.5625 -169.65625 C 194.0625 -158.894531 184.300781 -150.632812 172.28125 -144.875 C 160.269531 -139.125 147.507812 -136.25 134 -136.25 L 31.15625 -136.25 L 31.15625 0 L 0 0 Z M 31.15625 -275.515625 L 31.15625 -141.890625 L 114.859375 -141.890625 C 137.378906 -141.890625 154.082031 -148.082031 164.96875 -160.46875 C 175.851562 -172.851562 181.296875 -188.929688 181.296875 -208.703125 C 181.296875 -221.960938 178.101562 -233.597656 171.71875 -243.609375 C 165.34375 -253.617188 157.085938 -261.4375 146.953125 -267.0625 C 136.816406 -272.695312 125.992188 -275.515625 114.484375 -275.515625 Z M 31.15625 -275.515625 " />
              </g>
            </g>

            {/* S (first) */}
            <g className="letter-anchor" transform="translate(230.52366, 285.118424)">
              <g id="letter-S1" className="letter">
                <path d="M 98.34375 0 C 88.082031 0 77.820312 -0.9375 67.5625 -2.8125 C 57.300781 -4.6875 47.539062 -7.753906 38.28125 -12.015625 C 32.28125 -14.765625 26.085938 -18.453125 19.703125 -23.078125 C 13.328125 -27.710938 8.007812 -33.15625 3.75 -39.40625 C -0.5 -45.664062 -2.625 -52.425781 -2.625 -59.6875 C -2.625 -67.9375 0.125 -74.875 5.625 -80.5 C 11.132812 -86.132812 19.144531 -88.953125 29.65625 -88.953125 C 25.644531 -77.191406 24.828125 -66.117188 27.203125 -55.734375 C 29.585938 -45.347656 34.285156 -36.40625 41.296875 -28.90625 C 49.296875 -20.394531 59.425781 -14.257812 71.6875 -10.5 C 83.957031 -6.75 96.847656 -5.1875 110.359375 -5.8125 C 123.867188 -6.4375 136.691406 -9 148.828125 -13.5 C 160.960938 -18.007812 170.910156 -24.019531 178.671875 -31.53125 C 186.929688 -39.789062 192 -48.421875 193.875 -57.421875 C 195.75 -66.429688 194.992188 -75.191406 191.609375 -83.703125 C 188.234375 -92.210938 182.726562 -99.84375 175.09375 -106.59375 C 167.46875 -113.351562 158.398438 -118.609375 147.890625 -122.359375 C 137.628906 -126.117188 126.304688 -129.0625 113.921875 -131.1875 C 101.535156 -133.3125 89.085938 -135.6875 76.578125 -138.3125 C 64.066406 -140.945312 52.367188 -144.703125 41.484375 -149.578125 C 30.597656 -154.460938 21.398438 -161.40625 13.890625 -170.40625 C 6.128906 -179.914062 1.625 -190.800781 0.375 -203.0625 C -0.875 -215.332031 1.25 -226.722656 6.75 -237.234375 C 11.257812 -246.234375 17.578125 -253.609375 25.703125 -259.359375 C 33.835938 -265.117188 42.847656 -269.625 52.734375 -272.875 C 62.617188 -276.132812 72.753906 -278.390625 83.140625 -279.640625 C 93.523438 -280.890625 103.222656 -281.515625 112.234375 -281.515625 C 122.492188 -281.515625 132.753906 -280.578125 143.015625 -278.703125 C 153.273438 -276.828125 163.035156 -273.765625 172.296875 -269.515625 C 178.296875 -266.753906 184.484375 -262.992188 190.859375 -258.234375 C 197.242188 -253.484375 202.5625 -248.039062 206.8125 -241.90625 C 211.070312 -235.78125 213.203125 -229.09375 213.203125 -221.84375 C 213.203125 -213.332031 210.445312 -206.257812 204.9375 -200.625 C 199.4375 -195 191.429688 -192.3125 180.921875 -192.5625 C 184.671875 -203.070312 185.734375 -213.082031 184.109375 -222.59375 C 182.484375 -232.101562 178.796875 -240.484375 173.046875 -247.734375 C 166.785156 -256.242188 158.273438 -262.75 147.515625 -267.25 C 136.753906 -271.757812 125.179688 -274.453125 112.796875 -275.328125 C 100.410156 -276.203125 88.460938 -275.265625 76.953125 -272.515625 C 68.441406 -270.765625 60.117188 -267.695312 51.984375 -263.3125 C 43.847656 -258.9375 36.960938 -253.367188 31.328125 -246.609375 C 25.703125 -239.847656 22.390625 -231.71875 21.390625 -222.21875 C 20.390625 -211.707031 22.640625 -203.007812 28.140625 -196.125 C 33.648438 -189.238281 40.972656 -183.734375 50.109375 -179.609375 C 59.242188 -175.484375 68.566406 -172.164062 78.078125 -169.65625 C 89.835938 -166.90625 102.472656 -164.46875 115.984375 -162.34375 C 129.492188 -160.21875 142.691406 -157.273438 155.578125 -153.515625 C 168.472656 -149.765625 179.675781 -144.007812 189.1875 -136.25 C 198.4375 -128.75 205.4375 -119.929688 210.1875 -109.796875 C 214.945312 -99.660156 217.203125 -89.148438 216.953125 -78.265625 C 216.703125 -67.378906 213.945312 -56.929688 208.6875 -46.921875 C 203.4375 -36.910156 195.554688 -28.398438 185.046875 -21.390625 C 172.785156 -13.140625 158.707031 -7.507812 142.8125 -4.5 C 126.925781 -1.5 112.101562 0 98.34375 0 Z M 98.34375 0 " />
              </g>
            </g>

            {/* A (anchor) */}
            <g className="letter-anchor" transform="translate(462.848817, 285.118424)">
              <g id="letter-A" className="letter">
                <path d="M 124.625 -281.515625 L 250.734375 0 L 216.578125 0 L 170.03125 -103.21875 C 170.03125 -90.207031 167.96875 -77.507812 163.84375 -65.125 C 159.71875 -52.738281 153.648438 -41.664062 145.640625 -31.90625 C 137.628906 -22.144531 127.742188 -14.382812 115.984375 -8.625 C 104.222656 -2.875 90.710938 0 75.453125 0 C 58.929688 0 44.789062 -3.5625 33.03125 -10.6875 C 21.269531 -17.820312 12.507812 -27.582031 6.75 -39.96875 C 1 -52.363281 -1 -66.441406 0.75 -82.203125 C 2 -93.710938 4.9375 -104.910156 9.5625 -115.796875 C 14.195312 -126.679688 19.640625 -137.253906 25.890625 -147.515625 C 32.148438 -157.773438 38.410156 -167.535156 44.671875 -176.796875 C 52.421875 -188.304688 59.363281 -199.316406 65.5 -209.828125 C 71.632812 -220.335938 76.828125 -231.410156 81.078125 -243.046875 C 85.328125 -254.679688 88.332031 -267.503906 90.09375 -281.515625 Z M 161.40625 -122.359375 L 94.59375 -271.390625 C 91.84375 -255.867188 87.398438 -241.164062 81.265625 -227.28125 C 75.128906 -213.394531 68.0625 -199.441406 60.0625 -185.421875 C 54.550781 -175.410156 48.789062 -164.710938 42.78125 -153.328125 C 36.78125 -141.941406 31.898438 -130.304688 28.140625 -118.421875 C 24.390625 -106.535156 23.140625 -94.585938 24.390625 -82.578125 C 25.648438 -70.316406 29.59375 -59.492188 36.21875 -50.109375 C 42.851562 -40.722656 51.675781 -33.898438 62.6875 -29.640625 C 73.695312 -25.390625 86.457031 -24.519531 100.96875 -27.03125 C 110.226562 -28.53125 119.300781 -32.65625 128.1875 -39.40625 C 137.070312 -46.164062 144.703125 -54.300781 151.078125 -63.8125 C 157.460938 -73.320312 161.78125 -83.207031 164.03125 -93.46875 C 166.28125 -103.726562 165.40625 -113.359375 161.40625 -122.359375 Z M 161.40625 -122.359375 " />
              </g>
            </g>

            {/* L */}
            <g className="letter-anchor" transform="translate(718.068898, 285.118424)">
              <g id="letter-L" className="letter">
                <path d="M 0 0 L 0 -281.515625 L 31.15625 -281.515625 L 31.15625 -5.625 C 51.425781 -5.625 69.378906 -6.4375 85.015625 -8.0625 C 100.660156 -9.695312 114.863281 -11.828125 127.625 -14.453125 C 140.382812 -17.078125 152.644531 -19.828125 164.40625 -22.703125 C 176.164062 -25.585938 188.300781 -28.40625 200.8125 -31.15625 L 200.8125 0 Z M 0 0 " />
              </g>
            </g>

            {/* M */}
            <g className="letter-anchor" transform="translate(928.249745, 285.118424)">
              <g id="letter-M" className="letter">
                <path d="M 299.90625 0 L 206.078125 -272.515625 C 200.066406 -253.492188 194.242188 -234.535156 188.609375 -215.640625 C 182.984375 -196.742188 177.671875 -177.789062 172.671875 -158.78125 L 227.46875 0 L 194.4375 0 L 158.40625 -103.59375 C 150.644531 -70.5625 143.507812 -36.03125 137 0 L 105.46875 0 L 150.140625 -128.375 L 100.21875 -272.515625 C 86.457031 -227.972656 73.695312 -183.742188 61.9375 -139.828125 C 50.175781 -95.910156 39.914062 -49.300781 31.15625 0 L 0 0 L 97.21875 -281.515625 L 130.25 -281.515625 L 166.65625 -176.421875 L 202.6875 -281.515625 L 236.09375 -281.515625 L 333.3125 0 Z M 299.90625 0 " />
              </g>
            </g>

            {/* S (second) */}
            <g className="letter-anchor" transform="translate(1269.044447, 285.118424)">
              <g id="letter-S2" className="letter">
                <path d="M 98.34375 0 C 88.082031 0 77.820312 -0.9375 67.5625 -2.8125 C 57.300781 -4.6875 47.539062 -7.753906 38.28125 -12.015625 C 32.28125 -14.765625 26.085938 -18.453125 19.703125 -23.078125 C 13.328125 -27.710938 8.007812 -33.15625 3.75 -39.40625 C -0.5 -45.664062 -2.625 -52.425781 -2.625 -59.6875 C -2.625 -67.9375 0.125 -74.875 5.625 -80.5 C 11.132812 -86.132812 19.144531 -88.953125 29.65625 -88.953125 C 25.644531 -77.191406 24.828125 -66.117188 27.203125 -55.734375 C 29.585938 -45.347656 34.285156 -36.40625 41.296875 -28.90625 C 49.296875 -20.394531 59.425781 -14.257812 71.6875 -10.5 C 83.957031 -6.75 96.847656 -5.1875 110.359375 -5.8125 C 123.867188 -6.4375 136.691406 -9 148.828125 -13.5 C 160.960938 -18.007812 170.910156 -24.019531 178.671875 -31.53125 C 186.929688 -39.789062 192 -48.421875 193.875 -57.421875 C 195.75 -66.429688 194.992188 -75.191406 191.609375 -83.703125 C 188.234375 -92.210938 182.726562 -99.84375 175.09375 -106.59375 C 167.46875 -113.351562 158.398438 -118.609375 147.890625 -122.359375 C 137.628906 -126.117188 126.304688 -129.0625 113.921875 -131.1875 C 101.535156 -133.3125 89.085938 -135.6875 76.578125 -138.3125 C 64.066406 -140.945312 52.367188 -144.703125 41.484375 -149.578125 C 30.597656 -154.460938 21.398438 -161.40625 13.890625 -170.40625 C 6.128906 -179.914062 1.625 -190.800781 0.375 -203.0625 C -0.875 -215.332031 1.25 -226.722656 6.75 -237.234375 C 11.257812 -246.234375 17.578125 -253.609375 25.703125 -259.359375 C 33.835938 -265.117188 42.847656 -269.625 52.734375 -272.875 C 62.617188 -276.132812 72.753906 -278.390625 83.140625 -279.640625 C 93.523438 -280.890625 103.222656 -281.515625 112.234375 -281.515625 C 122.492188 -281.515625 132.753906 -280.578125 143.015625 -278.703125 C 153.273438 -276.828125 163.035156 -273.765625 172.296875 -269.515625 C 178.296875 -266.753906 184.484375 -262.992188 190.859375 -258.234375 C 197.242188 -253.484375 202.5625 -248.039062 206.8125 -241.90625 C 211.070312 -235.78125 213.203125 -229.09375 213.203125 -221.84375 C 213.203125 -213.332031 210.445312 -206.257812 204.9375 -200.625 C 199.4375 -195 191.429688 -192.3125 180.921875 -192.5625 C 184.671875 -203.070312 185.734375 -213.082031 184.109375 -222.59375 C 182.484375 -232.101562 178.796875 -240.484375 173.046875 -247.734375 C 166.785156 -256.242188 158.273438 -262.75 147.515625 -267.25 C 136.753906 -271.757812 125.179688 -274.453125 112.796875 -275.328125 C 100.410156 -276.203125 88.460938 -275.265625 76.953125 -272.515625 C 68.441406 -270.765625 60.117188 -267.695312 51.984375 -263.3125 C 43.847656 -258.9375 36.960938 -253.367188 31.328125 -246.609375 C 25.703125 -239.847656 22.390625 -231.71875 21.390625 -222.21875 C 20.390625 -211.707031 22.640625 -203.007812 28.140625 -196.125 C 33.648438 -189.238281 40.972656 -183.734375 50.109375 -179.609375 C 59.242188 -175.484375 68.566406 -172.164062 78.078125 -169.65625 C 89.835938 -166.90625 102.472656 -164.46875 115.984375 -162.34375 C 129.492188 -160.21875 142.691406 -157.273438 155.578125 -153.515625 C 168.472656 -149.765625 179.675781 -144.007812 189.1875 -136.25 C 198.4375 -128.75 205.4375 -119.929688 210.1875 -109.796875 C 214.945312 -99.660156 217.203125 -89.148438 216.953125 -78.265625 C 216.703125 -67.378906 213.945312 -56.929688 208.6875 -46.921875 C 203.4375 -36.910156 195.554688 -28.398438 185.046875 -21.390625 C 172.785156 -13.140625 158.707031 -7.507812 142.8125 -4.5 C 126.925781 -1.5 112.101562 0 98.34375 0 Z M 98.34375 0 " />
              </g>
            </g>
          </g>
        </g>
      </svg>
    );
  },
);
```

- [ ] **Step 2: Verify the build accepts the new file**

Run: `npx tsc --noEmit`

Expected: PASS (no TypeScript errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/PsalmsWordmarkSvg.tsx
git commit -m "$(cat <<'EOF'
feat(hero): inline PsalmsWordmarkSvg component

Six PSALMS letter paths from public/Logo-motion/my-video/index.html
inlined as a React component with stable letter ids for GSAP targeting.
ViewBox cropped vertically to match the existing /logo-hero.png framing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `disabled` prop to WaterRipple

**Files:**
- Modify: `src/components/ui-custom/WaterRipple.tsx`

Add an optional `disabled` prop that gates the three event handlers. When `disabled` is truthy, clicks/touches/mouse-moves do not spawn ripples. Default `false` (no behavior change for existing callers).

- [ ] **Step 1: Add the prop to the interface**

Open `src/components/ui-custom/WaterRipple.tsx`.

Replace the existing `WaterRippleProps` interface and the function signature:

```typescript
interface WaterRippleProps {
  rippleColor?: string;
  rippleDuration?: number;
  maxRipples?: number;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export function WaterRipple({
  rippleColor = "rgba(40, 35, 30, 0.15)",
  rippleDuration = 1500,
  maxRipples = 8,
  className = "",
  children,
  disabled = false,
}: WaterRippleProps) {
```

- [ ] **Step 2: Gate the three handlers**

In `handleMouseMove`, after the existing `if (isTouchDevice.current) return;` line, add:

```typescript
    if (disabled) return;
```

In `handleClick`, replace the body so it reads:

```typescript
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    createRipple(e.clientX, e.clientY);
  };
```

In `handleTouchStart`, replace the body so it reads:

```typescript
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return;
    const touch = e.touches[0];
    createRipple(touch.clientX, touch.clientY);
  };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm run test`

Expected: PASS (no test currently covers WaterRipple; this confirms we didn't break the unrelated test suite).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui-custom/WaterRipple.tsx
git commit -m "$(cat <<'EOF'
feat(water-ripple): add disabled prop

Gates click, touch, and mousemove ripple handlers. Default false
preserves existing behavior. Used by hero intro to suppress ripple
spawn during the logo reveal animation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Lift intro state into App.tsx and wire WaterRipple

**Files:**
- Modify: `src/App.tsx`

Add a lazy-initialized state for `introActive` computed via `decideHeroIntro` at first render. Pass `disabled={introActive}` to `<WaterRipple>`. Pass `introActive` and `onIntroComplete` to `<Hero>`. Persist the flag immediately if the gate said `persistFlag: true` (the reduced-motion case).

- [ ] **Step 1: Add the imports**

Open `src/App.tsx`. Add to the imports near the top (after the existing `import { Hero } ...` line):

```typescript
import { useState } from 'react';
import { decideHeroIntro, persistIntroPlayed } from '@/components/sections/hero-intro-gate';
```

If `useState` is already imported via `useCallback`, extend the existing import instead:

```typescript
import { useCallback, useState } from 'react';
```

- [ ] **Step 2: Initialize intro state inside the App function**

Inside `function App()`, after the existing `const projects = useProjectColors();` line, add:

```typescript
  const [introActive, setIntroActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const decision = decideHeroIntro({
      storage: window.sessionStorage,
      prefersReducedMotion,
    });
    if (decision.persistFlag) {
      persistIntroPlayed(window.sessionStorage);
    }
    return decision.playIntro;
  });

  const handleIntroComplete = useCallback(() => {
    setIntroActive(false);
    if (typeof window !== 'undefined') {
      persistIntroPlayed(window.sessionStorage);
    }
  }, []);
```

- [ ] **Step 3: Wire the WaterRipple and Hero props**

Find the `<WaterRipple>` block (around line 65). Add the `disabled` prop:

```typescript
                  <WaterRipple
                    rippleColor="rgba(40, 35, 30, 0.12)"
                    rippleDuration={1800}
                    maxRipples={6}
                    disabled={introActive}
                  >
                    <Hero introActive={introActive} onIntroComplete={handleIntroComplete} />
                  </WaterRipple>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: This will fail with errors about `introActive` and `onIntroComplete` not existing on `HeroProps`. That's expected — we'll add them in Task 5.

- [ ] **Step 5: Commit (deferred until Task 5)**

Do not commit yet. App.tsx changes are incomplete without the Hero props they reference. We'll commit Task 4 + Task 5 together at the end of Task 5.

---

## Task 5: Add intro props to Hero, replace `<img>` with SVG, internalize `showNav`

**Files:**
- Modify: `src/components/sections/Hero.tsx`

Replace the `<img src="/logo-hero.png" .../>` block with `<PsalmsWordmarkSvg>` referenced by a ref. Add `introActive` and `onIntroComplete` props. Make `showNav` internal state initialized from `introActive` (false when intro is playing, true otherwise). The existing scroll-trigger logic stays as-is.

- [ ] **Step 1: Update imports and the props interface**

Open `src/components/sections/Hero.tsx`.

Replace the existing imports with:

```typescript
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PsalmsWordmarkSvg } from './PsalmsWordmarkSvg';
```

Replace the existing `HeroProps` interface with:

```typescript
interface HeroProps {
  introActive?: boolean;
  onIntroComplete?: () => void;
}
```

Replace the function signature and the `showNav` initialization. Find:

```typescript
export function Hero({ showNav = true }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
```

Replace with:

```typescript
export function Hero({ introActive = false, onIntroComplete }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [showNav, setShowNav] = useState<boolean>(!introActive);
  const svgRef = useRef<SVGSVGElement>(null);
```

- [ ] **Step 2: Replace the `<img>` block with the SVG component**

Find the block that currently reads (around lines 136-146):

```typescript
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden px-4">
          <img
            src="/logo-hero.png"
            alt="LivePsalms"
            className="w-[95vw] md:w-[80vw] max-w-4xl object-contain"
            style={{
              opacity: 0.12,
              filter: 'invert(1)',
            }}
          />
        </div>
```

Replace with:

```typescript
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden px-4">
          <PsalmsWordmarkSvg
            ref={svgRef}
            className="w-[95vw] md:w-[80vw] max-w-4xl"
            style={{
              opacity: introActive ? 1 : 0.12,
              color: introActive ? '#f6f4f0' : '#3A3426',
            }}
          />
        </div>
```

Note: the SVG's letter `<path>` fills currently inherit from the wrapping `<g fill="#f6f4f0">` in PsalmsWordmarkSvg. In Step 3 below we'll change that wrapping fill to `currentColor` so this `color` style cascades into the paths. The intro timeline in Task 7 animates `color` on the SVG element directly at the handoff beat (t=6.4s), so both intro and resting states drive the letter color through the same property.

- [ ] **Step 3: Inline-set the letter fill via CSS when intro is not active**

PsalmsWordmarkSvg's `<g fill="#f6f4f0">` hardcodes the cream color. For the resting state we need `#3A3426` (deep-umber) at opacity 0.12. Easiest: override via inline style on the SVG using CSS that targets the inner `<g>`.

In `PsalmsWordmarkSvg.tsx`, change the `<g fill="#f6f4f0">` line to:

```typescript
          <g fill="currentColor">
```

This lets the parent's CSS `color` cascade in as the fill. Save the file.

Verify the change applies by re-running:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Verify the rest path renders without animation**

Verify by spot-reading that nothing else in `Hero.tsx` references `/logo-hero.png` or the removed `<img>`. The scroll-trigger logic for the masked image and the quote stays unchanged.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS (both App.tsx from Task 4 and Hero.tsx from this task now compile together).

- [ ] **Step 6: Run the existing test suite**

Run: `npm run test`

Expected: PASS (no test covers Hero or App; this confirms we didn't break anything else).

- [ ] **Step 7: Commit (Tasks 4 and 5 together)**

```bash
git add src/App.tsx src/components/sections/Hero.tsx src/components/sections/PsalmsWordmarkSvg.tsx
git commit -m "$(cat <<'EOF'
feat(hero): lift intro state into App, inline SVG replaces PNG

Hero gains introActive/onIntroComplete props. App computes the initial
state via decideHeroIntro at mount and passes it down to both Hero and
WaterRipple. The static /logo-hero.png is replaced by an inline SVG
that will become the animated wordmark in subsequent tasks.

Non-intro resting state renders the wordmark at #3A3426 / opacity 0.12
via currentColor cascade, matching the prior PNG framing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add dark canvas, glow-aura, and pulse-ring to Hero JSX

**Files:**
- Modify: `src/components/sections/Hero.tsx`

Add three new absolutely-positioned elements inside the first viewport `<div>`, layered behind and around the SVG wordmark. Initial CSS state matches t=0 of the intro timeline (dark canvas opaque, glow/ring at 0 opacity).

- [ ] **Step 1: Add new refs near the top of the component**

After the existing `const svgRef = useRef<SVGSVGElement>(null);` line, add:

```typescript
  const darkCanvasRef = useRef<HTMLDivElement>(null);
  const glowAuraRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Add the three elements inside the first viewport**

Find the first viewport `<div>`:

```typescript
      {/* First viewport: PSALMS logo */}
      <div className="relative h-screen flex flex-col items-center justify-center">
```

Inside that div, BEFORE the existing wordmark container (the `<div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden px-4">`), add:

```typescript
        {/* Dark canvas — covers the first viewport during intro, fades at handoff */}
        <div
          ref={darkCanvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 50% 50%, #0e0c10 0%, #08070a 60%, #050507 100%), #0a0a0c',
            opacity: introActive ? 1 : 0,
            zIndex: 2,
          }}
        />

        {/* Glow aura — sits behind the A glyph, blooms on heartbeats */}
        <div
          ref={glowAuraRef}
          className="absolute pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            width: 'var(--aura-size, 0px)',
            height: 'var(--aura-size, 0px)',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle at center, rgba(246, 244, 240, 0.32) 0%, rgba(246, 244, 240, 0.12) 22%, rgba(246, 244, 240, 0.04) 45%, rgba(246, 244, 240, 0) 72%)',
            borderRadius: '50%',
            opacity: 0,
            mixBlendMode: 'screen',
            filter: 'blur(14px)',
            willChange: 'opacity, transform',
            zIndex: 3,
          }}
        />

        {/* Pulse ring — emanates from A on the second heartbeat */}
        <div
          ref={pulseRingRef}
          className="absolute pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            width: 'var(--ring-size, 0px)',
            height: 'var(--ring-size, 0px)',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1.25px solid rgba(246, 244, 240, 0.85)',
            boxShadow:
              '0 0 38px rgba(246, 244, 240, 0.42), 0 0 90px rgba(246, 244, 240, 0.18), inset 0 0 22px rgba(246, 244, 240, 0.12)',
            opacity: 0,
            mixBlendMode: 'screen',
            willChange: 'width, height, opacity',
            zIndex: 3,
          }}
        />
```

Also add `style={{ zIndex: 1 }}` to the existing wordmark container so it sits BELOW the dark canvas (z-index 2) during the intro. The wordmark stays at z-index 1, dark canvas at z-index 2, glow/ring at z-index 3 (above dark canvas so their `mix-blend-mode: screen` blends with the dark, not the plaster background).

Wait — that contradicts what we want. The wordmark needs to be ABOVE the dark canvas (otherwise we can't see the cream letters during the intro).

Correct layering:
- Wordmark (cream letters): z-index 4 (top)
- Glow aura, pulse ring: z-index 3 (mix-blend-mode: screen blends with dark canvas below)
- Dark canvas: z-index 2

Update the wordmark container to use `zIndex: 4`:

```typescript
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden px-4"
          style={{ zIndex: 4 }}
        >
          <PsalmsWordmarkSvg ... />
        </div>
```

- [ ] **Step 3: Add the ResizeObserver effect for responsive aura/ring sizing**

After the existing `useEffect` blocks but before the `return` statement, add a new `useEffect`:

```typescript
  /* ── Responsive sizing for glow-aura and pulse-ring ── */
  useEffect(() => {
    const svgEl = svgRef.current;
    const heroEl = heroRef.current;
    if (!svgEl || !heroEl) return;

    const update = () => {
      const wordmarkWidth = svgEl.getBoundingClientRect().width;
      if (wordmarkWidth === 0) return;
      // Ratios derived from the original 1100px wordmark:
      // aura 720px → 0.6545, ring initial 260px → 0.2364, ring final 2800px → 2.5455
      heroEl.style.setProperty('--aura-size', `${wordmarkWidth * 0.6545}px`);
      heroEl.style.setProperty('--ring-size', `${wordmarkWidth * 0.2364}px`);
      heroEl.style.setProperty('--ring-final-size', `${wordmarkWidth * 2.5455}px`);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(svgEl);
    return () => ro.disconnect();
  }, []);
```

- [ ] **Step 4: Verify TypeScript compiles and tests pass**

Run: `npx tsc --noEmit && npm run test`

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): add dark canvas, glow-aura, and pulse-ring DOM

Three absolutely-positioned layers inside the first viewport, sized
responsively from the SVG wordmark via CSS custom properties. Initial
state matches t=0 of the intro timeline. Z-order: dark canvas under
glow/ring under wordmark, so the screen-blend layers paint against
the dark canvas rather than the plaster page background.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Build the GSAP intro timeline

**Files:**
- Modify: `src/components/sections/Hero.tsx`

Add the GSAP timeline that drives all six tracks. Mount-time effect that runs ONLY when `introActive` is true. Plays once on mount, calls `onIntroComplete` at the handoff beat.

- [ ] **Step 1: Add the intro timeline effect**

After the ResizeObserver effect from Task 6 step 3, add a new `useEffect`.

**Important implementation note on cleanup:** Do NOT wrap the timeline in `gsap.context()` and call `ctx.revert()` here (the pattern used by the scroll-trigger effects below). `revert()` restores inline styles to their pre-tween values, which would cause a visible flash from `#3A3426` back to `#f6f4f0` AFTER the intro completes and React has settled the DOM to the final state. Use direct element references (no selectors) and `tl.kill()` in cleanup. `kill()` removes the timeline without touching inline styles, so React's render of the final state remains visible.

```typescript
  /* ── Intro timeline ── */
  useEffect(() => {
    if (!introActive) return;

    const svgEl = svgRef.current;
    const darkEl = darkCanvasRef.current;
    const glowEl = glowAuraRef.current;
    const ringEl = pulseRingRef.current;
    const heroEl = heroRef.current;
    if (!svgEl || !darkEl || !glowEl || !ringEl || !heroEl) return;

    // Resolve letter elements once via the SVG ref. Direct references avoid
    // global selector queries and let us drop gsap.context() (see note above).
    const letterA  = svgEl.querySelector<SVGGElement>('#letter-A');
    const letterP  = svgEl.querySelector<SVGGElement>('#letter-P');
    const letterS1 = svgEl.querySelector<SVGGElement>('#letter-S1');
    const letterL  = svgEl.querySelector<SVGGElement>('#letter-L');
    const letterM  = svgEl.querySelector<SVGGElement>('#letter-M');
    const letterS2 = svgEl.querySelector<SVGGElement>('#letter-S2');
    if (!letterA || !letterP || !letterS1 || !letterL || !letterM || !letterS2) return;

    // SVG-userspace collapse offsets (CSS px × 1500/1100 = × 1.3636 from original)
    const COLLAPSE = {
      P: 653.3,
      S1: 339.8,
      L: -313.9,
      M: -690.5,
      S2: -1076.4,
    };

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        onIntroComplete?.();
      },
    });

    // Initial states (t=0)
    tl.set(letterA,  { opacity: 0, scale: 0.92, transformOrigin: '50% 50%' }, 0);
    tl.set(letterP,  { x: COLLAPSE.P,  opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(letterS1, { x: COLLAPSE.S1, opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(letterL,  { x: COLLAPSE.L,  opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(letterM,  { x: COLLAPSE.M,  opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(letterS2, { x: COLLAPSE.S2, opacity: 0, filter: 'blur(6px)' }, 0);
    tl.set(glowEl, { opacity: 0 }, 0);
    tl.set(ringEl, { width: 'var(--ring-size, 260px)', height: 'var(--ring-size, 260px)', opacity: 0 }, 0);
    tl.set(darkEl, { opacity: 1 }, 0);

    // Act I.1 — A enters (0.3 → 1.7s)
    tl.to(letterA, { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out', overwrite: 'auto' }, 0.3);
    tl.to(glowEl,  { opacity: 0.18, duration: 1.4, ease: 'power1.out', overwrite: 'auto' }, 0.4);

    // Act I.3 — Lub (2.10s)
    const lub = 2.10;
    tl.to(letterA, { scale: 1.022, duration: 0.18, ease: 'power2.out', overwrite: 'auto' }, lub);
    tl.to(letterA, { scale: 1.0,   duration: 0.32, ease: 'power3.out', overwrite: 'auto' }, lub + 0.18);
    tl.to(glowEl,  { opacity: 0.42, scale: 1.08, duration: 0.18, ease: 'power2.out', overwrite: 'auto' }, lub);
    tl.to(glowEl,  { opacity: 0.18, scale: 1.0,  duration: 0.32, ease: 'power2.out', overwrite: 'auto' }, lub + 0.18);

    // Act I.5 — Dub (2.85s)
    const dub = 2.85;
    tl.to(letterA, { scale: 1.042, duration: 0.22, ease: 'power2.out', overwrite: 'auto' }, dub);
    tl.to(letterA, { scale: 1.0,   duration: 0.50, ease: 'power3.out', overwrite: 'auto' }, dub + 0.22);
    tl.to(glowEl,  { opacity: 0.78, scale: 1.18, duration: 0.22, ease: 'power2.out', overwrite: 'auto' }, dub);
    tl.to(glowEl,  { opacity: 0,    scale: 1.0,  duration: 1.30, ease: 'power2.in',  overwrite: 'auto' }, dub + 0.22);

    // Act I.6 — Ring expands (2.97s)
    const ring = dub + 0.12;
    const ringFinalCss = getComputedStyle(heroEl).getPropertyValue('--ring-final-size').trim() || '2800px';
    tl.to(ringEl, { opacity: 0.92, duration: 0.24, ease: 'power2.out', overwrite: 'auto' }, ring);
    tl.to(ringEl, { width: ringFinalCss, height: ringFinalCss, duration: 1.8, ease: 'power2.out', overwrite: 'auto' }, ring);
    tl.to(ringEl, { opacity: 0, duration: 1.5, ease: 'power2.in', overwrite: 'auto' }, ring + 0.35);

    // Act II — Letter spread (4.20s, three waves)
    const spread = (target: SVGGElement, t: number) => {
      tl.to(target, { x: 0,                duration: 1.8, ease: 'power3.out' }, t);
      tl.to(target, { opacity: 1,          duration: 1.4, ease: 'power1.out' }, t);
      tl.to(target, { filter: 'blur(0px)', duration: 1.6, ease: 'power2.out' }, t);
    };
    const spreadAt = 4.20;
    spread(letterS1, spreadAt);
    spread(letterL,  spreadAt);
    spread(letterP,  spreadAt + 0.45);
    spread(letterM,  spreadAt + 0.45);
    spread(letterS2, spreadAt + 0.90);

    // Handoff beat (6.40s → 7.60s) — cream→deep-umber, opacity→0.12, dark canvas fades
    // tl.call fires once at the position; setShowNav(true) triggers the existing
    // masked-image and quote entrance via their existing prop gating.
    const handoff = 6.40;
    tl.to(darkEl, { opacity: 0, duration: 1.2, ease: 'power2.inOut' }, handoff);
    tl.to(svgEl,  { color: '#3A3426', duration: 1.2, ease: 'power2.inOut' }, handoff);
    tl.to(svgEl,  { opacity: 0.12, duration: 1.2, ease: 'power2.inOut' }, handoff);
    tl.call(() => setShowNav(true), [], handoff);

    tl.play(0);

    return () => {
      tl.kill();
    };
  }, [introActive, onIntroComplete]);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Run the existing test suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 4: Smoke-test in the browser**

Run: `npm run dev`

Open the dev server URL. Hard-refresh the home page (`Cmd+Shift+R` to bypass cache). Watch for:
- Dark canvas covers the first viewport at first paint.
- The A glyph fades in starting around 0.3s.
- Two heartbeat pulses around 2.1s and 2.85s.
- Ring expands outward starting ~3s.
- Five letters fan out into the wordmark starting ~4.2s.
- Around 6.4s the dark canvas fades, the letters drop to the faint outline.
- Around 7.6s the masked tropical-jungle and quote appear via their existing fade.

If anything is visibly broken (letters not appearing, dark canvas not fading, etc.), open browser DevTools and check the console for GSAP errors. The most likely failure is a selector mismatch — verify `#letter-A` etc. exist in the DOM under the SVG.

If the timing feels too long, do NOT trim values in this task. Tuning is reserved for Task 9.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): build the GSAP intro timeline

One paused timeline owns six tracks: letter motion (A enter, two
heartbeats, ring expansion, three spread waves), dark canvas crossfade,
letter color/opacity crossfade, and the showNav handoff at t=6.4s.
COLLAPSE offsets are in SVG userspace units so the animation scales
responsively with the wordmark.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verify the skip path (session flag + reduced motion)

**Files:**
- No code changes. Verification only.

The skip-path code is already in place: when `introActive=false`, the intro `useEffect` returns early (Task 7 step 1, first line). The dark canvas starts at `opacity: 0` (Task 6 step 2). The SVG starts at `opacity: 0.12` and `color: '#3A3426'` (Task 5 step 2). `showNav` defaults to `!introActive`, so when introActive is false, showNav is true and the existing masked-image entrance plays normally.

This task verifies that path manually.

- [ ] **Step 1: Verify session-flag skip**

Run: `npm run dev`

In the browser:
1. Hard-refresh the home page. Intro plays.
2. Wait for it to complete (~8 seconds).
3. Open DevTools Application tab → Session Storage → confirm `psalms-intro-played = 1`.
4. Navigate to `/purpose` (click the first project card or go via URL).
5. Navigate back to `/`.
6. Expected: NO intro plays. Hero renders in its final state immediately. Masked image enters via the existing fade.

If the intro plays again, check that `App.tsx`'s `setIntroActive(false)` fires inside `handleIntroComplete` (Task 4 step 2).

- [ ] **Step 2: Verify reduced-motion skip**

1. Open DevTools → ⋮ menu → More tools → Rendering.
2. Find "Emulate CSS media feature prefers-reduced-motion" and set to "reduce".
3. Clear sessionStorage (Application tab → right-click `psalms-intro-played` → Delete).
4. Hard-refresh.
5. Expected: NO intro plays. Hero renders in its final state immediately. Session storage now contains `psalms-intro-played = 1` (set by the gate's `persistFlag: true` path).

If the intro plays anyway, check that `decideHeroIntro` (Task 1 step 3) returns `playIntro: false` for the reduced-motion branch.

- [ ] **Step 3: Restore browser to normal**

Turn off reduced-motion emulation in DevTools. Clear sessionStorage. Reload to confirm the intro plays again for fresh sessions.

- [ ] **Step 4: Commit nothing**

This task is verification only. If any issues were found, fix them in the relevant file and amend the previous commit (or create a follow-up fix commit) before proceeding.

---

## Task 9: Manual verification across viewports and timing tune

**Files:**
- Modify (only if tuning is needed): `src/components/sections/Hero.tsx`

Verify the full experience at multiple viewport sizes. Tune timing if the 7.6s wall-clock feels long.

- [ ] **Step 1: Test responsive sizing**

Run: `npm run dev`

Open DevTools → Toggle device toolbar (Cmd+Shift+M). Test these viewports:
- 375×667 (iPhone SE)
- 768×1024 (iPad)
- 1440×900 (desktop)

For each: clear sessionStorage, hard-refresh, verify the intro plays and the wordmark final position visually matches what the static logo would have looked like (centered horizontally, vertically aligned within the first viewport).

If letters spread too far (off-screen) or too little (cramped) at any viewport, the COLLAPSE values may need recalibration. They should not — they're in SVG userspace units. If they appear off, check that GSAP is writing to the SVG `transform` attribute (DevTools inspector → letter `<g>` → look for `transform="translate(...)"`).

- [ ] **Step 2: Test timing**

Watch the intro at desktop size with fresh sessionStorage. Time it informally: from page paint to "feels done" should be ~7.6s.

If it feels too long, apply one or more of these trims to the Task 7 timeline. Each is a single-line change:

| Original | Trim option | New timing |
|---|---|---|
| `tl.to('#letter-A', { ... }, 0.3);` | `tl.to('#letter-A', { ... }, 0.1);` | Removes 0.2s of opening silence |
| `const lub = 2.10;` | `const lub = 1.85;` | Removes "A holds alone" beat |
| `const dub = 2.85;` | `const dub = 2.55;` | Tighter heartbeat sequence |
| `const handoff = 6.40;` | `const handoff = 6.00;` | Crossfade starts as letters settle |
| `duration: 1.2` (in three handoff tweens) | `duration: 0.8` | Faster crossfade |

Apply only the trims that the felt duration justifies. Do not blanket-apply all five — the intro is meant to be cinematic. If trimming, prefer cutting handoff duration first (least cost to the cinematic feel).

- [ ] **Step 3: Test masked image / quote handoff**

At the 6.4s handoff beat, verify that the masked tropical-jungle image starts its blur+fade-in (existing behavior gated by `showNav`). The image should be fully visible by ~9s after page load.

Scroll down slowly. Verify the masked image scroll-expand still works (existing scroll trigger). Verify the Psalm 23 quote fades in as you scroll.

- [ ] **Step 4: Run final TypeScript + test check**

```bash
npx tsc --noEmit && npm run test
```

Expected: both PASS.

- [ ] **Step 5: Commit any timing tweaks**

If you applied trims in Step 2:

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
chore(hero): tune intro timeline based on felt duration

Adjust [specific trim values] based on manual QA — felt too long
before. Cinematic intent preserved; total wall-clock now [N]s.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no trims were needed, no commit. Implementation is complete.

---

## Verification summary

After all tasks:

1. **Unit tests (Task 1):** `decideHeroIntro` covered by 5 vitest tests in the codebase's established pattern.
2. **TypeScript:** `npx tsc --noEmit` passes.
3. **Test suite:** `npm run test` passes (no existing tests were broken).
4. **Manual browser verification (Tasks 7-9):**
   - Fresh session → intro plays through to final state matching the prior `/logo-hero.png` framing.
   - Returning visit within the same tab → intro skipped, hero renders in final state immediately.
   - `prefers-reduced-motion: reduce` → intro skipped, session flag persisted.
   - Responsive at 375 / 768 / 1440px → wordmark final position aligns; letter offsets scale.
   - Scroll-triggered masked-image expansion and quote fade still work after the intro completes.
