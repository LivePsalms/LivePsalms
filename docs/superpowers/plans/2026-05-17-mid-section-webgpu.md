# Mid-Section Motion — WebGPU Live Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scrubbed-MP4 background in the mid-section with a live WebGPU "curl-noise lines" scene; keep the five-beat kiss-handoff text overlay exactly as it ships today; provide three rendering paths (WebGPU live → MP4 autoplay-loop fallback → static-poster reduced-motion).

**Architecture:** Add a self-contained `mountCurlLinesScene(canvas)` module that ports `public/remix-webgpu-curl-lines/scene.js` into a React-mountable function with strict cleanup. Wire it into `MidSectionMotion.tsx` via a new `renderMode` state (`'webgpu' | 'video' | 'reduced'`) selected from capability detection. The existing GSAP timeline + 5 beat tweens are retained; only the `video.currentTime` scrub is removed.

**Tech Stack:** React 18 + TypeScript, Vite, GSAP + ScrollTrigger (existing), **Three.js 0.183.2 + WebGPU + TSL** (new), Vitest (no new tests needed).

---

## Spec deviations

None expected. Approved spec: `docs/superpowers/specs/2026-05-17-mid-section-webgpu-redesign.md`.

If during execution a deviation seems necessary (e.g., the Three.js WebGPU API has changed in a breaking way that the spec did not anticipate), STOP and escalate; do not silently change behavior.

---

## File Structure

**New files:**
- `src/components/sections/mid-section-webgpu-scene.ts` — the React-mountable port of `public/remix-webgpu-curl-lines/scene.js`. Exports `mountCurlLinesScene(canvas)` returning `{ dispose }`. Single responsibility: own the Three.js scene's full lifecycle within a target canvas.

**Modified files:**
- `package.json` — add `"three": "^0.183.2"` to dependencies.
- `package-lock.json` — auto-updates from `npm install`.
- `src/components/sections/MidSectionMotion.tsx` — new state machine, new effect, three small edits to existing effects, JSX rewrite to three branches.
- `src/index.css` — one rule change: stronger scrim radial gradient.

**Manually-produced assets (after merge, Task 6):**
- `public/mid-section-video.mp4` — replaced with a screen capture of the live WebGPU scene.
- `public/mid-section-poster.jpg` — re-extracted from the new MP4.

**Untouched:**
- `src/components/sections/mid-section-motion-content.ts` (`BEATS`, `MID_SECTION_PIN_TIMING`, `MID_SECTION_VIDEO_DURATION`). `MID_SECTION_VIDEO_DURATION` becomes vestigial; do NOT remove it in this change.
- `src/components/sections/mid-section-motion-content.test.ts` (33 tests stay green).
- `src/App.tsx` wiring slot.
- Everything else in the codebase.

---

### Task 1: Add `three` to dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-updated)

The WebGPU module needs `three@^0.183.2` (the version pinned by the demo, with the current shape of the WebGPU + TSL APIs).

- [ ] **Step 1: Install**

Run from repo root:
```bash
npm install three@^0.183.2
```

Expected: npm prints what was added/changed; `package.json` and `package-lock.json` both update; no peer-dependency conflicts; exit code 0.

- [ ] **Step 2: Verify the entry**

Run: `grep '"three"' package.json`
Expected: a line like `"three": "^0.183.2"` under `"dependencies"`.

- [ ] **Step 3: Verify TypeScript still builds**

