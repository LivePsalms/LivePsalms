# Frontend Performance — P1/P2 Implementation Plan

**Date:** 2026-06-13 · **Branch:** `main` (P0 uncommitted) · **App:** Psalms (Vite 7 + React 19 + TS SPA)

## Context

The P0 pass (already shipped this session, uncommitted on `main` — see the handoff doc `2026-06-13-frontend-perf-handoff.md`) cut the homepage main-entry JS from **918 KB gz → 283 KB gz (−69%)** by route-lazy-loading 15 non-home routes, deferring the `three/webgpu` curl-lines scene behind a dynamic import, and removing/deferring blocking font `@import`s. That work attacked **transfer size** and got `three` off the critical path.

What P0 did **not** move is the homepage's **intrinsic render cost**: a measured **~625 ms total forced reflow** on first paint and a **~1.4 s LCP render-delay** on a 4×-CPU / Fast-4G trace. Those are DOM/layout/measurement problems, not byte problems — localhost LCP stayed flat (1.39 s → 1.50 s, within noise) precisely because on localhost bytes are free and V8 lazy-compiles unused route code.

This plan covers the **seven verified P1/P2 findings** that target that remaining cost (plus correctness/caching/console-hygiene cleanups discovered alongside). Two of them — **eager-images** and **forced-reflow** — carry essentially all of the real LCP/reflow value. The other five are correctness, caching, or console-noise fixes and **must not be credited against the 1.4 s / 625 ms targets.**

The authoritative regression signal throughout is the **re-run trace** (4× CPU, Fast 4G) on `/` — comparing total Forced Reflow ms and LCP render-delay before/after each tier. The exact, runnable measurement method lives in the handoff doc; re-establish the baseline before touching code.

---

## Priority & order

Order below is the critic's recommended sequence. Rationale is preserved per item.

1. **external-cdn-grain** — isolated CSS one-liner (`index.css:655` → `/grain-overlay.webp`), zero JS-path coupling. Land first as a freebie that removes a third-party DNS+TLS off the critical path; ships/verifies independently while bigger work is in flight.
2. **footer-gsap-bug** — isolated one-class add in `Footer.tsx` (off the LCP path, below-fold). Clears a console warning and establishes a clean correctness baseline so later "console must be warning-free" gates are meaningful.
3. **three-deprecations** — clears the two remaining three.js console warnings (PostProcessing→RenderPipeline, Clock→Timer) so the homepage console is provably clean **before** the perf-trace work. Touches MidSectionMotion's scene module (`mid-section-webgpu-scene.ts`), so it must land **before** the forced-reflow edits to `MidSectionMotion.tsx` to keep that file's coordination window small.
4. **animation-libs** — drop animejs (single SpotlightTour tween → gsap). Independent, off-homepage, shrinks the dependency surface; do it before forced-reflow so the only animation libs left in play (gsap/framer-motion) are settled when reasoning about the ScrollTrigger refresh batch.
5. **eager-images** — HeroDesktop video preload + LCP img fetchpriority/decoding + dimensions. Directly attacks the ~1.4 s LCP render-delay and is the highest-value homepage win. Sequence it **before** forced-reflow because it ALSO edits `HeroDesktop.tsx`, and you want the LCP-asset change validated by its own trace pass before stacking the heavier reflow refactor on the same file.
6. **forced-reflow** — the 625 ms reflow refactor (defer/batch ScrollTrigger refresh, MidSection pin tuning, DesktopMosaic Flip deferral, Hero getComputedStyle removal, WaterRipple rect cache). Largest/riskiest, touches the most files, and depends on three-deprecations + eager-images already being settled in `MidSectionMotion.tsx` and `HeroDesktop.tsx`. Its Tier-1 single-batched-refresh must land with/before its own Tier-2 (the DesktopMosaic deferral relies on the section being below the fold at the batched refresh).
7. **build-chunking-tskdata** — caching/notepad-only polish with ~zero homepage LCP/reflow impact. Land **last** and verify via dist chunk-graph inspection, **not** against the perf trace, so this plan does not miscredit it against the 1.4 s / 625 ms targets.

---

## 1. external-cdn-grain  ·  effort: S  ·  risk: low

**Problem.** The global `.grain-bg` overlay (rendered on every page via `<div className="grain-bg">` in `src/App.tsx:287`) pulls its grain texture from an external Webflow CDN URL inside `src/index.css`. This adds a third-party DNS lookup + TCP/TLS handshake + fetch on the homepage critical path, despite a self-hosted grain asset (`public/grain-overlay.webp`) already shipping locally and already used by the Footer.

**Sites.**

| File | Line | Current code / issue |
|---|---|---|
| `src/index.css` | 655 | `background-image: url("https://cdn.prod.website-files.com/69689842a40a17ac45e5418a/696fa735107879475a0cab0e_a1a6cc782354d179a4012e64d120e2b7_Grain%20%281%29.webp");` — external CDN background-image adds a cross-origin DNS+TLS+fetch on every page, including the homepage. |
| `src/App.tsx` | 287 | `<div className="grain-bg" aria-hidden="true" />` — consumer of the rule; **no change needed**, context only. |
| `src/components/layout/Footer.tsx` | 67 | `style={{ backgroundImage: "url('/grain-overlay.webp')" }}` — existing precedent; Footer already self-hosts grain, proving the local asset is the intended source. |

**Fix.** In `src/index.css:655`, inside the `.grain-bg` rule:

- BEFORE: `background-image: url("https://cdn.prod.website-files.com/.../Grain%20%281%29.webp");`
- AFTER: `background-image: url("/grain-overlay.webp");`

No other lines change — `background-position` (50% 50%), `background-size` (150px), and `mix-blend-mode` (color-dodge) stay as-is. The local file already exists in `public/` (2000×1000 WebP, 1.33 MB).

**Caveat on visual parity.** The two grain images are NOT guaranteed identical (different source files), and `.grain-bg` tiles at `background-size:150px` with `mix-blend-mode:color-dodge` while the Footer uses it un-tiled (`bg-cover`) with `mix-blend-overlay` + `opacity-20` — so the same file renders differently in each context. The local grain at 150 px tiles is fine-grain noise and should read nearly identically, but **eyeball it on the live page after the swap.** (Optional future hardening: the local file is 1.33 MB — large for a 150 px tile; a follow-up could add a small seamless ~150 px tile. Out of scope here.)

