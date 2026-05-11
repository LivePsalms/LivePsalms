# PSALMS Hero Intro Animation — Design

**Date:** 2026-05-11
**Status:** Approved (design phase)
**Scope:** Home page (`/`) hero only

---

## 1. Goal

Play the PSALMS logo reveal animation (currently authored as a standalone HyperFrames composition in `public/Logo-motion/my-video/`) as the entrance to the home page hero, such that the animation and the existing hero feel like one continuous unit rather than two stitched moments.

The animation must:

- Play once per browser session on `/` (skipped on returns within the same tab).
- End on a state that is visually identical to today's hero first-paint (PSALMS wordmark as a faint `#3A3426` outline at 12% opacity on the plaster background).
- Choreograph its handoff into the existing scroll-bound masked-image and quote so all three feel like one orchestrated arrival.
- Respect `prefers-reduced-motion: reduce`.

## 2. Source material

`public/Logo-motion/my-video/index.html` — HyperFrames composition. Self-contained HTML running a paused GSAP timeline. Authoritative source for:

- The PSALMS wordmark as inline SVG (six letter paths, cream `#f6f4f0`, viewBox `0 0 1500 1500`, wordmark anchored at `translate(6, 558)` inside).
- The full timeline structure (heartbeat pulses, ring expansion, letter spread waves).
- The visual rules in `DESIGN.md` (ease-outs only, no bounces, three-eases-per-scene Emil rule).

The 9 PNGs in `snapshots/` are previews only — not used at runtime.

The HyperFrames folder stays in place as the canonical design document. It is not loaded by the React app.

## 3. Architecture

### 3.1 Where the code lives

A single paused GSAP timeline inside `src/components/sections/Hero.tsx`. The timeline owns six tracks simultaneously:

1. PSALMS letter motion (A enters → heartbeat → ring → letters fan out).
2. Glow-aura and pulse-ring layers.
3. Dark canvas covering the hero during the intro.
4. Letter fill color crossfade (`#f6f4f0` → `#3A3426`).
5. Letter opacity crossfade (`1.0` → `0.12`).
6. `showNav` gate flipping to `true` at the handoff beat, which triggers the existing masked-image blur+fade entrance and the scroll-bound quote reveal.

No new dependencies. GSAP and ScrollTrigger are already in use.

### 3.2 Asset model: inline SVG replaces PNG

The current `<img src="/logo-hero.png" .../>` block in `Hero.tsx:137-145` is replaced with an inline `<svg>` containing the six letter paths copied verbatim from `Logo-motion/my-video/index.html`. The same Tailwind classes (`w-[95vw] md:w-[80vw] max-w-4xl object-contain`) and parent container are reused.

The SVG's `viewBox` is cropped to the wordmark's bounding box (vs. the original 1500×1500 square canvas) so the rendered SVG occupies the same physical box the PNG did. This guarantees no horizontal or vertical jump when the timeline lands.

`public/logo-hero.png` becomes orphaned. Optional to delete; costs nothing either way.

### 3.3 Dark canvas

An absolutely-positioned `<div>` inside Hero's first viewport. Background = the original radial gradient (`radial-gradient(ellipse 90% 70% at 50% 50%, #0e0c10 0%, #08070a 60%, #050507 100%)` over `#0a0a0c`). `z-index` above the SVG and above `OrganicBackdrop`, below `Header`.

Not a fixed full-viewport overlay (would block header and overflow hero). Contained within the hero section. Crossfades to opacity 0 at the handoff beat, revealing the plaster page background.

### 3.4 Glow-aura and pulse-ring

Stay as HTML `<div>` elements (the original implementation). Their `mix-blend-mode: screen`, `filter: blur(14px)`, and `box-shadow` halos are easier in CSS than SVG.

Their pixel dimensions are bound to the wordmark container's measured width via CSS custom properties, refreshed on resize via `ResizeObserver`:

- `--aura-size` = `wordmark-width × 0.65` (original: 720px on a 1100px wordmark = 0.6545)
- `--ring-initial-size` = `wordmark-width × 0.236` (original: 260px on 1100px)
- `--ring-final-size` = `wordmark-width × 2.545` (original: 2800px on 1100px)

Both layers are absolutely positioned within the first viewport, centered on the wordmark's optical center (the A glyph).

### 3.5 WaterRipple coordination

Hero is wrapped in `<WaterRipple>` in `App.tsx:65-71`. During the intro, click ripples would compete with the cinematic moment.

`WaterRipple` gains a `disabled` prop (additive, no behavior change when `disabled={false}` or unset). Hero owns whether the intro is currently playing and surfaces that to `App.tsx` via shared state, OR Hero renders its own click-shield over the dark canvas. Implementation detail to be resolved during planning; either approach is acceptable.