Run: `npm run build`
Expected: PASS — `tsc -b` and `vite build` succeed. (Three.js ships its own type declarations, so no `@types/three` is needed for the version we install.)

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: PASS — all 511 tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add three@^0.183.2 for WebGPU mid-section scene"
```

---

### Task 2: Create `mid-section-webgpu-scene.ts`

**Files:**
- Create: `src/components/sections/mid-section-webgpu-scene.ts`
- Reference (read-only): `public/remix-webgpu-curl-lines/scene.js` (current revision; user has already changed `scene.background` to `0x988F80` taupe)

This task ports the demo's scene logic into a React-mountable module. Most of the code is **copied verbatim** from `scene.js`; a small set of strip-list and modify-list changes adapt it to a function-scoped mount API.

#### Step 1: Read the reference scene

- [ ] Read `public/remix-webgpu-curl-lines/scene.js` end-to-end so you know which lines you're touching. Reference line numbers in this task are from the current revision.

#### Step 2: Create the target file with the exact mount-function structure

- [ ] Create `src/components/sections/mid-section-webgpu-scene.ts` with this top-level skeleton, then fill in the body sections per Steps 3-9 below:

```ts
import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import {
  Fn, compute, instanceIndex, instancedArray, uniform, float, int, vec2, vec3, vec4,
  sin, cos, abs, floor, fract, mix, step, smoothstep, dot, normalize,
  hash, storage, If, attribute, Loop,
  pass, mrt, output, emissive,
} from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';

// --- Config ---
const LINE_COUNT = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ? 1024 : 4096;
const TRAIL_LENGTH = 64;
const TOTAL_POINTS = LINE_COUNT * TRAIL_LENGTH;
const BOUNDS = 6.0;
const NUM_SCHEMES = 5;

