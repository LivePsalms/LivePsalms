# Next Devotion Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Zone 8 ("Next Devotion Hero") across all 11 devotions with a shared cinematic `NextDevotionHandoff` component — a 50/50 split-image composition with a centered, hero-mask-clipped pill that expands to fullscreen on click.

**Architecture:** New `src/data/devotions.ts` carries per-devotion metadata (title, label, scripture, monogram, firstMoodboardImage). New `src/components/ui-custom/HeroMaskClipDef.tsx` extracts the home-hero `clipPath` def so MoodBoard can reuse it. New `src/components/sections/NextDevotionHandoff.tsx` renders the split + pill, owns its scroll-triggered entrance, idle loop, and pill-expand click. Click bypasses `RouteTransition` entirely — `useNavigate()` is called inside a fixed-position portaled pill that acts as the color cover during route swap.

**Tech Stack:** React 19, TypeScript, react-router-dom v7, GSAP 3 (ScrollTrigger), Tailwind, Vite, Vitest. Existing primitives: `LineMaskReveal`, `PhotoDevelopImage`.

**Spec:** [docs/superpowers/specs/2026-05-19-next-devotion-handoff-design.md](../specs/2026-05-19-next-devotion-handoff-design.md)

---

## File Structure

### New files

| Path | Purpose |
|---|---|
| `src/data/devotions.ts` | Per-devotion metadata keyed by project id |
| `src/data/devotions.test.ts` | Data completeness + shape tests |
| `src/components/ui-custom/HeroMaskClipDef.tsx` | Hidden SVG def for the `hero-mask-clip` path |
| `src/components/sections/NextDevotionHandoff.tsx` | Shared zone component (desktop + mobile variants) |

### Modified files

| Path | Change |
|---|---|
| `src/components/sections/Hero.tsx` | Replace inline `<clipPath id="hero-mask-clip">` with `<HeroMaskClipDef />` |
| `src/components/sections/MoodBoard.tsx` | Mount `<HeroMaskClipDef />` once near top; replace all 11 desktop Zone 8 blocks; replace all 11 mobile last-section blocks |

### Untouched

`src/data/projects.ts`, `src/types/index.ts`, `src/App.tsx`, all `transitions/*` files.

---

## Branch + Worktree

This plan assumes you're working on a branch off `main`. The current branch is `deepen-architecture` — feel free to continue on it, or follow [superpowers:using-git-worktrees](../../../.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/using-git-worktrees/SKILL.md) for an isolated worktree before starting Task 1.

---

## Task 1: Devotion data file

**Files:**
- Create: `src/data/devotions.ts`
- Create: `src/data/devotions.test.ts`

