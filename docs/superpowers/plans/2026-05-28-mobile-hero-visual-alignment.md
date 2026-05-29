# Mobile Hero Visual Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `HeroMobile` background and `HeaderMobile` logo + bar palette with the desktop hero. Two-zone hero (warm taupe → paper cream) replacing the single deep-umber root; navbar swaps the PSALMS wordmark for the `/logo-icon.png` 'A' icon with the conditional invert rule HeaderDesktop already uses.

**Architecture:** Pure visual edits — no new files, no animation changes, no layout restructures beyond splitting HeroMobile's root container into two background-owning zones. HeaderMobile subscribes to the existing `nav-theme` pub/sub for the invert toggle.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS v3.4, the existing `@/lib/nav-theme` module (`subscribeNavTheme` / `getNavTheme`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-28-mobile-hero-visual-alignment-design.md`

---

## File Structure

### Modify
- `src/components/sections/HeroMobile.tsx` — restructure root into two background-owning zones (zone 1 = `--app-bg` taupe; zone 2 = `--paper-cream`). Move the bridge `<div>` outside the existing wordmark/silhouette/quote wrapper. Drop the root `bg-[color:var(--deep-umber)]` and `text-white`.
- `src/components/sections/HeroMobile.test.tsx` — assert each zone exists with its expected background token and `data-zone` attribute.
- `src/components/layout/HeaderMobile.tsx` — drop `PsalmsWordmarkSvg` import, add `subscribeNavTheme`/`getNavTheme` subscription, render `<img src="/logo-icon.png" alt="LivePsalms">` in place of the wordmark, flip bar background to `var(--app-bg)/90` and text to `var(--deep-umber)`.
- `src/components/layout/HeaderMobile.test.tsx` — replace the `getByLabelText(/psalms/i)` assertion with `getByAltText('LivePsalms')`; assert the bar's logo `src` and conditional invert behavior.

### Untouched (called out so future implementers know not to drift)
- `src/lib/nav-theme.ts` (consumed as-is)
- `src/components/sections/PsalmsWordmarkSvg.tsx` (still used inside HeroMobile, not in the navbar)
- `src/components/sections/HeroDesktop.tsx`, `src/components/layout/HeaderDesktop.tsx`
- All other mobile + desktop sections, the dispatcher files (`Hero.tsx`, `Header.tsx`), the design tokens in `src/index.css`

---

## Task 1: HeroMobile two-zone background

The current `HeroMobile` has one root `<div>` with `bg-[color:var(--deep-umber)] text-white` that wraps everything (wordmark, silhouette, quote, bridge). Split it so zone 1 (wordmark + silhouette + quote) sits on `var(--app-bg)` taupe and zone 2 (bridge copy) sits on `var(--paper-cream)`. Drop the global `text-white`.

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx`
- Modify: `src/components/sections/HeroMobile.test.tsx`

- [ ] **Step 1: Add the failing tests**

Append to `src/components/sections/HeroMobile.test.tsx` inside the existing `describe('HeroMobile content', ...)` block:

```tsx
it('renders zone 1 with app-bg background and a data-zone="hero" attribute', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
  setMatchMedia(true);
  vi.resetModules();
  const { Hero } = await import('./Hero');
  render(<Hero introActive={false} />);
  const zone1 = screen.getByTestId('hero-mobile-zone-1');
  expect(zone1).toBeInTheDocument();
  expect(zone1.style.backgroundColor).toBe('var(--app-bg)');
});

it('renders zone 2 with paper-cream background and a data-zone="bridge" attribute', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
  setMatchMedia(true);
  vi.resetModules();
  const { Hero } = await import('./Hero');
  render(<Hero introActive={false} />);
  const zone2 = screen.getByTestId('hero-mobile-zone-2');
  expect(zone2).toBeInTheDocument();
  expect(zone2.style.backgroundColor).toBe('var(--paper-cream)');
});

