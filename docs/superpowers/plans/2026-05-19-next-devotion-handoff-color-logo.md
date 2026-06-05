# Next Devotion Handoff — Pill Color + Logo Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `NextDevotionHandoff` pill color match the home grid's dominant-extracted color, and replace the 2-letter monogram with the studio logo asset.

**Architecture:** Add a small `useNextProjectColor` hook to `NextDevotionHandoff.tsx` that calls the existing `extractDominantColor()` utility on the next project's thumbnail, with `nextProject.overlayColor` as fallback. Thread the resolved color into every place the component currently reads `nextProject.overlayColor` (outer section, pill, click-expand cover). Replace the monogram `<div>` in the pill center with an `<img src="/logo-icon.png">` matching the existing grid hover watermark styling.

**Tech Stack:** React 19, TypeScript, existing `extractDominantColor` utility at `src/utils/extractDominantColor.ts`. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-19-next-devotion-handoff-color-logo.md](../specs/2026-05-19-next-devotion-handoff-color-logo.md)

---

## File Structure

### Modified

| Path | Change |
|---|---|
| `src/components/sections/NextDevotionHandoff.tsx` | Add `useNextProjectColor` hook. Thread resolved color through `useClickToExpand`, `DesktopLayout`, `MobileLayout`, and `Pill`. Replace monogram `<div>` with logo `<img>`. |

### Untouched

`src/utils/extractDominantColor.ts`, `src/utils/dominant-color.ts`, `src/hooks/useProjectColors.ts`, `src/data/devotions.ts`, `src/data/projects.ts`, `src/App.tsx`, `src/components/sections/MoodBoard.tsx`.

---

## Task 1: Dominant-color pill (replaces hand-picked overlayColor)

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

The 5 current reads of `nextProject.overlayColor`:
- Line 99 — `DesktopLayout` outer `<section>` style.backgroundColor
- Line 157 — `MobileLayout` outer `<section>` style.backgroundColor
- Line 212 — `Pill`'s `pillStyle.backgroundColor`
- Line 509 — `useClickToExpand`'s `clippedLayer.style.backgroundColor`
- Line 518 — `useClickToExpand`'s `unclippedLayer.style.backgroundColor`

All five must use the resolved color instead.

- [ ] **Step 1: Add `extractDominantColor` import**

At the top of `src/components/sections/NextDevotionHandoff.tsx`, after the existing imports, add:

```tsx
import { extractDominantColor } from '@/utils/extractDominantColor';
```

(`useState` is already imported via the `useReducedMotion` hook from Task 8 of the parent feature.)

- [ ] **Step 2: Add `useNextProjectColor` hook**

Just below `useReducedMotion` (currently around line 10-24 of the file), add:

```tsx
function useNextProjectColor(nextProject: Project): string {
  const [color, setColor] = useState<string>(nextProject.overlayColor);

  useEffect(() => {
    let cancelled = false;
    extractDominantColor(nextProject.thumbnail).then((c) => {
      if (!cancelled) setColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [nextProject.thumbnail, nextProject.overlayColor]);

  return color;
}
```

This returns the fallback synchronously on first render (no flash), then re-renders with the extracted color when the promise resolves.

- [ ] **Step 3: Call the hook in `NextDevotionHandoff` parent and thread color through `LayoutProps`**

The parent `NextDevotionHandoff` function currently calls four hooks and assembles `layoutProps`. Add a fifth hook call and a new field in `layoutProps`:

Find the function (it starts around line 39):

```tsx
export function NextDevotionHandoff({ currentProject, nextProject, nextDevotion, variant = 'desktop' }: NextDevotionHandoffProps) {
  void currentProject;

  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion });
  useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion });
  const { startExpand } = useClickToExpand(pillRef, nextProject, reducedMotion);

  const layoutProps = {
    nextProject,
    nextDevotion,
    rootRef,
    leftImgRef,
    rightImgRef,
    pillRef,
    onActivate: startExpand,
  };
  ...
```

Update to:

```tsx
export function NextDevotionHandoff({ currentProject, nextProject, nextDevotion, variant = 'desktop' }: NextDevotionHandoffProps) {
  void currentProject;

  const reducedMotion = useReducedMotion();
  const pillColor = useNextProjectColor(nextProject);
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion });
  useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion });
  const { startExpand } = useClickToExpand(pillRef, nextProject, reducedMotion, pillColor);

  const layoutProps = {
    nextProject,
    nextDevotion,
    rootRef,
    leftImgRef,
    rightImgRef,
    pillRef,
    onActivate: startExpand,
    pillColor,
  };
  ...
```

- [ ] **Step 4: Add `pillColor` to `LayoutProps` interface**

Find the `LayoutProps` interface (currently around line 75 of the file):