Sources for the strings (all values below are verified from the codebase as of 2026-05-19):
- `label`, `title`, `scriptureRef` — verbatim from the inline conditionals in [src/components/sections/PurposeDetail.tsx:75-272](../../../src/components/sections/PurposeDetail.tsx#L75-L272)
- `firstMoodboardImage` — for the 9 devotions that use an image-map const, this is the `.hero` field of that const ([src/components/sections/MoodBoard.tsx:65-225](../../../src/components/sections/MoodBoard.tsx)). For Peace and Hope (which don't use a const), it's the first image referenced in their respective Zones function.
- `monogram` — 2-letter codes per spec §4.1

- [ ] **Step 1: Write the failing test** — `src/data/devotions.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { devotions, type Devotion } from './devotions';

const REQUIRED_IDS = [
  'restoration1',
  'restoration3',
  'strength',
  'wholeness',
  'purpose',
  'connection',
  'identity',
  'joy',
  'forgiveness',
  'surrender',
  'trust',
];

describe('devotions data', () => {
  it('has an entry for each of the 11 devotion project ids', () => {
    for (const id of REQUIRED_IDS) {
      expect(devotions[id], `missing devotion for ${id}`).toBeDefined();
    }
  });

  it('every devotion has non-empty title, label, scriptureRef, monogram, firstMoodboardImage', () => {
    for (const id of REQUIRED_IDS) {
      const d: Devotion = devotions[id];
      expect(d.title.length, `${id}.title`).toBeGreaterThan(0);
      expect(d.label.length, `${id}.label`).toBeGreaterThan(0);
      expect(d.scriptureRef.length, `${id}.scriptureRef`).toBeGreaterThan(0);
      expect(d.monogram.length, `${id}.monogram`).toBe(2);
      expect(d.firstMoodboardImage.startsWith('/'), `${id}.firstMoodboardImage`).toBe(true);
    }
  });

  it('monograms are uppercase ASCII letters', () => {
    for (const id of REQUIRED_IDS) {
      expect(devotions[id].monogram, `${id}.monogram`).toMatch(/^[A-Z]{2}$/);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- src/data/devotions.test.ts
```

Expected: FAIL with "Cannot find module './devotions'" or similar.

- [ ] **Step 3: Create `src/data/devotions.ts`**

```ts
export interface Devotion {
  id: string;
  label: string;
  title: string;
  scriptureRef: string;
  monogram: string;
  firstMoodboardImage: string;
}

export const devotions: Record<string, Devotion> = {
  restoration1: {
    id: 'restoration1',
    label: 'Restoration of Peace',
    title: 'Beside Still Waters',
    scriptureRef: 'Psalm 23:2–3',
    monogram: 'PE',
    firstMoodboardImage: '/restoration1/image1.png',
  },
  restoration3: {
    id: 'restoration3',
    label: 'The Restoration of Hope',
    title: 'A Future You Cannot See Yet',
    scriptureRef: 'Jeremiah 29:11',
    monogram: 'HO',
    firstMoodboardImage: '/restoration3/image1.png',
  },
  strength: {
    id: 'strength',
    label: 'The Restoration of Strength',
    title: 'Wings Like Eagles',
    scriptureRef: 'Isaiah 40:31',
    monogram: 'ST',
    firstMoodboardImage: '/restoration5/hf_20260414_210624_51692a60-f0b4-4235-8fe5-ebf51bae7dff.png',
  },
  wholeness: {
    id: 'wholeness',
    label: 'The Restoration of Wholeness',
    title: 'The Years Restored',
    scriptureRef: 'Joel 2:25–26',
    monogram: 'WH',
    firstMoodboardImage: '/restoration6/hf_20260414_231106_4132533c-178d-4385-a431-2def24758ac8.png',
  },
  purpose: {
    id: 'purpose',
    label: 'The Restoration of Purpose',
    title: 'All Things Working',
    scriptureRef: 'Romans 8:28',
    monogram: 'PU',
    firstMoodboardImage: '/restoration7/hf_20260415_190342_341ba0fb-3636-4645-aa20-40f7c56ecf5c.png',
  },
  connection: {
    id: 'connection',
    label: 'The Restoration of Connection',
    title: 'Brought Near',
    scriptureRef: 'Ephesians 2:13',
    monogram: 'CN',
    firstMoodboardImage: '/restoration8/hf_20260416_074854_c5387c7f-6f07-4b15-bf62-4afdddee9149.png',
  },
  identity: {
    id: 'identity',
    label: 'The Restoration of Identity',
    title: 'The New Has Come',
    scriptureRef: '2 Corinthians 5:17',
    monogram: 'ID',
    firstMoodboardImage: '/restoration9/hf_20260417_004042_2d78afd9-82c6-447b-93e1-d4df054daedf.png',
  },
  joy: {
    id: 'joy',
    label: 'The Restoration of Joy',
    title: 'Mouths Filled with Laughter',
    scriptureRef: 'Psalm 126:1–2',
    monogram: 'JY',
    firstMoodboardImage: '/restoration10/hf_20260417_160036_8cfcbbb9-be3c-41e1-90be-3a356eb8955c.png',
  },
  forgiveness: {
    id: 'forgiveness',
    label: 'The Serenity of Forgiveness',
    title: 'Let It Fall From Your Hands',
    scriptureRef: 'Ephesians 4:31–32',
    monogram: 'FG',
    firstMoodboardImage: '/serenity2/hf_20260417_180057_acab57fb-74d9-469f-b29b-a1b8af56ccd9.png',
  },
  surrender: {
    id: 'surrender',
    label: 'The Serenity of Surrender',
    title: 'Be Still and Know',
    scriptureRef: 'Psalm 46:10',
    monogram: 'SR',
    firstMoodboardImage: '/serenity3/hf_20260417_220039_093609a2-929e-4c7f-9cc7-a61440c6a2fa.png',
  },
  trust: {
    id: 'trust',
    label: 'The Serenity of Trust',
    title: 'The Path He Makes Straight',
    scriptureRef: 'Proverbs 3:5–6',
    monogram: 'TR',
    firstMoodboardImage: '/serenity5/IMG_3096.jpg',
  },
};
```

Add this comment block at the top of the file:

```ts
// TODO(handoff): values for `label`, `title`, `scriptureRef`, and
// `firstMoodboardImage` are duplicated from PurposeDetail.tsx and the
// per-devotion image-map consts in MoodBoard.tsx. A follow-up cleanup should
// make those files consume this data instead. Until then, keep this file in
// sync if you change the originals.
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- src/data/devotions.test.ts
```

Expected: PASS, 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/data/devotions.ts src/data/devotions.test.ts
git commit -m "feat(devotions): data file for next-devotion handoff

11 entries mirroring inline strings from PurposeDetail and MoodBoard. See
TODO at top of devotions.ts for the duplication note.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Extract HeroMaskClipDef

**Files:**
- Create: `src/components/ui-custom/HeroMaskClipDef.tsx`
- Modify: `src/components/sections/Hero.tsx:741-751`

- [ ] **Step 1: Create `src/components/ui-custom/HeroMaskClipDef.tsx`**

```tsx
/**
 * Hidden SVG def for the `hero-mask-clip` clipPath. Used by the home hero
 * masked image and by the NextDevotionHandoff pill. Mount in exactly one
 * place per render tree — Hero on the home route, MoodBoard on the detail
 * route. Both never mount together so no ID collision risk.
 */
export function HeroMaskClipDef() {
  return (
    <svg
      className="absolute -top-[999px] -left-[999px] w-0 h-0"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="hero-mask-clip" clipPathUnits="objectBoundingBox">
          <path d="M0.0998072 1H0.422076H0.749756C0.767072 1 0.774207 0.961783 0.77561 0.942675V0.807325C0.777053 0.743631 0.791844 0.731953 0.799059 0.734076H0.969813C0.996268 0.730255 1.00088 0.693206 0.999875 0.675159V0.0700637C0.999875 0.0254777 0.985045 0.00477707 0.977629 0H0.902473C0.854975 0 0.890448 0.138535 0.850165 0.138535H0.0204424C0.00408849 0.142357 0 0.180467 0 0.199045V0.410828C0 0.449045 0.0136283 0.46603 0.0204424 0.469745H0.0523086C0.0696245 0.471019 0.0735527 0.497877 0.0733523 0.511146V0.915605C0.0723903 0.983121 0.090588 1 0.0998072 1Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
```

- [ ] **Step 2: Replace inline def in Hero.tsx**

Open [src/components/sections/Hero.tsx](../../../src/components/sections/Hero.tsx). Find the existing block at lines 741-751:

```tsx
      {/* Hidden SVG defs for the mask clip-path */}
      <svg
        className="absolute -top-[999px] -left-[999px] w-0 h-0"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="hero-mask-clip" clipPathUnits="objectBoundingBox">
            <path d="M0.0998072 1H0.422076H0.749756C0.767072 1 0.774207 0.961783 0.77561 0.942675V0.807325C0.777053 0.743631 0.791844 0.731953 0.799059 0.734076H0.969813C0.996268 0.730255 1.00088 0.693206 0.999875 0.675159V0.0700637C0.999875 0.0254777 0.985045 0.00477707 0.977629 0H0.902473C0.854975 0 0.890448 0.138535 0.850165 0.138535H0.0204424C0.00408849 0.142357 0 0.180467 0 0.199045V0.410828C0 0.449045 0.0136283 0.46603 0.0204424 0.469745H0.0523086C0.0696245 0.471019 0.0735527 0.497877 0.0733523 0.511146V0.915605C0.0723903 0.983121 0.090588 1 0.0998072 1Z" />
          </clipPath>
        </defs>
      </svg>
```

Replace with:

```tsx
      {/* Hidden SVG defs for the mask clip-path */}
      <HeroMaskClipDef />
```

Add the import at the top of Hero.tsx (alphabetize within the ui-custom group):

```tsx
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';
```

- [ ] **Step 3: Verify the home page still renders the masked hero**

```bash
npm run dev
```

Open `http://localhost:5173/`. Scroll into the hero mask section. The notched-window masked image must still appear correctly. If it doesn't, the clipPath id is wrong somewhere — grep `Hero.tsx` for `url(#hero-mask-clip)` and confirm the consumer still matches the def.

Kill the dev server when verified.

- [ ] **Step 4: Run the test suite (full)**

```bash
npm test
```

Expected: PASS for everything (no new tests, no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui-custom/HeroMaskClipDef.tsx src/components/sections/Hero.tsx
git commit -m "refactor(hero-mask): extract clipPath def into shared component

NextDevotionHandoff (Task 3 of next-devotion-handoff plan) needs the same
clipPath. Pulling it out of Hero into a dedicated component so both routes
can mount it without copying the path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: NextDevotionHandoff — static shell

**Files:**
- Create: `src/components/sections/NextDevotionHandoff.tsx`

This task builds the visual shell only — no animations, no click handler, no portal. Just the layout.

- [ ] **Step 1: Create `src/components/sections/NextDevotionHandoff.tsx`**

```tsx
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';

interface NextDevotionHandoffProps {
  currentProject: Project;
  nextProject: Project;
  nextDevotion: Devotion;
  variant?: 'desktop' | 'mobile';
}

/**
 * Final zone of each devotion's moodboard. Renders a 50/50 split-image
 * composition behind a hero-mask-clipped pill containing the next devotion's
 * meta. On click (Task 7), the pill expands to fullscreen and navigates to
 * the next devotion page.
 */
export function NextDevotionHandoff({
  currentProject: _currentProject,
  nextProject,
  nextDevotion,
  variant = 'desktop',
}: NextDevotionHandoffProps) {
  // currentProject is reserved for future use (e.g. analytics, ABT).
  // Underscore prefix silences the unused-arg lint.

  if (variant === 'mobile') {
    return <MobileLayout nextProject={nextProject} nextDevotion={nextDevotion} />;
  }
  return <DesktopLayout nextProject={nextProject} nextDevotion={nextDevotion} />;
}

interface LayoutProps {
  nextProject: Project;
  nextDevotion: Devotion;
}

function DesktopLayout({ nextProject, nextDevotion }: LayoutProps) {
  return (
    <div
      className="next-handoff relative flex-shrink-0 h-screen overflow-hidden"
      style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}
    >
      {/* Split background */}
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            className="next-handoff-img-left absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            className="next-handoff-img-right absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      {/* Vertical seam line */}
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />

      <Pill nextProject={nextProject} nextDevotion={nextDevotion} variant="desktop" />
    </div>
  );
}

function MobileLayout({ nextProject, nextDevotion }: LayoutProps) {
  return (
    <section
      className="next-handoff relative w-full overflow-hidden"
      style={{ minHeight: '100vh', backgroundColor: nextProject.overlayColor }}
    >
      {/* Two vertical columns */}
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            className="next-handoff-img-left absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            className="next-handoff-img-right absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />

      <Pill nextProject={nextProject} nextDevotion={nextDevotion} variant="mobile" />
    </section>
  );
}

interface PillProps extends LayoutProps {
  variant: 'desktop' | 'mobile';
}

function Pill({ nextProject, nextDevotion, variant }: PillProps) {
  const isMobile = variant === 'mobile';
  const pillStyle: React.CSSProperties = {
    backgroundColor: nextProject.overlayColor,
    clipPath: 'url(#hero-mask-clip)',
    width: isMobile ? '92%' : 'min(62vw, 920px)',
    aspectRatio: '11 / 3.2',
    boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)',
  };

  return (
    <div
      className="next-handoff-pill absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={pillStyle}
      role="link"
      aria-label={`Next devotion: ${nextDevotion.title}`}
    >
      <div
        className="absolute inset-0 grid items-center text-white"
        style={{
          gridTemplateColumns: '1fr auto 1fr',
          padding: isMobile ? '0 14%' : '0 10%',
          fontFamily: '"Cormorant Garamond", Georgia, serif',
        }}
      >
        {/* Left column: label + title */}
        <div className="flex flex-col gap-1 text-left">
          <span
            className="next-handoff-label"
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Next Devotion
          </span>
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
        </div>

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

        {/* Right column: category + scripture */}
        <div className="flex flex-col gap-1 text-right">
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {nextDevotion.label.replace(/^(The )?(Restoration of |Serenity of )/, '')}
          </span>
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            {nextDevotion.scriptureRef} <span aria-hidden="true">↗</span>
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): static shell — split images + clipped pill

Renders the desktop and mobile variants with no animation and no click
handler yet. Wiring into MoodBoard zones happens in Task 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire HeroMaskClipDef + replace PurposeZones Zone 8

**Files:**
- Modify: `src/components/sections/MoodBoard.tsx` (PurposeZones only, plus a single import + def mount near the top of `MoodBoard`)

- [ ] **Step 1: Add imports near the top of MoodBoard.tsx**

Find the existing imports block at the top of [src/components/sections/MoodBoard.tsx](../../../src/components/sections/MoodBoard.tsx). Add:

```ts
import { HeroMaskClipDef } from '@/components/ui-custom/HeroMaskClipDef';
import { NextDevotionHandoff } from '@/components/sections/NextDevotionHandoff';
import { devotions } from '@/data/devotions';
```

- [ ] **Step 2: Mount `<HeroMaskClipDef />` once at the top of `MoodBoard`'s return**

Find the `export function MoodBoard` JSX return (around line 247). It currently looks like:

```tsx
  return (
    <section ref={sectionRef} ...>
      ...
    </section>
  );
```

Wrap in a fragment and add `<HeroMaskClipDef />` as the first child:

```tsx
  return (
    <>
      <HeroMaskClipDef />
      <section ref={sectionRef} ...>
        ...
      </section>
    </>
  );
```

- [ ] **Step 3: Replace PurposeZones Zone 8**

In PurposeZones (starts ~line 2426), find Zone 8 (starts at `{/* ── Zone 8: Next Devotion Hero ── */}`, around line 2708). Delete the entire `<div className="relative flex-shrink-0 h-screen" ...> ... </div>` block (~30 lines), and replace with:

```tsx
      {/* ── Zone 8: Next Devotion Handoff ── */}
      <NextDevotionHandoff
        currentProject={project}
        nextProject={nextProject}
        nextDevotion={devotions[nextProject.id] ?? FALLBACK_DEVOTION}
      />
```

- [ ] **Step 4: Add `FALLBACK_DEVOTION` at the top of MoodBoard.tsx**

Just after the new imports, add:

```ts
import type { Devotion } from '@/data/devotions';

const FALLBACK_DEVOTION: Devotion = {
  id: 'fallback',
  label: 'Next Devotion',
  title: 'Continue Reading',
  scriptureRef: '—',
  monogram: 'ND',
  firstMoodboardImage: '/mid_section/restoration1.png',
};
```

This is used if `devotions[nextProject.id]` is undefined (e.g. the next project in the array is a non-devotional restoration image). The handoff still renders with neutral copy.

- [ ] **Step 5: Type-check + verify visually**

```bash
npm run build
```

Expected: build succeeds.

```bash
npm run dev
```

Navigate to `http://localhost:5173/purpose/purpose`. Scroll horizontally through the moodboard until the last zone. You should see the new split-image composition with the pill in the center, showing the *next* project's data (whatever follows Purpose in the array — likely Connection given the order in `data/projects.ts`).

If the pill looks unclipped (rectangular), the `hero-mask-clip` def isn't mounted — check Step 2.

Kill the dev server when verified.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/MoodBoard.tsx
git commit -m "feat(moodboard): wire NextDevotionHandoff into PurposeZones

Mounts HeroMaskClipDef once at the top of MoodBoard, and replaces the
PurposeZones Zone 8 inline block with NextDevotionHandoff. Other 10 zones
follow in Task 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Cinematic entrance animation

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

We attach GSAP timelines to the zone's images and pill using `ScrollTrigger.getById('moodboard-pin').animation` as the `containerAnimation` (so the trigger fires in horizontal-scroll space, matching the rest of the moodboard).

- [ ] **Step 1: Add refs and effect to `DesktopLayout`**

Replace the `DesktopLayout` function body with:

```tsx
function DesktopLayout({ nextProject, nextDevotion }: LayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef });

  return (
    <div
      ref={rootRef}
      className="next-handoff relative flex-shrink-0 h-screen overflow-hidden"
      style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}
    >
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            ref={leftImgRef}
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ clipPath: 'inset(0 100% 0 0)' }}
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            ref={rightImgRef}
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ clipPath: 'inset(0 0 0 100%)' }}
          />
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />
      <Pill
        pillRef={pillRef}
        nextProject={nextProject}
        nextDevotion={nextDevotion}
        variant="desktop"
      />
    </div>
  );
}
```

- [ ] **Step 2: Update `Pill` to accept a forwarded ref**

Update `PillProps` and `Pill`:

```tsx
interface PillProps extends LayoutProps {
  variant: 'desktop' | 'mobile';
  pillRef?: React.RefObject<HTMLDivElement | null>;
}

function Pill({ nextProject, nextDevotion, variant, pillRef }: PillProps) {
  // ...same body, but the outer div uses ref={pillRef}, and initial styles
  // start the pill invisible/offset so the entrance can fade it in:
  const pillStyle: React.CSSProperties = {
    backgroundColor: nextProject.overlayColor,
    clipPath: 'url(#hero-mask-clip)',
    width: variant === 'mobile' ? '92%' : 'min(62vw, 920px)',
    aspectRatio: '11 / 3.2',
    boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)',
    opacity: 0,
    transform: 'translate(-50%, calc(-50% + 40px)) scale(0.96)',
  };

  return (
    <div
      ref={pillRef}
      className="next-handoff-pill absolute left-1/2 top-1/2 cursor-pointer"
      style={pillStyle}
      role="link"
      aria-label={`Next devotion: ${nextDevotion.title}`}
    >
      {/* ...inner grid markup unchanged from Task 3... */}
    </div>
  );
}
```

(The mobile layout uses the same `Pill` and the same default-hidden initial style. We'll override it once for mobile in Task 9 if needed.)

- [ ] **Step 3: Add the entrance hook**

At the top of NextDevotionHandoff.tsx, add imports:

```tsx
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
```

After the `NextDevotionHandoff` export, add:

```tsx
interface EntranceArgs {
  rootRef: React.RefObject<HTMLDivElement | null>;
  leftImgRef: React.RefObject<HTMLImageElement | null>;
  rightImgRef: React.RefObject<HTMLImageElement | null>;
  pillRef: React.RefObject<HTMLDivElement | null>;
}

function useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef }: EntranceArgs) {
  useEffect(() => {
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const pill = pillRef.current;
    if (!root || !left || !right || !pill) return;

    // The moodboard's main horizontal scroll tween lives at id 'moodboard-pin'.
    // It's created in MoodBoard's useEffect, which fires AFTER this component's
    // child useEffects. Defer to the next frame so the parent has registered it.
    let ctx: gsap.Context | null = null;
    const rafId = requestAnimationFrame(() => {
      const mainTrigger = ScrollTrigger.getById('moodboard-pin');
      const containerAnimation = mainTrigger?.animation;
      if (!containerAnimation) return; // graceful no-op; entrance just won't play

      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            containerAnimation,
            start: 'left 90%',
            end: 'left 30%',
            toggleActions: 'play none none reverse',
          },
        });

        tl.to(left, { clipPath: 'inset(0 0 0 0)', duration: 0.8, ease: 'power3.out' }, 0)
          .fromTo(left, { y: 24 }, { y: 0, duration: 0.8, ease: 'power3.out' }, 0)
          .to(right, { clipPath: 'inset(0 0 0 0)', duration: 0.8, ease: 'power3.out' }, 0)
          .fromTo(right, { y: 24 }, { y: 0, duration: 0.8, ease: 'power3.out' }, 0)
          .to(
            pill,
            {
              opacity: 1,
              // Match the pill's resting transform exactly so we don't fight Tailwind:
              transform: 'translate(-50%, -50%) scale(1)',
              duration: 0.6,
              ease: 'power3.out',
            },
            0.5,
          );
      }, root);
    });

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.revert();
    };
  }, [rootRef, leftImgRef, rightImgRef, pillRef]);
}
```

- [ ] **Step 4: Type-check + visual verify**

```bash
npm run build
```

Expected: build succeeds.

```bash
npm run dev
```

Navigate to `http://localhost:5173/purpose/purpose`. Scroll horizontally to the last zone. As the zone enters the viewport:
- Left image clip-reveals from left edge
- Right image clip-reveals from right edge
- Pill fades + lifts into place after a brief delay

Scroll back. The animation should reverse (`toggleActions: 'play none none reverse'`).

Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): cinematic entrance — clip-reveal + pill drop

Two images clip-reveal from the seam outward; pill fades and lifts in.
Triggered via the moodboard's main horizontal scroll tween.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Idle loop — breathing pill + Ken Burns drift

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

- [ ] **Step 1: Add a second hook**

Below `useEntranceAnimation`, add:

```tsx
function useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef }: EntranceArgs) {
  useEffect(() => {
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const pill = pillRef.current;
    if (!root || !left || !right || !pill) return;

    const ctx = gsap.context(() => {
      // Pill breathes — runs continuously, GSAP picks up at the resting
      // transform set by the entrance animation.
      gsap.to(pill, {
        scale: 1.02,
        transformOrigin: 'center center',
        duration: 4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        // Multiply onto the existing transform (which is the centering).
        // GSAP composes scale with existing translate when written this way.
      });

      // Ken Burns drift — each image breathes and drifts outward slowly.
      gsap.to(left, {
        scale: 1.05,
        x: -10,
        duration: 12,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
      gsap.to(right, {
        scale: 1.05,
        x: 10,
        duration: 12,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    }, root);

    return () => ctx.revert();
  }, [rootRef, leftImgRef, rightImgRef, pillRef]);
}
```

- [ ] **Step 2: Wire `useIdleLoop` into `DesktopLayout` after `useEntranceAnimation`**

```tsx
function DesktopLayout({ nextProject, nextDevotion }: LayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef });
  useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef });

  // ...return JSX unchanged
}
```

Note: the idle loop starts immediately on mount, not on entrance. This is intentional — by the time the user scrolls to the zone, the breathing/drift is already in progress and feels organic. If you find the entrance fights the loop (e.g. pill jitters at handoff), gate the loop behind a state flag set after entrance completes.

- [ ] **Step 3: Visual verify**

```bash
npm run dev
```

Scroll to Purpose's Zone 8. Watch the pill — it should subtly breathe (slow scale 1 ↔ 1.02 over ~4s). Both images should slowly drift outward over ~12s, then back.

Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): idle loop — pill breathes, images drift

Subtle Ken Burns on both halves and a 2% scale breathing on the pill.
Looped, yoyo'd, sine-eased.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Pill-expand click transition

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

The click flow per spec §6.3:
1. Capture pill rect
2. Build a plain-DOM cover element appended to `document.body` (NOT a React portal — a React portal would unmount when the source route changes; we need the cover to survive the route swap).
3. Tween the DOM cover to fullscreen via GSAP, with a cross-fade clip-path morph
4. `navigate()` once fullscreen
5. After hold, fade out the DOM cover via inline transition, then remove the node and restore body scroll

The clip-path morph from the notched path to a rectangle is done by **cross-fading** two stacked divs inside the cover (one with `clipPath: url(#hero-mask-clip)`, one without) — simpler than GSAP's paid MorphSVGPlugin and visually equivalent.

- [ ] **Step 1: Add imports at the top of NextDevotionHandoff.tsx**

```tsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
```

(No `useState`, no `createPortal` — the cover is a vanilla DOM node.)

- [ ] **Step 2: Add the click hook**

Below `useIdleLoop`, add:

```tsx
function useClickToExpand(
  pillRef: React.RefObject<HTMLDivElement | null>,
  nextProject: Project,
): { startExpand: () => void } {
  const navigate = useNavigate();

  const startExpand = () => {
    const pill = pillRef.current;
    if (!pill) return;
    // Guard against double-clicks while a cover is already animating.
    if (document.querySelector('[data-pill-cover]')) return;

    const rect = pill.getBoundingClientRect();
    document.body.style.overflow = 'hidden';

    // Cover container — survives React unmounts because it's a DOM node, not React.
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

    // Clipped layer — visible at start, fades out mid-expand.
    const clippedLayer = document.createElement('div');
    Object.assign(clippedLayer.style, {
      position: 'absolute',
      inset: '0',
      backgroundColor: nextProject.overlayColor,
      clipPath: 'url(#hero-mask-clip)',
    } as Partial<CSSStyleDeclaration>);

    // Unclipped layer — fades in mid-expand to complete the morph to rect.
    const unclippedLayer = document.createElement('div');
    Object.assign(unclippedLayer.style, {
      position: 'absolute',
      inset: '0',
      backgroundColor: nextProject.overlayColor,
      opacity: '0',
    } as Partial<CSSStyleDeclaration>);

    cover.appendChild(clippedLayer);
    cover.appendChild(unclippedLayer);
    document.body.appendChild(cover);

    const EXPAND_S = 0.65;
    const POST_NAV_HOLD_MS = 200;
    const FADE_MS = 400;

    const tl = gsap.timeline();
    tl.to(cover, {
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      duration: EXPAND_S,
      ease: 'power3.inOut',
    }, 0);
    tl.to(clippedLayer, { opacity: 0, duration: 0.35, ease: 'power2.out' }, 0.15);
    tl.to(unclippedLayer, { opacity: 1, duration: 0.35, ease: 'power2.in' }, 0.15);

    tl.call(() => {
      // The cover now fully paints the next project's color. Navigate.
      navigate(`/purpose/${nextProject.id}`);

      // After the destination renders, fade the cover out.
      window.setTimeout(() => {
        cover.style.transition = `opacity ${FADE_MS}ms ease-out`;
        cover.style.opacity = '0';
        window.setTimeout(() => {
          cover.remove();
          document.body.style.overflow = '';
        }, FADE_MS + 50);
      }, POST_NAV_HOLD_MS);
    });
  };

  return { startExpand };
}
```

- [ ] **Step 3: Wire click into `DesktopLayout` and `MobileLayout`**

In `DesktopLayout` (after existing hooks):

```tsx
function DesktopLayout({ nextProject, nextDevotion }: LayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef });
  useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef });
  const { startExpand } = useClickToExpand(pillRef, nextProject);

  return (
    <div
      ref={rootRef}
      onClick={startExpand}
      className="next-handoff relative flex-shrink-0 h-screen overflow-hidden cursor-pointer"
      style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}
    >
      {/* ...rest of layout unchanged... */}
    </div>
  );
}
```

Same change in `MobileLayout`. We use `onClick` on the whole zone (not just the pill) so the click target is forgiving — matches the reference video where the entire card is the hit area. The pill itself shows `cursor-pointer` for affordance via CSS.

- [ ] **Step 4: Visual verify**

```bash
npm run dev
```

Navigate to `http://localhost:5173/purpose/purpose`. Scroll to the last zone. Click anywhere in the zone.

Expected:
- Cover expands from the pill's rest position to fill viewport (~650ms)
- Clipped layer fades out, unclipped layer fades in mid-expand (the clip-path morph)
- Once fullscreen, URL changes to `/purpose/connection` (or whatever the next project is)
- Destination page renders under the still-painted cover
- After 200ms hold, cover fades out over 400ms, revealing the destination with its own reveal

If the destination flickers in before the cover fades out, increase `POST_NAV_HOLD_MS` to 350.

Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): pill-expand click transition

Pill click captures rect, portals a fixed cover, tweens it to fullscreen
in the next project's color, navigates, then fades out over the
destination page's reveal. Bypasses RouteTransition entirely for this
path — the pill itself is the color cover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Reduced-motion path

**Files:**
- Modify: `src/components/sections/NextDevotionHandoff.tsx`

Per spec §6.4, reduced motion: skip entrance parallax, skip idle loop, collapse pill-expand to instant fullscreen + 200ms fade-out.

- [ ] **Step 1: Add a `useReducedMotion` helper**

At the top of NextDevotionHandoff.tsx (after imports):

```tsx
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Gate entrance + idle loop on reduced motion**

In `useEntranceAnimation`, accept and respect a `reducedMotion` arg:

```tsx
function useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion }: EntranceArgs & { reducedMotion: boolean }) {
  useEffect(() => {
    const root = rootRef.current;
    const left = leftImgRef.current;
    const right = rightImgRef.current;
    const pill = pillRef.current;
    if (!root || !left || !right || !pill) return;

    if (reducedMotion) {
      // Single fade — skip clip-reveals, skip parallax.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });
      tl.set([left, right], { clipPath: 'inset(0 0 0 0)' });
      tl.fromTo(
        [left, right, pill],
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' },
      );
      tl.set(pill, { transform: 'translate(-50%, -50%) scale(1)' }, 0);
      return () => tl.kill();
    }

    // ...existing standard-motion code, unchanged...
  }, [rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion]);
}
```

In `useIdleLoop`, add an early return:

```tsx
function useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion }: EntranceArgs & { reducedMotion: boolean }) {
  useEffect(() => {
    if (reducedMotion) return;
    // ...existing body unchanged...
  }, [rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion]);
}
```

- [ ] **Step 3: Gate the pill expand**

Update `useClickToExpand` to accept `reducedMotion` and collapse the timeline durations:

```tsx
function useClickToExpand(
  pillRef: React.RefObject<HTMLDivElement | null>,
  nextProject: Project,
  reducedMotion: boolean,
): { startExpand: () => void } {
  const navigate = useNavigate();

  const startExpand = () => {
    const pill = pillRef.current;
    if (!pill) return;
    if (document.querySelector('[data-pill-cover]')) return;

    const rect = pill.getBoundingClientRect();
    document.body.style.overflow = 'hidden';

    // ...build cover, clippedLayer, unclippedLayer exactly as in Task 7...

    const EXPAND_S = reducedMotion ? 0 : 0.65;
    const FADE_LAYER_DUR = reducedMotion ? 0 : 0.35;
    const POST_NAV_HOLD_MS = reducedMotion ? 50 : 200;
    const FADE_MS = reducedMotion ? 200 : 400;

    const tl = gsap.timeline();
    tl.to(cover, { top: 0, left: 0, width: '100vw', height: '100vh', duration: EXPAND_S, ease: 'power3.inOut' }, 0);
    tl.to(clippedLayer, { opacity: 0, duration: FADE_LAYER_DUR, ease: 'power2.out' }, reducedMotion ? 0 : 0.15);
    tl.to(unclippedLayer, { opacity: 1, duration: FADE_LAYER_DUR, ease: 'power2.in' }, reducedMotion ? 0 : 0.15);

    tl.call(() => {
      navigate(`/purpose/${nextProject.id}`);
      window.setTimeout(() => {
        cover.style.transition = `opacity ${FADE_MS}ms ease-out`;
        cover.style.opacity = '0';
        window.setTimeout(() => {
          cover.remove();
          document.body.style.overflow = '';
        }, FADE_MS + 50);
      }, POST_NAV_HOLD_MS);
    });
  };

  return { startExpand };
}
```

- [ ] **Step 4: Pass `reducedMotion` from `DesktopLayout` and `MobileLayout`**

```tsx
function DesktopLayout({ nextProject, nextDevotion }: LayoutProps) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEntranceAnimation({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion });
  useIdleLoop({ rootRef, leftImgRef, rightImgRef, pillRef, reducedMotion });
  const { startExpand } = useClickToExpand(pillRef, nextProject, reducedMotion);

  return (
    <div ref={rootRef} onClick={startExpand} className="next-handoff ..." style={{ ... }}>
      {/* ... */}
    </div>
  );
}
```

Same change in `MobileLayout`.

- [ ] **Step 5: Verify by toggling OS setting**

On macOS: `System Settings → Accessibility → Display → Reduce motion` on. Re-test the click + scroll behavior. Animations should be visibly muted: instant pill fill, short fade.

Kill dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/NextDevotionHandoff.tsx
git commit -m "feat(next-handoff): respect prefers-reduced-motion

Skip clip-reveal + parallax in entrance, skip idle loop entirely, collapse
pill-expand durations to ~0 for instant cross-fade navigation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Roll out to remaining 10 desktop zones

**Files:**
- Modify: `src/components/sections/MoodBoard.tsx`

We replicate the Task 4 edit across the other 10 `*Zones` functions: PeaceZones, HopeZones, StrengthZones, WholenessZones, ConnectionZones, IdentityZones, JoyZones, ForgivenessZones, SurrenderZones, TrustZones.

For each function: find its Zone 8 block (search for `{/* ── Zone 8: Next Devotion Hero ── */}`), delete the inline 2-column block (~30 lines), and replace with:

```tsx
      {/* ── Zone 8: Next Devotion Handoff ── */}
      <NextDevotionHandoff
        currentProject={project}
        nextProject={nextProject}
        nextDevotion={devotions[nextProject.id] ?? FALLBACK_DEVOTION}
      />
