# Mobile Bridge Pinned Handoff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the mobile hero bridge to feature-parity with desktop — a 300svh pinned three-beat kiss-handoff stage with spatial left/right/center positioning, scroll-scrubbed GSAP timeline tuned for mobile gesture pace, and a static-stack reduced-motion fallback.

**Architecture:** Replace the static intersection-observer fade in `HeroMobile.tsx` with the same DOM shape as `HeroDesktop`'s bridge (300svh outer wrapper + 100svh sticky `<section>` containing three absolutely-positioned `<p>` beats). Port the desktop GSAP timeline with two mobile tunings (`scrub * 0.7`, text-2 `x: 30`). Unlock the existing `.bridge-beat-left` / `.bridge-beat-right` CSS offsets at every viewport by removing the `@media (min-width: 768px)` gate and tighten side offsets from `10vw` to `8vw`. Add viewport-relative max-width caps to the three typography classes so the side beats don't overflow on narrow viewports. Spec: `docs/superpowers/specs/2026-05-30-mobile-bridge-pinned-handoff-design.md`.

**Tech Stack:** React 18, TypeScript, GSAP (ScrollTrigger), Tailwind CSS, Vitest + @testing-library/react.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/components/sections/HeroMobile.tsx` | Mobile hero composition | Modify — replace bridge JSX, add 3 refs, add GSAP `useEffect`, drop `bridgeVisible` plumbing |
| `src/index.css` | Global styles incl. `.bridge-beat-*` and typography | Modify — remove `@media (min-width: 768px)` gate, tighten offsets, cap typography widths |
| `src/components/sections/HeroMobile.test.tsx` | Vitest + RTL unit tests | Modify — add structural tests for the new pinned wrapper and reduced-motion path |

No new files. All three changes commit independently and pass `npm test` after each task.

---

## Task 1: Update CSS — unlock spatial offsets at every viewport and cap typography widths

**Files:**
- Modify: `src/index.css:282-335` (bridge typography + stage positioning blocks)

This is a foundational change. After this task, the `.bridge-beat-left` and `.bridge-beat-right` classes apply at every viewport (currently gated to ≥768px), so when Task 3 adds the beat `<p>` elements with these classes they will pick up the correct positioning. Desktop is unaffected because the typography max-width caps resolve to the existing pixel values at every desktop width.

- [ ] **Step 1: Read the current bridge block to confirm the exact text being replaced**

Run: `sed -n '275,340p' src/index.css`

Expected output ends with the closing `}` of the `@media (min-width: 768px) { ... }` block at around line 335.

- [ ] **Step 2: Edit `src/index.css` — three typography classes get a viewport-relative cap**

Find each of these three rules in `src/index.css` (lines ~282-310) and update the `max-width` line:

```css
/* .bridge-line-side */
.bridge-line-side {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(24px, 4vw, 40px);
  font-weight: 300;
  font-style: italic;
  line-height: 1.4;
  color: var(--deep-umber);
  max-width: min(440px, 80vw);   /* was: max-width: 440px; */
}

/* .bridge-line-center */
.bridge-line-center {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(24px, 4vw, 40px);
  font-weight: 300;
  font-style: italic;
  line-height: 1.4;
  color: var(--deep-umber);
  max-width: min(560px, 80vw);   /* was: max-width: 560px; */
}

/* .bridge-thesis */
.bridge-thesis {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(24px, 4vw, 40px);
  font-weight: 300;
  font-style: italic;
  line-height: 1.4;
  color: var(--deep-umber);
  max-width: min(440px, 80vw);   /* was: max-width: 440px; */
}
```

- [ ] **Step 3: Replace the `@media (min-width: 768px)` block with unconditional rules**

Find this block (lines ~324-335):

```css
@media (min-width: 768px) {
  .bridge-beat-left {
    left: 10vw;
    transform: translate(0, -50%);
  }
  .bridge-beat-right {
    left: auto;
    right: 10vw;
    transform: translate(0, -50%);
  }
  /* .bridge-beat-center keeps the default mobile centering on desktop too */
}
```

Replace with:

```css
/* No media query — applies at every viewport. Side offsets tightened from
   10vw to 8vw so at 360px viewports the inset is ~29px instead of ~36px,
   giving the side beats more text width within the typography cap. */
