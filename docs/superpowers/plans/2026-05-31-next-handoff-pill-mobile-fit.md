# Next-Devotion Handoff Pill — Mobile Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refit the next-devotion handoff pill on mobile so each devotion's italic display title sits inside the silhouette as a curated two-line block (Hope shrinks to fit), with legible eyebrow and scripture metadata.

**Architecture:** Two surgical changes. (1) Extend the `Devotion` interface in `src/data/devotions.ts` with two optional fields — `mobileTitleBreak` (word index for explicit `<br>`) and `mobileTitleScale` (`'shrink'`) — and populate them per devotion. (2) In `src/components/sections/NextDevotionHandoff.tsx`, the `Pill` mobile branch reads those fields, splits the title into curated lines via an exported `applyCuratedBreak` helper, and uses the new sizing tokens (aspect `11/4`, padding `0 10%`, title `17px` or `14px`, eyebrow + scripture `9px`, logo `w-[19px]` / `translateY(14px)`). Desktop branch is untouched.

**Tech Stack:** TypeScript, React 18, Vitest + jsdom + @testing-library/react, Tailwind (utility classes only — no token file changes).

**Spec:** [docs/superpowers/specs/2026-05-31-next-handoff-pill-mobile-fit-design.md](../specs/2026-05-31-next-handoff-pill-mobile-fit-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/data/devotions.ts` | Modify | Add `mobileTitleBreak?` and `mobileTitleScale?` to `Devotion`; populate per devotion. |
| `src/components/sections/NextDevotionHandoff.tsx` | Modify | Export `applyCuratedBreak`; update `Pill` mobile branch sizing + title render. |
| `src/components/sections/NextDevotionHandoff.test.tsx` | Create | Unit tests for `applyCuratedBreak` + component-level mobile rendering assertions. |

No other files change. Desktop branch of `NextDevotionHandoff.tsx`, hooks (`usePillExpandNavigation`), GSAP entrance, scroll choreography, and `hero-mask-clip` SVG are out of scope.

---

## Task 1: Extend the Devotion interface and populate per-devotion config

**Files:**
- Modify: `src/data/devotions.ts:7-14` (interface) and `:16-90` (each devotion entry)

- [ ] **Step 1: Read the current Devotion interface and entries to confirm the exact shape**

Run: `head -90 src/data/devotions.ts`
Expected: confirms the six devotion keys (peace, hope, strength, wholeness, purpose, connection) and the `Devotion` interface ending at line 14.

- [ ] **Step 2: Extend the `Devotion` interface**

Edit `src/data/devotions.ts`, replace the `Devotion` interface block:

```ts
export interface Devotion {
  id: string;
  label: string;
  title: string;
  scriptureRef: string;
  monogram: string;
  firstMoodboardImage: string;
  /**
   * Mobile-only curated line break for the next-handoff pill title.
   * Word index (1-indexed) to insert a `<br>` after when rendering on mobile.
   * Desktop ignores this. Undefined = no curated break (natural wrap).
   */
  mobileTitleBreak?: number;
  /**
   * Mobile-only title scale override for long titles that cannot fit at the
   * default size. `'shrink'` drops the mobile title from 17px to 14px.
   */
  mobileTitleScale?: 'shrink';
}
```

- [ ] **Step 3: Populate `mobileTitleBreak` on each devotion**

Edit each devotion record in `src/data/devotions.ts`:

- `peace` — add `mobileTitleBreak: 2,`
- `hope` — add `mobileTitleBreak: 3,` and `mobileTitleScale: 'shrink',`
- `strength` — add `mobileTitleBreak: 2,`
- `wholeness` — add `mobileTitleBreak: 2,`
- `purpose` — add `mobileTitleBreak: 2,`
- `connection` — add `mobileTitleBreak: 1,`

Example (peace):

```ts
peace: {
  id: 'peace',
  label: 'Restoration of Peace',
  title: 'Beside Still Waters',
  scriptureRef: 'Psalm 23:2–3',
  monogram: 'PE',
  firstMoodboardImage: '/restoration1/image1.png',
  mobileTitleBreak: 2,
},
```

Example (hope):

```ts
hope: {
  id: 'hope',
  label: 'The Restoration of Hope',
  title: 'A Future You Cannot See Yet',
  scriptureRef: 'Jeremiah 29:11',
  monogram: 'HO',
  firstMoodboardImage: '/restoration3/image1.png',
  mobileTitleBreak: 3,
  mobileTitleScale: 'shrink',
},
```

Apply the same shape to strength / wholeness / purpose / connection using their respective break index.

- [ ] **Step 4: Type-check the project to confirm no Devotion consumers broke**

Run: `npx tsc --noEmit`
Expected: PASS (the new fields are optional; no consumer needs to provide them).

- [ ] **Step 5: Commit**

```bash
git add src/data/devotions.ts
git commit -m "$(cat <<'EOF'
feat(devotions): add mobileTitleBreak + mobileTitleScale per devotion

Curated line-break metadata used by the next-handoff pill on mobile.
Both fields optional — desktop ignores them and other consumers fall
back to natural CSS wrapping. Hope gets shrink because six words
can't fit on two lines at the default 17px mobile size.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Export `applyCuratedBreak` helper with unit tests

**Files:**
- Create: `src/components/sections/NextDevotionHandoff.test.tsx`
- Modify: `src/components/sections/NextDevotionHandoff.tsx:1-10` (add helper export near top of file, after imports)

- [ ] **Step 1: Write the failing unit tests**

Create `src/components/sections/NextDevotionHandoff.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { applyCuratedBreak } from './NextDevotionHandoff';

describe('applyCuratedBreak', () => {
  it('returns the original title when breakAfter is undefined', () => {
    expect(applyCuratedBreak('Beside Still Waters', undefined)).toBe('Beside Still Waters');
  });

  it('returns the original title when breakAfter is 0', () => {
    expect(applyCuratedBreak('Beside Still Waters', 0)).toBe('Beside Still Waters');
  });

  it('splits at word index 2 into two segments', () => {
    expect(applyCuratedBreak('Beside Still Waters', 2)).toEqual(['Beside Still', 'Waters']);
  });

  it('splits at word index 1 (forces 2-line break on a 2-word title)', () => {
    expect(applyCuratedBreak('Brought Near', 1)).toEqual(['Brought', 'Near']);
  });

  it('splits a long title at word index 3', () => {
    expect(applyCuratedBreak('A Future You Cannot See Yet', 3)).toEqual([
      'A Future You',
      'Cannot See Yet',
    ]);
  });

  it('returns the original title when breakAfter equals word count', () => {
    expect(applyCuratedBreak('Beside Still Waters', 3)).toBe('Beside Still Waters');
  });

  it('returns the original title when breakAfter exceeds word count', () => {
    expect(applyCuratedBreak('Beside Still Waters', 99)).toBe('Beside Still Waters');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: FAIL — module has no export `applyCuratedBreak`.

- [ ] **Step 3: Implement and export the helper**

Edit `src/components/sections/NextDevotionHandoff.tsx`. After the existing imports block (after line 10, before `function useReducedMotion`), insert:

```tsx
/**
 * Returns the title unchanged when no curated break is configured, or a
 * two-segment tuple [before, after] when a 1-indexed word boundary is given.
 *
 * Used by the mobile Pill branch to render `<>{a}<br/>{b}</>`. Desktop never
 * calls this — it always renders the title as a single span.
 *
 * Exported for unit-testing in NextDevotionHandoff.test.tsx.
 */
export function applyCuratedBreak(
  title: string,
  breakAfter: number | undefined,
): string | [string, string] {
  if (!breakAfter || breakAfter <= 0) return title;
  const words = title.split(' ');
  if (breakAfter >= words.length) return title;
  return [
    words.slice(0, breakAfter).join(' '),
    words.slice(breakAfter).join(' '),
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: PASS — all 7 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx src/components/sections/NextDevotionHandoff.test.tsx
git commit -m "$(cat <<'EOF'
feat(next-handoff): applyCuratedBreak helper + unit tests

Pure helper that splits a title into a [before, after] tuple at a
1-indexed word boundary, used by the mobile pill branch for curated
display breaks. Returns the title unchanged for undefined / 0 / OOR
input so consumers can fall back to natural CSS wrap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Render curated break in Pill mobile branch + component test

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx:377-389` (mobile title render block)
- Modify: `src/components/sections/NextDevotionHandoff.test.tsx` (append component test)

- [ ] **Step 1: Append a failing component test for the curated-break render**

Open `src/components/sections/NextDevotionHandoff.test.tsx` and append below the existing `describe` block:

```tsx
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach } from 'vitest';
import { NextDevotionHandoff } from './NextDevotionHandoff';
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';

afterEach(cleanup);

const baseProject: Project = {
  id: 'peace',
  name: 'Peace',
  thumbnail: '/restoration1/image1.png',
  overlayColor: '#6b7370',
} as unknown as Project;

const peaceDevotion: Devotion = {
  id: 'peace',
  label: 'Restoration of Peace',
  title: 'Beside Still Waters',
  scriptureRef: 'Psalm 23:2–3',
  monogram: 'PE',
  firstMoodboardImage: '/restoration1/image1.png',
  mobileTitleBreak: 2,
};

function renderHandoff(devotion: Devotion = peaceDevotion) {
  return render(
    <MemoryRouter>
      <NextDevotionHandoff
        currentProject={baseProject}
        nextProject={baseProject}
        nextDevotion={devotion}
        variant="mobile"
      />
    </MemoryRouter>,
  );
}

describe('NextDevotionHandoff mobile pill — curated break', () => {
  it('renders the title as two segments split at the configured word index', () => {
    renderHandoff();
    // Both segments should appear separately in the DOM
    expect(screen.getByText('Beside Still')).toBeDefined();
    expect(screen.getByText('Waters')).toBeDefined();
    // And the un-split title should NOT appear as a single text node
    expect(screen.queryByText('Beside Still Waters')).toBeNull();
  });

  it('renders the title as one node when mobileTitleBreak is undefined', () => {
    renderHandoff({ ...peaceDevotion, mobileTitleBreak: undefined });
    expect(screen.getByText('Beside Still Waters')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: FAIL on "renders the title as two segments split…" because the mobile branch still renders `{nextDevotion.title}` as a single span. The "one node" case may pass — only the new case fails.

- [ ] **Step 3: Update the mobile title render block**

In `src/components/sections/NextDevotionHandoff.tsx`, locate the Left column title `<span>` at approximately line 377-388:

```tsx
<span
  className="next-handoff-title"
  style={{
    fontStyle: 'italic',
    fontWeight: 300,
    fontSize: isMobile ? '12px' : '28px',
    lineHeight: 1,
    color: 'rgba(255,255,255,0.95)',
  }}
>
  {nextDevotion.title}
</span>
```

Replace its children with a curated-break render. Use a local `const` immediately above the JSX return (still inside the `Pill` function body, just before `return (`):

```tsx
const titleNode = (() => {
  if (!isMobile) return nextDevotion.title;
  const segments = applyCuratedBreak(nextDevotion.title, nextDevotion.mobileTitleBreak);
  if (typeof segments === 'string') return segments;
  return (
    <>
      {segments[0]}
      <br />
      {segments[1]}
    </>
  );
})();
```

Then in the JSX, replace `{nextDevotion.title}` with `{titleNode}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: PASS — all helper tests stay green, both component tests now pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx src/components/sections/NextDevotionHandoff.test.tsx
git commit -m "$(cat <<'EOF'
feat(next-handoff): curated title break on mobile pill

Mobile Pill branch consumes Devotion.mobileTitleBreak to render the
title as two stacked segments separated by <br/>. Desktop branch and
the no-break fallback continue to render a single text node.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Apply `mobileTitleScale: 'shrink'` to the title font size

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx:377-388` (title style)
- Modify: `src/components/sections/NextDevotionHandoff.test.tsx` (append shrink test)

- [ ] **Step 1: Append a failing test for the shrink size**

Append to the "NextDevotionHandoff mobile pill — curated break" describe block in `NextDevotionHandoff.test.tsx` (or create a new sibling describe):

```tsx
describe('NextDevotionHandoff mobile pill — title scale', () => {
  it('uses 17px title by default on mobile', () => {
    renderHandoff();
    const title = document.querySelector('.next-handoff-title') as HTMLElement;
    expect(title).toBeTruthy();
    expect(title.style.fontSize).toBe('17px');
  });

  it('shrinks the title to 14px when mobileTitleScale is "shrink"', () => {
    renderHandoff({
      ...peaceDevotion,
      title: 'A Future You Cannot See Yet',
      mobileTitleBreak: 3,
      mobileTitleScale: 'shrink',
    });
    const title = document.querySelector('.next-handoff-title') as HTMLElement;
    expect(title).toBeTruthy();
    expect(title.style.fontSize).toBe('14px');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: FAIL — both new tests fail because current mobile title is `12px`, neither `17px` nor `14px`.

- [ ] **Step 3: Update the title style logic**

In `src/components/sections/NextDevotionHandoff.tsx`, change the title `<span>` style block so `fontSize` and `lineHeight` are mobile-scale-aware:

```tsx
<span
  className="next-handoff-title"
  style={{
    fontStyle: 'italic',
    fontWeight: 300,
    fontSize: isMobile
      ? (nextDevotion.mobileTitleScale === 'shrink' ? '14px' : '17px')
      : '28px',
    lineHeight: isMobile
      ? (nextDevotion.mobileTitleScale === 'shrink' ? 1.06 : 1.05)
      : 1,
    color: 'rgba(255,255,255,0.95)',
  }}
>
  {titleNode}
</span>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: PASS — title size cases green, break tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx src/components/sections/NextDevotionHandoff.test.tsx
git commit -m "$(cat <<'EOF'
feat(next-handoff): mobile title 17px default + 14px shrink

Mobile title font-size bumps from 12px to 17px italic display, with
opt-in 14px shrink for Devotion.mobileTitleScale === 'shrink'. Line
height tracks the size. Desktop 28px unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update remaining mobile pill visual tokens (aspect, padding, eyebrow, scripture, logo)

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx:312-340` (pillStyle, contentStyle)
- Modify: `src/components/sections/NextDevotionHandoff.tsx:365-376` (eyebrow style)
- Modify: `src/components/sections/NextDevotionHandoff.tsx:393-401` (logo)
- Modify: `src/components/sections/NextDevotionHandoff.tsx:404-426` (right-column meta styles)
- Modify: `src/components/sections/NextDevotionHandoff.test.tsx` (append visual-token tests)

- [ ] **Step 1: Append failing tests for the visual tokens**

Append to `NextDevotionHandoff.test.tsx`:

```tsx
describe('NextDevotionHandoff mobile pill — visual tokens', () => {
  it('uses 11/4 aspect ratio and 0 10% padding on mobile', () => {
    renderHandoff();
    const pill = document.querySelector('.next-handoff-pill') as HTMLElement;
    const content = document.querySelector('.next-handoff-pill-content') as HTMLElement;
    expect(pill.style.aspectRatio).toBe('11 / 4');
    expect(content.style.padding).toBe('0 10%');
  });

  it('uses 9px eyebrow and 9px scripture metadata on mobile', () => {
    renderHandoff();
    const eyebrow = document.querySelector('.next-handoff-label') as HTMLElement;
    expect(eyebrow.style.fontSize).toBe('9px');
    // Right-column meta lines also at 9px
    const rightColMeta = document.querySelectorAll(
      '.next-handoff-pill-content > div:last-child > span',
    );
    rightColMeta.forEach((el) => {
      expect((el as HTMLElement).style.fontSize).toBe('9px');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: FAIL on the visual-tokens describe — current mobile uses `11/3.2`, `0 14%`, and `6px`.

- [ ] **Step 3: Update `pillStyle` (around line 312-317)**

Replace:

```tsx
const pillStyle: React.CSSProperties = {
  clipPath: 'url(#hero-mask-clip)',
  width: isMobile ? '92%' : 'min(62vw, 920px)',
  aspectRatio: '11 / 3.2',
  transform: 'translate(-50%, -50%)',
};
```

With:

```tsx
const pillStyle: React.CSSProperties = {
  clipPath: 'url(#hero-mask-clip)',
  width: isMobile ? '92%' : 'min(62vw, 920px)',
  aspectRatio: isMobile ? '11 / 4' : '11 / 3.2',
  transform: 'translate(-50%, -50%)',
};
```

- [ ] **Step 4: Update `contentStyle` padding (around line 330-340)**

Replace `padding: isMobile ? '0 14%' : '0 10%'` with:

```tsx
padding: isMobile ? '0 10%' : '0 10%',
```

(Both branches now `0 10%` — kept as a ternary for explicit intent.)

- [ ] **Step 5: Update the left-column eyebrow `<span>` style (around line 365-376)**

In the eyebrow style object:

```tsx
fontSize: isMobile ? '9px' : '10px',
letterSpacing: isMobile ? '0.22em' : '0.25em',
```

(Was `6px` / `0.25em`.)

- [ ] **Step 6: Update the center logo (around line 399-401)**

Replace:

```tsx
className={`next-handoff-logo opacity-25 invert pointer-events-none ${isMobile ? 'w-5' : 'w-10'}`}
style={{ transform: isMobile ? 'translateY(12px)' : 'translateY(22px)' }}
```

With:

```tsx
className={`next-handoff-logo opacity-25 invert pointer-events-none ${isMobile ? 'w-[19px]' : 'w-10'}`}
style={{ transform: isMobile ? 'translateY(14px)' : 'translateY(22px)' }}
```

- [ ] **Step 7: Update the right-column meta `<span>` styles (around line 404-426)**

Both right-column spans currently set `fontSize: isMobile ? '6px' : '10px'`. Change both to:

```tsx
fontSize: isMobile ? '9px' : '10px',
```

Letter-spacing stays at `0.2em` on both.

- [ ] **Step 8: Run all tests**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: PASS — visual-token cases green, all earlier cases still green.

- [ ] **Step 9: Type-check the project end-to-end**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx src/components/sections/NextDevotionHandoff.test.tsx
git commit -m "$(cat <<'EOF'
feat(next-handoff): mobile pill visual tokens (C2 editorial)

Mobile-only tweaks: aspect-ratio 11:4 (was 11:3.2), inner padding
0 10% (was 0 14%), eyebrow + scripture 9px / 0.22em (was 6px /
0.25em), logo w-[19px] / translateY(14px). Desktop unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Desktop guard test — confirm no desktop regression

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.test.tsx` (append a desktop describe)

- [ ] **Step 1: Append the desktop guard test**

Append to `NextDevotionHandoff.test.tsx`:

```tsx
describe('NextDevotionHandoff — desktop guard', () => {
  it('renders 28px title and 11/3.2 aspect on desktop, ignoring mobileTitleBreak', () => {
    render(
      <MemoryRouter>
        <NextDevotionHandoff
          currentProject={baseProject}
          nextProject={baseProject}
          nextDevotion={peaceDevotion}
          variant="desktop"
          inHorizontalTrack
        />
      </MemoryRouter>,
    );

    // Desktop must NOT split the title — the curated break is mobile-only
    expect(screen.getAllByText('Beside Still Waters').length).toBeGreaterThan(0);
    expect(screen.queryByText('Waters')).toBeNull();

    const pill = document.querySelector('.next-handoff-pill') as HTMLElement;
    expect(pill.style.aspectRatio).toBe('11 / 3.2');

    const title = document.querySelector('.next-handoff-title') as HTMLElement;
    expect(title.style.fontSize).toBe('28px');

    const eyebrow = document.querySelector('.next-handoff-label') as HTMLElement;
    expect(eyebrow.style.fontSize).toBe('10px');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/components/sections/NextDevotionHandoff.test.tsx`
Expected: PASS — desktop guard green, all earlier cases still green.

- [ ] **Step 3: Run the full test suite to catch any neighbor regressions**

Run: `npm test`
Expected: PASS for all suites. If `MobileProjectTile.test.tsx` or `HeroMobile.test.tsx` fail, they are reading raw `nextDevotion.title` strings and our changes do not mutate that — investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.test.tsx
git commit -m "$(cat <<'EOF'
test(next-handoff): desktop guard — no regression on tokens or render

Asserts desktop title stays at 28px, aspect stays at 11:3.2, eyebrow
stays at 10px, and the curated break is ignored when variant='desktop'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Manual visual QA on the dev server

**Files:** none modified — verification only.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: dev server boots, prints local URL (e.g. `http://localhost:5173`).

- [ ] **Step 2: Open Chrome DevTools, switch to a mobile viewport (390 × 844, iPhone 14 preset)**

Navigate to the app root, scroll through to surface a `NextDevotionHandoff` zone for each devotion.

- [ ] **Step 3: Verify each of the six devotions matches the C2 reference**

For each devotion route, confirm:
- Title sits on two lines using the curated break (or three for Hope at 14px) — no descender clipped by the pill bottom.
- Eyebrow `DEVOTION` and scripture `<REF> ↗` are legible at 9px.
- Logo center is visually centered in the pill body (not the notch).
- Pill silhouette still reads as a "pill", not a chunky tab.

Cross-check against the brainstorm reference at `.superpowers/brainstorm/59771-1780279136/content/03-all-titles.html`.

- [ ] **Step 4: Repeat at 360 px (smallest target) and 414 px viewports**

Confirm no overflow at 360, no awkward over-spacing at 414.

- [ ] **Step 5: Tap the pill on one devotion to verify the fullscreen expand-and-navigate flow**

Expected: pill expands to fullscreen and navigates to the next devotion's page. No visual jank or layout snap during the transition.

- [ ] **Step 6: Switch to desktop viewport and confirm zero visual change vs. before this branch**

Use git to compare:
```bash
git stash
# screenshot desktop
git stash pop
# screenshot desktop again
```
Or eyeball against `main`. Desktop branch should be pixel-identical.

- [ ] **Step 7: Stop the dev server**

Stop the `npm run dev` process (Ctrl-C in the terminal that started it).

- [ ] **Step 8: No commit — this task is verification only.**

If issues are found, file them as follow-ups or restart the relevant prior task with a fix.

---

## Self-Review

**Spec coverage:**
- Pill aspect ratio `11/4` on mobile → Task 5 step 3 ✓
- Inner padding `0 10%` → Task 5 step 4 ✓
- Eyebrow `9px / 0.22em` → Task 5 step 5 + test in step 1 ✓
- Title default `17px / lh 1.05` → Task 4 ✓
- Title shrink `14px / lh 1.06` (Hope) → Task 4 ✓
- Scripture `9px / 0.2em` → Task 5 step 7 ✓
- Logo `w-[19px] / translateY(14px)` → Task 5 step 6 ✓
- `mobileTitleBreak` + `mobileTitleScale` data fields → Task 1 ✓
- `applyCuratedBreak` helper + curated render → Task 2 + Task 3 ✓
- Graceful fallback when `mobileTitleBreak` undefined → Task 2 step 1 case + Task 3 step 1 case ✓
- Desktop unchanged → Task 6 guard ✓
- Visual QA at 360 / 390 / 414 → Task 7 ✓

**Placeholder scan:** no TBD / TODO / "implement later" / "appropriate error handling" / unresolved references.

**Type consistency:** `applyCuratedBreak` signature and return type are the same in Task 2 and Task 3. `Devotion` fields used in tests (`mobileTitleBreak`, `mobileTitleScale: 'shrink'`) match the interface declared in Task 1.

No issues found.