```

- [ ] **Step 1: PeaceZones**

Locate `function PeaceZones` (~line 717). Find its Zone 8 block (the `<div className="relative flex-shrink-0 h-screen" style={{ ... backgroundColor: nextProject.overlayColor }}>` near the end). Replace per pattern above.

- [ ] **Step 2: HopeZones**

Same edit in `function HopeZones` (~line 1154).

- [ ] **Step 3: StrengthZones**

Same edit in `function StrengthZones` (~line 1578).

- [ ] **Step 4: WholenessZones**

Same edit in `function WholenessZones` (~line 2002).

- [ ] **Step 5: ConnectionZones**

Same edit in `function ConnectionZones` (~line 2850).

- [ ] **Step 6: IdentityZones**

Same edit in `function IdentityZones` (~line 3274).

- [ ] **Step 7: JoyZones**

Same edit in `function JoyZones` (~line 3698).

- [ ] **Step 8: ForgivenessZones**

Same edit in `function ForgivenessZones` (~line 4122).

- [ ] **Step 9: SurrenderZones**

Same edit in `function SurrenderZones` (~line 4546).

- [ ] **Step 10: TrustZones**

Same edit in `function TrustZones` (~line 4969).

- [ ] **Step 11: Build + spot-check 3 random devotions**

```bash
npm run build
npm run dev
```

Visit at least three devotions of mixed categories, e.g.:
- `http://localhost:5173/purpose/strength`
- `http://localhost:5173/purpose/joy`
- `http://localhost:5173/purpose/trust`