.bridge-beat-left {
  left: 8vw;
  right: auto;
  transform: translate(0, -50%);
  text-align: left;
}
.bridge-beat-right {
  left: auto;
  right: 8vw;
  transform: translate(0, -50%);
  text-align: right;
}
/* .bridge-beat-center keeps the default 50/50 centering established by .bridge-beat */
```

- [ ] **Step 4: Visually verify the file by re-reading the block**

Run: `sed -n '275,340p' src/index.css`

Expected: the three typography classes use `max-width: min(...px, 80vw)`; `.bridge-beat-left` and `.bridge-beat-right` are at top level (not inside an `@media` block) with `left: 8vw` / `right: 8vw`, `text-align: left` / `right`, and `transform: translate(0, -50%)`.

- [ ] **Step 5: Run the existing test suite to confirm nothing regresses**

Run: `npm test -- src/components/sections/HeroMobile.test.tsx`

Expected: all existing tests pass. CSS changes are not asserted yet, so this is a no-op confirmation.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "$(cat <<'EOF'
style(bridge): unlock spatial offsets at every viewport + cap typography widths

Remove the @media (min-width: 768px) gate around .bridge-beat-left /
-right so the spatial composition applies at mobile too. Tighten side
offsets from 10vw to 8vw and cap the three bridge typography classes at
min(width, 80vw) so the side beats fit narrow viewports without overflow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add failing structural tests for the new bridge

**Files:**
- Modify: `src/components/sections/HeroMobile.test.tsx` (append to the `describe('HeroMobile content', ...)` block at line 61)

Three new tests assert the structure that Task 3 will introduce. Running them now must fail — they describe behavior that doesn't exist yet.

- [ ] **Step 1: Append three new tests inside `describe('HeroMobile content', () => { ... })` — just before its closing `});` at line 312**

Insert this block before the closing `});` of the `HeroMobile content` describe (currently at line 312):

```tsx
  it('bridge wrapper has height 300svh when motion is enabled', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { Hero } = await import('./Hero');
    const { getByTestId } = render(<Hero introActive={false} />);
    const bridge = getByTestId('hero-mobile-bridge');
    expect(bridge.style.height).toBe('300svh');
  });

  it('bridge contains three <p> beats with spatial position classes when motion is enabled', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true });
    vi.resetModules();
    const { BRIDGE_COPY } = await import('./hero-bridge-content');
    const { Hero } = await import('./Hero');
    const { getByTestId } = render(<Hero introActive={false} />);
    const bridge = getByTestId('hero-mobile-bridge');
    const beats = bridge.querySelectorAll<HTMLParagraphElement>('p');
    expect(beats).toHaveLength(3);
    expect(beats[0].className).toContain('bridge-beat-left');
    expect(beats[0].className).toContain('bridge-line-side');
    expect(beats[0].textContent).toBe(BRIDGE_COPY.invitation);
    expect(beats[1].className).toContain('bridge-beat-right');
    expect(beats[1].className).toContain('bridge-thesis');
    expect(beats[1].textContent).toBe(BRIDGE_COPY.thesis);
    expect(beats[2].className).toContain('bridge-beat-center');
    expect(beats[2].className).toContain('bridge-line-center');
    expect(beats[2].textContent).toBe(BRIDGE_COPY.assurance);
  });

  it('bridge renders a static stack (no 300svh wrapper) when prefers-reduced-motion is set', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    setMatchMedia({ mobile: true, reducedMotion: true });
    vi.resetModules();
    const { BRIDGE_COPY } = await import('./hero-bridge-content');
    const { Hero } = await import('./Hero');
    const { getByTestId } = render(<Hero introActive={false} />);
    const bridge = getByTestId('hero-mobile-bridge');
    // No 300svh outer wrapper; bridge IS the static <section>.
    expect(bridge.style.height).not.toBe('300svh');
    expect(bridge.tagName).toBe('SECTION');
    // All three beats still in the DOM and not positioned via .bridge-beat
    // (which would absolute-stack them at center 50/50).
    const beats = bridge.querySelectorAll<HTMLParagraphElement>('p');
    expect(beats).toHaveLength(3);
    expect(beats[0].textContent).toBe(BRIDGE_COPY.invitation);
    expect(beats[1].textContent).toBe(BRIDGE_COPY.thesis);
    expect(beats[2].textContent).toBe(BRIDGE_COPY.assurance);
    for (const beat of beats) {
      expect(beat.className).not.toContain('bridge-beat-left');
      expect(beat.className).not.toContain('bridge-beat-right');
      expect(beat.className).not.toContain('bridge-beat-center');
    }
  });
