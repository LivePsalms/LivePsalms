# Next Devotion Handoff — Pill Color + Logo Refinement

**Date:** 2026-05-19
**Status:** Draft — awaiting user review
**Scope:** Refine the `NextDevotionHandoff` pill so its background color matches the dominant color extracted from the next project's thumbnail (the same color shown on the home purpose grid), and replace the 2-letter monogram in the pill's center column with the studio logo asset.

**Parent feature:** [docs/superpowers/specs/2026-05-19-next-devotion-handoff-design.md](2026-05-19-next-devotion-handoff-design.md). This is a small follow-up tightening two visual details that emerged during visual review of the shipped feature.

---

## 1. Problem

Two issues observed once the handoff zone was rendering on a live page:

**1.1 Pill color mismatch with the home grid.**
The pill uses `nextProject.overlayColor` directly from `src/data/projects.ts`, which carries the *hand-picked* palette (e.g. `#7D756A` "driftwood" for Purpose). The home page's purpose grid, however, uses dominant-color values extracted at runtime from each thumbnail via [`src/hooks/useProjectColors.ts`](../../../src/hooks/useProjectColors.ts), which `App.tsx:34` mounts and passes into `<PurposeGrid>` / `<PurposeGallery>`. The result: hovering "Purpose" on the home grid shows one color (the dominant-extracted one), but the handoff pill that points to Purpose shows a different, hand-picked color. The two should agree.

**1.2 Monogram reads as placeholder.**
The center column of the pill currently renders a 2-letter monogram (`PU`, `CN`, `JY`, etc.) — set during the initial spec when I didn't yet know the codebase had a logo asset. Visually, it reads as a placeholder. The codebase has [/public/logo-icon.png](../../../public/logo-icon.png), already used as a watermark on the purpose grid hover overlay ([src/components/sections/PurposeGrid.tsx:130-133](../../../src/components/sections/PurposeGrid.tsx#L130)). Reusing it in the pill ties the handoff to the brand watermark elsewhere.

---

## 2. Goal

Make two surgical edits to `src/components/sections/NextDevotionHandoff.tsx`:

1. Replace the static `nextProject.overlayColor` source with a runtime-extracted dominant color from `nextProject.thumbnail`, falling back to the hand-picked value until extraction resolves.
2. Replace the monogram `<div>` in the pill's center column with an `<img src="/logo-icon.png">` styled to match the grid hover watermark.

Both edits apply uniformly to desktop and mobile.

---

## 3. Design

### 3.1 Dominant color source

The existing utility chain already exists and is proven:

- [`src/utils/dominant-color.ts`](../../../src/utils/dominant-color.ts) — pure RGB-pixel → hex algorithm with a neutral fallback.
- [`src/utils/extractDominantColor.ts`](../../../src/utils/extractDominantColor.ts) — loads an image via `<img>` + canvas, calls the above.
- [`src/hooks/useProjectColors.ts`](../../../src/hooks/useProjectColors.ts) — batches extraction across all 11 thumbnails on App mount.

The cleanest add is **not** to re-plumb `useProjectColors()` results all the way down to MoodBoard (would require a context or prop drilling through `App → PurposeDetail → MoodBoard → NextDevotionHandoff`). Instead, `NextDevotionHandoff` calls `extractDominantColor()` itself on its single `nextProject.thumbnail`. The algorithm is identical to the one the grid uses, so the resulting color matches exactly — same input, same algorithm, same output.

The cost is one extra image fetch + canvas pass per mounted handoff (11 handoffs × 1 image = 11 extractions, but only one handoff is mounted at a time since each is on a per-devotion route). Negligible runtime cost.

### 3.2 New hook: `useNextProjectColor`

Encapsulates the async extraction with a fallback:

```ts
function useNextProjectColor(nextProject: Project): string {
  const [color, setColor] = useState<string>(nextProject.overlayColor);

  useEffect(() => {
    let cancelled = false;
    extractDominantColor(nextProject.thumbnail).then((c) => {
      if (!cancelled) setColor(c);
    });
    return () => { cancelled = true; };
  }, [nextProject.thumbnail, nextProject.overlayColor]);

  return color;
}
```

Returns the fallback synchronously on first render (no flash to white), then re-renders with the extracted color when the promise resolves. Re-extracts if `nextProject` changes (e.g., if the user navigates between devotions while the handoff is still mounted — unlikely but defensive).

### 3.3 Where the color is applied