Scroll to the last zone of each. Confirm the pill shows the correct next devotion (wrapping back to the first project after `trust`).

Kill dev server.

- [ ] **Step 12: Commit**

```bash
git add src/components/sections/MoodBoard.tsx
git commit -m "feat(moodboard): roll out NextDevotionHandoff to all 11 desktop zones

PeaceZones, HopeZones, StrengthZones, WholenessZones, ConnectionZones,
IdentityZones, JoyZones, ForgivenessZones, SurrenderZones, TrustZones.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Mobile rollout

**Files:**
- Modify: `src/components/sections/MoodBoard.tsx` (the `*Mobile` functions)

Each `*Mobile` function (PeaceMobile, HopeMobile, etc.) currently ends with a "Final image" or equivalent next-devotion vertical block. We replace that with `<NextDevotionHandoff variant="mobile" ... />`.

The exact final block varies per mobile component — search each for the trailing `<section style={{ backgroundColor: bg }}>` or similar at the bottom of the function, where the next-devotion preview lives.

- [ ] **Step 1: For each `*Mobile` function, replace its trailing next-devotion section**

For each of (approximate line numbers in current source): PeaceMobile (~1049), HopeMobile (~1473), StrengthMobile (~1897), WholenessMobile (~2321), PurposeMobile (~2745), ConnectionMobile (~3169), IdentityMobile (~3593), JoyMobile (~4017), ForgivenessMobile (~4441), SurrenderMobile (~4864), TrustMobile (~5287) —

Open the function, scroll to the last `<section>` (or equivalent), and replace its entire JSX with:

```tsx
      <NextDevotionHandoff
        currentProject={project}
        nextProject={nextProject}
        nextDevotion={devotions[nextProject.id] ?? FALLBACK_DEVOTION}
        variant="mobile"
      />
