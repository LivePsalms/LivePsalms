# Mobile Decoration UX — Native-Feel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make editing a decoration on mobile feel like manipulating an object in Keynote/Freeform — finger-sized handles, a stable bottom toolbar that can't clip, and rotation that snaps instead of spinning wildly — with zero change to desktop behavior.

**Architecture:** All new behavior is gated on the existing `isBottomToolbar` flag (`toolbarPlacement === 'bottom'`), threaded into the decoration layer as a `mobile` prop. Two new **pure** geometry helpers (`snapAngle`, `resizeFromCorner`) are TDD'd in isolation. `DecorationItem` gains mobile branches (drag threshold, 44px four-corner handles, larger snapping rotate handle + angle badge). A new `DecorationToolbar` component renders the contextual bottom bar; the Editor swaps it in place of the formatting toolbar while a decoration is selected.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react (jsdom), lucide-react icons.

**Spec:** [docs/superpowers/specs/2026-06-11-mobile-decoration-ux-design.md](../specs/2026-06-11-mobile-decoration-ux-design.md)

---

## File Structure

**Modify:**
- `src/notepad/decorations/decoration-geometry.ts` — add `snapAngle`, `resizeFromCorner`.
- `src/notepad/decorations/decoration-geometry.test.ts` — tests for the two helpers.
- `src/notepad/decorations/DecorationItem.tsx` — `mobile` prop; drag threshold; 4 corner handles w/ 44px hit area; rotate radius + snap + angle badge; pinch snap; hide floating bar on mobile.
- `src/notepad/decorations/DecorationItem.test.tsx` — mobile-branch tests + desktop regression.
- `src/notepad/decorations/DecorationLayer.tsx` — thread `mobile` prop.
- `src/notepad/components/Editor.tsx` — pass `mobile`; render `DecorationToolbar` swapped for the formatting toolbar when `isBottomToolbar && selectedDecoration`.

**Create:**
- `src/notepad/decorations/DecorationToolbar.tsx` — contextual bottom toolbar component.
- `src/notepad/decorations/DecorationToolbar.test.tsx` — its tests.

**Conventions to follow (verified in repo):**
- Test runner: `npm test` (= `vitest run`). Single file: `npx vitest run <path>`.
- Component tests start with `// @vitest-environment jsdom`, mock `../styles/manifest` `getStyleAsset` to return `{ aspectRatio: 2, displayUrl, ... }`, and drive interactions with `fireEvent.pointerDown/Move/Up`.
- jsdom `getBoundingClientRect()` returns 0,0 — rotate-handle tests treat the box center as the origin.
- Typecheck with `tsc -b` (NOT bare `tsc --noEmit`).

---

## Task 1: `snapAngle` geometry helper

