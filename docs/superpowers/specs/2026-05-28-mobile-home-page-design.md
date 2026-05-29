# Mobile Home Page — Faithful Translation

**Status:** Draft (2026-05-28)
**Owner:** Marketing site — home page mobile experience
**Scope:** `/` route only. Other pages (Notepad, Auth, Profile, Admin, Purpose detail, Community, Contact) are out of scope for this spec and will be brainstormed separately.

## Purpose

The desktop home page is a five-act, scroll-pinned, GSAP/WebGPU-driven brand journey designed for cursors, large viewports, and capable GPUs. On phones it is brittle (pinning fights the URL bar), expensive (WebGPU + masked video), and unrewarded (thumbs don't track tightly enough to enjoy the choreography). This spec defines a **mobile-specific home page** — the same five acts in the same order with the same brand voice, **rebuilt for one-thumb scroll**.

Mobile activates at viewport width ≤ 768px (the existing Tailwind `md` breakpoint). Tablet (769–1024px) and desktop (≥ 1025px) keep the current `/` experience unchanged.

This is **not** a separate route — it's the same `/` URL, with mobile-specific component variants composed inside the existing `App.tsx` route. Routing, intro gate, header chrome, footer, and loading overlay logic remain shared.

## Design philosophy

**Faithful translation × Theater (lite).** The five-act journey survives: PSALMS opens, the mid-section breathes, the two paths invite, the Purpose grid is browsed, the final reflection closes. What's rebuilt is the *mechanism*:

- Scroll-pinning is shortened or removed (mobile address bars resize the viewport mid-scroll and break long pins).
- WebGPU mid-section swaps to the existing `video` render mode (already implemented as the desktop fallback).
- Masked silhouette video becomes a static silhouette image (battery + bandwidth).
- Quote sequences fade in place rather than scroll-pinning.
- The horizontal Purpose row becomes a CSS scroll-snap carousel with a dot indicator.
- Two-column TwoPathInterlude stacks vertically.
- Hover affordances disappear; tap targets are sized for thumbs (≥ 44pt).
- All GSAP scroll timings shorten ~30% for snappier feel.

What does *not* change: brand voice, copy, color palette, type pairings, navigation taxonomy, footer, route structure, intro-gate behavior, reduced-motion paths, sessionStorage keys, analytics events.

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Guiding philosophy | **Faithful translation** — same 5 acts, same order, same voice; rebuilt for thumb-scroll | Chosen over "reimagined editorial" and "app-forward landing." Visitors who saw desktop should recognize the journey. |
| 2 | Activation breakpoint | **`max-width: 768px`** (Tailwind default `md` breakpoint) | Matches `particle-system.ts:50` and existing `md:` class usage across `sections/`. Tablet (769–1024) gets the desktop layout as today. |
| 3 | Code structure | **Variant components, not a separate route** | E.g. `Hero.tsx` exports the desktop hero and internally renders `<HeroMobile />` when viewport ≤ 768px (via a small `useIsMobile()` hook). No new routes, no `/m/` URLs, no UA sniffing. |
| 4 | Mobile detection | **CSS-first; `useIsMobile()` for behaviorally distinct branches** | Layout differences use Tailwind responsive classes. The hook (matches `(max-width: 768px)`) gates render-mode swaps (WebGPU → video) and animation-content swaps (multi-beat scroll → single-fade). SSR-safe: hook returns `false` server-side. |
| 5 | Hero treatment | **Theater (lite)** — keep all 4 hero beats with simplified mechanics | Wordmark intro animation: kept. Scroll-collapse: kept but ~50% shorter pin distance. Silhouette image: kept (static, no video). Quote sequence: kept (cross-fade in place, not scroll-progress). Bridge copy: kept, stacked vertically. |
| 6 | Hero silhouette media | **Static image only on mobile** | The desktop masked image + video pair becomes a single image on mobile. Saves bandwidth, battery, and the codec-decoding latency that delays paint. Asset already exists in the desktop hero `<img>` source. |
| 7 | MidSectionMotion render mode | **Force `video` mode on mobile; drop pinning** | The existing `initialRenderMode()` in `MidSectionMotion.tsx:21` already supports `'video'` as the WebGPU fallback. Mobile path skips WebGPU detection entirely and selects video. Section is *not* pinned — it scrolls past naturally; beat copy appears as IntersectionObserver fades. |
| 8 | TwoPathInterlude layout | **Vertical stack, "— or —" hairline between cards** | Two existing path cards stack top/bottom. Hairline `<div>` rotates from horizontal-divider semantics to a centered "— or —" between the cards. Hover-only behaviors (`TextStaggerHover`) collapse to a static state on touch devices. |
| 9 | PurposeGrid mobile pattern | **CSS scroll-snap carousel + dot indicator beneath** | The existing `overflow-x-auto md:overflow-visible` flex row already works on mobile. Enhancement: add `scroll-snap-type: x mandatory` on the row and `scroll-snap-align: center` on each tile. New small dot-indicator row beneath, driven by `IntersectionObserver` on each tile. Tap → existing PurposeDetail flow unchanged. |
| 10 | FinalReflectionCta scale | **Tighter type scale, button width clamped ≤ 70vw, vertical padding kept generous** | No structural change. Tailwind responsive classes do the work. |
| 11 | Header on mobile | **Compact top bar: wordmark left, hamburger right. Drawer slides from right with the same nav items as desktop.** | No bottom nav — this is a brand journey, not an app shell. Drawer uses the existing shadcn `Sheet` primitive (already in `components/ui/sheet.tsx`). Lucide `Menu` / `X` icons already imported in `Header.tsx:6`. The desktop nav-collapse ScrollTrigger logic disables on mobile (the hamburger replaces it). |
| 12 | Footer | **Single-column stack of existing footer content** | No structural redesign. CSS only. |
| 13 | Intro gate | **Inherited unchanged** | `decideHeroIntro` + `persistIntroPlayed` behavior in `App.tsx` is shared. The mobile hero's intro animation uses the same `introActive` prop. |
| 14 | GSAP timing scale | **Mobile timings = desktop timings × 0.7** | Centralize as a `MOBILE_TIME_SCALE = 0.7` constant in a small `lib/motion-scale.ts`. Imported by Hero / MidSection / FinalReflection mobile paths only. |
| 15 | Reduced motion | **Existing reduced-motion paths inherited everywhere** | Mobile-specific render branches still check `prefers-reduced-motion` first. No new logic — mobile + reduced-motion users get the same reduced experience that desktop + reduced-motion users get, scaled to the mobile layout. |
| 16 | Loading overlay & page transitions | **Inherited; timings shortened ~30%** via the same `MOBILE_TIME_SCALE` | `useLoadingOverlay` `minMs` reduced on mobile. `SplitTransition` phases shortened. |
| 17 | Analytics / sessionStorage | **No changes** | Same events, same keys. Mobile is a presentation layer, not a behavior fork. |
| 18 | Out of scope | **All other routes** | Notepad, Auth (`/login`, `/welcome`, `/profile`), Admin (`/admin/*`), PurposeDetail, Community, Contact, NotepadLanding sub-stations. Each gets its own brainstorm + spec. |

## Scope

### In

- **`useIsMobile()` hook** (`src/hooks/useIsMobile.ts`) — wraps `window.matchMedia('(max-width: 768px)')`, SSR-safe (returns `false` server-side), subscribes to changes. Used only by components that need a *behavioral* branch (render mode, animation content). Pure layout differences must use Tailwind responsive classes.
- **`MOBILE_TIME_SCALE` constant** (`src/lib/motion-scale.ts`) — `0.7`. Imported by mobile animation paths to scale GSAP durations.
- **Hero mobile path** in `src/components/sections/Hero.tsx`:
  - Conditional render: when `useIsMobile()` returns `true`, render `<HeroMobile />`; otherwise the existing desktop hero.
  - `HeroMobile` keeps the wordmark intro, a shortened scroll-collapse (≤ 60vh pin distance), static silhouette image, vertically-stacked quote cross-fades, vertically-stacked bridge copy. Uses the existing `BRIDGE_COPY` data and `BRIDGE_PIN_TIMING` (scaled by `MOBILE_TIME_SCALE`).
  - Re-uses the existing `PsalmsWordmarkSvg` and `HeroMaskClipDef`.
  - No `<video>` element on the mobile path.
- **MidSectionMotion mobile path** in `src/components/sections/MidSectionMotion.tsx`:
  - `initialRenderMode()` extended to return `'video'` when `useIsMobile()` is true, regardless of WebGPU availability.
  - Mobile rendering drops the pin: the existing ScrollTrigger that pins the stage becomes a no-op on mobile; beat copy fades in via IntersectionObserver instead of scroll-progress.
  - Existing `BEATS` data and `mid-section-motion-content.ts` content unchanged.
- **TwoPathInterlude mobile path** in `src/components/sections/TwoPathInterlude.tsx`:
  - Tailwind responsive classes: column flex direction becomes `flex-col` ≤ 768px; the central hairline `<div>` becomes a centered "— or —" label.
  - `TextStaggerHover` components render as `TextStaggerHoverHidden` static state on touch devices (detected via `(hover: none)` media query).
  - ScrollTrigger entrance keeps its existing IntersectionObserver fallback on mobile.
- **PurposeGrid mobile path** in `src/components/sections/PurposeGrid.tsx`:
  - The existing `overflow-x-auto` flex row gets `scroll-snap-type: x mandatory` and each tile gets `scroll-snap-align: center` on mobile only.
  - New `<PurposeGridDots>` sub-component renders beneath the row on mobile: one dot per tile, active state driven by an IntersectionObserver on each tile.
  - Filter chip row above the grid already responsive; no changes.
- **FinalReflectionCta** in `src/components/sections/FinalReflectionCta.tsx`:
  - Type scale tightened via Tailwind responsive classes.
  - CTA button max-width clamped to `70vw` on mobile.
- **Header mobile path** in `src/components/layout/Header.tsx`:
  - On mobile: nav links collapse into a hamburger that opens a right-side `Sheet` (shadcn) with the existing `navItems` list.
  - The desktop nav-collapse ScrollTrigger (`NAV_WINDOWS`, `BURGER_WINDOW`) bails out early on mobile — it's replaced by the static hamburger.
  - Loading-overlay trigger and water-text hover effect disable on mobile; nav-item taps still fire `handleNavTrigger` via tap.
- **Footer** in `src/components/layout/Footer.tsx`:
  - Tailwind responsive classes only — single-column stack on mobile.

### Out

- **Other routes.** Notepad (`/notepad`), NotepadLanding sub-stations (Living Graph, Seven Papers, Scripture Margin, Notepad Garden Scene), Auth (`/login`, `/welcome`, `/profile`), Admin (`/admin/*`), PurposeStack / PurposeDetail flow body, Community (`/community`), Contact (`/contact`). Each gets its own brainstorm + spec.
- **Tablet redesign.** 769–1024px keeps the desktop layout as-is.
- **UA sniffing or device detection.** Width-only via `matchMedia`.
- **Native app behaviors.** No bottom nav, no pull-to-refresh, no haptics, no service worker, no PWA install prompts.
- **Performance work beyond what falls out of the changes.** No Lighthouse target in this spec; mobile asset diet (image vs. video, video vs. WebGPU) is a side effect of the design choices, not a separate workstream.
- **Copy revisions.** All mobile copy is the existing desktop copy.

### Deferred

- **Mobile nav refinement** — drawer animation timing, scrim opacity, focus trap quality, "current section" indicator inside the drawer. The MVP is the shadcn `Sheet` default behavior with the existing `navItems`.
- **Mobile-specific intro experience.** Spec uses the existing desktop intro at mobile scale. A bespoke mobile intro is its own creative beat.
- **Tablet redesign.** Above.

## Architecture

```
App.tsx (unchanged routing)
  └─ <Home /> (the existing composition of sections on '/')
       ├─ Hero
       │    ├─ useIsMobile() ? <HeroMobile /> : <HeroDesktop />   (HeroDesktop = today's Hero body)
       ├─ MidSectionMotion
       │    ├─ initialRenderMode() reads useIsMobile() first
       │    └─ pin ScrollTrigger no-ops on mobile
       ├─ TwoPathInterlude       (CSS-only stacking + hover disable)
       ├─ PurposeGrid
       │    ├─ row gets scroll-snap on mobile
       │    └─ <PurposeGridDots /> renders below on mobile
       ├─ FinalReflectionCta     (CSS-only)
       └─ Footer                 (CSS-only)
  └─ Header
       ├─ useIsMobile() ? <HeaderMobile /> : <HeaderDesktop />
```

**Boundary discipline:** mobile variants share data sources (BRIDGE_COPY, BEATS, navItems, project data) and shared primitives (PsalmsWordmarkSvg, HeroMaskClipDef, Sheet, IntersectionObserver hooks) with their desktop siblings. The only thing each mobile variant owns is its layout and animation choreography.

## Component-by-component detail

### Hero — `<HeroMobile />`

Vertical flow, top to bottom:

1. **Wordmark intro** (~0.8s × `MOBILE_TIME_SCALE`) — same letter-spread reveal as desktop, shorter spread distance (60% of desktop) so the letters don't fly off-screen at narrow widths.
2. **Wordmark resting state** with the silhouette image masked beneath. No `<video>` element.
3. **Quote sequence** — `quoteLine1`, `quoteLine2`, `quoteAttr` cross-fade in place over ~1.5s total instead of scroll-progress. IntersectionObserver triggered when the quote container enters the viewport.
4. **Bridge copy** — `bridgeInvite`, `bridgeThesis`, `bridgeAssure` stacked vertically, fade-in on scroll via IntersectionObserver.
5. **Scroll cue** — small "↓" or "scroll" hint.

Scroll-collapse: kept but shortened. Pin distance `~60vh` instead of desktop's longer pin. Collapse curve unchanged.

Reduced motion: same paths as desktop reduced-motion — all elements settle to their final state with `opacity: 1` and no transforms.

### MidSectionMotion — mobile path

- `initialRenderMode()` returns `'video'` on mobile regardless of `'gpu' in navigator`.
- Existing `<video>` element renders normally with the desktop video source (already exists as the fallback path).
- The pin ScrollTrigger that holds the stage on desktop is wrapped: on mobile it doesn't pin. The section flows naturally; the video plays once it's in view (existing autoplay behavior unchanged).
- Beat copy (`BEATS`) appears via the existing `reducedBeatRefs` IntersectionObserver path — that path was built for `prefers-reduced-motion` users and works identically on mobile.

### TwoPathInterlude — CSS-driven mobile

- Outer flex container: `flex-col md:flex-row`.
- Hairline `<div>` rotates: `w-full h-px md:w-px md:h-full` becomes a horizontal divider on mobile. A small "— or —" label sits centered atop the divider on mobile only.
- `TextStaggerHover` reads `(hover: none)` and renders the `TextStaggerHoverHidden` static text on touch.
- IntersectionObserver entrance unchanged.

### PurposeGrid — snap carousel

- Row class additions: `snap-x snap-mandatory md:snap-none` on the existing `overflow-x-auto` parent.
- Tile class additions: `snap-center md:snap-align-none`.
- New `<PurposeGridDots projects={projects} activeId={activeId} />` component renders beneath the row on mobile (`md:hidden`).
- An IntersectionObserver tracks which tile's center is closest to the viewport center; that ID drives `activeId`.

### FinalReflectionCta — CSS only

- Headline: `text-3xl md:text-5xl` (or equivalent existing scale).
- Button: `max-w-[70vw] md:max-w-none`.
- Padding tightened ~10% on mobile.

### Header — `<HeaderMobile />`

- Compact 56px top bar.
- Wordmark (PSALMS) left, full opacity always (no scroll-collapse on mobile).
- Hamburger right, opens shadcn `Sheet` from `right` side.
- Sheet body: vertical stack of `navItems`, each link tap-target ≥ 44pt, fires `handleNavTrigger` then navigates.
- Sheet close on link tap, on outside click, on swipe-right (Sheet default).
- Theme: inherits `getNavTheme()` so it adapts to light/dark sections like desktop.

### Footer — CSS only

- Mobile: single-column stack of existing footer content blocks.
- Spacing tightened ~15%.

## Testing

The repo uses Vitest (`vitest.config.ts`) and a mix of component + behavior tests (see `Hero.tsx`'s neighbors: `hero-intro-gate.test.ts`, `hero-bridge-content.test.ts`). Tests for this spec:

- **`useIsMobile.test.ts`** — covers SSR-safe default, initial match, change subscription, unsubscribe on unmount.
- **`HeroMobile.test.tsx`** — renders without `<video>`, runs the quote cross-fade once visible, respects `prefers-reduced-motion`.
- **`mid-section-motion.mobile.test.ts`** — `initialRenderMode()` returns `'video'` when mobile is true, even when `'gpu' in navigator`. Pin ScrollTrigger does not run on mobile branch.
- **`PurposeGridDots.test.tsx`** — renders one dot per project, activates the dot whose tile is centered in viewport.
- **`HeaderMobile.test.tsx`** — hamburger toggles Sheet, link tap fires `handleNavTrigger`, Sheet closes on link tap.
- **No integration test** of "switching viewport widths mid-session" — that's a real-world edge case the existing `matchMedia` subscription handles correctly by design.

## Risks

- **`Hero.tsx` is already a large file (~800 lines).** Splitting it into `HeroDesktop` and `HeroMobile` is a natural improvement, but the wordmark intro effect is tightly coupled to the SVG ref and the ScrollTrigger sequence. Implementation will need to extract the wordmark intro into a small shared module both variants import, or hoist it into a parent.
- **MidSectionMotion's pin no-op on mobile** must be done by *not constructing* the pin ScrollTrigger on the mobile branch, not by constructing it and calling `.disable()`. The latter still creates a marker DOM cost.
- **Address bar resize on mobile Safari** can cause the wordmark intro's letter positions to recompute mid-animation. Mitigation: lock `100svh` (small viewport height) instead of `100vh` for any viewport-relative measurement during the intro.
- **shadcn `Sheet`** ships with focus management and a backdrop scrim by default; verify the backdrop doesn't conflict with the existing `useLoadingOverlay`'s z-index stack.
- **Scroll-snap carousel** can feel janky if individual tiles' images haven't loaded. Existing tiles are background images via Tailwind classes; verify each is preloaded or at least sized so the snap math doesn't jump.

## Open questions

- None blocking. All resolved during brainstorming (philosophy → A; hero → Theater lite; defaults → approved).