## 4. Choreography

Total run time: **~7.6s** from first paint to final state. The original HyperFrames composition is 9.0s; the trim drops the 2.1s final hold in favor of an overlapping handoff crossfade.

| t (s) | Beat | Activity |
|---|---|---|
| 0.00 | Pre-roll | Dark canvas opaque. All letters at collapse offsets near A's center (`blur 6px`, `opacity 0`). A hidden (`opacity 0`, `scale 0.92`). Glow-aura at 0. Pulse-ring at small size, opacity 0. `showNav=false`. |
| 0.30 | Act I.1 — A enters | A fades in over 1.4s (`scale 0.92→1.0`, `power2.out`). Glow-aura rises to opacity 0.18 alongside. |
| 1.70 | Act I.2 — A holds | A alone, breathing. No motion. |
| 2.10 | Act I.3 — Lub | First heartbeat. A scales `1.0→1.022→1.0`. Glow-aura blooms to 0.42, settles to 0.18. |
| 2.85 | Act I.5 — Dub | Second heartbeat. A scales `1.0→1.042→1.0`. Glow-aura blooms to 0.78, fades to 0 over 1.3s. |
| 2.97 | Act I.6 — Ring | Pulse-ring expands from initial to final size over 1.8s (`power2.out`). Fades in over 0.24s, out over 1.5s. |
| 4.20 | Act II — Wave 1 | S1 + L spread from A. Each: `x→0` (1.8s `power3.out`), `opacity→1` (1.4s `power1.out`), `blur→0px` (1.6s `power2.out`). |
| 4.65 | Act II — Wave 2 | P + M spread. Same triple-tween pattern. |
| 5.10 | Act II — Wave 3 | S2 spreads. |
| 6.00 | Letters settled | All letters at `x=0`, `opacity=1`, no blur. Wordmark fully composed in cream on dark. |
| 6.40 | **Handoff beat** | Crossfade begins (1.2s duration): dark canvas opacity → 0; letter fill `#f6f4f0` → `#3A3426`; letter opacity `1.0` → `0.12`. `showNav` flips to `true`, triggering existing masked-image entrance and scroll-bound quote. `WaterRipple.disabled` flips to `false`. |
| 7.60 | Intro complete | Wordmark is now the faint `#3A3426` outline at 12% (visually identical to today's first paint). Masked-image is mid-arrival via existing logic. |

### 4.1 Design decisions baked into the timeline

**Crossfade overlaps letter settle by 0.4s.** Letters finish at t=6.0s; we let them breathe for 400ms (half-breath, not full hold), then start the crossfade at t=6.4s. The dark canvas is still visible while the wordmark is perfectly composed in cream — the eye registers the money shot before everything dissolves.

**Wall-clock time is 7.6s.** On the long side for a web intro (most brand sites land at 3–5s). Justified by the cinematic intent of the source composition. If QA finds it long, available trim points without breaking the heartbeat or letter waves:

- The 1.7→2.1s "A holds alone" window (collapse to 0)
- The 2.6→2.85s silent gap between heartbeats (shorten to 0.15s)
- The handoff crossfade duration (shorten 1.2s → 0.8s)
- Combined trim: 7.6s → 6.0s

Trim values are tuned in QA, not pre-decided here.

## 5. Responsive sizing

The original animates letter offsets in CSS pixels for a fixed 1100px-wide wordmark. The port animates in **SVG userspace units** (viewBox 1500×1500), which scale automatically with the SVG's rendered size.

Conversion: `userspace = css_px × (1500 / 1100) = css_px × 1.3636`

| Letter | Original CSS px | SVG userspace |
|---|---|---|
| P | +479.10 | +653.3 |
| S1 | +249.20 | +339.8 |
| L | -230.26 | -313.9 |
| M | -506.68 | -690.5 |
| S2 | -789.32 | -1076.4 |

The final viewBox after cropping to the wordmark's bounding box must be re-derived during implementation (the conversion factor changes if viewBox dimensions change). Implementation note: keep the wordmark's intrinsic aspect ratio when sizing the SVG container.

## 6. Session gating

On `Hero` mount, check `sessionStorage.getItem('psalms-intro-played')`.

- **Absent** → start timeline at t=0. On `onComplete` (t=7.6s), set `sessionStorage.setItem('psalms-intro-played', '1')`.
- **Present** → skip timeline. Render hero in final state on first paint: dark canvas hidden, letters at fill `#3A3426` opacity 0.12, `showNav=true`, `WaterRipple` enabled. Visually identical to today's first paint.

Storage key: `'psalms-intro-played'`. SessionStorage (not localStorage) — flag dies when tab closes.

## 7. Reduced motion

On mount, check `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.

If true → same code path as the session-flag-present case. Skip timeline, render final state on first paint. Also set the session flag (so a mid-session toggle of reduced-motion doesn't suddenly play the intro).

## 8. First-paint / SSR

Hero is client-rendered (no SSR). The initial render state IS the t=0 state of the timeline (dark canvas opaque, letters hidden) — no FOUC between mount and first GSAP frame.

## 9. File-level changes

1. **`src/components/sections/Hero.tsx`** — primary edit
   - Inline the PSALMS SVG (six letter paths from `Logo-motion/my-video/index.html`) replacing the `<img>` at lines 137-145.
   - Add the GSAP intro timeline alongside the existing scroll-trigger logic.
   - Add `sessionStorage` and `matchMedia` checks for gating.
   - Move `showNav` from being a parent-controlled prop to being internal state driven by the timeline's handoff beat.
   - Add the dark canvas, glow-aura, and pulse-ring elements.
2. **`src/App.tsx`**
   - No change required to the `<Hero />` call itself (it currently passes no props; the `showNav` prop becomes internal and the default is removed from `HeroProps`).
   - If the implementation chooses lifted state for `WaterRipple.disabled`: add the state, pass into both `<WaterRipple>` and `<Hero>`. If the implementation chooses Hero-owned click-shield: no change to App.tsx at all.
3. **`src/components/ui-custom/WaterRipple.tsx`**
   - Add `disabled?: boolean` prop. When true, click handlers no-op. No visual change.
4. **`public/logo-hero.png`** — orphaned. Optional delete.
5. **`public/Logo-motion/`** — untouched. Stays as design document.

## 10. Verification plan

Tested via the existing Playwright setup.

1. **Visual regression — final state matches today.** Pre-set `sessionStorage['psalms-intro-played']='1'` in test, navigate to `/`, screenshot first viewport. Compare to baseline screenshot of current site. Must be pixel-identical within tolerance.
2. **First-visit happy path.** Clear sessionStorage, navigate to `/`. At t=0.5s verify dark canvas visible. Verify mask image hidden until t≥6.4s. At t=8s verify dark canvas gone, mask image visible.
3. **Session skip.** Navigate to `/`, wait for intro complete, navigate to `/purpose`, navigate back to `/`. Verify no intro plays; direct to final state.
4. **Reduced motion.** Set browser preference to `reduce`, clear sessionStorage, navigate to `/`. Verify no intro plays; mask image enters via existing fade.
5. **Responsive.** At 375 / 768 / 1440px viewports, verify the wordmark final position aligns horizontally with the existing static logo's center (no jump). Verify letter spread distances scale proportionally to wordmark width.
6. **Manual QA — duration feel.** Run on /. If 7.6s feels long, apply trims per §4.1.

## 11. Risks and non-goals

**Risk: mix-blend-mode during crossfade.**
Glow-aura and pulse-ring use `mix-blend-mode: screen` against the dark canvas. When the dark canvas crossfades out at t=6.4s and plaster shows through, `screen` against plaster would brighten the page unexpectedly. By t=6.4s both layers are already at opacity 0 (pulse-ring finished at t≈4.8s, aura at t≈4.15s) so this is a non-issue in practice. Any future change that extends a glow into the handoff window must revisit the blend mode.

**Risk: timing tuning.**
The 7.6s wall-clock is at the upper edge of acceptable web-intro duration. If QA finds it long, the trims in §4.1 are reversible adjustments — but the source composition's cinematic intent will read as faster/lighter if trimmed beyond ~6s.

**Non-goals.**
- No skip button. (User explicitly chose session-gated B over option D with skip.)
- No first-visit-only persistence. (User chose session B over localStorage C.)
- No animation on routes other than `/`.
- No changes to the existing scroll-triggered masked-image expansion or quote scroll-fade logic. Both stay as-is, gated only by `showNav` flipping at the handoff beat.
- The HyperFrames source folder is not loaded at runtime and is not part of the build pipeline.

## 12. Open questions for implementation phase

These do not block the design but should be resolved in the implementation plan:

- Exact bounding box of the cropped wordmark viewBox (compute from the SVG path data).
- Whether `WaterRipple.disabled` is driven by lifted state in App.tsx or by Hero rendering a transparent click-shield over the dark canvas.
- Whether the dark canvas should clamp to the first viewport's height or extend to cover any masked-image hover into the first viewport (the masked-image's sticky container starts with `marginTop: '-35vh'`).