export async function mountCurlLinesScene(
  canvas: HTMLCanvasElement,
): Promise<{ dispose: () => void }> {
  // STEP 3: scene + camera + renderer setup
  // STEP 4: storage buffers + uniforms + palette
  // STEP 5: compute functions (hash3, quintic, smoothNoise3, curlNoise, initCompute, initTrails, shiftTrails, updateParticles)
  // STEP 6: line geometry + line material (with trailColor() node function)
  // STEP 7: post-processing (bloom)
  // STEP 8: initial compute runs + async pre-warm + start animation loop
  // STEP 9: ResizeObserver + dispose()
}
```

Notes on the import block:
- Drop the `OrbitControls` import from the demo's line 2 (not used in this port).
- Everything else from the demo's import block is preserved verbatim.

#### Step 3: Scene + camera + renderer setup

- [ ] Inside `mountCurlLinesScene`, immediately after the comment marker, paste in (and adapt) lines 20-30 of the demo's `scene.js`:

```ts
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x988F80); // matches --app-bg
  const initialRect = canvas.parentElement
    ? canvas.parentElement.getBoundingClientRect()
    : { width: window.innerWidth, height: window.innerHeight };
  const camera = new THREE.PerspectiveCamera(60, initialRect.width / initialRect.height, 0.1, 200);
  camera.position.set(0, 6, 18);

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setSize(initialRect.width, initialRect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();
```

Changes from the demo:
- `innerWidth / innerHeight` → measured from `canvas.parentElement.getBoundingClientRect()`.
- `setPixelRatio(devicePixelRatio)` → `setPixelRatio(Math.min(window.devicePixelRatio, 2))`.
- No `root.appendChild(renderer.domElement)` — the canvas is the constructor target.
- The demo's lines 32-34 (`new OrbitControls(camera, renderer.domElement)` + damping) are **stripped**. Do not include them.

#### Step 4: Storage buffers, uniforms, palette

- [ ] Paste lines 36-94 of the demo verbatim. These declare `particlePos`, `particleLife`, `trailPositions`, all the `uniform(...)` constants (`uBounds` through `uDeltaTime`), the `palettes` object, and the six `uPalALo` / `uPalAHi` / etc. uniform declarations seeded from `palettes.Cosmic`.

Do NOT include the demo's lines 96-141 (the lineSchemeData StorageBufferAttribute, schemeShiftsLo/Hi/Brightness instancedArrays, schemeDefinitions table, initSchemes Fn declaration, and `setPalette` function). Those are unused: the demo's per-line variation actually comes from the `trailColor()` node function (lines 378-445), which reads `attribute('aLineIdx', 'float')` and computes scheme variations inline. The orphaned scheme-buffer plumbing was dead code in the demo. Skipping it shrinks the file and removes orphaned exports.

#### Step 5: Compute functions

- [ ] Paste lines 145-302 of the demo verbatim. This includes:
  - `hash3`, `quintic`, `smoothNoise3`, `curlNoise` — the curl-noise field math
  - `initCompute` — seeds particle positions and life
  - `initTrails` — initializes trail positions from particle positions
  - `shiftTrails` — shifts trail positions down by one segment per frame
  - `updateParticles` — moves particles via curl noise, soft spherical wrap, respawn

No changes to this block.

#### Step 6: Line geometry + line material

- [ ] Paste lines 304-457 of the demo verbatim. This includes:
  - Per-vertex `posArray`, `alphaArray`, `lineIndexArray` typed arrays
  - `StorageBufferAttribute`s for position/alpha/line index
  - `geometry = new THREE.BufferGeometry()` with `setAttribute` calls and index buffer
  - `posStorage`, `alphaStorage` storage refs
  - `writeToGeometry` compute Fn
  - `uLineWidth` uniform
  - `lineMaterial = new THREE.LineBasicNodeMaterial(...)` with `linewidthNode`
  - `trailColor` Fn (the 5-scheme per-line color variation)
  - `lineMaterial.colorNode = trailColor()`, `lineMaterial.emissiveNode = trailColor().mul(0.9)`, `lineMaterial.opacityNode = attribute('aAlpha', 'float')`
  - `const linesMesh = new THREE.LineSegments(geometry, lineMaterial)` + `scene.add(linesMesh)`

No changes to this block.

#### Step 7: Fog + post-processing

- [ ] Paste lines 458-471 of the demo verbatim:
  - `scene.fog = new THREE.FogExp2(0x050510, 0.018);` — **edit this line** to `scene.fog = new THREE.FogExp2(0x988F80, 0.018);` so fog matches the new taupe background. Otherwise fog would pull lines toward the old black, fighting the taupe scene background.
  - `postProcessing = new THREE.PostProcessing(renderer)`
  - `scenePass = pass(scene, camera)`
  - `scenePass.setMRT(mrt({ output, emissive }))`
  - `scenePassColor`, `scenePassEmissive` texture nodes
  - `bloomPass = bloom(scenePassEmissive, 2.2, 0.75, 0.15)`
  - `postProcessing.outputNode = scenePassColor.add(bloomPass);`

#### Step 8: Init runs, async pre-warm, animation loop

The demo's lines 343-355 do `await renderer.computeAsync(initCompute); await renderer.computeAsync(initTrails);` and then a synchronous `for` loop of 360 prewarm frames calling `await renderer.computeAsync(...)`. That blocks the calling promise for roughly 1-2 seconds.

We need to keep the visual benefit of pre-warm (trails already populated at first render) without blocking the main thread. Replacement:

- [ ] Add this block (replacing the demo's synchronous prewarm loop):

```ts
  await renderer.computeAsync(initCompute);
  await renderer.computeAsync(initTrails);

  const PREWARM_STEPS = 360;
  const PREWARM_DT = 1.0 / 60.0;
  const PREWARM_CHUNK = 20;
  uDeltaTime.value = PREWARM_DT;

  // Async pre-warm in chunks so the main thread stays responsive.
  // Each chunk yields to the browser via requestAnimationFrame.
  let prewarmStep = 0;
  await new Promise<void>((resolve) => {
    function runChunk() {
      const limit = Math.min(prewarmStep + PREWARM_CHUNK, PREWARM_STEPS);
      const promises: Promise<unknown>[] = [];
      for (let i = prewarmStep; i < limit; i++) {
        uTime.value = i * PREWARM_DT;
        promises.push(renderer.computeAsync(shiftTrails));
        promises.push(renderer.computeAsync(updateParticles));
      }
      Promise.all(promises).then(() => {
        prewarmStep = limit;
        if (prewarmStep >= PREWARM_STEPS) {
          resolve();
        } else {
          requestAnimationFrame(runChunk);
        }
      });
    }
    runChunk();
  });

  await renderer.computeAsync(writeToGeometry);
```

- [ ] After the pre-warm block, set up the animation loop. Adapt lines 558-577 of the demo by stripping the `controls.update()` call, the FPS counter, and using `setAnimationLoop`:

```ts
  const clock = new THREE.Clock();
  function animate() {
    const dt = clock.getDelta();
    uTime.value += dt;
    uDeltaTime.value = dt;
    renderer.compute(shiftTrails);
    renderer.compute(updateParticles);
    renderer.compute(writeToGeometry);
    postProcessing.render();
  }
  renderer.setAnimationLoop(animate);
```

Stripped from the demo:
- `controls.update()` — no OrbitControls in this port.
- FPS counter (`fpsFrames++`, `fpsTime`, `fpsDiv.textContent`) — see Step 9.

#### Step 9: ResizeObserver + dispose()

Replace the demo's `window.addEventListener('resize', ...)` (lines 579-583) with a `ResizeObserver` scoped to the canvas's parent, so the canvas tracks its container rather than the window. Then return the dispose handle.

- [ ] Add this block at the end of the function body:

```ts
  const target = canvas.parentElement ?? canvas;
  const resizeObserver = new ResizeObserver(() => {
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height);
  });
  resizeObserver.observe(target);

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      geometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    },
  };
}
```

Notes:
- The 0×0 guard prevents the observer from firing with garbage values when the parent is briefly detached during route transitions.
- `renderer.dispose()` releases the underlying WebGPU context and texture/buffer GPU memory.
- `geometry.dispose()` and `lineMaterial.dispose()` are explicit; without them, repeated mount/unmount cycles leak.

#### Step 10: Strip-list explicitly NOT ported

The following pieces of `scene.js` are intentionally NOT in this file. They produce side effects on `document` that have no place in a React component:

- The Google Fonts `<link>` injection (demo lines 474-477)
- The `panel` div + `makeSlider` helper + title/info text + all 8 slider rows + `document.body.appendChild(panel)` (demo lines 480-540)
- The `fpsDiv` element + its measurement code (demo lines 543-554, 564-571)
- `OrbitControls` (demo line 2 import, lines 32-34 setup)
- The orphaned per-line scheme buffers and `setPalette` function (demo lines 96-141)

#### Step 11: Verify TypeScript compiles

- [ ] Run: `npm run build`

Expected: PASS — `tsc -b` and `vite build` succeed. Three.js ships its own types so no `@types/three` is required for the version we installed.

If you get errors about missing `three/webgpu` or `three/tsl` subpath exports: confirm `three@^0.183.2` is installed (Step 1 of Task 1) and the version in `node_modules/three/package.json` matches. Earlier Three.js versions do not expose these subpath exports.

If you get TypeScript errors about node types from one of the Three.js TSL functions, those are spec-allowed since the TSL API is in flux. Use a narrow `as unknown as ...` cast at the specific call site rather than turning off strict mode. Report any such casts in the self-review.

#### Step 12: Commit

- [ ] Run:
```bash
git add src/components/sections/mid-section-webgpu-scene.ts
git commit -m "feat(mid-section): port WebGPU curl-lines scene to React-mountable module"
```

---

### Task 3: Update `MidSectionMotion.tsx`

**Files:**
- Modify: `src/components/sections/MidSectionMotion.tsx`

This is a single coherent refactor: add a three-mode state machine, add a new WebGPU mount effect, edit the existing motion effect (3 changes), edit the reduced-motion effect (1 change), rewrite the JSX into three branches. Shown as one task with the full target file so the implementer can apply it in one editing pass.

#### Step 1: Read the current file

- [ ] Read `src/components/sections/MidSectionMotion.tsx` (currently 184 lines, commit `da85524`). Hold its structure in mind: imports → TIMING constant → `MidSectionMotion()` function body with `useMemo` (prefersReducedMotion) + two `useEffect`s + two return branches.

#### Step 2: Replace the file contents

- [ ] Replace `src/components/sections/MidSectionMotion.tsx` with exactly this content:

```tsx
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
```

Specific differences from the prior revision (so reviewers can verify):
- `useMemo` import removed (no longer used; render mode is computed in `useState` initializer).
- `MID_SECTION_VIDEO_DURATION` import removed (no longer used — the constant remains exported but is now vestigial).
- New import: `import { mountCurlLinesScene } from './mid-section-webgpu-scene';`
- New ref: `canvasRef`.
- The `prefersReducedMotion` `useMemo` is gone — collapsed into the `initialRenderMode()` helper and the `useState` initializer.
- New effect: the WebGPU mount effect (33 lines).
- Existing motion effect:
  - Guard changed from `if (prefersReducedMotion) return;` to `if (renderMode !== 'webgpu' && renderMode !== 'video') return;`.
  - `const videoEl = videoRef.current;` line removed.
  - `videoEl` clause removed from the null-check (`if (!wrapperEl || !stageEl || beatEls.some((b) => !b))`).
  - `videoEl.currentTime = 0;` initial-state line removed.
  - The `tl.to(videoEl, { currentTime: ... }, 0);` line removed.
- Existing reduced-motion effect: guard changed from `if (!prefersReducedMotion) return;` to `if (renderMode !== 'reduced') return;`.
- JSX: full-motion branch now picks between `<canvas>` and `<video>` based on `renderMode`. Video element gets `autoPlay loop` attributes (was no autoplay, no loop, in prior revision since GSAP drove playback). All other JSX is unchanged.

#### Step 3: Verify TypeScript compiles

- [ ] Run: `npm run build`

Expected: PASS — `tsc -b` and `vite build` succeed. If you see an error about `disablePictureInPicture` / `disableRemotePlayback` not being recognized React props on `<video>`, lowercase them or remove them (matches the comment in the prior revision's plan; current TS likely accepts the camelCase form).

#### Step 4: Verify all existing tests still pass

- [ ] Run: `npm test`

Expected: PASS — all 511 tests pass. The 33 mid-section-motion-content tests don't reference any of the changed code paths; they should be unaffected.

#### Step 5: Commit

```bash
git add src/components/sections/MidSectionMotion.tsx
git commit -m "feat(mid-section): switch background to live WebGPU scene with autoplay-loop video fallback"
```

---

### Task 4: Bump the scrim opacity gradient

**Files:**
- Modify: `src/index.css`

The bright Cosmic palette lines crossing through the central text region need a heavier taupe vignette pulling the edges back. One CSS rule change.

#### Step 1: Read the current rule

- [ ] Read `src/index.css` around the `.mid-section-scrim` block (added in commit `f06e3b9`, around line 360). Confirm the current values are `0 / 60% 0.18 / 100% 0.32`.

#### Step 2: Replace the gradient stops

Find this block in `src/index.css`:

```css
.mid-section-scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(var(--app-bg-rgb), 0)    0%,
    rgba(var(--app-bg-rgb), 0.18) 60%,
    rgba(var(--app-bg-rgb), 0.32) 100%
  );
  opacity: var(--mid-section-scrim-opacity, 1);
  pointer-events: none;
}
```

- [ ] Replace with:

```css
.mid-section-scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(var(--app-bg-rgb), 0)    0%,
    rgba(var(--app-bg-rgb), 0.32) 50%,
    rgba(var(--app-bg-rgb), 0.55) 100%
  );
  opacity: var(--mid-section-scrim-opacity, 1);
  pointer-events: none;
}
```

Two stop changes:
- `60% / 0.18` → `50% / 0.32` (vignette starts darker, sooner).
- `100% / 0.32` → `100% / 0.55` (edges pool into stronger taupe).

Stop 1 (`0% / 0`) and the opacity tuning knob both stay unchanged.

#### Step 3: Verify the build still passes

- [ ] Run: `npm run build`

Expected: PASS.

#### Step 4: Commit

```bash
git add src/index.css
git commit -m "feat(mid-section): heavier scrim gradient for legibility against Cosmic-palette lines"
```

---

### Task 5: Manual browser verification

**Files:** none modified — verification only.

Verify each of the three rendering paths works in a real browser. The implementer should run this on a Chromium-based browser at minimum; full Safari + iOS verification is a follow-up the user will perform.

#### Step 1: Start the dev server

- [ ] Run: `npm run dev`

Expected: Vite prints a local URL (typically `http://localhost:5173`).

