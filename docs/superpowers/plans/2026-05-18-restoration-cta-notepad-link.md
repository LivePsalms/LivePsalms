# Restoration CTA Notepad Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a notepad reflection CTA ("Take a few moments to pause, reflect, and jot down what God is revealing to you. Open your notepad →") inside the "Continue Restoring Your [Purpose]" zone on every desktop purpose detail page, and extract the 11 duplicated Zone 7 blocks into a single shared `RestorationCTA` component.

**Architecture:** A new private component `RestorationCTA` is defined inline at the top of `src/components/sections/MoodBoard.tsx`. It renders the full Zone 7 wrapper (background color + centered flex column + heading + new reflection prompt + new notepad link + new divider + existing newsletter prompt + existing email form). Each of the 11 detail-component functions (PeaceZones, HopeZones, StrengthZones, WholenessZones, PurposeZones, ConnectionZones, IdentityZones, JoyZones, ForgivenessZones, SurrenderZones, TrustZones) replaces its inline Zone 7 JSX with a single `<RestorationCTA purposeWord="…" overlayColor={ov} />` call. The notepad link is a `react-router-dom` `<Link to="/notepad">` for SPA navigation.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, react-router-dom, Vitest (test runner — not used here; this is a presentational change verified via type-check, build, and manual page walk).

**Verification approach:** Component tests are out of scope (this repo uses Vitest only for pure-logic unit tests; no React Testing Library is installed and adding one for a presentational change is YAGNI). Correctness is verified via `tsc` + `vite build` succeeding and a manual walk of all 11 detail pages.

---

## File Structure

**Modify:**
- `src/components/sections/MoodBoard.tsx` — add `Link` import, define `RestorationCTA` component near the top of the file (after imports, before the existing `MoodBoard` export), and replace each of the 11 inline Zone 7 JSX blocks with a `<RestorationCTA …/>` call.

**No new files.** The component is a private implementation detail of `MoodBoard.tsx` and ships in the same file alongside the other private components (`DefaultZones`, `PeaceZones`, …). This matches the existing file organization.

---

## Task 1: Add `RestorationCTA` component to MoodBoard.tsx

**Files:**
- Modify: `src/components/sections/MoodBoard.tsx` (imports block at top; new component definition added between line 10 and the `MoodBoard` export at line 195)

- [ ] **Step 1: Add the `Link` import from react-router-dom**

Open `src/components/sections/MoodBoard.tsx`. The current imports (lines 1-8) are:

```tsx
// src/components/sections/MoodBoard.tsx
import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useIsMobile } from '@/hooks/use-mobile';
import { categoryLabel, projects } from '@/data/projects';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import type { Project } from '@/types';
```

Add a new import line after the `useRef, useLayoutEffect` line so the imports become:

```tsx
// src/components/sections/MoodBoard.tsx
import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useIsMobile } from '@/hooks/use-mobile';
import { categoryLabel, projects } from '@/data/projects';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import type { Project } from '@/types';
```

The `react-router-dom` package is already a project dependency — `Link` is used elsewhere (e.g. `src/components/sections/FinalReflectionCta.tsx:2`).

- [ ] **Step 2: Define the `RestorationCTA` component**

Insert the following component definition immediately after line 10 (`gsap.registerPlugin(ScrollTrigger);`) and before the `T` image map constant at line 13. Add a blank line of separation on each side.