**Risk.** low — visual regression possible but minor; decorative full-screen overlay at a fixed blend mode. No layout or behavior change.

**Verification.** Network check: load `/` in DevTools, confirm NO request to `cdn.prod.website-files.com` and that `/grain-overlay.webp` is served from the app origin. Manual visual: the full-viewport grain overlay (z-index:1000, fixed, color-dodge, 150 px tile) still appears and looks equivalent. No automated test exists for decorative CSS overlays.

---

## 2. footer-gsap-bug  ·  effort: S  ·  risk: low

**Problem.** `Footer.tsx` fires `gsap.to('.footer-watermark', {scale:1.03, opacity:0.12, yoyo:true, repeat:-1})` at lines 33-40, but **no element** in the component (or anywhere in `src/`) carries the class `footer-watermark`, so the tween silently no-ops and GSAP warns `"GSAP target .footer-watermark not found"`. The intended target clearly exists: the "logo watermark overlay" div at lines 70-77, whose comment, starting opacity (`opacity-[0.15]`), and decorative `pointer-events-none` role exactly match the animation's intent. **Fix it (add the class), do not delete the block** — the evidence favors enabling the originally-intended pulse.

**Sites.**

| File | Line | Current code / issue |
|---|---|---|
| `src/components/layout/Footer.tsx` | 32-40 | `gsap.to('.footer-watermark', { scale: 1.03, opacity: 0.12, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 });` — selector matches zero elements; tween no-ops + emits warning. |
| `src/components/layout/Footer.tsx` | 70-77 | The intended target: `<div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15]">` wrapping `<img src="/logo-icon.png" alt="" .../>` — comment "A logo watermark overlay" + opacity + pointer-events-none match the animation's purpose, but the div has NO `footer-watermark` class. |

**Fix.** Edit `Footer.tsx` line 71 — add the class to the **wrapper div** (not the img; the tween animates scale/opacity and the div is the positioned, opacity-controlled container):

- BEFORE: `<div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15]">`
- AFTER: `<div className="footer-watermark absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15]">`

No change to the `gsap.to` block (lines 33-40); it already targets `.footer-watermark` and lives inside `gsap.context(..., footerRef)` with `ctx.revert()` cleanup (line 43), so the infinite tween is properly torn down on unmount.

**Risk.** low — adds a class to a decorative, `pointer-events-none`, `alt=""` overlay; no layout impact. Minor visual change: the watermark gains a slow 4 s yoyo pulse (scale 1.0→1.03, opacity 0.15→0.12) where it was static — the intended effect. Nit: `opacity-[0.15]` is a Tailwind class while GSAP writes inline opacity; GSAP's inline style wins and `ctx.revert()` restores it, so no conflict — confirm resting opacity reads 0.15 after revert. The `repeat:-1` tween is GPU-cheap (transform+opacity only) and unrelated to the LCP/forced-reflow work.

**Verification.** Manual: scroll to footer on `/`, confirm the "GSAP target .footer-watermark not found" warning is **gone** and the centered logo-icon watermark slowly pulses (4 s yoyo). Optional RTL regression: assert `document.querySelector('.footer-watermark')` is non-null after Footer mounts to lock the selector to a real element. Confirm resting opacity reads 0.15 after `ctx.revert()` on unmount. No existing test covers Footer animations.

---

## 3. three-deprecations  ·  effort: S  ·  risk: medium

**Problem.** Two console deprecation warnings come from `three@0.184.0`. (1) `THREE.PostProcessing` (`mid-section-webgpu-scene.ts:427`) was deprecated in r183 and renamed `THREE.RenderPipeline`; PostProcessing still exists as a subclass that emits a `warnOnce` on construction. (2) `THREE.Clock` was deprecated in r183 in favor of `THREE.Timer`, used at `mid-section-webgpu-scene.ts:477-479` and `particle-system.ts:181/191/238`. **All migration targets (RenderPipeline, Timer) are confirmed present and exported in the installed build** (`node_modules/three@0.184.0`), so the fixes are low-risk drop-ins with two API-shape gotchas.

> **API-compatibility note (already verified empirically — no further changelog/Context7 check strictly required for r184):** In the installed build, `PostProcessing` is literally `class PostProcessing extends RenderPipeline` with the identical `(renderer, outputNode?)` constructor (it only adds a `warnOnce`), and `.outputNode` + the no-arg `.render()` are unchanged. `Timer` is exported from the main `three` module (used by `particle-system.ts`) AND re-exported through `three/webgpu` (used by `mid-section`), so neither file needs a new import path. If you bump three versions before applying, re-verify both of these via the three.js r184 changelog or Context7 MCP.

