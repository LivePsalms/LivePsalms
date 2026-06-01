# Next-Devotion Handoff Pill — Mobile Fit

**Date:** 2026-05-31
**Component:** `src/components/sections/NextDevotionHandoff.tsx` (mobile branch)
**Data:** `src/data/devotions.ts`
**Scope:** Mobile-only refit of the pill so the title fits and reads as editorial display type instead of overflowing the pill silhouette.

---

## Problem

At a 390 px viewport the pill's left column is ~118 px wide. The title `"Beside Still Waters"` at the current italic display size cannot fit on one or two lines, so it stacks each word on its own line — and at the editorial size the design is aiming for, those three lines spill past the pill's bottom edge. The right column (`PEACE`, `PSALM 23:2–3`) never overflows because both lines are short.

The visual target (provided as screenshot during brainstorming) shows the title set as a confident two-line italic display with the rest of the pill metadata legible and proportional.

## Direction (chosen during brainstorm)

**C — Balance both.** Slightly taller pill plus slightly smaller display title than the screenshot, so all six devotion titles sit on two lines (Hope on two lines via a font shrink). Three sizing variants were tested in the visual companion; the "C2 Editorial" variant was approved.

## Scope

In scope:
- `src/components/sections/NextDevotionHandoff.tsx` — `Pill` component, mobile branch only.
- `src/data/devotions.ts` — add two optional fields per `Devotion` to carry curated line-break and shrink intent.

Out of scope:
- Desktop branch of the same component.
- Entrance animation (`scaleX` from center).
- Scroll-driven reveal.
- Expand-to-fullscreen navigation (`usePillExpandNavigation`).
- `hero-mask-clip` SVG path.
- Other consumers of `devotions.ts` (`MoodBoard`, `HeroMobile`, `PurposeDetail`) — they read `title` only and ignore the new fields.

## Visual spec (mobile only)

| Token | Today | Proposed |
|---|---|---|
| Pill aspect ratio | `11 / 3.2` | `11 / 4` |
| Pill width | `92%` | `92%` (unchanged) |
| Inner padding | `0 14%` | `0 10%` |
| Grid | `1fr · auto · 1fr` | unchanged |
| Eyebrow (`Next Devotion`, category) | `6 px / 0.25em` | `9 px / 0.22em` |
| Title default | `12 px italic, lh 1` | `17 px italic, lh 1.05` |
| Title shrink (Hope only) | n/a | `14 px italic, lh 1.06` |
| Scripture ref + ↗ | `6 px / 0.2em` | `9 px / 0.2em` |
| Center logo | `w-5` / `translateY(12px)` | `w-[19px]` / `translateY(14px)` |

Notes:
- Title line breaks are explicit `<br>`s injected from data — no `text-wrap: balance`. Editorial line breaks read better when curated than when the browser balances.
- 9 px eyebrow / scripture is the smallest text on the page. No `rem` lock — accessibility font scaling still applies.

## Data model

`src/data/devotions.ts`:

```ts
export interface Devotion {
  id: string;
  label: string;
  title: string;
  scriptureRef: string;
  monogram: string;
  firstMoodboardImage: string;
  mobileTitleBreak?: number;        // word index to insert <br> after (1-indexed)
  mobileTitleScale?: 'shrink';      // forces 14 px on mobile when title is long
}
```

Per-devotion config:

| Devotion | `mobileTitleBreak` | `mobileTitleScale` | Renders as |
|---|---|---|---|
| peace | `2` | — | "Beside Still" / "Waters" |
| hope | `3` | `'shrink'` | "A Future You" / "Cannot See Yet" |
| strength | `2` | — | "Wings Like" / "Eagles" |
| wholeness | `2` | — | "The Years" / "Restored" |
| purpose | `2` | — | "All Things" / "Working" |
| connection | `1` | — | "Brought" / "Near" |

Fallback: if `mobileTitleBreak` is `undefined`, the title renders unbroken and CSS handles word wrap. The `FALLBACK_DEVOTION` constant in `NextDevotionHandoff.tsx` does not need either field — its title is short.