```tsx
/* ── Shared CTA used by every Zone 7 (Continue Restoring …) ── */
type RestorationCTAProps = {
  purposeWord: string;
  overlayColor: string;
};

function RestorationCTA({ purposeWord, overlayColor }: RestorationCTAProps) {
  return (
    <div
      className="relative flex-shrink-0 h-screen flex items-center justify-center"
      style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${overlayColor} 95%, black 10%)` }}
    >
      <div className="flex flex-col items-center text-center max-w-lg px-8">
        <h3
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[1.15] mb-6"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
        >
          Continue Restoring Your {purposeWord}
        </h3>
        <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-3">
          Take a few moments to pause, reflect, and jot down what God is revealing to you.
        </p>
        <Link
          to="/notepad"
          className="group inline-flex items-center gap-2 text-sm text-white/80 tracking-wide underline underline-offset-4 decoration-white/30 hover:text-white hover:decoration-white/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-sm"
        >
          Open your notepad
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transform-none"
          >
            →
          </span>
        </Link>
        <div className="w-16 h-px bg-white/10 my-8" aria-hidden="true" />
        <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-10">
          Sign up for our newsletter to receive devotions that restores you
        </p>
        <div className="flex w-full max-w-md">
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 bg-white/10 border border-white/20 text-white text-sm tracking-wide px-5 py-4 placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
          />
          <button className="px-6 py-4 bg-white text-mersi-dark text-sm tracking-wide hover:bg-white/90 transition-colors whitespace-nowrap">
            Subscribe
          </button>
        </div>
      </div>
    </div>
  );
}
```

Notes on this code (the engineer should be able to read these intent points off the code itself, but to be safe):

- Outer `<div>` mirrors the existing Zone 7 wrapper exactly — `relative flex-shrink-0 h-screen flex items-center justify-center`, `width: 100vw`, and the `color-mix` background formula `${overlayColor} 95%, black 10%`. This matches lines 955, 1404, 1850, 2296, 2742, 3188, 3634, 4080, 4526, 4971, 5416 verbatim today.
- Heading `<h3>` preserves the existing typography classes and inline `fontSize: clamp(2rem, 4vw, 3.5rem)` exactly. Only the trailing word is now interpolated as `{purposeWord}`.
- Reflection prompt `<p>` uses the same text style as the existing newsletter prompt (`text-sm text-white/50 tracking-wide leading-relaxed`) but with a tighter `mb-3` to bind it visually to the link.
- `<Link>` uses `react-router-dom` for SPA navigation to `/notepad`. The route already exists (`src/App.tsx:138`) and has no auth wall.
- The `<span>` containing `→` is `aria-hidden` because the arrow is decorative; the link text reads "Open your notepad" to screen readers.
- The hover translate uses `group-hover` so the parent `<Link>` controls it via the `group` class. `motion-reduce:transform-none` disables the nudge under `prefers-reduced-motion: reduce`.
- The hairline divider is `w-16 h-px bg-white/10 my-8 aria-hidden="true"`. It separates the notepad invitation from the newsletter invitation.
- Everything below the divider (newsletter prompt, input, Subscribe button) is byte-for-byte identical to the existing Zone 7 below-the-form content.

- [ ] **Step 3: Verify the file still type-checks**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`

Expected: no output (success). The `RestorationCTA` component is defined but not yet referenced anywhere — TypeScript should not complain about an unused function at module scope.

If `noUnusedLocals` is set strictly and TypeScript flags the component as unused, that's expected at this stage and will resolve in Task 2 when the call sites are added. If the error blocks compilation, defer Task 1 commit until Task 2 is also complete and commit them together.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/MoodBoard.tsx
git commit -m "$(cat <<'EOF'
feat(restoration-cta): add shared RestorationCTA component

Defines a private RestorationCTA component at the top of MoodBoard.tsx
that renders the Zone 7 "Continue Restoring Your …" CTA, now including
a notepad reflection prompt and Open-your-notepad link above the
existing newsletter signup. Call sites are migrated in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If Task 1 was deferred for the `noUnusedLocals` reason above, skip this commit and roll it into Task 2's commit.

---

## Task 2: Migrate all 11 Zone 7 call sites to `RestorationCTA`

**Files:**
- Modify: `src/components/sections/MoodBoard.tsx` at 11 locations.

Each location currently contains the same 22-line block (lines vary; find via grep — see Step 1). The block runs from the `{/* ── Zone 7: CTA ── */}` comment line through the closing `</div>` two lines after the email form's `</div>`. Replace each block with a single component call.

**The find-pattern is identical at every site.** Today the block reads:

```tsx
      {/* ── Zone 7: CTA ── */}
      <div className="relative flex-shrink-0 h-screen flex items-center justify-center" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 95%, black 10%)` }}>
        <div className="flex flex-col items-center text-center max-w-lg px-8">
          <h3
            className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[1.15] mb-6"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
          >
            Continue Restoring Your <PURPOSE_WORD>
          </h3>
          <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-10">
            Sign up for our newsletter to receive devotions that restores you
          </p>
          <div className="flex w-full max-w-md">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 bg-white/10 border border-white/20 text-white text-sm tracking-wide px-5 py-4 placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
            />
            <button className="px-6 py-4 bg-white text-mersi-dark text-sm tracking-wide hover:bg-white/90 transition-colors whitespace-nowrap">
              Subscribe
            </button>
          </div>
        </div>
      </div>
```

**The replacement at every site is:**

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="<PURPOSE_WORD>" overlayColor={ov} />
```

The 11 sites and their `purposeWord` values:

| # | Detail component  | Line (approx) | `purposeWord` |
|---|-------------------|---------------|---------------|
| 1 | `PeaceZones`      | ~955          | `"Peace"`     |
| 2 | `HopeZones`       | ~1404         | `"Hope"`      |
| 3 | `StrengthZones`   | ~1850         | `"Strength"`  |
| 4 | `WholenessZones`  | ~2296         | `"Wholeness"` |
| 5 | `PurposeZones`    | ~2742         | `"Purpose"`   |
| 6 | `ConnectionZones` | ~3188         | `"Connection"`|
| 7 | `IdentityZones`   | ~3634         | `"Identity"`  |
| 8 | `JoyZones`        | ~4080         | `"Joy"`       |
| 9 | `ForgivenessZones`| ~4526         | `"Serenity"`  |
|10 | `SurrenderZones`  | ~4971         | `"Serenity"`  |
|11 | `TrustZones`      | ~5416         | `"Serenity"`  |

Sites 9-11 pass `"Serenity"` because the existing heading text reads "Continue Restoring Your Serenity" for those three components (a placeholder used until the team writes purpose-specific copy). Preserving that placeholder is intentional — this PR does not change copy.

- [ ] **Step 1: Locate every Zone 7 block**

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -n "Continue Restoring" src/components/sections/MoodBoard.tsx`

Expected: 11 line numbers printed, in ascending order, one per detail component. If the count is not exactly 11, stop and reconcile with the table above before continuing.

- [ ] **Step 2: Replace site #1 — PeaceZones**

Find the block starting at the `{/* ── Zone 7: CTA ── */}` comment just above line ~955 (heading text "Continue Restoring Your Peace"). The block ends 22 lines later at the closing `</div>` that sits two lines after the email form's `</div>`.

Replace the entire block with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Peace" overlayColor={ov} />
```

- [ ] **Step 3: Replace site #2 — HopeZones**

Find the block near line ~1404 (heading text "Continue Restoring Your Hope"). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Hope" overlayColor={ov} />
```

- [ ] **Step 4: Replace site #3 — StrengthZones**

Find the block near line ~1850 (heading text "Continue Restoring Your Strength"). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Strength" overlayColor={ov} />
```

- [ ] **Step 5: Replace site #4 — WholenessZones**

Find the block near line ~2296 (heading text "Continue Restoring Your Wholeness"). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Wholeness" overlayColor={ov} />
```

- [ ] **Step 6: Replace site #5 — PurposeZones**

Find the block near line ~2742 (heading text "Continue Restoring Your Purpose"). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Purpose" overlayColor={ov} />
```

- [ ] **Step 7: Replace site #6 — ConnectionZones**

Find the block near line ~3188 (heading text "Continue Restoring Your Connection"). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Connection" overlayColor={ov} />
```

- [ ] **Step 8: Replace site #7 — IdentityZones**

Find the block near line ~3634 (heading text "Continue Restoring Your Identity"). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Identity" overlayColor={ov} />
```

- [ ] **Step 9: Replace site #8 — JoyZones**

Find the block near line ~4080 (heading text "Continue Restoring Your Joy"). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Joy" overlayColor={ov} />
```

- [ ] **Step 10: Replace site #9 — ForgivenessZones**

Find the block near line ~4526 (heading text "Continue Restoring Your Serenity", inside `ForgivenessZones`). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Serenity" overlayColor={ov} />
```

- [ ] **Step 11: Replace site #10 — SurrenderZones**

Find the block near line ~4971 (heading text "Continue Restoring Your Serenity", inside `SurrenderZones`). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Serenity" overlayColor={ov} />
```

- [ ] **Step 12: Replace site #11 — TrustZones**

Find the block near line ~5416 (heading text "Continue Restoring Your Serenity", inside `TrustZones`). Replace with:

```tsx
      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Serenity" overlayColor={ov} />
```

- [ ] **Step 13: Confirm no Zone 7 inline blocks remain**

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -c "Continue Restoring Your" src/components/sections/MoodBoard.tsx`

Expected output: `0`

If the count is non-zero, a call site was missed. Re-run the grep from Task 2 Step 1 and locate the remaining occurrences by line number.

- [ ] **Step 14: Confirm exactly 11 call sites exist**

Run: `cd /Users/newmac/Downloads/Psalms_app && grep -c "<RestorationCTA " src/components/sections/MoodBoard.tsx`

Expected output: `11`

If the count is not exactly 11, list every match (`grep -n "<RestorationCTA " src/components/sections/MoodBoard.tsx`) and reconcile against the table above.

