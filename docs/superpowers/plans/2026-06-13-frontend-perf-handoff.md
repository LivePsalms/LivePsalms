# Frontend Performance — Status & Handoff

**Date:** 2026-06-13 · **Branch:** `main` · **App:** Psalms (Vite 7 + React 19 + TS SPA)
**Implementation plan:** [`2026-06-13-frontend-perf-p1-p2.md`](./2026-06-13-frontend-perf-p1-p2.md) (FILE A)

---

## Status as of 2026-06-13

- **P0 = DONE** (implemented + verified this session, **uncommitted on `main`**, 4 files). Homepage main-entry JS dropped **918 KB gz → 283 KB gz (−69%)**. See "What changed (P0)" below.
- **P1/P2 = PLANNED.** Seven verified findings + net-new scope (CLS dimensions, React memoization, mobile font decision) are specified in the plan ([FILE A](./2026-06-13-frontend-perf-p1-p2.md)). Not yet started.

**Honest LCP caveat (carry this forward):** localhost LCP stayed **flat (1.39 s → 1.50 s, within noise)** after P0, because on localhost downloads are free and V8 lazy-compiles unused route code. The P0 win is real-world **cold-network transfer** (~635 KB less) + non-WebGPU devices skipping `three` entirely. The homepage's **intrinsic render-delay (~1.4 s)** + **625 ms forced reflow** are what P1 targets — those are DOM/layout/measurement problems, not byte problems, and won't move on a localhost trace; measure on the throttled (4× CPU / Fast 4G) preview.

---

## What changed (P0)

Four files, all uncommitted on `main`:

| File | Change | Effect |
|---|---|---|
| `src/App.tsx` | 15 non-home routes converted to `React.lazy` + a `<Suspense>` boundary with a neutral `var(--app-bg)` fallback div. | Homepage main-entry JS **918 KB gz → 283 KB gz (−69%)**. Notepad/pdf/admin/auth/purpose are now separate on-demand chunks. |
| `src/components/sections/MidSectionMotion.tsx` | The `three/webgpu` curl-lines scene now loads via dynamic `import('./mid-section-webgpu-scene')` inside the mount effect (was a static import); `CurlLinesIntensity` is now `import type`. | `three` is **off the critical path** and never loads on non-WebGPU devices (video fallback). |
| `src/index.css` | Removed the dead 16-handwriting-font Google `@import` AND the marketing-font `@import`. | No blocking font `@import` in CSS. |
| `index.html` | Marketing fonts (Cormorant Garamond + Outfit) now load via non-blocking `<link rel="preconnect">` + `<link rel="stylesheet" media="print" onload="this.media='all'">` + `<noscript>` fallback. | Fonts no longer render-block. (Side effect: a mobile-hero FOUT — flagged for the P1 mobile-font decision.) |

**Verified after P0:** `npx tsc -b` exits 0 (zero type errors); no new console warnings; CLS still 0.00; network capture confirms only Cormorant + Outfit fonts load and `three` is deferred.

---

## How to re-measure (reproducible — runnable verbatim)

Any future session must re-establish the baseline this way before touching code, and re-run it after each fix.

1. `npx vite build --outDir dist-perf-audit` — bypasses the `tsc -b` gate. (The real build is `npm run build` = `tsc -b && vite build`.)
2. `npx vite preview --outDir dist-perf-audit --port 4318`
3. Chrome DevTools MCP:
   - `emulate` with `cpuThrottlingRate=4` + `networkConditions="Fast 4G"`.
   - `performance_start_trace` with `reload=true autoStop=true`.
   - Read the **ForcedReflow** and **LCPBreakdown** insights, and `list_network_requests` for `/`.
   - Compare: **total ForcedReflow ms (baseline 625 ms)**, **LCP render-delay**, and which chunks load on first paint.
4. Clean up afterward: `rm -rf dist-perf-audit .perf-audit` and kill the preview.

**Known pre-existing repo baseline — do NOT treat as regressions:** ~114 lint errors, and historically failing test files (`Editor.toolbar-placement`, `garden-scene`, `force-sphere.test.ts`). Verify changes add **ZERO NEW** errors rather than gating on a green repo. `tsc -b` currently passes (exit 0).

---

## Remaining work (P1/P2 — see [FILE A](./2026-06-13-frontend-perf-p1-p2.md) for full detail)

In the critic's recommended order:

1. **[external-cdn-grain]** (S) — `index.css:655` → `url("/grain-overlay.webp")`; removes a third-party DNS+TLS off the critical path. → [§1](./2026-06-13-frontend-perf-p1-p2.md#1-external-cdn-grain---effort-s--risk-low)
2. **[footer-gsap-bug]** (S) — add `footer-watermark` class to `Footer.tsx:71`; clears a GSAP "target not found" console warning. → [§2](./2026-06-13-frontend-perf-p1-p2.md#2-footer-gsap-bug---effort-s--risk-low)
3. **[three-deprecations]** (S) — PostProcessing→RenderPipeline + Clock→Timer in `mid-section-webgpu-scene.ts` + `particle-system.ts`; clears two three.js warnings. **Land before the MidSection pin edit.** → [§3](./2026-06-13-frontend-perf-p1-p2.md#3-three-deprecations---effort-s--risk-medium)
4. **[animation-libs]** (S) — drop animejs (single SpotlightTour tween → gsap/CSS) + remove from `package.json`. → [§4](./2026-06-13-frontend-perf-p1-p2.md#4-animation-libs---effort-s--risk-low)
5. **[eager-images]** (S) — HeroDesktop video `preload="none"`+poster, mobile `preload="metadata"`, LCP img `fetchPriority="high"`+`decoding="async"`+**width/height**. Highest-value LCP win. **Do before forced-reflow (shared file).** → [§5](./2026-06-13-frontend-perf-p1-p2.md#5-eager-images---effort-s--risk-medium)
6. **[forced-reflow]** (L) — batch/defer ScrollTrigger refresh, MidSection pin tuning, DesktopMosaic Flip deferral, Hero `getComputedStyle` removal, WaterRipple rect-cache. Largest/riskiest; attacks the 625 ms. Tier-1+Tier-2 atomic. → [§6](./2026-06-13-frontend-perf-p1-p2.md#6-forced-reflow---effort-l--risk-medium)
7. **[build-chunking-tskdata]** (S) — `vite.config.ts` manualChunks (caching only) + tsk-data `public/`+`fetch` move (notepad-only). **Verify via dist chunk-graph, NOT the perf trace.** → [§7](./2026-06-13-frontend-perf-p1-p2.md#7-build-chunking-tskdata---effort-s--risk-low-chunking--medium-tsk-data)

**Net-new scope (not in the seven findings — see plan "Missing / also consider"):** LCP image width/height (CLS); React memoization audit (HeroDesktop `useSyncExternalStore` re-renders the subtree per scroll frame); mobile Cormorant font preload-or-accept-FOUT decision; reduced-motion smoke pass; numeric per-tier trace budgets.

---

## Update this when P1/P2 is done

> Whoever finishes P1/P2 **must fill this in** so the thread stays continuous. Replace each `TBD`.

- **Final total ForcedReflow ms** (4× CPU / Fast 4G trace on `/`, vs 625 ms baseline): `TBD`
- **Final LCP render-delay** (vs ~1.4 s) and **CLS** (vs 0.00): `TBD`
- **Final homepage entry size** (gz, vs 283 KB after P0): `TBD`
- **Console state** on `/` and notepad-landing (must be warning-free): `TBD`
- **`tsc -b`** exit code (must be 0): `TBD`
- **Lint:** new errors vs the ~114 baseline (must be 0 new): `TBD`
- **Commit hash(es)** for P0 and each P1/P2 batch: `TBD`
- **Items deferred** (e.g. tsk-data per-book split, mid-section-video preload, anything punted): `TBD`
- **Net-new scope outcomes** (LCP dimensions added? memoization applied? mobile font decision?): `TBD`

---

## Open commit state

The **P0 changes are uncommitted on `main`** (4 files: `src/App.tsx`, `src/components/sections/MidSectionMotion.tsx`, `src/index.css`, `index.html`). They should be **committed and/or branched** before P1/P2 work begins, so the perf effort is isolated and each batch (per the plan's "Batching & commits") gets its own revertible commit and before/after trace. Do not commit unrelated working-tree noise (there are several untracked docs/assets/supabase files present from other workstreams).

---

## Kickoff prompt for a fresh session

> Paste the block below into a fresh Claude Code session at the repo root to continue the P1/P2 work.

```
You are continuing a frontend-performance effort on the Psalms app (Vite 7 + React 19 + TS SPA) at /Users/newmac/Downloads/Psalms_app, branch `main`. P0 is already done (uncommitted, 4 files). Your job is to implement the P1/P2 fixes. This is CODE work, not documentation.

1. READ BOTH DOCS FIRST (full files):
   - Plan:    /Users/newmac/Downloads/Psalms_app/docs/superpowers/plans/2026-06-13-frontend-perf-p1-p2.md
   - Handoff: /Users/newmac/Downloads/Psalms_app/docs/superpowers/plans/2026-06-13-frontend-perf-handoff.md
   The plan has one section per finding (sites with exact file:line + current code, fix, risk, verification, effort), a "Cross-cutting risks" section, "Missing / also consider" (net-new scope), "Batching & commits", and a "Definition of done" checklist. Follow them.

2. RE-ESTABLISH THE BASELINE before changing any code (this is the authoritative regression signal — localhost won't show it, you MUST throttle):
   a. npx vite build --outDir dist-perf-audit   (bypasses the tsc -b gate; real build is `npm run build` = tsc -b && vite build)
   b. npx vite preview --outDir dist-perf-audit --port 4318
   c. Chrome DevTools MCP: emulate cpuThrottlingRate=4 + networkConditions="Fast 4G"; performance_start_trace reload=true autoStop=true; read the ForcedReflow + LCPBreakdown insights and list_network_requests for "/". Record total ForcedReflow ms (baseline 625ms), LCP render-delay, CLS, and which chunks load on first paint. Set numeric per-tier budgets from this baseline.
   d. Clean up after measuring: rm -rf dist-perf-audit .perf-audit and kill the preview.

3. IMPLEMENT IN THE CRITIC'S RECOMMENDED ORDER (use the diagnose discipline for the perf items, and TDD where a test seam exists — extend HeroMobile.test.tsx / add HeroDesktop RTL assertions / update reference-graph.test.ts with a fetch mock as the plan specifies):
   1) external-cdn-grain  2) footer-gsap-bug  3) three-deprecations  4) animation-libs  5) eager-images  6) forced-reflow  7) build-chunking-tskdata
   Verify EACH item via its listed checks before moving on. For three-deprecations, build-check with `tsc -b` (NOT bare `tsc --noEmit`). Also fold in the net-new scope: add width/height to the LCP img (CLS), audit React memoization on the homepage scroll path (HeroDesktop useSyncExternalStore re-renders the subtree per scroll frame), and make the mobile Cormorant font decision (preload vs accept FOUT). Run a prefers-reduced-motion smoke pass.

4. KEEP MIDSECTIONMOTION'S TWO CONCERNS COORDINATED IN ONE PASS: three-deprecations edits mid-section-webgpu-scene.ts (the lazily-imported scene) and forced-reflow edits MidSectionMotion.tsx (the pin ScrollTrigger). Land three-deprecations FIRST, smoke the webgpu curl-lines + bloom, THEN do the pin (anticipatePin/pinType) change — separate commits so a frozen-sim vs pin regression is bisectable. Likewise HeroDesktop.tsx is touched by both eager-images and forced-reflow: do eager-images first and re-trace before the reflow refactor. forced-reflow Tier-1 (global batched ScrollTrigger.refresh in main.tsx) + Tier-2 (DesktopMosaic Flip deferral) must be ONE atomic commit. The global ScrollTrigger.config affects ALL routes — smoke at least one non-homepage ScrollTrigger route (notepad-landing). WaterRipple's rect-cache MUST invalidate on scroll (the trace won't catch a stale-rect regression).

5. AFTER ALL FIXES: re-run the measurement method (step 2, same port 4318, same 4x CPU / Fast 4G throttle) on "/" AND on the notepad-landing route. Confirm: total ForcedReflow ms well below 625ms, LCP render-delay improved, CLS ~0.00, zero new console warnings, `tsc -b` exit 0, zero NEW lint errors vs the ~114 pre-existing baseline (do NOT gate on a green repo). Then UPDATE the handoff doc's "Update this when P1/P2 is done" section with the final ForcedReflow ms, final homepage entry size, console state, commit hash(es), and any deferred items. Produce a final handoff summary.

Notes: P0 (4 files: src/App.tsx, src/components/sections/MidSectionMotion.tsx, src/index.css, index.html) is uncommitted on main — commit/branch it before starting. Known pre-existing baseline (NOT regressions): ~114 lint errors, failing test files Editor.toolbar-placement / garden-scene / force-sphere.test.ts. Commit per the plan's "Batching & commits": the three housekeeping fixes can share one PR; three-deprecations, eager-images, and forced-reflow are isolated commits each; chunking + tsk-data land last, verified against the dist chunk-graph NOT the perf trace.
```
