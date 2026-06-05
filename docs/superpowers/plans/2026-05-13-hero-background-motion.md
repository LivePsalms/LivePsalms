# Hero Background Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a looping warm-shadow surface behind the PSALMS wordmark in the first hero viewport, blended over the existing olive background, fading in synced with the intro handoff.

**Architecture:** A single JSX element (`<video>` in default; `<img>` in reduced-motion) added inside the existing sticky `h-screen` container in `src/components/sections/Hero.tsx`. Positioned `absolute inset-0` at `z-index: 1` with `mix-blend-mode: multiply`. Opacity is bound to the existing `showNav` state via CSS transition — zero new state, zero new effects, zero new refs. The pre-rendered MP4 from `public/hero-background-motion/renders/` is the shipping asset; no live SVG filter runs in the browser.

**Tech Stack:** React 18, TypeScript, Vite, existing GSAP timelines (not touched), CSS `mix-blend-mode`, HTML5 `<video>`.

**Spec:** `docs/superpowers/specs/2026-05-13-hero-background-motion-design.md`

**Testing note:** The codebase's Vitest setup runs in Node env (`vitest.config.ts`) and only unit-tests pure logic helpers — JSX/visual output of the `Hero` component is not unit-tested anywhere in this repo (see `src/components/sections/hero-intro-gate.test.ts`, which tests the extracted gating helper, not the component). The motion overlay has no meaningfully extractable pure logic — it is two inline ternaries and a static style object. Forcing a "TDD" helper just to have something to assert against would be theater. Verification for this change is:

1. **Static checks** (`tsc -b`, `eslint .`) — must pass.
2. **Regression** (`vitest run`) — no existing tests touched, all should remain green.
3. **Manual verification in a real browser** — the only way to actually confirm the visual behavior, per the spec's acceptance criteria. Done via Chrome DevTools MCP (`browser-testing-with-devtools` skill) on the running dev server.

---

## File Structure

**Files modified:** exactly one.

- `src/components/sections/Hero.tsx` — add a single element inside the sticky container at `src/components/sections/Hero.tsx:489-583`, placed before `darkCanvasRef` in DOM order (it will render beneath via `z-index: 1`).

**No new files.** No helper extraction (see Testing note above).

**Assets already in `public/`:**
- `public/hero-background-motion/renders/hero-loop-draft.mp4` — used by `<video>`
- `public/hero-background-motion/shadow-overlay.jpg` — used by `<img>` (reduced-motion)

Vite serves `public/` at root, so URLs are `/hero-background-motion/renders/hero-loop-draft.mp4` and `/hero-background-motion/shadow-overlay.jpg`.

---

## Task 1: Add the motion overlay element