```tsx
interface LayoutProps {
  nextProject: Project;
  nextDevotion: Devotion;
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
  onActivate: () => void;
}
```

Add the `pillColor` field:

```tsx
interface LayoutProps {
  nextProject: Project;
  nextDevotion: Devotion;
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
  onActivate: () => void;
  pillColor: string;
}
```

- [ ] **Step 5: Use `pillColor` in `DesktopLayout`**

Find the `DesktopLayout` function (around line 85). Destructure `pillColor` from props, and replace the outer section's `backgroundColor`:

Change the function signature from:
```tsx
function DesktopLayout({ nextProject, nextDevotion, rootRef, leftImgRef, rightImgRef, pillRef, onActivate }: LayoutProps) {
```
to:
```tsx
function DesktopLayout({ nextProject, nextDevotion, rootRef, leftImgRef, rightImgRef, pillRef, onActivate, pillColor }: LayoutProps) {
```

Change the `<section>` style from:
```tsx
style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}
```
to:
```tsx
style={{ width: '100vw', backgroundColor: pillColor }}
```

Pass `pillColor` to `<Pill>` (find the existing Pill invocation near the end of `DesktopLayout`'s return):

```tsx
<Pill
  pillRef={pillRef}
  nextProject={nextProject}
  nextDevotion={nextDevotion}
  variant="desktop"
  onActivate={onActivate}
  pillColor={pillColor}
/>
```

- [ ] **Step 6: Use `pillColor` in `MobileLayout`**

Same pattern. Find `MobileLayout` (around line 143). Destructure `pillColor`:

```tsx
function MobileLayout({ nextProject, nextDevotion, rootRef, leftImgRef, rightImgRef, pillRef, onActivate, pillColor }: LayoutProps) {
```

Change the outer section's `backgroundColor` from `nextProject.overlayColor` to `pillColor`:

```tsx
style={{ minHeight: '100vh', backgroundColor: pillColor }}
```

Pass `pillColor` to the inner `<Pill>`:

```tsx
<Pill
  pillRef={pillRef}
  nextProject={nextProject}
  nextDevotion={nextDevotion}
  variant="mobile"
  onActivate={onActivate}
  pillColor={pillColor}
/>
```

- [ ] **Step 7: Update `PillProps` and `Pill`**

Find the `PillProps` interface (currently around line 200). It should look like:

```tsx
interface PillProps extends LayoutProps {
  variant: 'desktop' | 'mobile';
  pillRef?: React.RefObject<HTMLDivElement | null>;
  onActivate?: () => void;
}
```

(Note: since `LayoutProps` now contains `pillColor`, `PillProps` already inherits it.)

Find the `Pill` function. Destructure `pillColor` and use it for `pillStyle.backgroundColor`:

Change from:
```tsx
function Pill({ nextProject, nextDevotion, variant, pillRef, onActivate }: PillProps) {
  const isMobile = variant === 'mobile';
  const pillStyle: React.CSSProperties = {
    backgroundColor: nextProject.overlayColor,
    clipPath: 'url(#hero-mask-clip)',
    ...
```

to:
```tsx
function Pill({ nextProject: _nextProject, nextDevotion, variant, pillRef, onActivate, pillColor }: PillProps) {
  void _nextProject;
  const isMobile = variant === 'mobile';
  const pillStyle: React.CSSProperties = {
    backgroundColor: pillColor,
    clipPath: 'url(#hero-mask-clip)',
    ...
```

`nextProject` becomes unused inside `Pill` after this change; renaming to `_nextProject` and `void _nextProject` keeps it accessible if future code needs it while suppressing the unused-arg lint.

- [ ] **Step 8: Update `useClickToExpand` signature and use `pillColor` for the cover**

Find `useClickToExpand` (around line 464). Change the signature and body to take a fourth `pillColor` argument and use it where the cover is built:

```tsx
function useClickToExpand(
  pillRef: React.RefObject<HTMLDivElement | null>,
  nextProject: Project,
  reducedMotion: boolean,
  pillColor: string,
): { startExpand: () => void } {
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      const orphan = document.querySelector('[data-pill-cover]');
      orphan?.remove();
      document.body.style.overflow = '';
    };
  }, []);

  const startExpand = () => {
    const pill = pillRef.current;
    if (!pill) return;
    if (document.querySelector('[data-pill-cover]')) return;

    const rect = pill.getBoundingClientRect();
    document.body.style.overflow = 'hidden';

    const cover = document.createElement('div');
    cover.setAttribute('data-pill-cover', '');
    Object.assign(cover.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      zIndex: '100',
      pointerEvents: 'none',
      opacity: '1',
    } as Partial<CSSStyleDeclaration>);

    const clippedLayer = document.createElement('div');
    Object.assign(clippedLayer.style, {
      position: 'absolute',
      inset: '0',
      backgroundColor: pillColor,
      clipPath: 'url(#hero-mask-clip)',
    } as Partial<CSSStyleDeclaration>);

    const unclippedLayer = document.createElement('div');
    Object.assign(unclippedLayer.style, {
      position: 'absolute',
      inset: '0',
      backgroundColor: pillColor,
      opacity: '0',
    } as Partial<CSSStyleDeclaration>);

    // ...rest of body unchanged...
```

Only two lines change in the body: the two `backgroundColor: nextProject.overlayColor` → `backgroundColor: pillColor`. Everything else stays identical.

- [ ] **Step 9: Verify nothing else reads `nextProject.overlayColor` in the file**

```bash
cd /Users/newmac/Downloads/Psalms_app
grep -n 'nextProject.overlayColor' src/components/sections/NextDevotionHandoff.tsx
```

Expected: 0 matches. If any remain, replace them with the appropriate `pillColor` reference.

- [ ] **Step 10: Build + tests**

```bash
cd /Users/newmac/Downloads/Psalms_app
npm run build
npm test
```

Expected: build clean (only pre-existing warnings). All 534 tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): pill color matches grid hover via dominant extraction