```

- [ ] **Step 2: Run only the new tests to verify they fail in the expected way**

Run: `npm test -- src/components/sections/HeroMobile.test.tsx -t "bridge wrapper has height 300svh"`

Expected: FAIL. Currently the bridge is rendered as a `<div data-testid="hero-mobile-bridge" ...>` with no inline `height: 300svh` style — so `bridge.style.height` is the empty string.

Run: `npm test -- src/components/sections/HeroMobile.test.tsx -t "bridge contains three <p> beats with spatial position classes"`

Expected: FAIL. The current beat `<p>` elements have classes like `bridge-line-center` and `bridge-thesis` but NOT `bridge-beat-left` / `bridge-beat-right` / `bridge-beat-center`.

Run: `npm test -- src/components/sections/HeroMobile.test.tsx -t "bridge renders a static stack"`

Expected: FAIL. The current bridge wrapper is a `<div>`, not a `<section>`, regardless of reduced-motion state.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/components/sections/HeroMobile.test.tsx
git commit -m "$(cat <<'EOF'
test(hero-mobile): failing tests for pinned bridge + reduced-motion fallback

Three new tests describe the structure being built in the next task —
300svh wrapper with three spatial beats when motion is enabled, and a
static <section> stack when prefers-reduced-motion is set.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Replace the bridge JSX in `HeroMobile.tsx` — add refs and reduced-motion branch

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx:32-37` (refs block)
- Modify: `src/components/sections/HeroMobile.tsx:149-179` (bridge JSX)

This task replaces the static fade-in bridge with the desktop-shape sticky stage. GSAP wiring comes in Task 4 — for now the beats are statically positioned by the CSS we updated in Task 1, and the structural tests from Task 2 pass.

- [ ] **Step 1: Add three new refs to the refs block at the top of the component**

Find the refs block at `HeroMobile.tsx:29-32`:

```tsx
  const svgRef = useRef<SVGSVGElement>(null);

  const quoteRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);
```

Replace with:

```tsx
  const svgRef = useRef<SVGSVGElement>(null);

  const quoteRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);
  const bridgeInviteRef = useRef<HTMLParagraphElement>(null);
  const bridgeThesisRef = useRef<HTMLParagraphElement>(null);
  const bridgeAssureRef = useRef<HTMLParagraphElement>(null);
```

- [ ] **Step 2: Remove the intersection-observer for the bridge (keep the one for the quote)**

Find at `HeroMobile.tsx:36-37`:

```tsx
  const quoteVisible = useIntersectionStage(quoteRef, { threshold: 0.4 });
  const bridgeVisible = useIntersectionStage(bridgeRef, { threshold: 0.3 });
```

Replace with:

```tsx
  const quoteVisible = useIntersectionStage(quoteRef, { threshold: 0.4 });
```

- [ ] **Step 3: Replace the bridge JSX block (currently `HeroMobile.tsx:149-179`)**

Find this block:

```tsx
        <div
          ref={bridgeRef}
          data-testid="hero-mobile-bridge"
          data-visible={bridgeVisible ? 'true' : 'false'}
          className="mt-20 mb-32 text-center px-6 flex flex-col gap-8 max-w-md"
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
```

Replace with:

```tsx
        {prefersReducedMotion ? (
          <section
            ref={bridgeRef}
            data-testid="hero-mobile-bridge"
            aria-label="Site introduction"
            className="relative flex flex-col items-center justify-center px-6 py-24 text-center"
            style={{ minHeight: '100svh', backgroundColor: 'var(--paper-cream)' }}
          >
            <div className="flex flex-col items-center">
              <p ref={bridgeInviteRef} className="bridge-line-center">
                {BRIDGE_COPY.invitation}
              </p>
              <p ref={bridgeThesisRef} className="bridge-thesis mt-8">
                {BRIDGE_COPY.thesis}
              </p>
              <p ref={bridgeAssureRef} className="bridge-line-center mt-8">
                {BRIDGE_COPY.assurance}
              </p>
            </div>
          </section>
        ) : (
          <div
            ref={bridgeRef}
            data-testid="hero-mobile-bridge"
            className="relative"
            style={{ height: '300svh' }}
          >
            <section
              aria-label="Site introduction"
              className="overflow-hidden"
              style={{
                position: 'sticky',
                top: 0,
                height: '100svh',
                backgroundColor: 'var(--paper-cream)',
              }}
            >
              <p
                ref={bridgeInviteRef}
                className="bridge-beat bridge-beat-left bridge-line-side"
              >
                {BRIDGE_COPY.invitation}
              </p>
              <p
                ref={bridgeThesisRef}
                className="bridge-beat bridge-beat-right bridge-thesis"
              >
                {BRIDGE_COPY.thesis}
              </p>
              <p
                ref={bridgeAssureRef}
                className="bridge-beat bridge-beat-center bridge-line-center"
              >
                {BRIDGE_COPY.assurance}
              </p>
            </section>
          </div>
        )}
```

Note: `bridgeRef` is typed `RefObject<HTMLDivElement>` but is attached to a `<section>` in the reduced-motion branch. This mirrors `HeroDesktop.tsx:701` which does the same — React's JSX ref typing accepts the assignment because `HTMLDivElement` is structurally assignable to `HTMLElement`. The GSAP useEffect in Task 4 only runs the timeline when motion is enabled (where the ref points to the `<div>`), so the typed shape stays accurate at the only place it matters.

- [ ] **Step 4: Verify the `cn` import is still needed**

Run: `grep -c "cn(" src/components/sections/HeroMobile.tsx`

If the output is `0`, remove the unused import. Find at `HeroMobile.tsx:7`:

```tsx
import { cn } from '@/lib/utils';
```

The `cn` helper is still used by the quote container's className composition at `HeroMobile.tsx:112-115`, so this import stays. Confirm `grep -c "cn(" src/components/sections/HeroMobile.tsx` returns `>= 1` and leave the import as-is.

- [ ] **Step 5: Run the full HeroMobile test file**

Run: `npm test -- src/components/sections/HeroMobile.test.tsx`

Expected: all tests pass — including the three new ones from Task 2, and including the existing `renders all three BRIDGE_COPY lines` test (line 135) and `mounts and unmounts cleanly when prefers-reduced-motion is set` test (line 96).

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/HeroMobile.tsx
git commit -m "$(cat <<'EOF'
feat(hero-mobile): pinned three-beat bridge stage with spatial layout

Replace the static intersection-observer fade with the same DOM shape as
HeroDesktop's bridge — 300svh outer wrapper, 100svh sticky <section>,
three absolutely-positioned beats (left / right / center). Reduced-motion
falls back to a static vertical stack. Refs are wired for the GSAP
timeline in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire the GSAP scroll-scrubbed timeline

**Files:**
- Modify: `src/components/sections/HeroMobile.tsx` (add a new `useEffect` after the existing collapse `useEffect` at line 95)