## Renderer change

In `NextDevotionHandoff.tsx`:

1. Add a file-local helper:
   ```ts
   function applyCuratedBreak(title: string, breakAfter?: number): string | [string, string] {
     if (!breakAfter) return title;
     const words = title.split(' ');
     if (breakAfter >= words.length) return title;
     return [
       words.slice(0, breakAfter).join(' '),
       words.slice(breakAfter).join(' '),
     ];
   }
   ```
2. In the `Pill` mobile branch, render the title as either a single string or `<>{a}<br/>{b}</>` depending on the helper's return type.
3. Title `fontSize`: `isMobile ? (nextDevotion.mobileTitleScale === 'shrink' ? 14 : 17) : 28`.
4. Title `lineHeight`: `isMobile ? (nextDevotion.mobileTitleScale === 'shrink' ? 1.06 : 1.05) : 1`.
5. Eyebrow + meta-line `fontSize`: `isMobile ? 9 : 10` (was `6 : 10`).
6. Eyebrow `letterSpacing`: `isMobile ? '0.22em' : '0.25em'` (slight tighten on mobile).
7. Outer pill `aspectRatio`: `isMobile ? '11 / 4' : '11 / 3.2'`.
8. Inner padding: `isMobile ? '0 10%' : '0 10%'` (was `0 14%` on mobile).
9. Logo `className`: `isMobile ? 'w-[19px]' : 'w-10'`; `style.transform`: `isMobile ? 'translateY(14px)' : 'translateY(22px)'`.

Refs, hooks, GSAP timelines, and `usePillExpandNavigation` are untouched.

## Risks & regressions

- **Pill expansion to fullscreen on tap** uses runtime `getBoundingClientRect()` in `usePillExpandNavigation`, which auto-adapts to the new starting size. The expand calculation reads the current pill rect at click time, so a taller aspect ratio just produces a slightly different start-scale value — no code change needed in the hook.
- **Scroll-driven entrance** (`scaleX` 0 → 1, opacity fade) is aspect-ratio-agnostic — the fill div uses `inset: 0`.
- **`hero-mask-clip` SVG path** is `objectBoundingBox`-normalized; the notch profile reshapes proportionally with the new aspect ratio. The clipPath's notch sits at the top, so the logo's `translateY` may need a small tune during QA. If it reads cramped, adjust `translateY` only — never the clipPath.
- **"Brought Near" forced 2-line break** is a stylistic call. If it reads as overstated in QA, the fix is changing `mobileTitleBreak` for `connection` to `undefined`; no code change needed.
- **Existing tests** (`MobileProjectTile.test.tsx`, `HeroMobile.test.tsx`) assert on the raw `title` string — they remain green because `applyCuratedBreak` does not mutate `nextDevotion.title`.

## Test plan

- **Unit** — create `src/components/sections/NextDevotionHandoff.test.tsx` (no existing test file for this component) asserting:
  - With `mobileTitleBreak: 2`, the Pill renders the title as two text nodes split at word index 2.
  - With `mobileTitleScale: 'shrink'`, the title element style has `fontSize: 14`.
  - With both `undefined`, the title renders as one unbroken span (graceful fallback).
- **Visual** — capture mobile screenshots at 360 / 390 / 414 viewports cycling through all six devotions in dev. Compare against the C2 reference renderings recorded in `.superpowers/brainstorm/.../03-all-titles.html`.
- **No new e2e** — existing scroll-driven reveal coverage in `MobileProjectTile.test.tsx` continues to guard the integration.

## Acceptance criteria

1. On a 390 px viewport, all six devotion pills render their title as a two-line italic display, fully inside the pill silhouette, with no descender bleeding past the bottom edge of the clip mask.
2. Eyebrow (`DEVOTION`-style) and scripture reference are legible without zooming on a 360 px viewport.
3. Desktop rendering (≥ md breakpoint) is byte-identical to today's snapshot.
4. All existing tests pass; new unit tests for the curated-break helper pass.
5. Tapping any of the six pills still triggers the fullscreen expand-and-navigate flow with no perceived jank.