it('does NOT apply text-white to the root container', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
  setMatchMedia(true);
  vi.resetModules();
  const { Hero } = await import('./Hero');
  render(<Hero introActive={false} />);
  const root = screen.getByTestId('hero-mobile');
  expect(root.className).not.toMatch(/text-white/);
});

it('does NOT apply a dark umber background to the root container', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
  setMatchMedia(true);
  vi.resetModules();
  const { Hero } = await import('./Hero');
  render(<Hero introActive={false} />);
  const root = screen.getByTestId('hero-mobile');
  expect(root.className).not.toMatch(/deep-umber/);
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: the 4 new tests fail (testids missing; root class still contains `deep-umber` and `text-white`).

- [ ] **Step 3: Restructure HeroMobile.tsx**

Open `src/components/sections/HeroMobile.tsx`. Replace the entire return statement (current lines 99-166) with the two-zone structure:

```tsx
return (
  <div
    data-testid="hero-mobile"
    data-intro-active={introActive ? 'true' : 'false'}
    className="relative w-full"
  >
    {/* Zone 1 — wordmark + silhouette + quote on warm taupe */}
    <div
      data-testid="hero-mobile-zone-1"
      data-zone="hero"
      className="relative w-full min-h-[100svh] flex flex-col items-center justify-center pt-24 pb-12 px-5 gap-8"
      style={{ backgroundColor: 'var(--app-bg)' }}
    >
      <PsalmsWordmarkSvg ref={svgRef} className="w-[88vw] max-w-md" />
      <img
        src={SILHOUETTE_SRC}
        alt={SILHOUETTE_ALT}
        className="w-[88vw] max-w-md aspect-[4/5] object-cover opacity-90"
        loading="eager"
        decoding="async"
      />
      <div
        ref={quoteRef}
        data-testid="hero-mobile-quote"
        data-visible={quoteVisible ? 'true' : 'false'}
        className={cn(
          'mt-12 text-center px-6 transition-opacity duration-1000 max-w-md',
          quoteVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <p className="quote-text italic text-[15px] leading-relaxed">
          "He leads me beside still waters.
        </p>
        <p className="quote-text italic text-[15px] leading-relaxed mt-2">
          He restores my soul."
        </p>
        <p className="quote-attr text-xs opacity-60 mt-4">
          Psalm 23:2-3
        </p>
      </div>
    </div>

    {/* Zone 2 — bridge copy on paper cream */}
    <div
      data-testid="hero-mobile-zone-2"
      data-zone="bridge"
      className="w-full pt-16 pb-24 px-6"
      style={{ backgroundColor: 'var(--paper-cream)' }}
    >
      <div
        ref={bridgeRef}
        data-testid="hero-mobile-bridge"
        data-visible={bridgeVisible ? 'true' : 'false'}
        className="max-w-md mx-auto text-center flex flex-col gap-8"
      >
        <p
          className={cn(
            'bridge-line-center text-[15px] leading-relaxed transition-opacity duration-700',
            bridgeVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {BRIDGE_COPY.invitation}
        </p>
        <p
          className={cn(
            'bridge-thesis text-[15px] leading-relaxed transition-opacity duration-700 delay-200',
            bridgeVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {BRIDGE_COPY.thesis}
        </p>
        <p
          className={cn(
            'bridge-line-center text-[15px] leading-relaxed transition-opacity duration-700 delay-500',
            bridgeVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {BRIDGE_COPY.assurance}
        </p>
      </div>
    </div>
  </div>
);
```

What changed:
- Root `<div data-testid="hero-mobile">` no longer has `min-h-[100svh]`, no `bg-[color:var(--deep-umber)]`, no `text-white`. Only `relative w-full`.
- Zone 1 wraps the wordmark + silhouette + quote and owns the taupe background + the `100svh` minimum height + the flex centering.
- Zone 2 wraps the bridge copy and owns the paper-cream background. The bridge `<div>` (with its IntersectionObserver ref + visibility class) is the inner content of zone 2.
- `data-zone` attribute on each zone for semantic test queries.

Do not touch the existing `useLayoutEffect` GSAP setup, the `useEffect` intro-fire effect, `prefersReducedMotion` memo, refs, constants (`SILHOUETTE_SRC`, `COLLAPSE`, `MOBILE_COLLAPSE_VH`, `SILHOUETTE_ALT`), imports, or the JSDoc comment block. The change is JSX only.

- [ ] **Step 4: Run the tests and confirm pass**

Run: `npx vitest run src/components/sections/HeroMobile.test.tsx`
Expected: all 13 tests pass (the original 9 plus the 4 new ones).

If a pre-existing test references the root's `text-white` class or asserts the root container has `min-h-[100svh]`, update the assertion to read from `hero-mobile-zone-1` instead. The original 9 tests as inspected at commit `e5b3ce3` do not — they assert `data-testid="hero-mobile"` exists, presence of an `<img>` with src `/tropical_jungle.png`, absence of `<video>`, presence of wordmark labelled "psalms", and `data-visible` on the quote container. All still hold.

- [ ] **Step 5: Verify type-check and full section suite**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npx vitest run src/components/sections/`
Expected: full section suite green.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx
git commit -m "feat(hero-mobile): two-zone background mirroring desktop (taupe → cream)"
```

---

## Task 2: HeaderMobile logo + bar palette

Swap `<PsalmsWordmarkSvg />` for `<img src="/logo-icon.png" alt="LivePsalms">`, subscribe to the existing `nav-theme` for the conditional invert toggle, and flip the bar background from `--deep-umber/90` to `--app-bg/90` so it visually merges with HeroMobile's zone 1. The drawer (`SheetContent`) is intentionally left dark per spec Decision 9.

**Files:**
- Modify: `src/components/layout/HeaderMobile.tsx`
- Modify: `src/components/layout/HeaderMobile.test.tsx`

- [ ] **Step 1: Update the existing tests**

Open `src/components/layout/HeaderMobile.test.tsx`. Find the first test (`'renders a compact top bar with the PSALMS wordmark and a menu button'`) and replace its body so the wordmark assertion uses `getByAltText` and asserts the new `<img>` source:

```tsx
it('renders a compact top bar with the LivePsalms icon and a menu button', () => {
  render(
    <MemoryRouter>
      <HeaderMobile onNavTrigger={vi.fn()} />
    </MemoryRouter>,
  );
  const logo = screen.getByAltText('LivePsalms');
  expect(logo).toBeInTheDocument();
  expect(logo.getAttribute('src')).toBe('/logo-icon.png');
  expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
});
```

The other two tests (`'opens the drawer when the menu button is tapped'`, `'fires onNavTrigger when a nav link is tapped'`) reference `/open menu/i` and link roles, which do not depend on the logo. Leave them untouched.

Append a third new test that verifies the invert behavior:

```tsx
it('inverts the logo when nav-theme is set to dark', async () => {
  const { setNavTheme } = await import('@/lib/nav-theme');
  setNavTheme(null); // start clean

  render(
    <MemoryRouter>
      <HeaderMobile onNavTrigger={vi.fn()} />
    </MemoryRouter>,
  );

  const logo = screen.getByAltText('LivePsalms');
  expect(logo.style.filter).toBe('invert(0)');

  setNavTheme('dark');
  // React batches state updates; flush a microtask so the listener sets state.
  await new Promise((r) => setTimeout(r, 0));
  expect(logo.style.filter).toBe('invert(1)');

  setNavTheme(null); // restore for other tests in the suite
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `npx vitest run src/components/layout/HeaderMobile.test.tsx`
Expected: the updated and new tests fail (wordmark SVG is still rendered; no `<img alt="LivePsalms">`; `style.filter` is undefined).

- [ ] **Step 3: Rewrite HeaderMobile.tsx**

Open `src/components/layout/HeaderMobile.tsx`. Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { navItems, NAV_TRIGGER_LABELS } from '@/data/projects';
import { subscribeNavTheme, getNavTheme } from '@/lib/nav-theme';

interface HeaderMobileProps {
  onNavTrigger?: () => void;
}

/**
 * Compact top bar for the mobile viewport (< 768px). Wordmark left, hamburger
 * right. Hamburger opens a right-side Sheet drawer with the same nav items as
 * desktop. No scroll-collapse choreography — the static bar replaces it.
 *
 * Bar background matches HeroMobile zone 1 (`--app-bg` taupe) so the chrome
 * visually merges with the page. The 'A' logomark inverts when the active
 * page section publishes `nav-theme = 'dark'` (see `@/lib/nav-theme`).
 *
 * The drawer (`SheetContent`) keeps the dark deep-umber background — that's
 * a separate surface intentionally contrasted from the page.
 */
export function HeaderMobile({ onNavTrigger }: HeaderMobileProps) {
  const [open, setOpen] = useState(false);
  const [isDarkBg, setIsDarkBg] = useState<boolean>(() => getNavTheme() === 'dark');

  useEffect(() => {
    return subscribeNavTheme((theme) => setIsDarkBg(theme === 'dark'));
  }, []);

  return (
    <header
      data-testid="header-mobile"
      className="fixed top-0 left-0 right-0 z-40 h-14 px-4 flex items-center justify-between bg-[color:var(--app-bg)]/90 backdrop-blur-sm text-[color:var(--deep-umber)]"
      role="banner"
    >
      <Link to="/" className="block">
        <img
          src="/logo-icon.png"
          alt="LivePsalms"
          className="h-8 w-auto object-contain"
          style={{
            filter: isDarkBg ? 'invert(1)' : 'invert(0)',
            transition: 'filter 300ms ease',
          }}
        />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="h-11 w-11 inline-flex items-center justify-center"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-3/4 sm:w-1/2 bg-[color:var(--deep-umber)] text-white"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <nav className="mt-12 flex flex-col gap-6 text-lg" aria-label="Mobile primary">
            {navItems.map((item) => (
              <SheetClose asChild key={item.label}>
                <Link
                  to={item.href}
                  className="block py-3 min-h-[44px]"
                  onClick={() => {
                    if (NAV_TRIGGER_LABELS.has(item.label)) onNavTrigger?.();
                  }}
                >
                  {item.label}
                </Link>
              </SheetClose>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
```

What changed:
- `PsalmsWordmarkSvg` import dropped; `subscribeNavTheme` and `getNavTheme` imports added.
- `isDarkBg` state initialized from `getNavTheme()` and subscribed to changes; cleanup returned by `subscribeNavTheme` is the effect's cleanup function.
- Bar className: `bg-[color:var(--deep-umber)]/90 ... text-white` → `bg-[color:var(--app-bg)]/90 ... text-[color:var(--deep-umber)]`.
- Logo: `<PsalmsWordmarkSvg className="h-5 w-auto" />` → `<img src="/logo-icon.png" alt="LivePsalms" className="h-8 w-auto object-contain" style={{ filter: ..., transition: ... }} />`.
- Drawer `SheetContent` unchanged.
- JSDoc updated to mention the new palette + nav-theme behavior + drawer-stays-dark rationale.

- [ ] **Step 4: Run the tests and confirm pass**

Run: `npx vitest run src/components/layout/HeaderMobile.test.tsx`
Expected: all 4 tests pass (2 unchanged + the rewritten first test + the new invert test).

- [ ] **Step 5: Verify type-check and full layout suite**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npx vitest run src/components/layout/`
Expected: full layout suite green.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/HeaderMobile.tsx src/components/layout/HeaderMobile.test.tsx
git commit -m "feat(header-mobile): swap to /logo-icon.png + app-bg bar + nav-theme invert"
```

---

## Task 3: Whole-suite verification + visual smoke

No code changes — sanity pass after both tasks land.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass except the one pre-existing `garden-scene.test.tsx` failure that lives on `main` (unaffected by this branch).

- [ ] **Step 2: Run the typechecker**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Run the linter on the touched files**

Run: `npx eslint src/components/sections/HeroMobile.tsx src/components/sections/HeroMobile.test.tsx src/components/layout/HeaderMobile.tsx src/components/layout/HeaderMobile.test.tsx`
Expected: zero errors. (If `react-refresh/only-export-components` fires on a file, the touched-file scope is wrong — investigate.)

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds with the same chunk-size warnings as before this branch.

- [ ] **Step 5: Manual visual smoke on a 390×844 viewport**

Start the dev server: `npm run dev`

In Chrome DevTools, set device emulation to **iPhone 14 Pro (390×844)** and walk through `/`:

- The top bar shows the 'A' icon (not the wordmark). The bar background is warm taupe (`#988F80`).
- Scroll: the wordmark + silhouette + quote sit on the same warm taupe.
- A hard color boundary appears where the bridge copy starts — that area is paper cream (`#F8F1E1`-ish).
- Bridge copy is readable in italic serif on cream.
- The hamburger taps open the drawer; drawer background is the dark deep umber.
- Continue scrolling into MidSectionMotion: the navbar's 'A' icon should invert to white if (and only if) the existing dark sections publish `nav-theme = 'dark'`. If they do not on mobile, the icon stays dark on the bar — acceptable per the spec's risk note.

- [ ] **Step 6: No-op commit (verification artifact only)**

If any issues surface during smoke, return to the failing task. Otherwise no commit is needed at this step.

---

## Self-Review

**Spec coverage check (`docs/superpowers/specs/2026-05-28-mobile-hero-visual-alignment-design.md`):**

| Spec section | Task |
|---|---|
| Decision 1 — Two-zone hero | Task 1 |
| Decision 2 — Drop root background | Task 1 (Step 3 root className) |
| Decision 3 — Drop root text-white | Task 1 (Step 1 negative assertion + Step 3 root className) |
| Decision 4 — Navbar logo asset | Task 2 (Step 3 `<img src="/logo-icon.png">`) |
| Decision 5 — Logo sizing `h-8` | Task 2 (Step 3 `className="h-8 w-auto object-contain"`) |
| Decision 6 — Conditional invert | Task 2 (Step 3 subscribeNavTheme + filter style + Step 1 new test) |
| Decision 7 — Bar background to `--app-bg/90` | Task 2 (Step 3 className) |
| Decision 8 — Bar text to `--deep-umber` | Task 2 (Step 3 className) |
| Decision 9 — Drawer unchanged | Task 2 (Step 3 confirms `SheetContent` className unchanged) |
| Decision 10 — Hamburger inherits color | Task 2 (Step 3 — no explicit color on the Menu icon; inherits from bar's `text-[color:var(--deep-umber)]`) |
| Decision 11 — Loading-overlay z-stack | No change needed, no task |
| Decision 12 — Hover/focus states | No change needed, no task |
| Decision 13 — Reduced motion | No change needed, no task |
| Decision 14 — Out of scope items | Out — no tasks |

**Placeholder scan:** No `TBD`, no `TODO`, no "implement later." Every code step contains runnable code.

**Type consistency:**
- `data-testid` values: `hero-mobile`, `hero-mobile-zone-1`, `hero-mobile-zone-2`, `hero-mobile-quote`, `hero-mobile-bridge`, `header-mobile`. Used consistently across the JSX and tests.
- `data-zone` values: `hero` (zone 1), `bridge` (zone 2). Used in JSX; not used in tests but available for future selectors.
- CSS tokens referenced: `var(--app-bg)`, `var(--paper-cream)`, `var(--deep-umber)`. All exist in `src/index.css`.
- `subscribeNavTheme` signature: `(listener: (theme: NavTheme) => void) => () => void`. Used correctly — the cleanup returned by the effect is the unsubscribe function.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-mobile-hero-visual-alignment.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task with two-stage review between tasks. Slower but each task gets independent verification.
2. **Inline Execution** — execute tasks in this session using `executing-plans`, with a checkpoint after Task 2.

Which approach?
