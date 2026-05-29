# Mobile Hero — Visual Alignment With Desktop

**Status:** Draft (2026-05-28)
**Owner:** Marketing site — mobile home page visual polish
**Scope:** `HeroMobile.tsx` background layering + `HeaderMobile.tsx` logo asset. No structural changes; pure visual alignment with desktop.
**Predecessor spec:** `docs/superpowers/specs/2026-05-28-mobile-home-page-design.md` (mobile home page foundation)

## Purpose

`HeroMobile` and `HeaderMobile` shipped with a dark deep-umber (`#3A3426`) palette that does not exist anywhere in the desktop hero or header. Desktop uses a warm taupe (`var(--app-bg)` = `#988F80`) for the wordmark + silhouette area, transitions to `var(--paper-cream)` for the bridge copy section, and renders an 'A' logomark (`/logo-icon.png`) in the nav rather than the spelled-out wordmark.

This spec brings mobile in line with desktop's palette and navbar identity. No layout changes, no animation changes, no new components — only color tokens, the logo asset, and the conditional invert rule that desktop already uses.

## Design

### Decision log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Hero background layering | **Two zones, exactly mirroring desktop:** zone 1 (wordmark + silhouette + quote) = `var(--app-bg)`; zone 2 (bridge copy) = `var(--paper-cream)`. Hard color boundary between them. | Matches `HeroDesktop.tsx:704` `<section>` boundary where desktop transitions to the paper-cream bridge area. |
| 2 | HeroMobile root background | **Drop the `bg-[color:var(--deep-umber)]` on the root.** Set background per zone instead. | Root container becomes background-less; each zone owns its color. |
| 3 | HeroMobile root text color | **Drop `text-white`.** Each zone inherits the existing text styles (`bridge-line-center`, `quote-text` etc. already render dark on light per desktop). | Wordmark uses `currentColor` via `PsalmsWordmarkSvg`; default container text becomes the page default (deep-umber by inheritance). |
| 4 | Navbar logo asset | **`<img src="/logo-icon.png" alt="LivePsalms" />`** — the 'A' icon used by desktop. | Path and alt match `HeaderDesktop.tsx:310-311` exactly. Replace `<PsalmsWordmarkSvg />` in `HeaderMobile`. |
| 5 | Navbar logo sizing | **`className="h-8 w-auto object-contain"`** (32px high). Desktop uses `h-8 md:h-10`; mobile takes only the `h-8` half. | Mobile bar is `h-14` (56px); a 32px logo sits comfortably with 12px breathing room top/bottom. |
| 6 | Navbar logo conditional invert | **Subscribe to `subscribeNavTheme` from `@/lib/nav-theme`** and apply `filter: invert(1)` when `isDarkBg` is true. Same rule HeaderDesktop applies at line 314. | When the scroll position is over a dark section, the dark icon inverts to white. On mobile this triggers when the user reaches the MidSection (which uses dark `'reduced'` blocks). |
| 7 | Navbar bar background | **`bg-[color:var(--app-bg)]/90 backdrop-blur-sm`** (taupe, ~90% opacity, 4px blur). Replaces the deep-umber/90 currently used. | Bar visually merges with zone 1 — same color the wordmark area sits on. |
| 8 | Navbar bar text color | **`text-[color:var(--deep-umber)]`** (dark on light bar). | Replaces the `text-white` currently set on the bar. |
| 9 | Drawer (`SheetContent`) background | **Keep `bg-[color:var(--deep-umber)] text-white`** — unchanged from current. | Drawer is a separate surface, intentionally contrasted from the page. Confirmed by user. |
| 10 | Hamburger icon color | **Inherits from the bar's text color** (deep-umber on taupe). No additional inversion rule. | Default lucide `<Menu />` uses `currentColor`. |
| 11 | Loading-overlay / drawer scrim interaction | **No change.** The drawer's own backdrop scrim is provided by shadcn's `SheetOverlay`; the loading overlay remains z-100 above everything. | Same z-stack as before this spec. |
| 12 | Hero hover/focus states | **Unchanged.** No interactive elements in HeroMobile that depend on the old color scheme. | Confirmed by reading `HeroMobile.tsx`. |
| 13 | Reduced motion | **Unchanged.** Color choices are independent of motion preferences. | |
| 14 | Out of scope | **Silhouette image styling, wordmark scroll-collapse, IO fade timing, MidSection background, Footer background, FinalReflection background.** | This spec is two changes: hero background zones + navbar logo (with bar color). Nothing else. |

### Component-by-component detail

#### `HeroMobile.tsx`

Replace the single-color root container with a two-zone composition.

Before (current):
```tsx
<div className="relative w-full min-h-[100svh] bg-[color:var(--deep-umber)] text-white">
  <div className="...wordmark + img + quote + bridge all in here...">
```