In `NextDevotionHandoff`, replace every read of `nextProject.overlayColor` with the hook's return value, and pass the resolved color to:

- The outer `<section>`'s `backgroundColor` style (both desktop and mobile layouts)
- The Pill's inline `backgroundColor`
- The click-expand cover (`useClickToExpand` builds the cover with `backgroundColor: nextProject.overlayColor`; this also flips to the resolved color)

`useClickToExpand` currently takes `nextProject: Project` and reads `nextProject.overlayColor` inside the click handler. Refactor: pass the resolved `color` as a third (or replacement) argument to the hook so the cover uses the same value.

Signature change:
```ts
function useClickToExpand(
  pillRef: React.RefObject<HTMLDivElement | null>,
  nextProject: Project,
  reducedMotion: boolean,
  pillColor: string,        // ← new
): { startExpand: () => void } { ... }
```

The handler closes over `pillColor` instead of `nextProject.overlayColor`.

### 3.4 Logo replacement

In the `Pill` component, find the center-column `<div>` that currently renders `{nextDevotion.monogram}`. Replace its contents with:

```tsx
<img
  src="/logo-icon.png"
  alt=""
  aria-hidden="true"
  className="w-8 md:w-10 opacity-25 invert pointer-events-none"
  loading="lazy"
  decoding="async"
/>
```

The center grid column remains `auto` width as defined in the existing `gridTemplateColumns: '1fr auto 1fr'`. The logo sits at ~32px on small screens, ~40px on medium-plus — matching the proportions of a 22px-tall monogram glyph in the same slot.

The `invert` Tailwind filter converts the black-on-transparent logo PNG to white-on-transparent, which then composites against the pill's color for the same subtle watermark effect used on the grid hover.

The `monogram` field on the `Devotion` interface stays in place — no longer rendered, but harmless to keep. A future cleanup pass can drop it.

### 3.5 Mobile logo sizing

The `Pill` component already receives a `variant: 'desktop' | 'mobile'` prop and uses it to scale text sizes (the existing inline `style.fontSize` ternaries). Use the same prop for the logo width — mirrors the established pattern and avoids relying on viewport breakpoints (which wouldn't be correct anyway, since the variant is determined by the parent route's responsive logic, not by raw viewport width).

```tsx
className={`opacity-25 invert pointer-events-none ${variant === 'mobile' ? 'w-5' : 'w-10'}`}
```

That's `w-5` (20px) on mobile, `w-10` (40px) on desktop — proportional to the existing text sizes inside the pill.

---

## 4. Files Affected

### Modified

- `src/components/sections/NextDevotionHandoff.tsx` — add `useNextProjectColor` hook, thread the color through `useClickToExpand`, `DesktopLayout`, `MobileLayout`, and the `Pill`. Replace the monogram div with the logo img.

### Untouched

- `src/data/devotions.ts` — `monogram` field stays unused but present.
- `src/data/projects.ts` — `overlayColor` values remain as the fallback. No changes.
- `src/utils/extractDominantColor.ts`, `src/utils/dominant-color.ts`, `src/hooks/useProjectColors.ts` — reused as-is.
- `src/App.tsx`, `src/components/sections/MoodBoard.tsx`, `src/components/sections/PurposeDetail.tsx` — no changes.

---

## 5. Testing

- **Manual visual check:** on a few devotions (e.g. Strength, Joy, Trust), scroll to the final zone. Confirm pill color matches the color shown when hovering that same devotion on the home grid. They should be identical, not approximate.
- **Click flow:** click the pill, confirm the expand cover uses the same dominant color as the pill (not the fallback).
- **Fallback path:** on a slow network throttle, confirm the pill first appears in the fallback `overlayColor` and then re-paints to the extracted color smoothly, without flashing white.
- **Reduced motion:** the color flow is independent of motion preference; both paths should resolve identically.
- **Logo:** verify the logo renders at the right size on both desktop and mobile, with `opacity: 0.25` and inverted to white. No alt text exposure.

No new unit tests are proposed — the extraction utility already has its own tests at [`src/utils/dominant-color.test.ts`](../../../src/utils/dominant-color.test.ts).

---

## 6. Out of scope

- Refactoring `useProjectColors()` into a React Context shared across the app.
- Removing the now-unused `monogram` field from `Devotion`.
- Refining the hand-picked `overlayColor` values in `src/data/projects.ts` (still used as fallback + by many other components).

---

## 7. Open questions

None. Color source + logo styling confirmed by user.