#### Step 2: Verify the WebGPU path renders

- [ ] Open the URL in Chrome (Chrome supports WebGPU by default). Skip past the Hero intro. Scroll until you reach the mid-section.

Verify:
1. A `<canvas>` element renders inside `.mid-section-stage`. Confirm in DevTools that the canvas is full-bleed `object-fit: cover`-styled and that NO `<video>` element exists in this section's DOM.
2. The curl-noise lines flow continuously. The Cosmic palette is visible (purples, teals, oranges). Bloom is visible on tips.
3. As you scroll, the section pins for 500vh of scroll distance. The five beats kiss-handoff over the canvas exactly as before. Scrolling forward and backward both work.
4. The scene continues to play smoothly while the text beats sequence (the simulation is decoupled from scroll, by design).
5. Clicking/dragging on the canvas does NOT rotate the camera (OrbitControls stripped).
6. No DevTools console errors. One pre-existing warning about `footer-watermark` is acceptable (predates this work).

#### Step 3: Verify the video fallback path

- [ ] In Chrome DevTools, open the Sources panel, find the page's runtime, and execute in the console (after page load):
```js
// Temporarily override navigator.gpu to simulate an unsupported browser, then reload.
Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
location.reload();
```

Actually, the cleaner approach is the initScript trick: open `chrome-devtools` MCP or use the browser's "Page" tab settings. If the implementer is doing this by hand, the simplest method is to comment out the WebGPU branch in `initialRenderMode()` temporarily (forcing `'video'`), reload, verify, then restore the function. Either approach is fine; just verify:

1. A `<video>` element renders (not a `<canvas>`).
2. The video auto-plays the moment the section enters viewport (or earlier — `preload="auto"` starts the download immediately).
3. The video loops indefinitely.
4. Scrolling does NOT scrub the video — playback runs at its own rate, decoupled from scroll.
5. The five beats kiss-handoff exactly as before.

Restore any temporary code changes before continuing.

#### Step 4: Verify the reduced-motion path

- [ ] In Chrome DevTools → Command Menu (Cmd+Shift+P) → "Show Rendering" → set "Emulate CSS media feature prefers-reduced-motion" to "reduce". Reload the page.

Verify:
1. Five stacked viewport-tall blocks render, each with the static poster + one beat.
2. The block heights are 100vh each (no 500vh pin).
3. No `<video>` element in the DOM (zero requests for `mid-section-video.mp4` in the Network tab).
4. No `<canvas>` element in the DOM (no WebGPU init).
5. Each beat fades in as its block scrolls into view (IntersectionObserver fade).

Reset the reduced-motion emulation to "No emulation" before continuing.

#### Step 5: Verify clean unmount on route navigation

- [ ] With WebGPU active (no reduced-motion emulation), navigate from `/` to `/purpose` by clicking the Purpose nav link. Then navigate back to `/`.

