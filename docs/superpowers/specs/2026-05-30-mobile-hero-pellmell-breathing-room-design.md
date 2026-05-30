# Mobile hero — Pellmell-style breathing room + bottom dock

**Date:** 2026-05-30
**Components:** `MobileBottomDock` (new), `HeroMobile`, `HeaderMobile`, `App`, `useScrollDirection` (new hook)
**Scope:** Mobile (`< 768px`) only. Desktop is untouched.

## Goal

Give the mobile hero more breathing room (modest spacing/layout-only changes — typography unchanged), and replace the top `HeaderMobile` bar with a floating bottom dock (logo + MENU pill) that hides on scroll-down and reveals on scroll-up. Inspired by [pellmell.fr](https://pellmell.fr)'s mobile homepage.

## Why

The current mobile hero has a 56px top Header consuming the first scroll cell, and the hero stack (`pt-24 pb-12 gap-8`) reads as tight on small phones. Moving navigation to a floating bottom dock frees the top of the page for the wordmark, applies a recognisable mobile-native pattern (bottom-anchored nav), and gives the hero room to breathe without changing typography or asset proportions.

## Constraints (user-declared in brainstorming)

- Wordmark stays **centered**. No left-alignment.
- Quote keeps its **current font** (`text-[15px]` italic, `quote-text` class). Only layout spacing around it changes.
- Hero scale is the conservative tier — modest spacing increase, no dramatic resize.
- Dock is **app-wide on mobile**, not home-only.
- Dock contents are **logo + MENU only**. No theme toggle (dark mode is not in scope).
- Dock behavior is **hide on scroll-down, reveal on scroll-up**.

## File map

### New files

- `src/components/layout/MobileBottomDock.tsx`
- `src/components/layout/MobileBottomDock.test.tsx`
- `src/hooks/use-scroll-direction.ts`
- `src/hooks/use-scroll-direction.test.ts`

### Modified files

- `src/components/layout/HeaderMobile.tsx` — converts to `return null`. Old DOM + Sheet logic migrates to `MobileBottomDock`.
- `src/components/layout/HeaderMobile.test.tsx` — trimmed to a single "renders null" assertion.
- `src/components/sections/HeroMobile.tsx` — spacing/layout-only changes.
- `src/components/sections/HeroMobile.test.tsx` — updated assertions for new spacing + red-square accent.
- `src/App.tsx` — mount `<MobileBottomDock />` under the **same suppression predicate as the existing top `<Header>`** (`!isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage`). The dock replaces the Header on mobile, so route visibility must match. **Do not** tie it to `hideFooter` — that predicate is broader and would incorrectly hide the dock on `/community`, `/contact`, `/purpose/*`, `/notepad` landing, and detail routes.
- `src/App.tsx` (second change) — wrap the existing content tree so it has `padding-bottom: var(--mobile-dock-clearance)` on mobile whenever the dock is mounted. Single source of clearance; Footer and FinalReflectionCta are **not** modified.
- `src/index.css` — one CSS custom property `--mobile-dock-clearance` so the padding value is centralized.

## `MobileBottomDock` component

### Structure

```tsx
<aside
  data-testid="mobile-bottom-dock"
  data-visible={visible ? 'true' : 'false'}
  aria-label="Quick navigation"
  className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none
             pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300
             motion-reduce:transition-none"
  style={{ transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 1rem))' }}
>
  <div className="pointer-events-auto flex items-center gap-2">
    <Link
      to="/"
      aria-label="Home"
      className="h-11 w-11 rounded-xl bg-[var(--deep-umber)] inline-flex items-center justify-center"
    >
      <img
        src="/logo-icon.png"
        alt=""
        className="h-6 w-6 object-contain"
        style={{ filter: 'invert(1)' }}
      />
    </Link>
    <button
      type="button"
      aria-label="Open menu"
      onClick={() => setSheetOpen(true)}
      className="h-11 px-6 rounded-full bg-[var(--deep-umber)] text-white text-xs font-semibold tracking-[0.14em]"
    >
      MENU
    </button>
  </div>

  <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
    <SheetContent side="right" className="w-3/4 sm:w-1/2 bg-[color:var(--deep-umber)] text-white">
      <SheetTitle className="sr-only">Navigation</SheetTitle>
      <nav className="mt-12 flex flex-col gap-6 text-lg" aria-label="Mobile primary">
        {navItems.map((item) => (
          <SheetClose asChild key={item.label}>
            <Link
              to={item.href}
              className="block py-3 min-h-[44px]"
              onClick={() => { if (NAV_TRIGGER_LABELS.has(item.label)) onNavTrigger?.(); }}
            >
              {item.label}
            </Link>
          </SheetClose>
        ))}
      </nav>
    </SheetContent>
  </Sheet>
</aside>
```

### Props

```ts
interface MobileBottomDockProps {
  onNavTrigger?: () => void;
}
```

Same prop signature as the old `HeaderMobile` so `App.tsx`'s existing `handleNavTrigger` wires straight in.

### Behaviors

| Concern | Implementation |
|---|---|
| Hide/reveal | CSS `transform: translateY()` driven by `useScrollDirection()`. GPU-cheap, no layout reflow. |
| Hidden state | `translateY(calc(100% + 1rem))` — pushes the shadow off-screen too. |
| Top-of-page rule | `useScrollDirection` forces `'idle'` when `scrollY < 80`, so the dock is always visible on the hero. |
| Reduced motion | `motion-reduce:transition-none` — instant snap, no slide. Hide/reveal still occurs. |
| Safe-area | `pb-[max(0.75rem,env(safe-area-inset-bottom))]` — 12px on devices without home indicator, more on devices with one. |
| Pointer events | Outer `<aside>` is `pointer-events-none`; only the pill cluster captures events. Gutters left/right of the cluster don't intercept scroll/taps. |
| Theme reaction | None. The pill background is permanently `var(--deep-umber)` and the logo `<img>` carries a permanent `filter: invert(1)` to render white. Unlike the old transparent `HeaderMobile` (which needed nav-theme to swap colors as the underlying section changed), the opaque pill has its own visual identity and doesn't need to react to the page surface. |
| Drawer | The existing Sheet drawer (right-side, `var(--deep-umber)` bg, `navItems` from `@/data/projects`) is re-used verbatim — only the trigger surface changes. |

## `useScrollDirection` hook

```ts
// src/hooks/use-scroll-direction.ts
import { useEffect, useState } from 'react';

export type ScrollDirection = 'up' | 'down' | 'idle';

export function useScrollDirection(threshold = 8): ScrollDirection {
  const [dir, setDir] = useState<ScrollDirection>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < 80) {
          setDir('idle');
        } else if (Math.abs(delta) >= threshold) {
          setDir(delta > 0 ? 'down' : 'up');
          lastY = y;
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return dir;
}
```

Dock visibility computed as: `const visible = dir !== 'down';`

Reasons:
- `threshold = 8` filters inertial-bounce micro-jitter on iOS.
- `y < 80` forces `'idle'` near the top so the dock is always present on the hero (matches user mental model: dock is part of the entry impression).
- `requestAnimationFrame` keeps work 60fps-safe; `{ passive: true }` doesn't block scroll.
- SSR-safe via `typeof window === 'undefined'` guard (project uses Vite SPA but the guard is cheap and consistent with other hooks in the repo).

## `HeaderMobile` change

```tsx
// src/components/layout/HeaderMobile.tsx
interface HeaderMobileProps {
  onNavTrigger?: () => void;
}

export function HeaderMobile(_props: HeaderMobileProps) {
  return null;
}
```

The file is kept (not deleted) for these reasons:

- `Header.tsx` dispatcher still imports it. Keeping the export preserves the `HeaderMobile` / `HeaderDesktop` symmetry.
- A future re-enable (e.g. an A/B test toggling dock vs top bar) is a one-line revert.
- The imports of `Sheet`, `navItems`, `Menu`, `subscribeNavTheme` etc. all move to `MobileBottomDock.tsx`. No duplication.

`HeaderMobile.test.tsx` is trimmed to one assertion: rendering `<Header />` under 768px produces `null` (i.e. the document body contains no `[data-testid="header-mobile"]`).

## `HeroMobile` changes

| Element | Before | After | Why |
|---|---|---|---|
| Outer column wrapper | `pt-24 pb-12 px-5 gap-8` | `pt-20 pb-16 px-5 gap-10` | `pt-20` accounts for no top Header (was clearing 56px). `gap-10` (40px) is the modest spacing bump. `pb-16` adds room below the bridge before the dock-clearance zone. |
| Wordmark `<PsalmsWordmarkSvg>` | `w-[88vw] max-w-md` | unchanged | Centered via parent `items-center`. |
| Quote container `<div ref={quoteRef}>` | `text-center px-6` (+ `mt-12` removed in prior spec) | `text-center px-8 mt-2 max-w-md` | `px-8` widens the visual line measure; `mt-2` adds 8px nudge on top of `gap-10`. `max-w-md` retained. |
| Quote `<p>` style classes | `quote-text italic text-[15px] leading-relaxed` | **unchanged** | Per user constraint: quote keeps its current font. |
| Quote attribution `<p>` | `quote-attr text-xs opacity-60 mt-4` | `quote-attr text-xs opacity-60 mt-5 inline-flex items-center justify-center gap-2` and prepends a 6px red square span (decorative, `aria-hidden="true"`) | One pellmell-style accent: a small red marker before "Psalm 23:2-3". Brand-color punctuation; no copy change. |
| Video mask wrapper | `w-[88vw] max-w-md aspect-[5/3]` | unchanged | Locked by `2026-05-30-mobile-hero-masked-video-design.md`. |
| Bridge container `<div ref={bridgeRef}>` | `mt-16 mb-24 text-center px-6 flex flex-col gap-8 max-w-md` | `mt-20 mb-32 text-center px-6 flex flex-col gap-8 max-w-md` | More room above the bridge (after the video) and below it (before the dock-clearance zone). |

Red-square accent markup:

```tsx
<p className="quote-attr text-xs opacity-60 mt-5 inline-flex items-center justify-center gap-2">
  <span
    aria-hidden="true"
    className="inline-block w-1.5 h-1.5 bg-[var(--accent-red,#d9483a)]"
  />
  Psalm 23:2-3
</p>
```

The `--accent-red` token is not currently defined in `index.css`. The fallback `#d9483a` is used inline via the CSS custom property fallback syntax. Defining the token globally is **out of scope** for this spec; if a future spec introduces it, the markup picks it up automatically.

The GSAP scroll-collapse timeline (lines 53–95 of current `HeroMobile.tsx`) is **untouched**. The intersection-fade hooks (`quoteRef`, `bridgeRef`, thresholds 0.4 / 0.3) are **untouched**. These are presentation changes only.

## Sticky-dock clearance — App-level approach

Even with hide-on-scroll-down, when the user stops at the bottom of any page the dock reappears (`dir === 'idle'` once scroll stops, and `scrollY < 80` doesn't apply at the bottom). Without clearance, the dock covers the last line of content.

This must work on **every dock route**, including ones that don't render the Footer/CTA (`/community`, `/contact`, `/purpose/*`, `/notepad` landing, detail pages). Patching Footer and FinalReflectionCta individually misses those routes. Instead, apply clearance once at the App-tree level.

### CSS custom property

In `src/index.css` (`:root` block):

```css
:root {
  --mobile-dock-clearance: calc(44px + 0.75rem + env(safe-area-inset-bottom, 0px) + 1rem);
}
```

Breakdown:
- `44px` — pill height (`h-11`).
- `0.75rem` — dock outer `pb` minimum.
- `env(safe-area-inset-bottom, 0px)` — iOS home indicator on devices that have it.
- `1rem` — visual breathing buffer above the dock so content doesn't sit flush against it.

Single source of truth. If the dock pill height changes, only this constant moves.

### App.tsx wrapper

In `App.tsx`, locate the outer content wrapper (currently App.tsx:128):

```tsx
<div className="relative min-h-screen" style={{ background: 'var(--app-bg)', zIndex: 1 }}>
```

Wrap (or add a sibling utility class) so it carries mobile-only bottom padding when the dock is mounted:

```tsx
const dockMounted = !isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage;

<div
  className={cn(
    "relative min-h-screen",
    dockMounted && "pb-[var(--mobile-dock-clearance)] md:pb-0"
  )}
  style={{ background: 'var(--app-bg)', zIndex: 1 }}
>
```

`dockMounted` extracts the predicate that already gates the Header today (currently inlined at App.tsx:130) into a single named variable so both the Header conditional, the dock mount, and the wrapper padding use the same source. The `md:pb-0` clamp ensures no extra padding above 768px (where the dock isn't rendered).

Why this is enough:
- `<Footer />` and `<FinalReflectionCta />` are inside this wrapper. Bottom padding applies to the wrapper, so they sit above the padded floor naturally.
- Routes that don't render Footer/CTA — their `<main>` contents also sit inside this wrapper, so the same clearance applies.
- No individual section needs modification. Footer.tsx and FinalReflectionCta.tsx stay untouched.

Trade-off: the visual gap between Footer (or last-section) and the dock is a uniform 60px-ish strip of `--app-bg` background, the same color as the page. This reads as natural breathing room, not a layout glitch.

## App.tsx integration

Mount the dock under the **same suppression predicate as the existing top `<Header>`** (App.tsx:130). Extract the predicate into a named local first so the Header conditional, the dock mount, and the wrapper padding all share it:

```tsx
const dockMounted = !isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage;
// …
{dockMounted && (
  <Header darkText={isDetailPage || isPurposePage} showNav={headerVisible} onNavTrigger={handleNavTrigger} />
)}
{dockMounted && (
  <MobileBottomDock onNavTrigger={handleNavTrigger} />
)}
```

Why the Header predicate (not `hideFooter`):

- The dock semantically **replaces** the Header on mobile. They must appear on the same routes.
- `hideFooter` is broader: `isDetailPage || isPurposePage || isNotepadAny || isLoginPage || isProfilePage || isWelcomePage || isCommunityPage || isContactPage`. Tying the dock to it would hide the dock on `/community`, `/contact`, `/purpose/*`, `/notepad` (landing), and detail routes — which is wrong.
- The dock is mounted unconditionally on viewport-width grounds; `MobileBottomDock` internally returns `null` above 768px via `useIsMobile()`, so desktop is unaffected.

The Header itself (on the desktop path) continues to render under this predicate. The Header dispatcher's mobile branch — `HeaderMobile` — is now a no-op (`return null`), so under 768px the Header occupies zero DOM and the dock is the only chrome.

The dock's physical placement in the JSX tree is at the same level as the existing `<Header>` mount (App.tsx:130 area), not next to `<Footer />`. Visual layering is handled by `position: fixed` + `z-40`, so JSX order doesn't matter for paint — but co-locating with the Header keeps the chrome-related conditionals grouped.

## Tests

### `src/components/layout/MobileBottomDock.test.tsx`

- **Mobile, default scroll state**: `data-visible="true"`, logo `<a href="/">`, MENU button with `aria-label="Open menu"`.
- **Click MENU**: Sheet opens, contains every label from `navItems`.
- **Click a nav item with a trigger label**: `onNavTrigger` is called.
- **Scroll down past threshold**: `data-visible="false"`.
- **Scroll back up**: `data-visible="true"`.
- **`scrollY < 80`**: forced `data-visible="true"` even after a prior down-scroll.
- **Desktop (≥ 768px) via `useIsMobile`**: renders `null`.
- **Permanent filter**: logo `<img>` has inline `filter: invert(1)` (no nav-theme dependency).
- **`prefers-reduced-motion`**: outer aside still has `motion-reduce:transition-none` class (asserts the class is present; the actual CSS reduce behavior is browser-tested).

### `src/components/sections/HeroMobile.test.tsx`

Update / add:
- Outer wrapper has `pt-20 pb-16 px-5 gap-10` (replace previous assertion if present).
- Quote attribution contains a `[aria-hidden="true"]` decorative span sibling (the red square).
- All existing centered-wordmark, masked-video, intersection-fade, GSAP-collapse, reduced-motion video-poster, and quote-precedes-video tests **continue to pass unchanged**.

### `src/components/layout/HeaderMobile.test.tsx`

Replace existing suite with a single test:
- Rendering `<Header />` under 768px (via `useIsMobile` mocked truthy) results in no `[data-testid="header-mobile"]` in the document.

### `src/hooks/use-scroll-direction.test.ts`

- Initial state is `'idle'`.
- After dispatching a scroll event that pushes `scrollY` past `threshold`, returns `'down'`.
- After dispatching a scroll event that decreases `scrollY` past `threshold`, returns `'up'`.
- When `scrollY < 80`, forces `'idle'`.
- Below `threshold` deltas are ignored.
- Unsubscribes the scroll listener on unmount.

## Accessibility

- Dock outer element is `<aside aria-label="Quick navigation">`.
- Logo link has `aria-label="Home"`, MENU button has `aria-label="Open menu"`.
- Both controls are 44×44px minimum (`h-11` = 44px; logo is `h-11 w-11`, MENU is `h-11 px-6`).
- The Sheet drawer is the existing accessible component used by the old Header — no a11y regression.
- Red square in the quote attribution is `aria-hidden="true"` (decorative).
- Hide-on-scroll behavior continues for `prefers-reduced-motion` users — only the slide animation is suppressed (`motion-reduce:transition-none`). The dock still hides/reveals; it just snaps.

## Reduced motion behavior

| State | Dock animation | Hero |
|---|---|---|
| `prefers-reduced-motion: no-preference` | Slides via CSS transform (300ms) | Unchanged (wordmark intro, scroll-collapse, video autoplay per existing rules) |
| `prefers-reduced-motion: reduce` | Snaps instantly via `motion-reduce:transition-none` | Unchanged (existing reduced-motion rules already in place) |

The dock still appears/disappears under reduced motion — it just doesn't animate. This is correct under WCAG 2.3.3: state changes are allowed; only the motion is removed.

## What does NOT change

- `HeroDesktop.tsx`, `HeaderDesktop.tsx`, and the `Hero.tsx` / `Header.tsx` dispatchers.
- `PsalmsWordmarkSvg`, `HeroMaskClipDef`, the silhouette-masked video, `tropical_jungle.png`.
- Quote text content ("He leads me beside still waters. He restores my soul." / "Psalm 23:2-3").
- Quote `<p>` font (size, family, weight, italic, line-height).
- Bridge copy content (`BRIDGE_COPY` from `hero-bridge-content.ts`).
- Wordmark intro animation (`introActive`, `onIntroComplete`, `onHandoff`).
- GSAP scroll-collapse timeline and its `MOBILE_COLLAPSE_VH = 60` constant.
- Intersection-fade hooks and their thresholds.
- `navItems` content or `NAV_TRIGGER_LABELS` set.
- `WaterRipple`, `MidSectionMotion`, `TwoPathInterlude`, `PurposeGrid`, `HeroLoadingOverlay`.
- `Footer.tsx` and `FinalReflectionCta.tsx` source files — clearance is applied at the App-tree wrapper instead.
- Dark mode / theme system (still does not exist — explicitly out of scope).
- Desktop layout at any viewport ≥ 768px.

## Risk

Low–medium.

- **Low** on the hero spacing changes — they're whitespace adjustments to one component.
- **Medium** on the dock — it's a new component mounted app-wide on mobile. The risk is collision with the Footer/CTA (handled by `--mobile-dock-clearance`) and intercepting scroll/taps in the gutters (handled by `pointer-events-none` on the outer aside).
- **Low** on the `HeaderMobile → null` change — the dispatcher import is preserved, tests are updated, and the desktop path is unaffected.

## Out of scope

- Dark mode / theme toggle.
- Any change to `HeaderDesktop.tsx`, `HeroDesktop.tsx`, or the desktop dispatchers.
- Defining a global `--accent-red` token (the spec uses an inline fallback).
- A new bottom-dock variant per route (the dock is identical on every route where it appears).
- Changing `navItems` content or ordering.
- Changing the Sheet drawer's background, position, or contents.
- Adding new asset files.
- Performance changes beyond the dock's `requestAnimationFrame`-throttled scroll listener.
- Changing the existing intro animation, scroll-collapse, or any other Phase 1 hero motion.