```

If a given `*Mobile` function does NOT compute `nextProject` (some may not), add at the top of the function:

```tsx
const currentIndex = projects.findIndex((p) => p.id === project.id);
const nextProject = projects[(currentIndex + 1) % projects.length];
```

And ensure `projects` is imported at the top of the file (`import { projects } from '@/data/projects';` — it should already be there since the desktop Zones functions use it).

- [ ] **Step 2: Build + spot-check on mobile viewport**

```bash
npm run build
npm run dev
```

Open Chrome DevTools, set viewport to 375×812 (iPhone). Visit two devotions and scroll to the bottom. Confirm the mobile vertical split + pill renders correctly.

Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/MoodBoard.tsx
git commit -m "feat(moodboard-mobile): NextDevotionHandoff replaces final mobile sections

All 11 *Mobile functions now end with the shared handoff component in
mobile variant (vertical split + centered pill).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Final cleanup + verification

**Files:**
- Modify: `src/components/sections/PurposeDetail.tsx` (TODO comment only)
- Modify: `src/components/sections/MoodBoard.tsx` (TODO comment only)

- [ ] **Step 1: Add TODO comments at the duplication sites**

Add a comment block at the top of [src/components/sections/PurposeDetail.tsx](../../../src/components/sections/PurposeDetail.tsx), just below imports:

```tsx
// TODO(handoff): devotion-specific strings below (label, title, scripture)
// are duplicated in src/data/devotions.ts. A future refactor should make
// this component consume that data instead.
```

Add a similar comment near the per-devotion image-map constants at the top of [src/components/sections/MoodBoard.tsx](../../../src/components/sections/MoodBoard.tsx) (around line 65):

```tsx
// TODO(handoff): the `hero` field of each devotion image map is also stored
// at src/data/devotions.ts as `firstMoodboardImage`. A future refactor
// should consolidate these.
```

- [ ] **Step 2: Run full lint + build + test**

```bash
npm run lint
npm run build
npm test
```

Expected: all three pass with no errors. If lint flags any unused imports or vars introduced by the refactor (e.g. an unused `nextProject.description` reference that you removed from the old Zone 8), clean them up before commit.

- [ ] **Step 3: Manual end-to-end pass**

```bash
npm run dev
```

Walk the full happy path:
1. Open `http://localhost:5173/`
2. Click a devotion thumbnail from the purpose grid
3. Scroll through the moodboard to the final zone
4. Click the pill
5. Confirm it expands and you arrive at the next devotion
6. Scroll to its final zone, click again, repeat through 2–3 transitions

Then toggle reduced motion in OS settings and repeat once.

Test wraparound: navigate to the last devotion in `projects[]` (likely `trust` or `surrender`), scroll to its final zone, click. The next devotion should be `projects[0]` (likely `restoration1`).

Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/PurposeDetail.tsx src/components/sections/MoodBoard.tsx
git commit -m "docs(handoff): TODO markers for devotion-data duplication

Mark the two locations whose strings are now also stored in
src/data/devotions.ts so a future cleanup can consolidate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Done

11 devotions now end with the shared `NextDevotionHandoff` component on both desktop and mobile, with cinematic entrance, idle loop, pill-expand click transition, and reduced-motion fallback. The home hero's clipPath has been extracted into a shared component used by both surfaces.

Open spec: [docs/superpowers/specs/2026-05-19-next-devotion-handoff-design.md](../specs/2026-05-19-next-devotion-handoff-design.md).