Verify:
1. The WebGPU canvas re-mounts cleanly when returning to `/`.
2. No DevTools console warnings about leaked WebGPU contexts.
3. Performance Memory tab shows no obvious leak across several round-trips.

#### Step 6: Verify keyboard accessibility

- [ ] Press Tab repeatedly from the top of the page. Verify focus moves: Header → Hero focusable elements → past mid-section without trapping → PurposeGrid cards.

The canvas, video, and beats are all non-focusable. Confirm none of them ever receive a focus ring.

#### Step 7: Stop the dev server

- [ ] Ctrl+C the dev server.

No commit for this task — verification only.

---

### Task 6 (contingent, manual, post-merge): Re-record fallback assets

**Files:**
- Modify: `public/mid-section-video.mp4` (replaced)
- Modify: `public/mid-section-poster.jpg` (replaced)

**Run this task only after the WebGPU implementation has merged and the live scene is visually approved.** It produces a fallback MP4 that visually matches the live WebGPU scene so non-WebGPU users see a consistent experience.

#### Step 1: Start the dev server and open the home route in Chrome

- [ ] Run: `npm run dev`
- [ ] Open `http://localhost:5173/` in Chrome. Scroll to the mid-section so the WebGPU canvas is full-screen.

#### Step 2: Capture roughly 20 seconds of the WebGPU scene at 1920×1080