Adds useNextProjectColor hook that calls extractDominantColor on the next
project's thumbnail (with overlayColor as fallback). Resolved color
threaded into the outer section, pill, and click-expand cover so the
handoff color matches what users see when hovering that devotion on the
home grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Logo replaces monogram in pill center column

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

- [ ] **Step 1: Replace the monogram `<div>` in `Pill`**

Find the existing monogram block in `Pill` (currently around lines 276-289):

```tsx
        {/* Center column: monogram */}
        <div
          className="next-handoff-monogram"
          style={{
            fontFamily: 'ui-sans-serif, system-ui',
            fontSize: isMobile ? '11px' : '22px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          {nextDevotion.monogram}
        </div>
```

Replace with:

```tsx
        {/* Center column: logo watermark */}
        <img
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`next-handoff-logo opacity-25 invert pointer-events-none ${isMobile ? 'w-5' : 'w-10'}`}
        />
```

Notes:
- `next-handoff-logo` class name added for consistency with the other `next-handoff-*` BEM-style class hooks used in the file (no rules apply to it; it's a hook for future targeting).
- `w-5` (20px) on mobile, `w-10` (40px) on desktop — proportional to the existing 11px/22px monogram glyph dimensions.
- `opacity-25 invert` matches the existing grid hover watermark styling at [src/components/sections/PurposeGrid.tsx:130-133](../../../src/components/sections/PurposeGrid.tsx#L130).
- `pointer-events-none` ensures the logo doesn't block the click handler on the parent pill.
- `loading="lazy" decoding="async"` matches the other `<img>` patterns in the file.

`nextDevotion.monogram` is no longer referenced inside `Pill`. That's fine — the field remains on the `Devotion` interface and the data file, just unused. Spec §3.4 explicitly accepts this.

- [ ] **Step 2: Verify the logo asset exists**

```bash
ls -la /Users/newmac/Downloads/Psalms_app/public/logo-icon.png
```

Expected: file exists. (It does — already used by `PurposeGrid`.)

- [ ] **Step 3: Build + tests**

```bash
cd /Users/newmac/Downloads/Psalms_app
npm run build
npm test
```

Expected: build clean. 534/534 tests pass.

- [ ] **Step 4: Verify `nextDevotion.monogram` is no longer referenced in `Pill`**

```bash
cd /Users/newmac/Downloads/Psalms_app
grep -n 'nextDevotion.monogram' src/components/sections/NextDevotionHandoff.tsx
```

Expected: 0 matches in the file. If any remain, you've missed the replacement.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): logo replaces monogram in pill center

Center column now renders /logo-icon.png with opacity-25 invert — same
watermark style as the home grid hover overlay (PurposeGrid.tsx:130). The
Devotion.monogram field stays in place (unused, deferred cleanup).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Done

Two tasks, two commits. After this plan:
- Pill background, outer section background, and click-expand cover all use the dominant-extracted color from `nextProject.thumbnail` — matching what hovering that devotion on the home grid displays.
- Pill center renders the studio logo (`/logo-icon.png`) as a subtle watermark instead of a 2-letter monogram.

Verify visually by opening any devotion's moodboard end-zone:
1. Confirm the pill color matches the same devotion's grid hover color on the home page.
2. Confirm the center logo is visible at ~25% opacity, white-on-pill, sized small but legible.
3. Click the pill — the expand cover should use the same dominant color (not the fallback).

Open spec: [docs/superpowers/specs/2026-05-19-next-devotion-handoff-color-logo.md](../specs/2026-05-19-next-devotion-handoff-color-logo.md).