- [ ] **Step 15: Type-check**

Run: `cd /Users/newmac/Downloads/Psalms_app && npx tsc --noEmit`

Expected: no output (success).

- [ ] **Step 16: Build**

Run: `cd /Users/newmac/Downloads/Psalms_app && npm run build`

Expected: build completes with no errors. Warnings about chunk size are pre-existing and acceptable.

- [ ] **Step 17: Commit**

```bash
git add src/components/sections/MoodBoard.tsx
git commit -m "$(cat <<'EOF'
feat(restoration-cta): wire notepad link into all 11 detail pages

Replaces the 11 duplicated Zone 7 CTA blocks with a single
<RestorationCTA /> component invocation each. Adds the new notepad
reflection prompt + Open-your-notepad → link + divider above the
existing newsletter signup on every purpose detail page.

Forgiveness, Surrender, and Trust pass purposeWord="Serenity" to
preserve their existing placeholder heading copy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Manual verification on every detail page

**Files:** none — runtime verification only.

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/newmac/Downloads/Psalms_app && npm run dev`

Expected: Vite reports a local URL (usually `http://localhost:5173`). Open it in a browser.

- [ ] **Step 2: For each of the 11 detail pages, walk the CTA zone**

The detail pages are reachable from the home page (the project grid). The mapping from grid card → detail component is defined in `src/data/projects.ts`. For each of the 11 purposes (Peace, Hope, Strength, Wholeness, Purpose, Connection, Identity, Joy, Forgiveness, Surrender, Trust):

1. Navigate to the detail page.
2. Scroll horizontally/vertically (per the page's scroll architecture) until the "Continue Restoring Your …" zone is in view.
3. Confirm the rendered order is:
   - "Continue Restoring Your [Purpose]" heading
   - "Take a few moments to pause, reflect, and jot down what God is revealing to you." prompt
   - "Open your notepad →" link
   - Hairline divider
   - "Sign up for our newsletter…" prompt
   - Email input + Subscribe button
4. Hover the link — confirm the underline brightens and the arrow nudges right.
5. Click the link — confirm SPA navigation to `/notepad` (the URL bar changes, the page transitions without a full reload).
6. Browser-back to the detail page and confirm the section is visually intact.

For Forgiveness, Surrender, and Trust the heading reads "Continue Restoring Your Serenity" — that placeholder is expected and unchanged.

- [ ] **Step 3: Keyboard accessibility check (one page is sufficient)**

On the Peace detail page:

1. Use `Tab` to traverse focusable elements within the CTA zone. The link should receive a visible focus ring (`ring-1 ring-white/40`).
2. Press `Enter` while the link is focused — confirm SPA navigation to `/notepad`.

- [ ] **Step 4: Reduced-motion check (one page is sufficient)**

On macOS: System Settings → Accessibility → Display → "Reduce motion" → enable. On the Peace detail page, hover the "Open your notepad →" link. The arrow should not animate horizontally; the color/underline transition should still apply. Disable "Reduce motion" when done.

- [ ] **Step 5: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`. Only kill that single process — do not kill other dev servers on the machine.

---

## Self-Review (run after the plan is written)

**Spec coverage check (against `docs/superpowers/specs/2026-05-18-restoration-cta-notepad-link-design.md`):**

- Visual structure (heading → prompt → link → divider → newsletter prompt → form) → Task 1 Step 2.
- Reflection prompt copy + classes → Task 1 Step 2.
- Notepad link copy, classes, arrow, hover/focus behavior, reduced-motion → Task 1 Step 2.
- Divider styling → Task 1 Step 2.
- React Router `Link` import → Task 1 Step 1.
- `RestorationCTA` component shape + props → Task 1 Step 2.
- 11 call sites migrated → Task 2 Steps 2-12.
- Forgiveness/Surrender/Trust use `"Serenity"` → Task 2 Steps 10-12.
- Accessibility (aria-hidden on arrow + divider, focus ring) → Task 1 Step 2.
- Manual verification on each page → Task 3 Step 2.
- Keyboard verification → Task 3 Step 3.
- Reduced-motion verification → Task 3 Step 4.

All spec requirements have a matching task.

**Placeholder scan:** No "TBD" / "TODO" / "implement later" / "similar to" references remain. Every code-emitting step contains the actual code.

**Type consistency:** The component is named `RestorationCTA` everywhere (component definition, all 11 call sites, commit messages, verification grep). The prop names `purposeWord` and `overlayColor` match between the component signature and all 11 call sites.