After:
```tsx
<div className="relative w-full">
  {/* Zone 1 — wordmark + silhouette + quote on warm taupe */}
  <div
    className="relative w-full min-h-[100svh] flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8"
    style={{ backgroundColor: 'var(--app-bg)' }}
  >
    <PsalmsWordmarkSvg ref={svgRef} className="w-[88vw] max-w-md" />
    <img src={SILHOUETTE_SRC} alt={SILHOUETTE_ALT} className="..." />
    {/* quote block */}
    <div ref={quoteRef} ...>...</div>
  </div>
  {/* Zone 2 — bridge copy on paper cream */}
  <div
    ref={bridgeRef}
    style={{ backgroundColor: 'var(--paper-cream)' }}
    className="w-full pt-16 pb-24 px-6"
  >
    <div className="max-w-md mx-auto text-center flex flex-col gap-8">
      {/* three bridge paragraphs */}
    </div>
  </div>
</div>
```

The `quoteRef` block stays inside zone 1 (the visual flow is: wordmark → silhouette → quote → boundary → bridge). The `useIntersectionStage` hooks attached to `quoteRef` and `bridgeRef` are unaffected by the structural restructuring — they observe their respective refs and report visibility.

The existing class `bridge-line-center` (Cormorant Garamond italic, dark deep-umber text) renders correctly on cream. The existing `quote-text` and `quote-attr` classes are designed for light backgrounds and render correctly on taupe.

Remove the root `text-white` — each zone's typography inherits from the existing global CSS classes for those elements.

#### `HeaderMobile.tsx`

Three changes:

1. **Replace logo:**
   ```tsx
   import { subscribeNavTheme, getNavTheme } from '@/lib/nav-theme';
   import { useEffect, useState } from 'react';
   // ...
   const [isDarkBg, setIsDarkBg] = useState<boolean>(() => getNavTheme() === 'dark');
   useEffect(() => subscribeNavTheme((theme) => setIsDarkBg(theme === 'dark')), []);

   // In JSX, replace <PsalmsWordmarkSvg /> with:
   <img
     src="/logo-icon.png"
     alt="LivePsalms"
     className="h-8 w-auto object-contain"
     style={{ filter: isDarkBg ? 'invert(1)' : 'invert(0)', transition: 'filter 300ms ease' }}
   />
   ```

2. **Update bar classes:**
   ```
   bg-[color:var(--deep-umber)]/90 backdrop-blur-sm text-white
   ```
   becomes
   ```
   bg-[color:var(--app-bg)]/90 backdrop-blur-sm text-[color:var(--deep-umber)]
   ```

3. **`SheetContent` className unchanged** — drawer keeps the dark umber background.

Drop the `import { PsalmsWordmarkSvg } from '@/components/sections/PsalmsWordmarkSvg';` — no longer used.

## Architecture

No file additions. Modifications:

- `src/components/sections/HeroMobile.tsx` — restructure container hierarchy; per-zone backgrounds; drop root text-white.
- `src/components/layout/HeaderMobile.tsx` — swap logo asset; subscribe to `nav-theme`; update bar background + text classes.

No new dependencies. `nav-theme` already exists at `@/lib/nav-theme` (used by HeaderDesktop) and is the source of truth for `isDarkBg`. The `subscribeNavTheme` listener is cheap and lives only in HeaderMobile.

## Testing

Two test updates:

- **`HeroMobile.test.tsx`** — keep existing assertions (wordmark present, no `<video>`, silhouette `src`/`alt` correct, IO fade contracts). Add one assertion: the wrapper containing the silhouette has `backgroundColor` matching `var(--app-bg)` (via getComputedStyle is overkill; just assert the inline-style attribute resolves to the token name, or assert a data-zone attribute that test code can read).
- **`HeaderMobile.test.tsx`** — three changes:
  - Replace `getByLabelText(/psalms/i)` with `getByAltText('LivePsalms')`.
  - Update the wordmark-present test to assert the `<img src="/logo-icon.png">` is in the DOM.
  - Add a test that subscribes a fake `nav-theme` callback and asserts the `filter` style changes on dark-bg transitions. (Can be deferred — the contract is "same as HeaderDesktop"; HeaderDesktop's invert behavior is presumed working.)

No new test files.

## Risks

- **Reading legibility on `--app-bg` taupe.** The existing `quote-text` class uses a dark serif. Taupe is mid-tone — needs verification in QA that the quote remains readable. If contrast is borderline, the spec allows raising opacity or using a darker text color. Visual smoke check during implementation.
- **`nav-theme` initial state on mobile.** `getNavTheme()` defaults to `'light'` if never set. The mobile bar will start non-inverted (correct since zone 1 is light taupe). When the user scrolls past the bridge zone into MidSectionMotion's `'reduced'` blocks (which are dark), `nav-theme` may or may not update — depending on whether the existing dark sections call `setNavTheme('dark')`. Implementation will verify this; if the existing setNavTheme calls don't fire on mobile, the invert just stays off and the icon stays dark. Acceptable.
- **Existing `useIntersectionStage` for quoteRef/bridgeRef.** Restructuring the JSX moves the refs into new parent containers. The IO root is `null` (viewport) so the parent change doesn't affect observation. Confirmed.

## Open questions

None. Decisions 1, 2, 9 confirmed by user during brainstorming.