Port the desktop bridge timeline from `HeroDesktop.tsx:115-203`, with two mobile-tuned parameters: `scrub: 2 * MOBILE_TIME_SCALE` (= 1.4) and `x: 30` for text-2 (down from desktop's 120, proportional to viewport width). All other timeline values match desktop byte-for-byte.

- [ ] **Step 1: Import `BRIDGE_PIN_TIMING` and confirm `MOBILE_TIME_SCALE` is already imported**

Find at `HeroMobile.tsx:5-6`:

```tsx
import { BRIDGE_COPY } from './hero-bridge-content';
import { MOBILE_TIME_SCALE } from '@/lib/motion-scale';
```

Replace with:

```tsx
import { BRIDGE_COPY, BRIDGE_PIN_TIMING } from './hero-bridge-content';
import { MOBILE_TIME_SCALE } from '@/lib/motion-scale';
```

- [ ] **Step 2: Add the GSAP bridge timeline `useEffect` after the existing wordmark-collapse effect**

Insert this `useEffect` directly after the closing `}, [prefersReducedMotion]);` of the existing wordmark-collapse effect (currently ending at `HeroMobile.tsx:95`):

```tsx
  /* ── Bridge cascade: pinned three-beat sequence. Mobile port of the
        desktop scrub-timeline. Text 1 rises from below; text 2 slides in
        from off-screen-right (x:30 — proportional to mobile viewport,
        equivalent to desktop's x:120 at 1440px); text 3 rises with more
        travel; kiss-handoff timing via BRIDGE_PIN_TIMING.
        scrub = 2 * MOBILE_TIME_SCALE for snappier mobile pace,
        matching the wordmark-collapse scrub above. ── */
  useEffect(() => {
    const scrollEl = bridgeRef.current;
    const t1 = bridgeInviteRef.current;
    const t2 = bridgeThesisRef.current;
    const t3 = bridgeAssureRef.current;
    if (!scrollEl || !t1 || !t2 || !t3) return;

    if (prefersReducedMotion) {
      // Reduced motion: clear any transform/blur state. The reduced-motion
      // JSX path renders the beats in normal flow (no pin), so visibility
      // is handled by the layout — we just neutralise any leftover GSAP
      // state from a previous mount.
      gsap.set([t1, t2, t3], { opacity: 1, y: 0, x: 0, filter: 'blur(0px)' });
      return;
    }

    const ctx = gsap.context(() => {
      // Per-beat initial states. Identical to desktop except text 2's
      // horizontal travel is x:30 (≈ 8% of a 360px viewport, matching the
      // 120/1440 desktop proportion).
      gsap.set(t1, { opacity: 0, y: 40, filter: 'blur(10px)' });
      gsap.set(t2, { opacity: 0, x: 30, filter: 'blur(10px)' });
      gsap.set(t3, { opacity: 0, y: 80, filter: 'blur(10px)' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top 80%',
          end: 'bottom bottom',
          scrub: 2 * MOBILE_TIME_SCALE,
          invalidateOnRefresh: true,
        },
      });

      // Text 1 — enter (rise + blur clear + fade up), hold, exit (opacity).
      tl.to(
        t1,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out',
          duration: BRIDGE_PIN_TIMING.text1.holdStart - BRIDGE_PIN_TIMING.text1.enter },
        BRIDGE_PIN_TIMING.text1.enter,
      );
      tl.to(
        t1,
        { opacity: 0, ease: 'power1.in',
          duration: BRIDGE_PIN_TIMING.text1.exit - BRIDGE_PIN_TIMING.text1.holdEnd },
        BRIDGE_PIN_TIMING.text1.holdEnd,
      );

      // Text 2 — horizontal slide from offscreen-right into resting position.
      tl.to(
        t2,
        { opacity: 1, x: 0, filter: 'blur(0px)', ease: 'power2.out',
          duration: BRIDGE_PIN_TIMING.text2.holdStart - BRIDGE_PIN_TIMING.text2.enter },
        BRIDGE_PIN_TIMING.text2.enter,
      );
      tl.to(
        t2,
        { opacity: 0, ease: 'power1.in',
          duration: BRIDGE_PIN_TIMING.text2.exit - BRIDGE_PIN_TIMING.text2.holdEnd },
        BRIDGE_PIN_TIMING.text2.holdEnd,
      );

      // Text 3 — long hold; exits in the last 5%.
      tl.to(
        t3,
        { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out',
          duration: BRIDGE_PIN_TIMING.text3.holdStart - BRIDGE_PIN_TIMING.text3.enter },
        BRIDGE_PIN_TIMING.text3.enter,
      );
      tl.to(
        t3,
        { opacity: 0, ease: 'power1.in',
          duration: BRIDGE_PIN_TIMING.text3.exit - BRIDGE_PIN_TIMING.text3.holdEnd },
        BRIDGE_PIN_TIMING.text3.holdEnd,
      );
    }, scrollEl);

    return () => ctx.revert();
  }, [prefersReducedMotion]);
```

- [ ] **Step 3: Run the full HeroMobile test suite**

Run: `npm test -- src/components/sections/HeroMobile.test.tsx`

Expected: all tests pass. GSAP runs in jsdom without real layout, but the timeline setup doesn't throw — the existing `mounts and unmounts cleanly when prefers-reduced-motion is set` test (line 96) and the new tests from Task 2 all continue to pass.

- [ ] **Step 4: Run the broader test suite to catch any cross-file regression**

Run: `npm test`

Expected: all tests pass. The CSS change in Task 1 only affects bridge classes, and the JSX change is scoped to `HeroMobile.tsx`, so no other test file should be affected.

- [ ] **Step 5: Verify the typecheck passes**

Run: `npx tsc -b --noEmit`

Expected: no errors. The new `useEffect` uses already-imported symbols (`gsap`, `BRIDGE_PIN_TIMING`, `MOBILE_TIME_SCALE`) and three refs declared in Task 3.

- [ ] **Step 6: Manual visual verification on the dev server**

Run: `npm run dev`

Open the dev URL in a browser, resize to a mobile width (e.g. 375×667 via DevTools device emulation), and scroll through the hero:

1. Wordmark collapses on scroll (existing behavior, unchanged).
2. Quote and video mask appear (existing behavior, unchanged).
3. Bridge enters — text 1 rises from below on the left as the bridge top hits ~80% of viewport.
4. Continue scrolling — text 1 fades out, text 2 slides in from the right edge.
5. Continue scrolling — text 2 fades out, text 3 rises into center.
6. At the end of the 300svh pin, text 3 fades out and the next section (MidSectionMotion) takes over.

If any beat appears clipped at the viewport edge, the typography cap from Task 1 needs revisiting (revisit `max-width: min(440px, 80vw)` → try `75vw`). If kiss-handoff feels visibly broken (two beats visible simultaneously, or a black/blank gap), revisit the `BRIDGE_PIN_TIMING` import or the timeline build order. Stop the dev server with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/HeroMobile.tsx
git commit -m "$(cat <<'EOF'
feat(hero-mobile): GSAP kiss-handoff timeline for the pinned bridge

Port the desktop bridge timeline with two mobile-tuned parameters:
scrub = 2 * MOBILE_TIME_SCALE (1.4) for snappier pace consistent with
the wordmark-collapse scrub, and text-2 enter x:30 (proportional to
mobile viewport, equivalent to desktop's 120 at 1440px). Reduced-motion
neutralises GSAP state and renders via the static stack JSX from the
prior commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage check (against `docs/superpowers/specs/2026-05-30-mobile-bridge-pinned-handoff-design.md`):**

| Spec section | Covered by |
|---|---|
| Architecture — 300svh outer + 100svh sticky inner + 3 absolute beats | Task 3 Step 3 |
| Reduced-motion fallback — static vertical stack | Task 3 Step 3 (the ternary branch) |
| CSS — remove media gate, tighten offsets to 8vw, add `min(width, 80vw)` caps | Task 1 Steps 2-3 |
| GSAP — port desktop timeline with `scrub * MOBILE_TIME_SCALE` and `x: 30` | Task 4 Step 2 |
| Refs — `bridgeInviteRef`, `bridgeThesisRef`, `bridgeAssureRef` added | Task 3 Step 1 |
| Removed `bridgeVisible` + intersection-observer | Task 3 Step 2 |
| Tests — 300svh assertion, three-beat class assertion, reduced-motion stack assertion | Task 2 Step 1 |
| `data-visible` removal | N/A — there was no `data-visible` test on the bridge to remove (only on `hero-mobile-quote`, which is unchanged). |
| Section ordering inside `HeroMobile` unchanged | Preserved — Tasks 3/4 do not touch the wordmark, quote, or video-mask JSX. |

**Placeholder scan:** No TBDs / TODOs / "handle edge cases" / "similar to Task N" placeholders. All code blocks contain complete content. All grep commands have explicit expected outputs.

**Type consistency:** `BRIDGE_PIN_TIMING` is imported in Task 4 Step 1 and used in Task 4 Step 2 with the exact fields defined in `src/components/sections/hero-bridge-content.ts` (`text1.enter`, `text1.holdStart`, `text1.holdEnd`, `text1.exit`, and the same for `text2`/`text3`). The three new refs (`bridgeInviteRef`, `bridgeThesisRef`, `bridgeAssureRef`) are declared as `useRef<HTMLParagraphElement>(null)` in Task 3 Step 1 and accessed in Task 4 Step 2 as `bridgeInviteRef.current` (returning `HTMLParagraphElement | null`), which GSAP accepts.