**The two gotchas:** Timer is **pull-on-update** — you MUST call `timer.update()` each frame **before** any `getDelta()`/`getElapsed()` read (Clock computed on read; Timer returns the last `update()`'s value, so without it `dt`/`elapsed` stay 0 → frozen sim). And Timer's elapsed accessor is **`getElapsed()`**, there is **no `getElapsedTime()`** — a blind `Clock→Timer` swap that leaves `getElapsedTime()` throws `"clock.getElapsedTime is not a function"`. `getDelta()` keeps the same name on both.

**Sites & fixes.**

**Fix A — PostProcessing → RenderPipeline (rename only):**

| File:line | Before → After |
|---|---|
| `mid-section-webgpu-scene.ts:427` | `const postProcessing = new THREE.PostProcessing(renderer);` → `const renderPipeline = new THREE.RenderPipeline(renderer);` |
| `mid-section-webgpu-scene.ts:436` | `postProcessing.outputNode = scenePassColor.add(bloomPass);` → `renderPipeline.outputNode = ...` |
| `mid-section-webgpu-scene.ts:485` | `postProcessing.render()` → `renderPipeline.render()` |

Constructor signature, `.outputNode`, and the `.render()` call are all identical. The `intensity` getters/setters reference `bloomPass`, not the pipeline, so they're unaffected. (`mid-section` is `@ts-nocheck`, so TS won't catch a missed rename there — but it only uses `getDelta`, so it's safe.)

**Fix B — Clock → Timer (both files):**

```
--- mid-section-webgpu-scene.ts 477-481 ---
- const clock = new THREE.Clock();
- function animate() {
-   const dt = clock.getDelta() * simSpeed;
+ const timer = new THREE.Timer();
+ function animate() {
+   timer.update();
+   const dt = timer.getDelta() * simSpeed;
    uTime.value += dt;
    uDeltaTime.value = dt;

--- particle-system.ts 181 ---
- const clock = new THREE.Clock();
+ const timer = new THREE.Timer();

--- particle-system.ts 191 ---
- morphStartTime = clock.getElapsedTime();
+ morphStartTime = timer.getElapsed();

--- particle-system.ts 235-238 ---
  function animate() {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
-   const elapsed = clock.getElapsedTime();
+   timer.update();
+   const elapsed = timer.getElapsed();
```

Optional polish: Timer exposes `setTimescale()`, but keep the plain `* simSpeed` multiply on `dt` (simplest, no behavior change).

**Risk.** medium — both are deprecation-warning fixes, but the Clock→Timer swap has a real behavior trap: forgetting `timer.update()` OR leaving `getElapsedTime()` breaks the animation entirely (frozen sim in mid-section; frozen rotation/morph + runtime TypeError in particle-system). PostProcessing→RenderPipeline is low risk (identical API surface in r184, pure rename). `particle-system.ts` is type-checked, so `tsc -b` will flag a missed `getElapsed` rename there.

**Verification.** Console must be warning-free: load `/` and the notepad-landing particle scene; confirm `"PostProcessing has been renamed to RenderPipeline"` and `"Clock… use THREE.Timer"` are GONE and no `"getElapsedTime is not a function"` TypeError appears. Behavioral: mid-section curl-lines must still animate + bloom (validates `timer.update()`); particle scene must still rotate/bob/auto-morph between pencil/heart/journal every ~5 s with mouse interaction (validates `getElapsed` rename + `update()`). Build: **`tsc -b`** (NOT bare `tsc --noEmit`) to catch the rename in `particle-system.ts`. No existing automated test covers these scenes (force-sphere/garden-scene tests are a known-red baseline and unrelated).

> **Coordination:** This item touches `mid-section-webgpu-scene.ts` (the lazily-imported scene module); the forced-reflow item touches `MidSectionMotion.tsx` (the pin ScrollTrigger). Different files, same feature — **land this first, smoke the curl-lines + bloom, THEN do the pin change separately** so a frozen-sim or pin regression is bisectable. See Cross-cutting risks.

---

## 4. animation-libs  ·  effort: S  ·  risk: low

**Problem.** Three animation libraries ship together: framer-motion `^12.38.0`, gsap `^3.14.2`, animejs `^4.4.1`. **animejs has exactly ONE usage in the entire `src` tree:** a single card-entrance tween in the onboarding `SpotlightTour`. gsap is the workhorse (14 files), framer-motion is moderate (6 files). The one animejs tween is trivially reimplementable in gsap (already a dependency) or plain CSS, letting animejs be dropped from `package.json` entirely. **Do NOT touch framer-motion or gsap** — both are load-bearing.

**Sites.**

| File | Line | Current code / issue |
|---|---|---|
| `package.json` | 52 | `"animejs": "^4.4.1",` — declared but used in only ONE source file. No `@types/animejs` present (v4 ships its own types). |
| `src/notepad/onboarding/tour/SpotlightTour.tsx` | 2 | `import { animate } from 'animejs';` — the ONLY animejs import in `src`. |
| `src/notepad/onboarding/tour/SpotlightTour.tsx` | 86-100 | `animate(node, { opacity: [0, 1], translateY: [8, 0], duration: 280, ease: 'out(3)' });` — the ONLY usage: a card entrance on step change. Skipped under reduced motion, wrapped in try/catch, explicitly documented as optional progressive enhancement ("rendering must never depend on it"). |
| `src/components/sections/DesktopMosaic.tsx` | 2-4, 84-266 | The lone file importing BOTH gsap and framer-motion — **flag only, no change.** They animate *different nested elements* (gsap drives the grid container + tile wrappers; framer-motion drives inner per-tile hover overlays), and the transform boundary is intentional and documented in comments. No element is driven by both libs simultaneously. |

**Fix.** Pick one option, then remove the dependency.

- **Option A (gsap — keeps reduced-motion + try/catch shape; `'out(3)'` ≈ `'power3.out'`):** in `SpotlightTour.tsx`, replace the import (`import { animate } from 'animejs';` → `import gsap from 'gsap';`) and the tween:
  - `animate(node, { opacity: [0, 1], translateY: [8, 0], duration: 280, ease: 'out(3)' });`
  - → `gsap.fromTo(node, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power3.out' });`
- **Option B (plain CSS — zero animation-lib runtime for this component):** delete the entrance `useEffect` (86-100) + the animejs import (2); add a reduced-motion-gated keyframe:
  ```css
  @keyframes tour-card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .tour-card-in { animation: tour-card-in 280ms cubic-bezier(0.215,0.61,0.355,1) both; }
  ```
  Apply `key={index}` + the class conditionally (using the existing `reduced` flag) so it re-fires on step change.

Then, regardless of option: remove `package.json` line 52 `"animejs": "^4.4.1",` and reinstall to drop it from the lockfile.

> **Easing note:** animejs v4 `'out(3)'` is a power-3 ease-out, so gsap `'power3.out'` is the faithful mapping — **do not** use the default `power1`.

**Risk.** low — animejs powers one optional, reduced-motion-skipped, try/catch-wrapped card fade-in; worst case is slightly different easing on a 280 ms onboarding entrance. No bundle-critical or homepage path touched (SpotlightTour is lazy onboarding UI, not on the eager `/` route). DesktopMosaic dual-lib left untouched.

**Verification.** `SpotlightTour.test.tsx` already mocks `usePrefersReducedMotion()=>true`, so the entrance effect early-returns and animejs is never exercised — removing it cannot break existing tests. Then: (1) run the SpotlightTour test suite (must stay green), (2) `grep -rn animejs src` returns nothing, (3) `tsc -b` clean, (4) manual: open notepad onboarding tour with **reduced-motion OFF** and confirm the card fades/slides in on each step. animejs appears in ZERO test files, so no mocks to clean up.

---

## 5. eager-images  ·  effort: S  ·  risk: medium

**Problem.** On the homepage route `/`, the only genuinely eager below-the-fold asset is **`hero_main_video.mp4` (~2.3 MB)**, referenced in both HeroDesktop (`preload="auto"`) and HeroMobile (`preload="auto"`). On desktop the video does not play until scroll progress ≥ 0.65 (`VIDEO_PLAY_AT`), yet it fully downloads at page load. The original "11 restoration/serenity webp grid images load eagerly" premise is **already mitigated** — all consuming `<img>` sites already have `loading="lazy"`. The LCP image is **`tropical_jungle.webp`** (desktop masked hero image + mobile video poster) and must **NOT** be lazied — it should be prioritized.

**Sites.**

| File | Line | Current code / issue |
|---|---|---|
| `src/components/sections/HeroDesktop.tsx` | 644-653 | `<video ref={maskVideoRef} src="/hero_main_video.mp4" muted playsInline loop preload="auto" ... style={{ opacity: 0 }} />` — `preload="auto"` forces full ~2.3 MB download at load, but the video is invisible (`opacity:0`) and only plays at `VIDEO_PLAY_AT` (0.65). No poster on the `<video>`. **Primary eager below-the-fold asset.** |
| `src/components/sections/HeroMobile.tsx` | 179-190 | `<video ... src="/hero_main_video.mp4" poster="/tropical_jungle.webp" autoPlay={!prefersReducedMotion} muted playsInline loop preload="auto" ... />` — mobile autoplays in-viewport, so closer to above-the-fold, but `preload="auto"` still forces eager buffering of the whole file on cellular. Already has the poster (good). |
| `src/components/sections/HeroDesktop.tsx` | 637-643 | `<img ref={maskImgRef} src="/tropical_jungle.webp" alt="" className="w-full h-full object-cover" style={{ transform: 'scale(1.15)' }} />` — the **LCP / above-the-fold image.** MUST NOT be lazied. No `loading`/`decoding`/`fetchpriority` attrs and **no width/height** (see Missing → CLS). |
| `src/components/sections/HeroMobile.tsx` | 183 | `poster="/tropical_jungle.webp"` — the mobile above-the-fold/LCP visual. Do NOT lazy; keep eager. |
| `src/components/layout/HeaderDesktop.tsx` | 309-317 | `<img src="/logo-icon.png" .../>` — above-the-fold chrome; **explicit exclusion**, do not lazy. |
| `src/components/sections/MidSectionMotion.tsx` | 181-186 | `<img src="/mid-section-poster.jpg" alt="" aria-hidden="true" className="mid-section-reduced-poster" />` — reduced-motion fallback poster, rendered one per BEAT (5 copies). Lacks `decoding="async"`. Minor. |
| `src/data/projects.ts` | 32-80 | Source of the 11 `restoration*/serenity*` webp paths (`/mid_section/${file}`). **NOT a problem** — every consuming `<img>` already has `loading="lazy"` (DesktopMosaic:76-81, MobileProjectTile:102-107, PurposeStackPill:132-139). No change. |

**Fix.**

1. **`hero_main_video.mp4` (HeroDesktop:644-653):** `preload="auto"` → `preload="none"`, add `poster="/tropical_jungle.webp"`. Desktop already gates playback behind the scroll ScrollTrigger (`VIDEO_PLAY_AT=0.65`) calling `videoEl.play()`; with `preload="none"` the browser fetches the media lazily when `play()` is first invoked, deferring the ~2.3 MB download until ~65% scroll. (The `play().catch()` at line 164 still kicks loading — `play()` forces a load.)
2. **`hero_main_video.mp4` (HeroMobile:179-190):** `preload="auto"` → `preload="metadata"` (not `none` — so autoplay isn't stalled waiting for first byte). Keep `autoPlay` + existing poster.
3. **LCP image `tropical_jungle.webp` (HeroDesktop:637-643):** add `fetchPriority="high" decoding="async"` and explicitly DO NOT add `loading="lazy"`. **Also add explicit intrinsic dimensions** (`width`/`height` or `aspect-ratio`) to prevent CLS on decode — see Missing. Resulting img: `<img ref={maskImgRef} src="/tropical_jungle.webp" alt="" fetchPriority="high" decoding="async" width={...} height={...} className="w-full h-full object-cover" style={{ transform: 'scale(1.15)' }} />`.
4. **MidSectionMotion reduced poster (181-186):** add `decoding="async"`; optionally `loading={i === 0 ? undefined : 'lazy'}` on indices > 0.
5. **Grid restoration/serenity images:** no change — already lazy. Do an audit-only confirmation pass.

> **CRITICAL exclusions (never lazy):** `tropical_jungle.webp` (HeroDesktop:637 img + HeroMobile:183 poster — the LCP), `logo-icon.png` (HeaderDesktop:309 / Footer:72,82 / AuthCard:142). Use camelCase `fetchPriority` (the documented React 19 prop). `mid-section-video.mp4` (MidSectionMotion:218, non-reduced path) is a *separate* asset (the pinned scroll background) — out of strict scope, but **measure it in the network-on-first-paint check** (see Missing).

**Risk.** medium — desktop `preload="auto"→"none"` relies on the existing `play()` at HeroDesktop:163-164 to trigger the load at scroll 0.65; if `play()` somehow does not force a fetch on some browser, the first ~0.5 s of the reveal could show the poster before the video buffers (visually acceptable — masked behind `tropical_jungle.webp` anyway). Mobile `preload="metadata"` is low risk. `fetchPriority`/`decoding`/dimensions on the LCP img are low risk. Watch: desktop hero video first-play smoothness on fast scroll past 0.65.

**Verification.** Network check via DevTools MCP `list_network_requests`: confirm `hero_main_video.mp4` is NOT requested on desktop first paint (only after scroll ≥ 0.65). Trace: confirm LCP render-delay improved and `tropical_jungle.webp` is still flagged as LCP with `fetchpriority=high`. **CLS:** confirm no layout shift on hero-image decode (requires the added width/height). Unit: there is a `HeroMobile.test.tsx` (~80-95) asserting `src=/hero_main_video.mp4` + `poster=/tropical_jungle.webp` — extend it to assert `preload="metadata"`. Add a HeroDesktop RTL assertion that the masked video has `preload="none"` + a poster and the masked img has `fetchPriority="high"` and does NOT have `loading="lazy"`. Manual smoke: desktop hero reveal video still crossfades in at ~65% scroll.

> **Coordination:** `HeroDesktop.tsx` is also edited by forced-reflow. Do eager-images **first**, re-trace, then forced-reflow — so LCP-vs-reflow deltas stay attributable and merge churn stays small.

---

## 6. forced-reflow  ·  effort: L  ·  risk: medium

**Problem.** On the `/` render path the dominant forced-reflow source is **not** a manual read-in-scroll-handler but **GSAP ScrollTrigger itself**: ~16 ScrollTrigger instances are created across Hero (5), MidSectionMotion (2-3 incl. one PIN), TwoPathInterlude (1 — see note below), PurposeGrid (4), and DesktopMosaic (3) on first paint, 13 of them with `invalidateOnRefresh`. `ScrollTrigger.refresh()` (fired on load, every webfont load, and resize) synchronously measures `getBoundingClientRect` for every trigger and, because MidSectionMotion **pins**, inserts a pin-spacer and forces a full reflow — the **~324 ms** culprit. The second, separately-attributable thrash (**~130 ms**) is DesktopMosaic's Flip strip→grid morph, an explicit read→write→read inside a `useLayoutEffect` on mount. Manual layout reads in actual scroll/rAF handlers on this path are minimal and mostly safe (`HeaderDesktop.applyDom` is write-only; `useScrollDirection` reads only `scrollY`).

**Sites.**

| File | Line | Issue (current code excerpted) |
|---|---|---|
| `MidSectionMotion.tsx` | 85-94 | Pinned ScrollTrigger (`pin: stageEl`) with `scrub:2` + `invalidateOnRefresh`. **Pinning is the single most expensive ScrollTrigger feature on load** — `refresh()` measures the trigger rect, inserts a pin-spacer, forces a synchronous reflow of the whole document below it; every subsequent refresh re-runs this. **Largest contributor to the ~324 ms reflow.** |
| `DesktopMosaic.tsx` | 242-249 | Deliberate read→write→read thrash in a mount `useLayoutEffect`: `grid.dataset.layout='strip'; void grid.offsetHeight; const state=Flip.getState(items); grid.dataset.layout='grid'; void grid.offsetHeight;` — `Flip.getState` reads `getBoundingClientRect` for EVERY project card. Re-runs on every filter change (keyed on `filteredProjects`). **The ~130 ms culprit.** |
| `DesktopMosaic.tsx` | 344-360 | Second `Flip.from` (filter reflow) with `absolute:true` also measures all cards via the pre-captured `flipStateRef.current = Flip.getState(...querySelectorAll('[data-flip-id]'))` (331-340). Not on first paint but compounds per filter-tab click; `absolute:true` takes items out of flow → extra layout passes. |
| `HeroDesktop.tsx` | 266 | `const ringFinalCss = getComputedStyle(heroEl).getPropertyValue('--ring-final-size').trim() || '2800px';` — called synchronously while BUILDING the intro GSAP timeline (inside `play()`, invoked from `useLayoutEffect` at line 311, before first paint). `getComputedStyle` forces a style/layout flush, reading a CSS var written by the ResizeObserver effect (200-207) — a cross-effect read-after-write. |
| `HeroDesktop.tsx` | 195-213 | Responsive-sizing effect: `update()` does `svgEl.getBoundingClientRect().width` then writes 3 CSS vars (`--aura-size/--ring-size/--ring-final-size`) on `heroEl`. Fine steady-state, but fires once synchronously at mount AND on initial RO observe; its written vars are read back by `getComputedStyle` at 266 → read→write→read chain across effects on the LCP path. |
| `HeroDesktop.tsx` | 87,120,145,344-357 | Five ScrollTriggers (quote-fade, bridge-cascade, mask-expand ×2, scroll-collapse), all `invalidateOnRefresh:true`. Hero is the LCP component, so these run during render-delay. |
| `PurposeGrid.tsx` | 43-49,75-81,107-113,129-132 | Four more ScrollTriggers (section fade, filter-tabs reveal, watermark reveal, leave-back reset), three with `scrub`+`invalidateOnRefresh`. All on homepage mount; all join the refresh batch. |
| `HeroMobile.tsx` | 79 | `end: () => \`+=${window.innerHeight * (MOBILE_COLLAPSE_VH / 100)}\`` — functional end re-invoked on every refresh. `innerHeight` read doesn't itself force layout but runs inside the refresh batch on the mobile LCP path. Low cost. |
| `WaterRipple.tsx` | 49-54 | `const rect = containerRef.current.getBoundingClientRect(); const x = clientX - rect.left;` — per-event layout read on every (throttled 200 ms) mousemove + click/touch. NOT a load-time handler (does not contribute to the 625 ms), but cacheable. Wraps the entire homepage (disabled during intro). |
| `HeaderDesktop.tsx` | 105-138 | **NOT a thrash, documented for completeness:** `applyDom` runs every nav-collapse scrub frame but is WRITE-ONLY (transform/opacity/filter/aria on cached refs). No layout reads in the loop. **Leave as-is — explicitly do NOT touch.** |

**Fix — attack in three tiers.**

**TIER 1 — the ~324 ms refresh storm (biggest win):**
- (a) Add a single global ScrollTrigger config in app bootstrap (new — `main.tsx` is currently 6 lines, so this is a genuinely new insertion): `import { ScrollTrigger } from 'gsap/ScrollTrigger'; ScrollTrigger.config({ ignoreMobileResize: true });`. More importantly, **gate ALL homepage ScrollTrigger creation behind a deferred/idle pass** so they aren't built during the LCP render-delay window — create them in a `requestIdleCallback` (or after the first `ScrollTrigger.refresh()` settles), and call `ScrollTrigger.refresh()` **ONCE** after all are registered (batch) rather than letting each `gsap.context`/create trigger its own implicit refresh.
- (b) For MidSectionMotion's pin (85-94): add `anticipatePin: 1` and ensure the pinned element/spacer has a fixed reserved height in CSS (the wrapper already has `height:700vh/500vh`) so pin-spacer insertion doesn't reflow surrounding content; consider `pinType: 'transform'` to avoid layout-affecting position changes.
- (c) Reduce `invalidateOnRefresh` where geometry is viewport-relative and stable — it forces a full re-measure on each refresh.

**TIER 2 — the ~130 ms DesktopMosaic morph (must land atomically with Tier 1):**
Defer the whole morph setup out of the synchronous mount `useLayoutEffect` into the existing ScrollTrigger `onEnter` (or a `requestAnimationFrame`). The section is **below the fold on load**, so building it lazily via `IntersectionObserver`/`onEnter` means **zero measurement during initial homepage load.** Collapse the read→write→read to a single forced reflow (one `offsetHeight` between the two dataset writes is enough — the second is redundant because `Flip.from` re-measures).

**TIER 3 — Hero + WaterRipple (follow-on commit OK):**
- HeroDesktop: in the responsive-sizing effect (200-213), store `ringFinalPx = sizes.ringFinal` in a ref; at line 266 use that ref instead of `getComputedStyle(heroEl).getPropertyValue('--ring-final-size')`. Same value, removes one `getComputedStyle` flush from the pre-paint intro build. (`sizes.ringFinal` is already computed at line 206 — no CSS-var round-trip needed.)
- WaterRipple: add a `rectRef` cached on mount via ResizeObserver/scroll listener; in `createRipple` use `rectRef.current` instead of `getBoundingClientRect` per move. **Must invalidate on scroll** — the container is page-tall and fixed-overlay math uses viewport-relative client coords; a stale rect breaks ripple positioning after any scroll (an interaction regression the perf trace will NOT catch).

**Code-change summary.** (1) Global ScrollTrigger config + single batched refresh in `main.tsx`. (2) `MidSectionMotion.tsx` 85-94: add `anticipatePin: 1` + `pinType: 'transform'`, verify the 700vh/500vh wrapper reserves the pin height. (3) `DesktopMosaic.tsx` 205-314: defer the Flip morph into `onEnter`/`rAF`; collapse to a single forced reflow. (4) `HeroDesktop.tsx`: ref-cache `ringFinal`, use at 266. (5) `WaterRipple.tsx` 49-54: `rectRef` cached on mount + invalidated on scroll/resize.

**Risk.** medium — Deferring/batching ScrollTrigger creation and the DesktopMosaic Flip morph risks visual regressions if a trigger's start/end is measured before fonts/images settle (mis-positioned reveals) or if the strip→grid "from" state is captured at the wrong layout moment (cards jump). `pinType:'transform'` can shift stacking/overflow of the mid-section. HeroDesktop ringFinal change is low risk (same value, no round-trip). WaterRipple rect-cache is low risk but **must** invalidate on scroll.

**Verification (AUTHORITATIVE).** Chrome DevTools MCP `performance_start_trace` on `/` at 4× CPU / Fast 4G (same as diagnosis); compare total **Forced Reflow ms (baseline 625 ms — target well below)** and LCP render-delay before/after **each tier**. PLUS behavioral non-regression: existing `PurposeGrid.test.tsx` must stay green; Playwright/manual check that scrolling to `#projects` still plays the strip→grid morph and filter tabs still reflow (`data-layout` strip→grid, cards visible); Hero intro still renders the expanding ring (screenshot). WaterRipple: manual check that ripples appear at the correct cursor position **after** scrolling (validates rect-cache invalidation). **Must also re-trace at least one non-homepage ScrollTrigger route (notepad-landing)** to confirm the global config change didn't mis-position triggers app-wide. No pure-unit seam exists for reflow cost — rely on the trace + component tests.

> **Scope confirmation (do NOT widen):** MoodBoard, PurposeStack, NextDevotionHandoff, PurposeStackPill, LineMaskReveal, and `useAdaptiveDockTheme` are NOT on the `/` path (lazy/other-route, or gated to `isMobile && isNotepadLanding`) — exclude from this P1. `framer-motion useScroll` in MobileProjectTile is RO/IO-based and its callback reads only the motion value (no DOM) — clean, no change. `HeaderDesktop.applyDom` is write-only — explicitly do NOT touch.
>
> **TwoPathInterlude undercount (from the critic):** TwoPathInterlude has **3 ScrollTriggers** but was absent from the finding's refresh-batch census. The Tier-1 batched-refresh / deferred-creation strategy **must include TwoPathInterlude's triggers** or they'll refresh out-of-band.

---

## 7. build-chunking-tskdata  ·  effort: S  ·  risk: low (chunking) / medium (tsk-data)

**Problem.** `vite.config.ts` (7-18) has no `build.rollupOptions`, so Rollup uses default heuristics — every vendor package shares one auto-generated chunk per import boundary, with no stable long-cache vendor split. Separately, `src/notepad/graph/tsk-data.json` is **4.0 MB raw / 1.09 MB gz (29,364 keys)**, pulled in via `await import('./tsk-data.json')` at `reference-graph.ts:39`; it is **notepad-only and NOT on the homepage eager path**, but when the graph first expands TSK cross-references it forces a download + main-thread parse of the whole 4 MB blob. **Both are caching/notepad-scoped follow-ups, not homepage LCP/reflow wins.**

> **Honest framing (do not miscredit):** `manualChunks` is purely a **caching reshuffle** — Vite 7 / Rollup already auto-split dynamic imports, so total JS shipped to the homepage does NOT shrink (could even add a few KB of chunk overhead). `three` is already only in the notepad/mid-section chunks. The win is isolating react/react-dom/react-router into their own hashed chunk so an app-code edit no longer re-hashes the React vendor bundle → better repeat-visit cache hit rate. **This touches neither the 1.4 s LCP render-delay nor the 625 ms forced reflow.** tsk-data is notepad-only and cannot affect homepage metrics at all.

**Sites.**

| File | Line | Issue |
|---|---|---|
| `vite.config.ts` | 7-18 | `defineConfig` has no `build` key — no `rollupOptions.output.manualChunks`. Vendors land in default auto-split chunks; any app-code change can invalidate the vendor hash. |
| `reference-graph.ts` | 37-42 | `loadTskData()` does `const module = await import('./tsk-data.json'); tskCache = module.default`. Vite emits a ~1.1 MB-gz chunk fetched AND eval-parsed on the main thread on first cross-ref expansion. Module-level `tskCache` (35) → one-time cost per session, but a large synchronous parse spike. |
| `reference-graph.ts` | 386 | `expandTskForNewNodes` awaits `loadTskData()` then does pure key lookups (`tsk[newKey]`, `tsk[existingKey]`) — the 29k-entry object is never iterated; only referenced verses are read. Exactly the shape a per-book split / keyed fetch would serve without loading all 4 MB. |
| `package.json` | deps | Confirmed vendor versions for chunk matchers: react `^19.2.0`, react-dom `^19.2.0`, react-router-dom `^7.14.0` (NOT bare `react-router`), three `^0.184.0`, `@tiptap/*` `^3.22.5`, recharts `^2.15.4`. |

**Fix.**

**(a) Build chunking** — add a `build` block to `vite.config.ts` (after `resolve`), using the **function form** of `manualChunks`:
```js
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (!id.includes('node_modules')) return;
        if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
        if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return 'vendor-three';
        if (/[\\/]node_modules[\\/]@tiptap[\\/]/.test(id) || /[\\/]node_modules[\\/]prosemirror/.test(id)) return 'vendor-tiptap';
        if (/[\\/]node_modules[\\/]recharts[\\/]/.test(id) || /[\\/]node_modules[\\/]d3-/.test(id)) return 'vendor-recharts';
      },
    },
  },
},
```
Matcher notes: react-router-dom@7 pulls react-router as a dep — match BOTH; recharts drags in `d3-*` (d3-scale/d3-shape/victory-vendor) — co-locate; `@tiptap` depends on prosemirror (`@tiptap/pm`) — co-locate. Do NOT add a `vendor` catch-all for framer-motion/gsap/animejs — leaving them auto-split avoids forcing homepage animation libs into one always-loaded chunk. **Caveat:** force-grouping three/@tiptap/recharts can in rare cases pull a lazily-split lib into a homepage-reachable chunk — **verify the post-build dist chunk graph still keeps `three` OFF the homepage entry before shipping.**

**(b) tsk-data (lower-priority, notepad-only, deferred)** — best concrete option: `git mv src/notepad/graph/tsk-data.json public/tsk-data.json` and replace the `await import()` with `fetch()`:
```js
async function loadTskData(): Promise<Record<string, string[]>> {
  if (tskCache) return tskCache;
  try {
    const res = await fetch('/tsk-data.json');           // was: await import('./tsk-data.json')
    tskCache = (await res.json()) as Record<string, string[]>;
  } catch {
    return {};                                            // degrade to "no cross-references" rather than throw
  }
  return tskCache;
}
```
Pros: the 1.1 MB-gz blob leaves the JS module graph entirely (smaller build, no ESM-wrap overhead), browser caches it as a static asset, parsing runs off the JS-eval path. **Cons (must handle):** loses Vite content-hashing → add manual cache-busting (versioned filename or `?v=` query), and it's still a ~1 MB main-thread `JSON.parse` on first expansion. **Stronger but higher-effort:** split tsk-data by Bible book (`public/tsk/gen.json … re.json`) and fetch only the referenced books — the access pattern is pure key lookup, so on-demand per-book loading cuts a typical load from 4 MB to a few KB. **Best long-term:** precompute server-side / edge function. **Recommendation: ship the `public/`+`fetch` move now; file the per-book split as the deepening follow-up.**

**Risk.** low for (a), with one medium caveat (verify three stays off the homepage entry). **medium for (b):** behavior change in the failure path (bundled import never network-fails; fetch can) and loss of content-hash cache-busting (a stale CDN copy could serve old cross-refs) — both must be handled (try/catch + versioned filename) or it's a silent regression for offline/PWA users.

**Verification (build-time, NOT the perf trace).** (a) `npx vite build`; assert `dist/assets` contains `vendor-react-*.js / vendor-three-*.js / vendor-tiptap-*.js / vendor-recharts-*.js`, and grep the homepage entry chunk to confirm it still does NOT import `vendor-three`. **Also assert total first-load JS bytes for `/` did not increase** (manualChunks can add overhead — the only honest metric for this item). (b) `reference-graph.test.ts` (exercises TSK expansion at ~574/613) must be updated with a fetch mock (`vi.stubGlobal('fetch', …)`) since the static import is gone; add a case asserting `loadTskData` returns `{}` on a rejected fetch. (`resolveJsonModule` is NOT set in tsconfig — `moduleResolution:bundler` handles JSON — so removing the import has no tsconfig ripple.)

---

## Cross-cutting risks

1. **MidSectionMotion is edited by TWO items.** three-deprecations changes `mid-section-webgpu-scene.ts` (the lazily-imported scene module) while forced-reflow changes `MidSectionMotion.tsx` (the pin ScrollTrigger at 85-94). Different files, same feature — if batched in one PR, a regression in the pinned mid-section can't be bisected to libs-vs-reflow. **Land three-deprecations first, smoke the webgpu curl-lines + bloom, THEN do the pin/anticipatePin/pinType change separately.**
2. **HeroDesktop.tsx is edited by BOTH eager-images and forced-reflow** — overlapping line regions (637/644 vs 266/87/120/145/344). **Do eager-images first and re-trace, then forced-reflow,** to attribute any LCP delta correctly and avoid merge churn.
3. **forced-reflow Tier-1 and Tier-2 are NOT independent.** Deferring DesktopMosaic's morph relies on the section being below the fold at the single batched refresh. **They must land in ONE atomic commit;** splitting them risks the morph capturing "from" state at the wrong layout moment (cards jump).
4. **`pinType:'transform'` on the MidSection pin** changes stacking/overflow of the mid-section background video AND interacts with the WebGPU canvas mount. **Verify the curl-lines canvas still pins/scrubs after BOTH the Timer change and the pin change are in.**
5. **WaterRipple wraps the ENTIRE homepage** and is only disabled during `introActive`. Its rect-cache change must invalidate on scroll — a stale cached rect breaks ripple positioning after any scroll, **an interaction regression the perf trace will NOT catch.**
6. **The global `ScrollTrigger.config()`/batched-refresh added in `main.tsx` affects EVERY route** that uses ScrollTrigger (notepad-landing particle scene, PurposeStack on other routes), not just `/`. A too-aggressive refresh debounce or `ignoreMobileResize` can mis-position triggers on resize/orientation change app-wide. **Scope the config carefully and smoke at least one non-homepage ScrollTrigger route.**

---

## Missing / also consider (net-new scope before calling homepage-perf "complete")

These came from the critic's completeness review and are **not** in the seven findings. Treat them as first-class plan scope where noted.

1. **CLS / image dimensions (fold into eager-images).** The LCP img `tropical_jungle.webp` (HeroDesktop:637) has NO width/height/aspect-ratio and uses `style{transform:scale(1.15)}` only. Without explicit dimensions the masked hero can shift on decode → CLS. **Add explicit width+height (or aspect-ratio) to that img AND assert CLS in the trace, not just LCP render-delay.**
2. **React re-render / memoization (entirely unexamined — the biggest blind spot).** Grep shows ZERO `React.memo`/`useMemo`-gated children across Hero*, MidSectionMotion, TwoPathInterlude, PurposeGrid, DesktopMosaic. HeroDesktop drives `useSyncExternalStore` on nav-collapse progress every scroll frame (301-307), which re-renders the whole Hero subtree per frame unless children are memoized — **plausibly part of the 1.4 s render-delay the plan otherwise attributes to assets/ScrollTrigger.** Add a React-DevTools/profiler render-count check to the homepage scroll path; memoize hot children if confirmed.
3. **Mobile font strategy for the LCP (unverified-but-asserted-safe).** The desktop LCP is the masked `tropical_jungle.webp` IMAGE + inline-SVG wordmark, so Cormorant Garamond is NOT on the desktop LCP critical path. But the **mobile** LCP is the video poster + visible Cormorant text, and the P0 print/onload non-blocking font load (`index.html:18-23`) **guarantees a swap/FOUT on the mobile hero copy.** Decide explicitly: either **preload the single Cormorant weight used above-the-fold** (`<link rel="preload" as="font" crossorigin>`) or accept the FOUT — right now it's silently swap-flashing on mobile.
4. **TwoPathInterlude in the refresh-batch census** (also noted under forced-reflow). 3 ScrollTriggers, absent from the finding's census — the batched-refresh/deferred-creation strategy must include them.
5. **Numeric trace budgets / pass-fail thresholds.** Define per-tier gates so "re-run the trace and compare" isn't subjective — e.g. target `total ForcedReflow < Y ms` (well below 625 ms), `LCP render-delay < X ms`, `CLS ≈ 0.00`. Record the actual targets when you re-establish the baseline.
6. **`mid-section-video.mp4`** (MidSectionMotion non-reduced path, `preload=auto`, the pinned scroll background) — acknowledged but out of scope for eager-images. At minimum, **measure it in the network-on-first-paint check** even if not changed.
7. **Reduced-motion non-regression as a first-class verification line.** Several fixes touch reduced-motion paths (MidSection reduced poster decoding, SpotlightTour early-return after animejs removal, Hero quote-fade). Add an explicit `prefers-reduced-motion` smoke pass to confirm static fallbacks still render after the animation-lib and reflow edits.
8. **Bundle-size / network regression guard for chunking** beyond "grep three off the homepage entry" — assert total first-load JS bytes for `/` did not increase (manualChunks can add overhead).

---

## Batching & commits

- **Housekeeping (can share ONE PR — each independently revertible, none touches the LCP path):** `external-cdn-grain` (index.css one line), `footer-gsap-bug` (Footer.tsx one class), `animation-libs` (SpotlightTour.tsx + package.json/lockfile).
- **three-deprecations:** its own commit (two scene files; gated only by "do before the MidSection pin edit"). Keep separate so a frozen-sim regression is bisectable.
- **eager-images:** isolated commit. Re-trace before moving on.
- **forced-reflow:** isolated from eager-images even though both touch `HeroDesktop.tsx` (separate commits so each gets its own before/after trace, LCP-vs-reflow deltas stay attributable). Internally: **Tier-1 (global batched refresh) + Tier-2 (DesktopMosaic deferral) = ONE atomic commit** (deferral depends on the batched refresh + below-fold assumption); **Tier-3 (Hero getComputedStyle, WaterRipple rect-cache) = a follow-on commit.**
- **build-chunking + tsk-data:** two SEPARATE commits (chunking is shippable alone; tsk-data is a behavior change needing the fetch-mock test update + cache-busting). Both land last, verified against dist/chunk-graph, **never** against the homepage trace.

---

## Definition of done

- [ ] **external-cdn-grain** fixed + verified (no `cdn.prod.website-files.com` request; grain visually equivalent).
- [ ] **footer-gsap-bug** fixed + verified (warning gone; watermark pulses; resting opacity 0.15 after revert).
- [ ] **three-deprecations** fixed + verified (both warnings gone, no `getElapsedTime` TypeError; curl-lines + particle scene still animate/morph).
- [ ] **animation-libs** fixed + verified (`grep -rn animejs src` empty; SpotlightTour test green; tour entrance still animates reduced-motion-off).
- [ ] **eager-images** fixed + verified (`hero_main_video.mp4` not requested before scroll 0.65 on desktop; LCP img `fetchpriority=high`; **width/height added + CLS ≈ 0.00**).
- [ ] **forced-reflow** fixed + verified (**total ForcedReflow ms re-measured and well below the 625 ms baseline** on the authoritative 4× CPU / Fast 4G trace; DesktopMosaic morph + filter tabs + Hero ring intact; WaterRipple ripples correct after scroll; non-homepage ScrollTrigger route smoked).
- [ ] **build-chunking-tskdata** fixed + verified (dist contains the named vendor chunks; `three` still OFF the homepage entry; total first-load `/` JS bytes did not increase; tsk-data fetch + degraded-path test).
- [ ] **Net-new scope addressed:** LCP image dimensions; React memoization audit done (memoize hot children if confirmed); mobile Cormorant font decision made (preload or accept FOUT, documented); reduced-motion smoke pass; numeric per-tier trace budgets recorded.
- [ ] **`tsc -b` exits 0** (zero type errors).
- [ ] **Zero new console warnings** on `/` (and notepad-landing).
- [ ] **No new lint errors** vs the known repo baseline (~114 lint errors pre-exist; verify ZERO NEW, do NOT gate on a green repo).
- [ ] **Handoff doc updated** (`2026-06-13-frontend-perf-handoff.md` → "Update this when P1/P2 is done": final ForcedReflow ms, final homepage entry size, console state, commit hash(es), any deferred items).