- [ ] Use QuickTime → File → New Screen Recording, or Chrome's built-in recorder, to capture the mid-section canvas area for ~20 seconds. Aim for a stretch where the particle flow looks balanced (avoid moments where a single bright streak dominates the frame).

Save the raw capture somewhere outside the repo (e.g., `~/Desktop/raw-capture.mov`).

#### Step 3: Trim the capture to a loop-friendly length

- [ ] Open in QuickTime, trim to roughly 12-15 seconds. Pick a start frame and end frame where the field of lines visually balances (similar overall mass/distribution). The goal is that when the MP4 loops, the seam at end → start is imperceptible.

Save the trimmed version as `~/Desktop/trimmed-capture.mov`.

#### Step 4: Re-encode for web playback

- [ ] Run from the repo root:
```bash
ffmpeg -i ~/Desktop/trimmed-capture.mov \
  -c:v libx264 -preset slow -crf 22 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -an -y \
  public/mid-section-video.mp4
```

Flags:
- `-c:v libx264` H.264
- `-preset slow -crf 22` good quality / size tradeoff
- `-pix_fmt yuv420p` ensures playback compatibility on iOS Safari
- `-movflags +faststart` move metadata to file head so streaming starts immediately
- `-an` strip audio
- `-y` overwrite

#### Step 5: Verify the new MP4

- [ ] Run: `ffprobe -v error -show_entries stream=width,height,r_frame_rate,duration -show_entries format=duration,size -of default=noprint_wrappers=1 public/mid-section-video.mp4`

Expected: width/height match the capture, duration ~12-15 s, file size in the 5-15 MB range. If the file is > 20 MB, increase the `-crf` value (e.g., `-crf 26`) and re-encode.

#### Step 6: Re-extract the static poster

- [ ] Run from the repo root:
```bash
ffmpeg -ss 5 -i public/mid-section-video.mp4 -vframes 1 -q:v 3 -y public/mid-section-poster.jpg
```

Expected: a JPEG at `public/mid-section-poster.jpg` around 25-50 KB.

#### Step 7: Manually verify the fallback path with the new MP4

- [ ] In the dev server, temporarily force the video path (comment out the WebGPU detection in `initialRenderMode()` or use the navigator.gpu override from Task 5 Step 3). Confirm the new MP4 plays in a seamless loop and matches the live WebGPU scene visually.

Restore any temporary code changes before committing.

#### Step 8: Commit

```bash
git add public/mid-section-video.mp4 public/mid-section-poster.jpg
git commit -m "chore(public): re-record WebGPU fallback MP4 + poster"
```

---

## Final verification

After all required tasks (1-5) are committed:

- [ ] Run `npm test` — all 511+ tests pass.
- [ ] Run `npm run build` — production build succeeds.
- [ ] Run `npm run lint` — no new lint errors.
- [ ] Confirm the commit chain via `git log --oneline c69b25c..HEAD`:
  - poster JPG
  - CSS root variables
  - 3× content module tests
  - CSS rules block
  - MidSectionMotion v1 (MP4-scrub)
  - App.tsx wiring
  - three dependency
  - WebGPU scene module
  - MidSectionMotion v2 (three-mode)
  - Scrim bump
- [ ] Confirm `git diff main..HEAD --name-only` lists only files in the File Structure section.
- [ ] Bundle-size check: `du -sh dist/assets/*.js | sort -h | tail -5` shows the largest chunks. Confirm the new chunk including Three.js is on the order of 600 KB pre-gzip (roughly 200-250 KB gzipped). If it's > 1 MB pre-gzip, investigate — likely a code-splitting issue.

Task 6 (asset re-record) runs after merge.