**Files:**
- Modify: `src/components/sections/Hero.tsx:489-583` (insert one JSX block before line 493's `darkCanvasRef` div)

- [ ] **Step 1: Read the target region to confirm exact current state**

Run:
```bash
sed -n '489,495p' src/components/sections/Hero.tsx
```

Expected output (the lines we will insert before):
```
        <div
          className="top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden"
          style={{ position: prefersReducedMotion ? 'static' : 'sticky' }}
        >
          {/* Dark canvas — covers the first viewport during intro, fades at handoff */}
          <div
            ref={darkCanvasRef}
```

If the line numbers or content differ, stop and reconcile against the spec before editing.

- [ ] **Step 2: Insert the motion overlay JSX**

In `src/components/sections/Hero.tsx`, between the line containing `<div className="top-0 h-screen w-full ...` (the sticky wrapper, currently line 489-492) and the `{/* Dark canvas — covers the first viewport during intro, fades at handoff */}` comment (currently line 493), insert the following block as the FIRST child of the sticky wrapper.

Use this exact code (the wrapper `<div>` lets us share the lifecycle/style between the two branches and keeps `style.transition` working when the inner element changes type during a re-render):

```tsx
          {/* Motion overlay — warm-shadow surface that breathes underneath the
              wordmark. Loops a pre-rendered MP4 (or a static frame in
              reduced-motion) and blends with `mix-blend-mode: multiply` so
              only the shadow side of the composition modulates the olive
              app-bg. Fade-in is bound to `showNav` so it develops in
              synchronously with the dark-canvas fade at intro handoff (and
              renders immediately on non-intro paint, where `showNav` starts
              true). z-index 1 keeps it below the dark canvas (z2), aura/ring
              (z3), wordmark (z4), and climax ring (z5). */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{
              opacity: showNav ? 1 : 0,
              transition: 'opacity 1.2s cubic-bezier(0.45, 0, 0.55, 1)',
              mixBlendMode: 'multiply',
              willChange: 'opacity',
              zIndex: 1,
            }}
          >
            {prefersReducedMotion ? (
              <img
                src="/hero-background-motion/shadow-overlay.jpg"
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src="/hero-background-motion/renders/hero-loop-draft.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="w-full h-full object-cover"
              />
            )}
          </div>
```

The block must be inserted such that the resulting structure is:

```tsx
<div
  className="top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden"
  style={{ position: prefersReducedMotion ? 'static' : 'sticky' }}
>
  {/* Motion overlay — ... */}
  <div aria-hidden="true" ...>
    {prefersReducedMotion ? <img .../> : <video .../>}
  </div>

  {/* Dark canvas — covers the first viewport during intro, fades at handoff */}
  <div ref={darkCanvasRef} ...>
  ...
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npm run build
```

Expected: build completes successfully. The `tsc -b` step must produce no errors before Vite bundling begins. If there is a JSX or type error, the error will name `src/components/sections/Hero.tsx` and a line — fix it in place and re-run.

- [ ] **Step 4: Verify ESLint passes**

Run:
```bash
npm run lint
```

Expected: completes with exit 0 and no warnings about `src/components/sections/Hero.tsx`. If a warning fires, address it before continuing.

- [ ] **Step 5: Run the existing unit test suite (regression check)**

Run:
```bash
npm test
```

Expected: all tests pass. No test in this repo exercises the `Hero` component directly, so the count and pass/fail set should be unchanged from the previous commit. If a previously-green test now fails, stop — something unrelated has broken and must be investigated before the visual verification step.

- [ ] **Step 6: Commit the source change**

```bash
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(hero): add looping warm-shadow motion overlay behind wordmark

Layers the pre-rendered hero-loop-draft.mp4 inside the sticky h-screen
container at z-index 1, blended with mix-blend-mode: multiply so only
the shadow side of the composition modulates the existing olive
app-bg. Opacity is bound to the existing showNav state so the overlay
develops in synchronously with the dark-canvas fade at intro handoff,
reusing the existing reveal lifecycle without adding state/effects.

Reduced-motion fallback renders the composition's static source frame
(shadow-overlay.jpg) with identical placement and blend.

Spec: docs/superpowers/specs/2026-05-13-hero-background-motion-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Manual browser verification

**Why this task exists:** The acceptance criteria in the spec are entirely runtime/visual (intro reveal timing, multiply blend over olive, seamless loop, scroll-out behavior, reduced-motion swap). None can be verified by `tsc`/`eslint`/`vitest` alone. This task is the only honest verification of "it works."

Use the `browser-testing-with-devtools` skill (Chrome DevTools MCP) for everything below. Do NOT report the implementation as complete until each checkbox in this task is checked.

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server**

Run in background:
```bash
npm run dev
```

Note the local URL printed (usually `http://localhost:5173/`). All subsequent verification uses that URL.

- [ ] **Step 2: First-load intro path — confirm the overlay is hidden during the intro and develops in at handoff**

1. Open a fresh Chrome tab via Chrome DevTools MCP and navigate to the dev URL.
2. Within the first ~1 second after navigation, the dark intro canvas should fully cover the first viewport — the motion overlay must NOT be visible.
3. Around t≈6.4s after the page load, the dark canvas should begin fading. The warm-shadow motion should reveal smoothly *as* the dark canvas thins, NOT as a separate after-the-fact fade.
4. By t≈7.6s the overlay should be at full opacity, the cream wordmark should have shifted to deep-umber on the olive base, and the breathing surface should be visibly playing.

Pass criteria: no flash, no double-fade, no opacity pop. The overlay's reveal feels like the same beat as the dark canvas fading away.

- [ ] **Step 3: Non-intro path — confirm immediate visibility**

In the same tab, set the session-storage flag that gates the intro (the gate is `psalms-intro-played` per `src/components/sections/hero-intro-gate.ts`) and reload:

```javascript
// Run via Chrome DevTools MCP evaluate_script:
sessionStorage.setItem('psalms-intro-played', '1');
location.reload();
```

After reload, the dark canvas should not appear at all (`introActive=false`). The motion overlay should be fully visible from the very first paint — no fade-in transition.

Pass criteria: overlay visible at first paint, no perceptible opacity ramp.

- [ ] **Step 4: Confirm the seamless loop**

Watch the motion for 16+ seconds (two full 8s cycles). There must be no visible cut, pop, or jump at the loop boundary — the breathing should feel continuous.

Pass criteria: no visible seam in two full cycles.

- [ ] **Step 5: Confirm the background tone is preserved**

Using Chrome DevTools MCP `take_screenshot` on the hero viewport, sample a few pixels in mid-tone areas of the composition (not the very dark or very bright zones). The dominant hue should remain a warm olive — close to `#988F80` — not shift toward cream. The motion should read as shadow play *over* the olive, not a cream replacement.

Pass criteria: olive remains the perceived background tone. If the overlay reads as cream/beige instead, the multiply blend is failing — investigate before proceeding.

- [ ] **Step 6: Confirm scroll-collapse interaction**

From the top of the page, scroll slowly through the hero (4-5 scroll wheel notches). As the wordmark scroll-collapses, the motion should keep playing continuously through the entire sticky window. Once you have scrolled past 60% of the outer `380vh` (approximately one full screen of scrolling past the initial position), the entire sticky scene including the motion should release and scroll out of view together. The motion must NOT be visible in the mask-expand section below.

Pass criteria: motion plays through scroll-collapse, exits with the sticky region, does not bleed into subsequent sections.

- [ ] **Step 7: Confirm `prefers-reduced-motion` swap**

Via Chrome DevTools MCP, emulate reduced motion:
```
Use mcp__chrome-devtools__emulate with the prefers-reduced-motion: reduce CSS media feature.
```

Then reload. The motion area should now render the static `shadow-overlay.jpg` with identical placement and multiply blend. Inspect the DOM in DevTools and confirm an `<img>` is present, not a `<video>`. No video decode should be happening.

Pass criteria: static image is rendered in place of the video, blend and position are identical, no `<video>` element exists in that subtree.

- [ ] **Step 8: Confirm no console errors**

Use `mcp__chrome-devtools__list_console_messages` to check the console. There must be no new errors or warnings introduced by the change (especially no media-related warnings about autoplay being blocked, missing CORS, or failed asset loads).

Pass criteria: console is clean of new entries attributable to this change.

- [ ] **Step 9: Stop the dev server**

Stop the background `npm run dev` process started in Step 1.

- [ ] **Step 10: Final sanity commit (only if any tweaks were applied during verification)**

If verification surfaced a needed adjustment (e.g., a multiply that read too heavy and required an opacity reduction to 0.85, or a different reduced-motion approach), commit that delta now with a focused message. If no tweaks were needed, skip this step.

```bash
git status
git diff src/components/sections/Hero.tsx
# Only if there are changes:
git add src/components/sections/Hero.tsx
git commit -m "$(cat <<'EOF'
fix(hero): tune motion overlay <describe what>

<describe why — what visual issue Task 2 surfaced and how this fixes it>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task covering it |
|---|---|
| Asset (MP4 + jpg fallback) | Task 1 Step 2 |
| Placement & layering (z-index 1, multiply, opacity 0) | Task 1 Step 2 |
| Lifecycle — introActive=true (showNav-driven fade) | Task 1 Step 2 + Task 2 Step 2 |
| Lifecycle — introActive=false (visible from first paint) | Task 1 Step 2 + Task 2 Step 3 |
| Scroll-collapse (no special handling) | Task 2 Step 6 |
| Reduced motion swap (img instead of video) | Task 1 Step 2 + Task 2 Step 7 |
| What does NOT change (existing timelines, z-orders, props) | Task 1 only touches one file, inserts one element; no edits to existing JSX or effects |
| Acceptance criterion 1 (overlay invisible until handoff, full visible ~1.2s after) | Task 2 Step 2 |
| Acceptance criterion 2 (visible from first paint on non-intro) | Task 2 Step 3 |
| Acceptance criterion 3 (seamless loop) | Task 2 Step 4 |
| Acceptance criterion 4 (scrolls out with wordmark) | Task 2 Step 6 |
| Acceptance criterion 5 (reduced motion = static img) | Task 2 Step 7 |
| Acceptance criterion 6 (olive tone preserved) | Task 2 Step 5 |
| Acceptance criterion 7 (no regressions) | Task 1 Steps 3-5 (build/lint/test) + Task 2 Step 8 (console clean) |

All spec sections and acceptance criteria are mapped to a task.

**Placeholder scan:** No "TBD", "TODO", "implement later", "similar to Task N" placeholders. Code blocks are complete. Commands are exact.

**Type consistency:** No new types or functions are introduced. The only identifiers referenced in the new JSX are existing component-scope variables (`showNav`, `prefersReducedMotion`) — verified to exist at `src/components/sections/Hero.tsx:34` and `src/components/sections/Hero.tsx:44` respectively.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-13-hero-background-motion.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