**Files:**
- Modify: `src/notepad/decorations/decoration-geometry.ts`
- Test: `src/notepad/decorations/decoration-geometry.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `decoration-geometry.test.ts` (import `snapAngle` in the existing top import block alongside the others):

```ts
describe('snapAngle', () => {
  it('snaps to the nearest step when within the threshold', () => {
    expect(snapAngle(2, { step: 45, threshold: 5 })).toBe(0);
    expect(snapAngle(43, { step: 45, threshold: 5 })).toBe(45);
    expect(snapAngle(88, { step: 45, threshold: 5 })).toBe(90);
  });

  it('passes the angle through unchanged when outside the threshold', () => {
    expect(snapAngle(20, { step: 45, threshold: 5 })).toBe(20);
    expect(snapAngle(60, { step: 45, threshold: 5 })).toBe(60);
  });

  it('snaps across the 360/0 wrap', () => {
    expect(snapAngle(359, { step: 45, threshold: 5 })).toBe(0);
    expect(snapAngle(-2, { step: 45, threshold: 5 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/decorations/decoration-geometry.test.ts -t snapAngle`
Expected: FAIL — `snapAngle is not a function` / import error.

- [ ] **Step 3: Write minimal implementation**

Append to `decoration-geometry.ts` (after `rotationDeg`):

```ts
// Snaps an angle to the nearest multiple of `step` when within `threshold`
// degrees of it (handling the 360/0 wrap), else returns the normalized angle.
// Used on mobile so rotation locks onto cardinal/diagonal angles instead of
// drifting. Pure — desktop never calls it, keeping desktop rotation unchanged.
export function snapAngle(
  deg: number,
  { step, threshold }: { step: number; threshold: number },
): number {
  const norm = rotationDeg(deg);
  const nearest = Math.round(norm / step) * step;
  return Math.abs(norm - nearest) <= threshold ? rotationDeg(nearest) : norm;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/decorations/decoration-geometry.test.ts -t snapAngle`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/decorations/decoration-geometry.ts src/notepad/decorations/decoration-geometry.test.ts
git commit -m "feat(decorations): add snapAngle geometry helper"
```

---

## Task 2: `resizeFromCorner` geometry helper

Proportional (aspect-locked, width-driven) resize from any of the four corners, keeping the diagonally-opposite corner anchored. Reuses the existing `MIN_WIDTH_PCT`/`MAX_WIDTH_PCT` clamps. Position fields (`xPct`, `yPx`) are recomputed but NOT run through `clampDecoration` (matching `resizeWidthPct`, which leaves position to the move path) so the opposite-corner anchor stays exact.

**Files:**
- Modify: `src/notepad/decorations/decoration-geometry.ts`
- Test: `src/notepad/decorations/decoration-geometry.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `decoration-geometry.test.ts` (import `resizeFromCorner`):

```ts
describe('resizeFromCorner', () => {
  // base: left=500, top=100, width=200 (0.2*1000), aspectRatio 2 => height=100.
  const base: NoteDecoration = {
    id: 'a', assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 0, z: 1,
  };
  const cw = 1000;
  const ar = 2;

  it('bottom-right: grows width, anchors top-left (position unchanged)', () => {
    const out = resizeFromCorner(base, { corner: 'bottom-right', dxPx: 100, dyPx: 0, contentWidth: cw, aspectRatio: ar });
    expect(out.widthPct).toBeCloseTo(0.3, 5); // (200+100)/1000
    expect(out.xPct).toBeCloseTo(0.5, 5);     // left anchored
    expect(out.yPx).toBeCloseTo(100, 5);      // top anchored
  });

  it('bottom-left: grows width leftward, anchors top-right', () => {
    // drag left edge 100px left (dx=-100): width 200->300; right edge (700) fixed
    // => left = 700-300 = 400 => xPct 0.4; top fixed.
    const out = resizeFromCorner(base, { corner: 'bottom-left', dxPx: -100, dyPx: 0, contentWidth: cw, aspectRatio: ar });
    expect(out.widthPct).toBeCloseTo(0.3, 5);
    expect(out.xPct).toBeCloseTo(0.4, 5);
    expect(out.yPx).toBeCloseTo(100, 5);
  });

  it('top-right: grows width, anchors bottom-left (top moves up by height delta)', () => {
    // width 200->300 => height 100->150; bottom (200) fixed => top = 200-150 = 50.
    const out = resizeFromCorner(base, { corner: 'top-right', dxPx: 100, dyPx: 0, contentWidth: cw, aspectRatio: ar });
    expect(out.widthPct).toBeCloseTo(0.3, 5);
    expect(out.xPct).toBeCloseTo(0.5, 5);  // left anchored
    expect(out.yPx).toBeCloseTo(50, 5);
  });

  it('top-left: grows width leftward, anchors bottom-right', () => {
    // dx=-100 => width 300; height 150; right(700) & bottom(200) fixed
    // => left = 700-300 = 400 (xPct 0.4); top = 200-150 = 50.
    const out = resizeFromCorner(base, { corner: 'top-left', dxPx: -100, dyPx: 0, contentWidth: cw, aspectRatio: ar });
    expect(out.widthPct).toBeCloseTo(0.3, 5);
    expect(out.xPct).toBeCloseTo(0.4, 5);
    expect(out.yPx).toBeCloseTo(50, 5);
  });

  it('clamps width to the MIN/MAX range', () => {
    const wide = resizeFromCorner({ ...base, widthPct: 0.98 }, { corner: 'bottom-right', dxPx: 1000, dyPx: 0, contentWidth: cw, aspectRatio: ar });
    expect(wide.widthPct).toBe(1);
    const tiny = resizeFromCorner({ ...base, widthPct: 0.05 }, { corner: 'bottom-right', dxPx: -1000, dyPx: 0, contentWidth: cw, aspectRatio: ar });
    expect(tiny.widthPct).toBe(0.03);
  });

  it('leaves the decoration unchanged when contentWidth is 0', () => {
    const out = resizeFromCorner(base, { corner: 'bottom-right', dxPx: 100, dyPx: 0, contentWidth: 0, aspectRatio: ar });
    expect(out.widthPct).toBe(0.2);
    expect(out.xPct).toBe(0.5);
    expect(out.yPx).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/decorations/decoration-geometry.test.ts -t resizeFromCorner`
Expected: FAIL — `resizeFromCorner is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `decoration-geometry.ts`:

```ts
export type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Proportional (aspect-locked) resize from a corner, keeping the diagonally
// opposite corner fixed on the canvas. Width is the driver; height follows the
// asset aspect ratio (width / aspectRatio), matching the <img> render. Width is
// clamped to [MIN_WIDTH_PCT, MAX_WIDTH_PCT]; position is recomputed from the
// anchored corner and intentionally NOT passed through clampDecoration so the
// anchor stays exact (the move path owns position clamping).
export function resizeFromCorner(
  d: NoteDecoration,
  { corner, dxPx, contentWidth, aspectRatio }:
    { corner: ResizeCorner; dxPx: number; dyPx: number; contentWidth: number; aspectRatio: number },
): NoteDecoration {
  if (contentWidth <= 0) return d;

  const left = d.xPct * contentWidth;
  const top = d.yPx;
  const width = d.widthPct * contentWidth;
  const height = aspectRatio > 0 ? width / aspectRatio : width;
  const right = left + width;
  const bottom = top + height;

  // Left-edge corners grow as the pointer moves left (negative dx).
  const growsRight = corner === 'top-right' || corner === 'bottom-right';
  const rawWidth = growsRight ? width + dxPx : width - dxPx;

  const widthPct = Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, rawWidth / contentWidth));
  const newWidth = widthPct * contentWidth;
  const newHeight = aspectRatio > 0 ? newWidth / aspectRatio : newWidth;

  // Anchor the opposite corner.
  const anchorsLeft = corner === 'top-left' || corner === 'bottom-left'; // opposite corner is on the right
  const anchorsTop = corner === 'top-left' || corner === 'top-right';    // opposite corner is on the bottom
  const newLeft = anchorsLeft ? right - newWidth : left;
  const newTop = anchorsTop ? bottom - newHeight : top;

  return { ...d, widthPct, xPct: newLeft / contentWidth, yPx: newTop };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notepad/decorations/decoration-geometry.test.ts -t resizeFromCorner`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/decorations/decoration-geometry.ts src/notepad/decorations/decoration-geometry.test.ts
git commit -m "feat(decorations): add resizeFromCorner geometry helper"
```

---

## Task 3: Thread a `mobile` prop through DecorationLayer → DecorationItem (no behavior change)

Plumbing only. Default `false` so desktop and all existing tests stay green.

**Files:**
- Modify: `src/notepad/decorations/DecorationItem.tsx` (Props + signature)
- Modify: `src/notepad/decorations/DecorationLayer.tsx` (Props + pass-through)
- Test: `src/notepad/decorations/DecorationItem.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `DecorationItem.test.tsx`:

```ts
it('accepts a mobile prop without altering desktop default rendering', () => {
  const h = handlers();
  const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile={false} {...h} />);
  // Desktop default still shows the floating action bar.
  expect(getByLabelText('Delete decoration')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx -t "mobile prop"`
Expected: FAIL — TS/prop error: `mobile` is not a known prop.

- [ ] **Step 3: Add the prop**

In `DecorationItem.tsx`, add to `interface Props`:

```ts
  /** Mobile (bottom-toolbar) layout: enables finger-first handles, snapping
   *  rotation, drag threshold, and hides the floating action bar. */
  mobile?: boolean;
```

Update the destructured signature default:

```ts
export function DecorationItem({
  decoration: d, selected, contentWidth, mobile = false,
  onChange, onSelect, onDelete, onDuplicate, onBringToFront, onSendToBack, onDeselect,
}: Props) {
```

In `DecorationLayer.tsx`, add to `interface Props`:

```ts
  mobile?: boolean;
```

Add `mobile = false` to the destructured params, and pass it down in the JSX:

```tsx
            <DecorationItem
              decoration={d}
              selected={selectedId === d.id}
              contentWidth={contentWidth}
              mobile={mobile}
              onChange={onChange}
              onSelect={onSelect}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onBringToFront={onBringToFront}
              onSendToBack={onSendToBack}
              onDeselect={onDeselect}
            />
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx && tsc -b`
Expected: PASS; tsc clean (no NEW errors beyond the known `force-sphere.test.ts` baseline).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/decorations/DecorationItem.tsx src/notepad/decorations/DecorationLayer.tsx src/notepad/decorations/DecorationItem.test.tsx
git commit -m "feat(decorations): thread mobile prop through layer to item"
```

---

## Task 4: Drag threshold on mobile (tap selects without nudging)

On mobile, a move is only applied once the pointer travels > 6px from the start. Below that, the gesture selects only. Desktop keeps threshold 0 (immediate move).

**Files:**
- Modify: `src/notepad/decorations/DecorationItem.tsx`
- Test: `src/notepad/decorations/DecorationItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it('mobile: a sub-threshold pointer move selects but does not move the decoration', () => {
  const h = handlers();
  const { getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  const surface = getByTestId('decoration-surface-a');
  fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(surface, { clientX: 3, clientY: 2, pointerId: 1 }); // ~3.6px < 6
  fireEvent.pointerUp(surface, { pointerId: 1 });
  expect(h.onChange).not.toHaveBeenCalled();
});

it('mobile: a past-threshold pointer move updates position', () => {
  const h = handlers();
  const { getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  const surface = getByTestId('decoration-surface-a');
  fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(surface, { clientX: 100, clientY: 30, pointerId: 1 });
  fireEvent.pointerUp(surface, { pointerId: 1 });
  expect(h.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'a', xPct: expect.closeTo(0.6, 5), yPx: 130 }),
  );
});

it('desktop: moves immediately with no threshold (regression)', () => {
  const h = handlers();
  const { getByTestId } = render(<DecorationItem decoration={d} selected {...h} />);
  const surface = getByTestId('decoration-surface-a');
  fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(surface, { clientX: 3, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(surface, { pointerId: 1 });
  expect(h.onChange).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx -t threshold`
Expected: FAIL — the sub-threshold test fails because move currently applies immediately.

- [ ] **Step 3: Implement the threshold**

Add a module-level constant near the top of `DecorationItem.tsx` (after imports):

```ts
const MOBILE_DRAG_THRESHOLD_PX = 6;
```

Extend the gesture ref type to track whether the threshold has been crossed:

```ts
type Gesture = { kind: 'move' | 'resize'; startX: number; startY: number; base: NoteDecoration; movedEnough: boolean };
```

Set `movedEnough: false` everywhere a `Gesture` is created (in `start(...)` and in `surfacePointerDown`). Example for `surfacePointerDown`'s single-pointer branch:

```ts
      gesture.current = { kind: 'move', startX: e.clientX, startY: e.clientY, base: d, movedEnough: false };
```

And in `start`:

```ts
    gesture.current = { kind: kind === 'resize' ? 'resize' : 'move', startX: e.clientX, startY: e.clientY, base: d, movedEnough: false };
```

In `move`, gate the move-kind update behind the threshold on mobile:

```ts
  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dxPx = e.clientX - g.startX;
    const dyPx = e.clientY - g.startY;
    if (g.kind === 'move') {
      if (mobile && !g.movedEnough) {
        if (Math.hypot(dxPx, dyPx) < MOBILE_DRAG_THRESHOLD_PX) return;
        g.movedEnough = true;
      }
      onChange(moveTo(g.base, { dxPx, dyPx, contentWidth }));
    } else {
      onChange(resizeWidthPct(g.base, { dxPx, contentWidth }));
    }
  };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx`
Expected: PASS (new threshold tests + all existing).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/decorations/DecorationItem.tsx src/notepad/decorations/DecorationItem.test.tsx
git commit -m "feat(decorations): 6px drag threshold on mobile so a tap selects without nudging"
```

---

## Task 5: Four 44px corner resize handles on mobile

Desktop keeps its single bottom-right 12px handle. Mobile renders four corner handles, each a transparent 44px hit area with a centered ~24px visual dot, driving `resizeFromCorner`.

**Files:**
- Modify: `src/notepad/decorations/DecorationItem.tsx`
- Test: `src/notepad/decorations/DecorationItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it('mobile: renders four corner resize handles with a >=44px hit area', () => {
  const h = handlers();
  const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  for (const label of ['Resize top-left', 'Resize top-right', 'Resize bottom-left', 'Resize bottom-right']) {
    const handle = getByLabelText(label) as HTMLElement;
    expect(parseInt(handle.style.width, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(handle.style.height, 10)).toBeGreaterThanOrEqual(44);
  }
});

it('mobile: dragging the bottom-right corner grows width, anchoring top-left', () => {
  const h = handlers();
  const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  const handle = getByLabelText('Resize bottom-right');
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 100, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(h.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'a', widthPct: expect.closeTo(0.3, 5), xPct: expect.closeTo(0.5, 5), yPx: 100 }),
  );
});

it('mobile: dragging the bottom-left corner grows width, anchoring top-right', () => {
  const h = handlers();
  const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  const handle = getByLabelText('Resize bottom-left');
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: -100, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(h.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'a', widthPct: expect.closeTo(0.3, 5), xPct: expect.closeTo(0.4, 5) }),
  );
});

it('desktop: still renders the single bottom-right resize handle, not the four mobile ones', () => {
  const h = handlers();
  const { getByLabelText, queryByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
  expect(getByLabelText('Resize decoration')).not.toBeNull();
  expect(queryByLabelText('Resize top-left')).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx -t "corner"`
Expected: FAIL — corner-handle labels don't exist yet.

- [ ] **Step 3: Implement corner handles**

Add a resize-by-corner gesture. Extend the `Gesture` type with an optional corner:

```ts
type Gesture = {
  kind: 'move' | 'resize'; startX: number; startY: number; base: NoteDecoration;
  movedEnough: boolean; corner?: ResizeCorner;
};
```

Import `resizeFromCorner` and the `ResizeCorner` type from `./decoration-geometry`.

Add a corner-resize starter and route corner moves through `resizeFromCorner`:

```ts
const startCorner = (corner: ResizeCorner) => (e: React.PointerEvent) => {
  e.stopPropagation();
  gesture.current = { kind: 'resize', startX: e.clientX, startY: e.clientY, base: d, movedEnough: true, corner };
  try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* jsdom no-op */ }
};
```

In `move`, handle the corner case (extend the existing `else` branch):

```ts
    } else if (g.corner) {
      onChange(resizeFromCorner(g.base, {
        corner: g.corner, dxPx, dyPx, contentWidth, aspectRatio: asset.aspectRatio,
      }));
    } else {
      onChange(resizeWidthPct(g.base, { dxPx, contentWidth }));
    }
```

In the selected-chrome JSX, render the existing single bottom-right handle ONLY on desktop, and the four corner handles ONLY on mobile. Replace the current single resize handle block with:

```tsx
          {!mobile && (
            <div
              aria-label="Resize decoration"
              onPointerDown={start('resize')}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              style={{ ...handleStyle('-6px', '-6px', 'nwse-resize', 'bottom-right'), pointerEvents: 'auto' }}
            />
          )}
          {mobile && (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
            <div
              key={corner}
              aria-label={`Resize ${corner.replace('-', ' ')}`}
              onPointerDown={startCorner(corner)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              style={{ ...cornerHandleStyle(corner), pointerEvents: 'auto' }}
            />
          ))}
```

Add the `cornerHandleStyle` helper at the bottom of the file (a 44px transparent hit area with a centered 24px visual dot via `boxShadow`/pseudo is awkward inline, so use a nested element approach instead). Replace the map body with a wrapper + visual child:

```tsx
          {mobile && (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
            <div
              key={corner}
              aria-label={`Resize ${corner.replace('-', ' ')}`}
              onPointerDown={startCorner(corner)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              style={{ ...cornerHitArea(corner), pointerEvents: 'auto' }}
            >
              <span style={visualDot} />
            </div>
          ))}
```

And at the bottom of the file:

```tsx
// 44px transparent touch target centered on the box corner (negative offsets =
// half the hit-area size so the corner sits at its center).
function cornerHitArea(corner: ResizeCorner): React.CSSProperties {
  const SIZE = 44;
  const off = -SIZE / 2;
  const base: React.CSSProperties = {
    position: 'absolute', width: SIZE, height: SIZE,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    touchAction: 'none', cursor: 'nwse-resize', background: 'transparent',
  };
  const top = corner.startsWith('top');
  const left = corner.endsWith('left');
  return { ...base, top: top ? off : undefined, bottom: top ? undefined : off, left: left ? off : undefined, right: left ? undefined : off };
}

const visualDot: React.CSSProperties = {
  width: 24, height: 24, borderRadius: '50%', background: '#fff',
  border: '2px solid var(--deep-umber)', boxShadow: '0 1px 3px rgba(0,0,0,.18)',
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx && tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/decorations/DecorationItem.tsx src/notepad/decorations/DecorationItem.test.tsx
git commit -m "feat(decorations): finger-sized four-corner resize handles on mobile"
```

---

## Task 6: Rotate handle — larger radius, angle snapping, live angle badge, pinch snap

On mobile: the rotate handle sits ~40px above the box (vs -22px), its hit area is 44px, the rotation output snaps to 45° multiples within ±5°, a small badge shows the live snapped angle during the gesture, and a guarded `navigator.vibrate?.(10)` fires on a snap (no-op on iOS). Two-finger pinch rotation gets the same snap. Desktop is unchanged.

**Files:**
- Modify: `src/notepad/decorations/DecorationItem.tsx`
- Test: `src/notepad/decorations/DecorationItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it('mobile: rotate handle output snaps to the nearest 45 within 5 degrees', () => {
  const h = handlers();
  const { getByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  const handle = getByLabelText('Rotate decoration');
  // jsdom center = origin. Down at (10,0)=0deg; move to angle ~43deg => snaps to 45.
  // point at 43deg on unit circle: (cos43, sin43) ~ (0.731, 0.682)
  fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 7.31, clientY: 6.82, pointerId: 1 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  const last = h.onChange.mock.calls.at(-1)![0] as NoteDecoration;
  expect(last.rotation).toBe(45);
});

it('mobile: shows a live angle badge during a rotate gesture, hidden otherwise', () => {
  const h = handlers();
  const { getByLabelText, queryByTestId, getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  expect(queryByTestId('decoration-angle-badge-a')).toBeNull();
  const handle = getByLabelText('Rotate decoration');
  fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 0, clientY: 10, pointerId: 1 });
  expect(getByTestId('decoration-angle-badge-a').textContent).toContain('90');
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(queryByTestId('decoration-angle-badge-a')).toBeNull();
});

it('mobile: two-finger pinch rotation snaps to 45 multiples', () => {
  const h = handlers();
  const { getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  const surface = getByTestId('decoration-surface-a');
  // two pointers, rotate from 0 to ~43deg => snaps to 45.
  fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 2 });   // startAngle 0
  fireEvent.pointerMove(surface, { clientX: 73.1, clientY: 68.2, pointerId: 2 }); // ~43deg
  const last = h.onChange.mock.calls.at(-1)![0] as NoteDecoration;
  expect(last.rotation).toBe(45);
});

it('desktop: rotate handle does NOT snap (regression)', () => {
  const h = handlers();
  const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
  const handle = getByLabelText('Rotate decoration');
  fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 7.31, clientY: 6.82, pointerId: 1 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  const last = h.onChange.mock.calls.at(-1)![0] as NoteDecoration;
  expect(last.rotation).toBeCloseTo(43, 0); // ~43, NOT snapped to 45
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx -t "snap\|angle badge"`
Expected: FAIL — no snapping, no badge testid.

- [ ] **Step 3: Implement**

Import `snapAngle` from `./decoration-geometry`. Add module constants:

```ts
const SNAP = { step: 45, threshold: 5 };
```

Add a small state hook for the live badge (at the top of the component, with the other refs/effects):

```ts
const [liveAngle, setLiveAngle] = useState<number | null>(null);
```

(Add `useState` to the React import.)

Add a snap helper inside the component that also fires guarded haptics when it actually snaps:

```ts
const snapRotation = (deg: number): number => {
  const snapped = snapAngle(deg, SNAP);
  if (snapped !== rotationDeg(deg)) {
    try { navigator.vibrate?.(10); } catch { /* unsupported (iOS Safari) — visual feedback only */ }
  }
  return snapped;
};
```

In `rotateMove`, apply the snap and update the badge on mobile:

```ts
  const rotateMove = (e: React.PointerEvent) => {
    const g = rotateGesture.current;
    if (!g) return;
    const currentAngle = pointerAngleDeg(
      { x: g.centerX, y: g.centerY },
      { x: e.clientX, y: e.clientY },
    );
    const raw = applyRotationDrag(g.startRotation, g.startAngle, currentAngle);
    const next = mobile ? snapRotation(raw) : raw;
    if (mobile) setLiveAngle(next);
    onChange({ ...d, rotation: next });
  };
```

In `rotateEnd`, clear the badge:

```ts
  const rotateEnd = (e: React.PointerEvent) => {
    try {
      if ((e.target as Element).hasPointerCapture?.(e.pointerId)) {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }
    } catch { /* jsdom no-op */ }
    rotateGesture.current = null;
    setLiveAngle(null);
  };
```

In `surfacePointerMove`, snap the pinch rotation on mobile:

```ts
    if (pinch.current && pointers.current.size >= 2) {
      const m = twoPointerMetrics();
      const transformed = pinchTransform(pinch.current.base, {
        startDist: pinch.current.startDist, dist: m.dist,
        startAngle: pinch.current.startAngle, angle: m.angle,
      });
      onChange(mobile ? { ...transformed, rotation: snapRotation(transformed.rotation) } : transformed);
      return;
    }
```

Move the rotate handle further out and enlarge its hit area on mobile. Replace the rotate handle JSX with a mobile-aware version + the badge:

```tsx
          <div
            aria-label="Rotate decoration"
            onPointerDown={rotateDown}
            onPointerMove={rotateMove}
            onPointerUp={rotateEnd}
            onPointerCancel={rotateEnd}
            style={mobile
              ? { ...rotateHitAreaMobile, pointerEvents: 'auto' }
              : { ...handleStyle('-22px', 'calc(50% - 6px)', 'grab', 'top'), pointerEvents: 'auto' }}
          >
            {mobile && <span style={visualDot} />}
          </div>
          {mobile && liveAngle !== null && (
            <div
              data-testid={`decoration-angle-badge-${d.id}`}
              style={{
                position: 'absolute', top: -58, left: 'calc(50% + 26px)',
                background: '#fff', border: '1px solid var(--pale-stone)', borderRadius: 4,
                padding: '1px 5px', fontSize: 11, color: 'var(--charred)',
                fontFamily: 'Outfit, sans-serif', pointerEvents: 'none', whiteSpace: 'nowrap',
              }}
            >
              {Math.round(liveAngle)}&deg;
            </div>
          )}
```

Add the mobile rotate hit-area style at the bottom of the file (44px target centered ~40px above the top edge):

```tsx
const rotateHitAreaMobile: React.CSSProperties = {
  position: 'absolute', width: 44, height: 44, top: -62, left: 'calc(50% - 22px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  touchAction: 'none', cursor: 'grab', background: 'transparent',
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx && tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/decorations/DecorationItem.tsx src/notepad/decorations/DecorationItem.test.tsx
git commit -m "feat(decorations): mobile rotate handle with larger radius, 45-deg snap, and angle badge"
```

---

## Task 7: Hide the floating action bar on mobile

The eight-button floating pill (the off-screen offender) is not rendered on mobile — its actions move to the contextual bottom toolbar (Task 8/9). Desktop keeps it.

**Files:**
- Modify: `src/notepad/decorations/DecorationItem.tsx`
- Test: `src/notepad/decorations/DecorationItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it('mobile: does NOT render the floating action bar', () => {
  const h = handlers();
  const { queryByLabelText } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  expect(queryByLabelText('Delete decoration')).toBeNull();
  expect(queryByLabelText('Flip horizontal')).toBeNull();
});

it('desktop: still renders the floating action bar (regression)', () => {
  const h = handlers();
  const { getByLabelText } = render(<DecorationItem decoration={d} selected {...h} />);
  expect(getByLabelText('Delete decoration')).not.toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx -t "floating action bar"`
Expected: FAIL — the mobile test finds the bar (still rendered).

- [ ] **Step 3: Implement**

Wrap the floating action-bar `<div style={{ position: 'absolute', top: -34, left: 0, ... }}>…</div>` block in `!mobile`:

```tsx
          {!mobile && (
            <div style={{
              position: 'absolute', top: -34, left: 0, display: 'flex', gap: 4,
              background: '#fff', border: '1px solid var(--pale-stone)', borderRadius: 6,
              padding: '2px 4px', boxShadow: '0 2px 8px rgba(0,0,0,.14)', pointerEvents: 'auto',
            }}>
              {/* …existing eight buttons, unchanged… */}
            </div>
          )}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx`
Expected: PASS (all DecorationItem tests).

- [ ] **Step 5: Commit**

```bash
git add src/notepad/decorations/DecorationItem.tsx src/notepad/decorations/DecorationItem.test.tsx
git commit -m "feat(decorations): hide floating action bar on mobile (moves to bottom toolbar)"
```

---

## Task 8: `DecorationToolbar` contextual bottom-bar component

A standalone component: a flat row of finger-sized buttons (Flip-H, Flip-V, Send-to-back, Bring-to-front, Duplicate, Delete, Done) styled to match the editor's bottom toolbar slot. No rotate± buttons (handle + gesture own rotation).

**Files:**
- Create: `src/notepad/decorations/DecorationToolbar.tsx`
- Test: `src/notepad/decorations/DecorationToolbar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad/decorations/DecorationToolbar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecorationToolbar } from './DecorationToolbar';
import type { NoteDecoration } from '../types';

const d: NoteDecoration = {
  id: 'a', assetId: 'arrow-01', xPct: 0.5, yPx: 100, widthPct: 0.2, rotation: 0, z: 3,
};

const handlers = () => ({
  decoration: d, bottomOffset: 120,
  onChange: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(),
  onBringToFront: vi.fn(), onSendToBack: vi.fn(), onDone: vi.fn(),
});

afterEach(cleanup);

describe('DecorationToolbar', () => {
  it('renders a bottom-pinned bar at the given offset', () => {
    const h = handlers();
    const { getByTestId } = render(<DecorationToolbar {...h} />);
    const bar = getByTestId('decoration-toolbar') as HTMLElement;
    expect(bar.style.position).toBe('sticky');
    expect(bar.style.bottom).toBe('120px');
  });

  it('does NOT render rotate buttons (handle/gesture own rotation)', () => {
    const h = handlers();
    const { queryByLabelText } = render(<DecorationToolbar {...h} />);
    expect(queryByLabelText('Rotate decoration 15 degrees')).toBeNull();
  });

  it('fires flip/layer/duplicate/delete/done callbacks', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationToolbar {...h} />);
    fireEvent.click(getByLabelText('Flip horizontal'));
    expect(h.onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', flipH: true }));
    fireEvent.click(getByLabelText('Flip vertical'));
    expect(h.onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', flipV: true }));
    fireEvent.click(getByLabelText('Bring to front'));
    expect(h.onBringToFront).toHaveBeenCalledWith('a');
    fireEvent.click(getByLabelText('Send to back'));
    expect(h.onSendToBack).toHaveBeenCalledWith('a');
    fireEvent.click(getByLabelText('Duplicate decoration'));
    expect(h.onDuplicate).toHaveBeenCalledWith('a');
    fireEvent.click(getByLabelText('Delete decoration'));
    expect(h.onDelete).toHaveBeenCalledWith('a');
    fireEvent.click(getByLabelText('Done editing decoration'));
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it('every control meets the 44px touch-target minimum', () => {
    const h = handlers();
    const { getByLabelText } = render(<DecorationToolbar {...h} />);
    for (const label of ['Flip horizontal', 'Flip vertical', 'Bring to front', 'Send to back', 'Duplicate decoration', 'Delete decoration', 'Done editing decoration']) {
      const btn = getByLabelText(label) as HTMLElement;
      expect(parseInt(btn.style.minWidth || btn.style.width, 10)).toBeGreaterThanOrEqual(44);
      expect(parseInt(btn.style.minHeight || btn.style.height, 10)).toBeGreaterThanOrEqual(44);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/notepad/decorations/DecorationToolbar.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the component**

Create `src/notepad/decorations/DecorationToolbar.tsx`:

```tsx
// src/notepad/decorations/DecorationToolbar.tsx
import { FlipHorizontal2, FlipVertical2, ArrowDownToLine, ArrowUpToLine, Copy, Trash2, Check } from 'lucide-react';
import type { NoteDecoration } from '../types';

interface Props {
  decoration: NoteDecoration;
  /** px to lift the bar above the keyboard — mirrors the editor toolbar offset. */
  bottomOffset: number;
  onChange: (next: NoteDecoration) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onDone: () => void;
}

const btn: React.CSSProperties = {
  minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'transparent', color: 'var(--charred)', cursor: 'pointer',
};

// Contextual mobile toolbar shown in place of the formatting toolbar while a
// decoration is selected. Pinned to the bottom slot so it can never clip
// off-screen (the failure mode of the old floating pill). Rotation is handled by
// the on-canvas handle + two-finger gesture, so there are no rotate buttons here.
export function DecorationToolbar({
  decoration: d, bottomOffset, onChange, onDelete, onDuplicate, onBringToFront, onSendToBack, onDone,
}: Props) {
  return (
    <div
      data-testid="decoration-toolbar"
      className="shrink-0 flex items-center px-2"
      style={{
        height: 56, background: 'rgba(240, 236, 232, 0.97)',
        borderTop: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif',
        position: 'sticky', bottom: `${bottomOffset}px`, zIndex: 20,
        justifyContent: 'space-around', width: '100%', minWidth: 0,
      }}
    >
      <button aria-label="Flip horizontal" style={btn} onClick={() => onChange({ ...d, flipH: !d.flipH })}><FlipHorizontal2 size={20} /></button>
      <button aria-label="Flip vertical" style={btn} onClick={() => onChange({ ...d, flipV: !d.flipV })}><FlipVertical2 size={20} /></button>
      <button aria-label="Send to back" style={btn} onClick={() => onSendToBack(d.id)}><ArrowDownToLine size={20} /></button>
      <button aria-label="Bring to front" style={btn} onClick={() => onBringToFront(d.id)}><ArrowUpToLine size={20} /></button>
      <button aria-label="Duplicate decoration" style={btn} onClick={() => onDuplicate(d.id)}><Copy size={20} /></button>
      <button aria-label="Delete decoration" style={{ ...btn, color: '#c0392b' }} onClick={() => onDelete(d.id)}><Trash2 size={20} /></button>
      <button aria-label="Done editing decoration" style={{ ...btn, color: 'var(--charred)' }} onClick={onDone}><Check size={20} /></button>
    </div>
  );
}
```

> Verify the icon names exist in the installed lucide-react before relying on them: `node -e "const x=require('lucide-react'); ['FlipHorizontal2','FlipVertical2','ArrowDownToLine','ArrowUpToLine','Copy','Trash2','Check'].forEach(n=>console.log(n, !!x[n]))"`. If any prints `false`, substitute the nearest existing icon (e.g. `FlipHorizontal`, `MoveDown`, `MoveUp`) and keep the aria-label unchanged.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/notepad/decorations/DecorationToolbar.test.tsx && tsc -b`
Expected: PASS (4 tests); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/decorations/DecorationToolbar.tsx src/notepad/decorations/DecorationToolbar.test.tsx
git commit -m "feat(decorations): contextual mobile decoration toolbar component"
```

---

## Task 9: Wire the contextual toolbar into the Editor (swap for the formatting toolbar)

When `isBottomToolbar && selectedDecoration`, render `DecorationToolbar` in place of the formatting toolbar, and pass `mobile={isBottomToolbar}` to `DecorationLayer`. Done/tap-outside deselect already exist.

**Files:**
- Modify: `src/notepad/components/Editor.tsx`
- Test: `src/notepad/components/Editor.decoration-toolbar.test.tsx` (new)

- [ ] **Step 1: Implement the wiring**

In `Editor.tsx`, import the component near the other decoration imports:

```ts
import { DecorationToolbar } from '../decorations/DecorationToolbar';
```

Compute the selected decoration object where `selectedDecoration` is in scope (just after the `selectedDecoration` state / near the existing decoration handlers):

```ts
  const selectedDecorationObj = selectedDecoration
    ? decorationsApi.decorations.find((x) => x.id === selectedDecoration) ?? null
    : null;
  const showDecorationToolbar = isBottomToolbar && !!selectedDecorationObj;
```

Gate the existing formatting toolbar so it hides when the decoration toolbar is up. Change the toolbar's outer condition from `{editor && (` to:

```tsx
      {editor && !showDecorationToolbar && (
```

Immediately after the formatting-toolbar block (still inside the flex column), render the contextual toolbar:

```tsx
      {showDecorationToolbar && selectedDecorationObj && (
        <DecorationToolbar
          decoration={selectedDecorationObj}
          bottomOffset={toolbarBottomOffset}
          onChange={(next) => decorationsApi.update(next.id, next)}
          onDelete={(id) => { decorationsApi.remove(id); setSelectedDecoration(null); editor?.commands.focus(); }}
          onDuplicate={(id) => decorationsApi.duplicate(id)}
          onBringToFront={(id) => decorationsApi.bringToFront(id)}
          onSendToBack={(id) => decorationsApi.sendToBack(id)}
          onDone={() => { setSelectedDecoration(null); editor?.commands.focus(); }}
        />
      )}
```

Pass `mobile` to the layer:

```tsx
          <DecorationLayer
            key={activeNote.id}
            ref={decorationLayerRef}
            mobile={isBottomToolbar}
            decorations={decorationsApi.decorations}
            selectedId={selectedDecoration}
            /* …rest unchanged… */
```

- [ ] **Step 2: Write the integration test**

Create `src/notepad/components/Editor.decoration-toolbar.test.tsx`. It mounts `NotepadEditor` with the same mock harness as `Editor.toolbar-placement.test.tsx`, but additionally mocks `useDecorations` to return one decoration and selects it by clicking its body, then asserts the formatting toolbar is replaced by the decoration toolbar.

```tsx
// @vitest-environment jsdom
import { render, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fakeEditor = {
  chain: () => ({ focus: () => ({ undo: () => ({ run() {} }), redo: () => ({ run() {} }), run() {} }) }),
  can: () => ({ undo: () => true, redo: () => true }),
  isActive: () => false,
  commands: { focus: vi.fn() },
};
vi.mock('../context/useNoteCollection', () => ({
  useNoteCollection: () => ({
    notes: [],
    activeNote: { id: 'n1', title: 'T', createdAt: new Date().toISOString(), tags: [] },
    collection: { openNote: vi.fn() },
  }),
}));
vi.mock('../context/useNotepadActions', () => ({ useNotepadActions: () => ({ updateNote: vi.fn() }) }));
vi.mock('../context/useReferenceGraph', () => ({ useReferenceGraph: () => ({ graph: null }) }));
vi.mock('../editor/use-note-editor', () => ({ useNoteEditor: () => ({ editor: fakeEditor }) }));
vi.mock('../editor/use-note-link-popup', () => ({
  useNoteLinkPopup: () => ({ popup: null, search: '', setSearch: vi.fn(), filteredNotes: [], dismiss: vi.fn(), insert: vi.fn() }),
}));
vi.mock('../editor/use-verse-tooltip', () => ({
  useVerseTooltip: () => ({ tooltip: null, onMouseOver: vi.fn(), onMouseOut: vi.fn() }),
}));
vi.mock('@tiptap/react', () => ({ EditorContent: () => <div data-testid="editor-content" /> }));
vi.mock('../../auth/context/useAccountProfile', () => ({ useAccountProfile: () => ({ profile: null }) }));
vi.mock('../styles/manifest', () => ({
  getStyleAsset: (id: string) => ({ id, category: 'arrow', thumbUrl: 't', displayUrl: `/d/${id}.webp`, aspectRatio: 2 }),
}));
// One decoration, with stable ops, so selecting it flips the toolbar.
const deco = { id: 'dec1', assetId: 'arrow-01', xPct: 0.4, yPx: 80, widthPct: 0.2, rotation: 0, z: 1 };
vi.mock('../decorations/useDecorations', () => ({
  useDecorations: () => ({
    decorations: [deco],
    update: vi.fn(), remove: vi.fn(), duplicate: vi.fn(),
    bringToFront: vi.fn(), sendToBack: vi.fn(),
  }),
}));

import { NotepadEditor } from './Editor';

afterEach(cleanup);

describe('NotepadEditor decoration toolbar swap (mobile)', () => {
  it('replaces the formatting toolbar with the decoration toolbar when a decoration is selected', () => {
    const { getByTestId, queryByTestId, container } = render(
      <NotepadEditor toolbarPlacement="bottom" toolbarBottomOffset={120} />,
    );
    // Formatting toolbar visible, decoration toolbar absent before selection.
    expect(container.querySelector('[data-toolbar-placement]')).not.toBeNull();
    expect(queryByTestId('decoration-toolbar')).toBeNull();

    // Select the decoration via its body island.
    fireEvent.pointerDown(getByTestId('decoration-body-dec1'), { clientX: 0, clientY: 0, pointerId: 1 });

    // Now the decoration toolbar is shown and the formatting toolbar is gone.
    expect(getByTestId('decoration-toolbar')).not.toBeNull();
    expect(container.querySelector('[data-toolbar-placement]')).toBeNull();
  });
});
```

> If `useDecorations` lives at a different path or the hook name differs, adjust the `vi.mock` path to match the real import in `Editor.tsx` (grep `useDecorations` in `Editor.tsx`). The decoration body testid is `decoration-body-<id>` (see `DecorationItem`).

- [ ] **Step 3: Run the test (expect fail first if you scaffold the test before the wiring; here wiring is Step 1, so expect PASS)**

Run: `npx vitest run src/notepad/components/Editor.decoration-toolbar.test.tsx`
Expected: PASS. If the decoration body isn't found, the `useDecorations` mock path is wrong — fix per the note above and re-run.

- [ ] **Step 4: Full suite + typecheck**

Run: `npm test && tsc -b`
Expected: The decoration + editor suites pass. Pre-existing failures noted in the baseline (`Editor.toolbar-placement` only if it was already red, `garden-scene`, `force-sphere.test.ts` tsc errors) are unchanged — confirm you added ZERO new failures, not that the whole repo is green.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/components/Editor.tsx src/notepad/components/Editor.decoration-toolbar.test.tsx
git commit -m "feat(editor): swap in contextual decoration toolbar on mobile selection"
```

---

## Task 10: Reduced-motion-safe snap pulse (visual feedback) + manual mobile verification

A brief pulse on the rotate handle when a snap occurs, suppressed under `prefers-reduced-motion`. (The angle badge already updates; this adds a subtle visual tick since iOS has no haptics.)

**Files:**
- Modify: `src/notepad/decorations/DecorationItem.tsx`
- Test: `src/notepad/decorations/DecorationItem.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it('mobile: marks the rotate handle as snapped at a cardinal angle (drives the pulse)', () => {
  const h = handlers();
  const { getByLabelText, getByTestId } = render(<DecorationItem decoration={d} selected mobile {...h} />);
  const handle = getByLabelText('Rotate decoration');
  fireEvent.pointerDown(handle, { clientX: 10, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 7.31, clientY: 6.82, pointerId: 1 }); // ~43 -> snaps 45
  // The angle badge reflects the snapped value; its data-snapped flag is set.
  expect(getByTestId('decoration-angle-badge-a').getAttribute('data-snapped')).toBe('true');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx -t "snapped at a cardinal"`
Expected: FAIL — no `data-snapped` attribute.

- [ ] **Step 3: Implement**

Track whether the current live angle is on a snap multiple, and expose it on the badge. Extend the badge state to a small object:

```ts
const [liveAngle, setLiveAngle] = useState<{ deg: number; snapped: boolean } | null>(null);
```

Update `rotateMove` and the pinch path to set `{ deg, snapped }` (snapped when the value is a multiple of `SNAP.step`):

```ts
    const next = mobile ? snapRotation(raw) : raw;
    if (mobile) setLiveAngle({ deg: next, snapped: next % SNAP.step === 0 });
    onChange({ ...d, rotation: next });
```

Update the badge JSX to read the object and carry the flag + a reduced-motion-guarded pulse class:

```tsx
          {mobile && liveAngle !== null && (
            <div
              data-testid={`decoration-angle-badge-${d.id}`}
              data-snapped={liveAngle.snapped ? 'true' : 'false'}
              className={liveAngle.snapped ? 'decoration-snap-pulse' : undefined}
              style={{
                position: 'absolute', top: -58, left: 'calc(50% + 26px)',
                background: '#fff', border: '1px solid var(--pale-stone)', borderRadius: 4,
                padding: '1px 5px', fontSize: 11, color: 'var(--charred)',
                fontFamily: 'Outfit, sans-serif', pointerEvents: 'none', whiteSpace: 'nowrap',
              }}
            >
              {Math.round(liveAngle.deg)}&deg;
            </div>
          )}
```

Update `rotateEnd` to clear via `setLiveAngle(null)` (already does). Add the pulse keyframes to the app stylesheet (the same global CSS that holds other notepad styles — grep for `.notepad-editor` to find it, e.g. `src/index.css` or `src/notepad/notepad.css`):

```css
@keyframes decoration-snap-pulse-kf {
  0% { transform: scale(1); }
  50% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.decoration-snap-pulse { animation: decoration-snap-pulse-kf 140ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  .decoration-snap-pulse { animation: none; }
}
```

- [ ] **Step 4: Run to verify pass + typecheck**

Run: `npx vitest run src/notepad/decorations/DecorationItem.test.tsx && tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 5: Manual mobile verification**

Run the app (`npm run dev` or the project's run skill) and open a note on a phone-sized viewport (DevTools device mode / real iOS Safari at livepsalms.com preview). Verify:
1. Tapping a decoration selects it without nudging; the bottom bar swaps to the decoration toolbar.
2. All corner + rotate handles are easy to grab with a finger.
3. Rotating snaps at 0/45/90… with the angle badge updating; it does not feel twitchy.
4. The decoration toolbar never clips off-screen, even with a decoration near the top.
5. Done returns to the formatting toolbar.
6. On desktop, decoration editing is unchanged (floating pill, single corner handle, free rotation).

- [ ] **Step 6: Commit**

```bash
git add src/notepad/decorations/DecorationItem.tsx src/notepad/decorations/DecorationItem.test.tsx src/index.css
git commit -m "feat(decorations): reduced-motion-safe snap pulse on the angle badge"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** drag threshold (Task 4), 44px handles + 4 corners (Tasks 2,5), rotation radius + snap + badge + pinch snap (Tasks 1,6), contextual bottom toolbar replacing the editor toolbar (Tasks 8,9), floating pill removed on mobile (Task 7), snap feedback w/ iOS-honest haptics + reduced motion (Tasks 6,10), desktop-unchanged regressions (Tasks 3,4,5,6,7), mobile gating on `isBottomToolbar` (Task 3 + 9). All spec sections map to a task.
- **Type consistency:** `ResizeCorner` defined in Task 2 and consumed in Task 5; `snapAngle` signature `{ step, threshold }` used identically in Tasks 1 and 6; `DecorationToolbar` Props defined in Task 8 and consumed with matching names in Task 9; `liveAngle` shape upgraded once (Task 6 → Task 10) with all readers updated in the same task.
- **Placeholder scan:** none — every code step shows complete code; two verification notes (lucide icon existence, `useDecorations` mock path) tell the engineer exactly how to confirm against the real repo.
```
