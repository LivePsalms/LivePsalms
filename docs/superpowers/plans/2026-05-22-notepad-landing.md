# Notepad Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-app landing page for the Live Psalms Notepad at `/notepad`, with the existing editor relocated to `/notepad/notes`. Hero is a Three.js particle morph (Pencil → Heart → Journal) on a dark ground; main sections are scroll-driven motion + pre-rendered video paired with brand-voice copy.

**Architecture:** A new `src/notepad-landing/` directory with one file per section, a centralized copy module, a Three.js particle system mounted via `useEffect`, and per-section reduced-motion branches. Asset pipeline re-encodes `.mov` references to `.mp4`/`.webm`/`.jpg` and commits them to `public/notepad-landing/`. Route migration is a single PR.

**Tech Stack:** React 19 + Vite + TypeScript + React Router (existing) + Three.js r160 (added) + Vitest. Package manager: **npm**. Build: `npm run build`. Dev: `npm run dev`. Tests: `npm test`.

**Reference docs:**
- Design spec: [docs/superpowers/specs/2026-05-22-notepad-landing-design.md](docs/superpowers/specs/2026-05-22-notepad-landing-design.md)
- Vault product file: `/Users/newmac/Documents/Branding-Content-OS Vault/wiki/products/live-psalms-notepad-landing.md`
- Hero reference (verbatim Three.js source to port): `/Users/newmac/Downloads/Psalms_app/hero_section.md`
- Main reference (scroll Three.js source): `/Users/newmac/Downloads/Psalms_app/main_section.md`
- Template transition grammar: `/Users/newmac/Downloads/Psalms_app/reference/notepad_feature/DESIGN.md`

---

## Task 1: Asset pipeline — re-encode video sources

**Files:**
- Create: `public/notepad-landing/.gitkeep` (in case directory is empty)
- Create: `public/notepad-landing/graph.mp4`, `graph.webm`, `graph-poster.jpg`
- Create: `public/notepad-landing/notepad.mp4`, `notepad.webm`, `notepad-poster.jpg`
- Create: `public/notepad-landing/templates/t1.mp4` through `t4.mp4` + `.webm` + `-poster.jpg` for each
- Source `.mov` files at: `/Users/newmac/Downloads/Psalms_app/reference/`

- [ ] **Step 1: Create the output directory**

```bash
mkdir -p public/notepad-landing/templates
```

- [ ] **Step 2: Re-encode `Graph_video.mov`**

```bash
ffmpeg -i reference/Graph_video.mov \
  -vf "scale='min(1920,iw)':-2,format=yuv420p" \
  -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -an \
  public/notepad-landing/graph.mp4

ffmpeg -i reference/Graph_video.mov \
  -vf "scale='min(1920,iw)':-2" \
  -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 -an \
  public/notepad-landing/graph.webm

ffmpeg -i reference/Graph_video.mov -ss 00:00:00.5 -vframes 1 -q:v 3 \
  public/notepad-landing/graph-poster.jpg
```

Expected: `graph.mp4` ≤ 8 MB, `graph.webm` ≤ 6 MB.

- [ ] **Step 3: Re-encode `notepad_video.mov`**

```bash
ffmpeg -i reference/notepad_video.mov \
  -vf "scale='min(1920,iw)':-2,format=yuv420p" \
  -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -an \
  public/notepad-landing/notepad.mp4

ffmpeg -i reference/notepad_video.mov \
  -vf "scale='min(1920,iw)':-2" \
  -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 -an \
  public/notepad-landing/notepad.webm

ffmpeg -i reference/notepad_video.mov -ss 00:00:00.5 -vframes 1 -q:v 3 \
  public/notepad-landing/notepad-poster.jpg
```

Expected: `notepad.mp4` ≤ 3 MB.

- [ ] **Step 4: Re-encode the four template videos**

```bash
for i in 1 2 3 4; do
  ffmpeg -i "reference/notepad_feature/Template_video${i}.mov" \
    -vf "scale='min(1280,iw)':-2,format=yuv420p" \
    -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p \
    -movflags +faststart -an \
    "public/notepad-landing/templates/t${i}.mp4"

  ffmpeg -i "reference/notepad_feature/Template_video${i}.mov" \
    -vf "scale='min(1280,iw)':-2" \
    -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 -an \
    "public/notepad-landing/templates/t${i}.webm"

  ffmpeg -i "reference/notepad_feature/Template_video${i}.mov" \
    -ss 00:00:00.5 -vframes 1 -q:v 3 \
    "public/notepad-landing/templates/t${i}-poster.jpg"
done
```

Expected: each `t{n}.mp4` ≤ 2 MB.

- [ ] **Step 5: Verify total weight**

```bash
du -sh public/notepad-landing/
ls -lh public/notepad-landing/*.mp4 public/notepad-landing/*.webm
```

Expected: total directory ≤ 25 MB.

- [ ] **Step 6: Commit assets**

```bash
git add public/notepad-landing/
git commit -m "feat(notepad-landing): add re-encoded video assets

ffmpeg-encoded mp4 + webm + posters for graph, notepad, and 4 templates.
Source .mov files remain in reference/ (untracked, local-only)."
```

---

## Task 2: Add Three.js dependency

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `package-lock.json`

- [ ] **Step 1: Install Three.js (latest stable r160 line)**

```bash
npm install three@^0.160.0
npm install -D @types/three@^0.160.0
```

- [ ] **Step 2: Verify install**

```bash
node -e "console.log(require('three/package.json').version)"
```

Expected: a version starting with `0.160`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add three.js for notepad landing hero + scroll scenes"
```

---

## Task 3: Stub the NotepadLanding component + add the route migration

**Files:**
- Create: `src/notepad-landing/index.tsx`
- Create: `src/notepad-landing/index.test.tsx`
- Modify: `src/App.tsx` (route table + `isNotepadPage` logic)
- Modify: `src/App.test.tsx` if it exists, otherwise create

- [ ] **Step 1: Write the failing test for route migration**

Create `src/notepad-landing/index.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { NotepadLanding } from './index';

describe('NotepadLanding (stub)', () => {
  it('renders the locked hero H1', () => {
    render(
      <MemoryRouter initialEntries={['/notepad']}>
        <Routes>
          <Route path="/notepad" element={<NotepadLanding />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /for what you cannot afford to forget/i }),
    ).toBeInTheDocument();
  });

  it('renders the primary CTA that links to /notepad/notes', () => {
    render(
      <MemoryRouter initialEntries={['/notepad']}>
        <Routes>
          <Route path="/notepad" element={<NotepadLanding />} />
        </Routes>
      </MemoryRouter>,
    );
    const cta = screen.getByRole('link', { name: /open your notepad/i });
    expect(cta).toHaveAttribute('href', '/notepad/notes');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- src/notepad-landing/index.test.tsx
```

Expected: FAIL with `Cannot find module './index'`.

- [ ] **Step 3: Write the stub component**

Create `src/notepad-landing/index.tsx`:

```tsx
import { Link } from 'react-router-dom';

export function NotepadLanding() {
  return (
    <main className="notepad-landing">
      <section className="hero">
        <p className="eyebrow">— THE NOTEPAD —</p>
        <h1>For what you cannot afford to forget.</h1>
        <p className="sub">
          The notepad that remembers what God has been saying — across your devotions, your sermons, the threads you've been walking with for months.
        </p>
        <Link to="/notepad/notes" className="cta-primary">
          Open your notepad →
        </Link>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- src/notepad-landing/index.test.tsx
```

Expected: PASS (both tests).

- [ ] **Step 5: Wire the route in App.tsx**

In `src/App.tsx`, find line 142:

```tsx
<Route path="/notepad" element={<Notepad />} />
```

Replace with:

```tsx
<Route path="/notepad" element={<NotepadLanding />} />
<Route path="/notepad/notes" element={<Notepad />} />
```

Add the import near the other route component imports at the top of the file:

```tsx
import { NotepadLanding } from './notepad-landing';
```

- [ ] **Step 6: Update the path-derived flags in App.tsx**

In `src/App.tsx`, find line 96:

```tsx
const isNotepadPage = location.pathname === '/notepad';
```

Replace with:

```tsx
const isNotepadLanding = location.pathname === '/notepad';
const isNotepadEditor = location.pathname.startsWith('/notepad/notes');
const isNotepadAny = isNotepadLanding || isNotepadEditor;
```

Then find every reference to `isNotepadPage` in the file. Update line 102 (`hideFooter`):

```tsx
const hideFooter = isDetailPage || isPurposePage || isNotepadAny || isLoginPage || isProfilePage || isWelcomePage || isCommunityPage || isContactPage;
```

Update line 121 (`Header` conditional). The landing should **show** the header; only the editor hides it:

```tsx
{!isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage && <Header darkText={isDetailPage || isPurposePage} showNav={headerVisible} onNavTrigger={handleNavTrigger} />}
```

- [ ] **Step 7: Run the dev server and confirm both routes render**

```bash
npm run dev
```

Open `http://localhost:5173/notepad` → should show stub landing with H1.
Open `http://localhost:5173/notepad/notes` → should show the existing Notepad editor.
Stop the server with Ctrl+C.

- [ ] **Step 8: Run full test suite to confirm nothing else broke**

```bash
npm test
```

Expected: all tests pass (or the same set that was passing before).

- [ ] **Step 9: Commit**

```bash
git add src/notepad-landing/ src/App.tsx
git commit -m "feat(notepad-landing): scaffold landing route + relocate editor to /notepad/notes

- New <NotepadLanding /> stub mounted at /notepad with locked H1, sub, and CTA copy
- Existing <Notepad /> editor moved to /notepad/notes
- App.tsx route flags split into isNotepadLanding / isNotepadEditor / isNotepadAny
- Header continues to hide on the editor; now shows on the landing"
```

---

## Task 4: Internal link audit

**Files:**
- Modify: every file that contains `to="/notepad"` or `navigate('/notepad')` where the intent is the **editor**, not the **landing**

- [ ] **Step 1: Enumerate every reference to `/notepad`**

```bash
grep -rEn '["'"'"']/notepad["'"'"']|to="/notepad"|navigate\(["'"'"']/notepad' src/ --include='*.ts' --include='*.tsx'
```

Save the output. For each hit, classify:

- **Landing intent** (the user should see the landing page) → leave as `/notepad`
- **Editor intent** (the user should go straight to writing) → change to `/notepad/notes`

- [ ] **Step 2: Apply the changes**

For each editor-intent call site, change the literal `/notepad` to `/notepad/notes`. For each call site where intent is ambiguous, default to **landing** (`/notepad`) — the landing's own CTA will route the user onward to the editor.

Typical heuristics:
- A nav link labeled "Notepad" → landing.
- An onboarding "Start writing" button after profile setup → editor.
- A toast or notification "Continue your note" → editor.
- A "Back to your notepad" breadcrumb from a child page → editor.

- [ ] **Step 3: Re-grep to confirm**

```bash
grep -rEn '["'"'"']/notepad["'"'"']|to="/notepad"|navigate\(["'"'"']/notepad' src/ --include='*.ts' --include='*.tsx'
```

Read every remaining hit. Are they all genuine landing-page intents?

- [ ] **Step 4: Run dev + click through the affected flows manually**

```bash
npm run dev
```

For each editor-intent link you changed, exercise the flow once. Confirm the user lands at `/notepad/notes`, not the landing.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat(notepad-landing): audit internal links — editor-intent calls route to /notepad/notes"
```

---

## Task 5: Centralized copy module

**Files:**
- Create: `src/notepad-landing/data/copy.ts`
- Create: `src/notepad-landing/data/copy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/notepad-landing/data/copy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { copy } from './copy';

describe('notepad landing copy (locked)', () => {
  it('hero H1 is the locked Alt 2 line', () => {
    expect(copy.section01.h1).toBe('For what you cannot afford to forget.');
  });

  it('hero subtitle matches the locked copy', () => {
    expect(copy.section01.sub).toBe(
      'The notepad that remembers what God has been saying — across your devotions, your sermons, the threads you’ve been walking with for months.',
    );
  });

  it('primary CTA reads "Open your notepad →"', () => {
    expect(copy.section01.ctaPrimary).toBe('Open your notepad →');
  });

  it('closing CTA repeats the primary', () => {
    expect(copy.section09.ctaPrimary).toBe('Open your notepad →');
  });

  it('Lamplight section refuses chatbot framing', () => {
    expect(copy.section04.body).toMatch(/Lamplight is not a chatbot/);
  });

  it('seven papers includes all seven paper names', () => {
    const names = copy.section06.papers.map((p) => p.name);
    expect(names).toEqual(['Linen', 'Vellum', 'Margin', 'Dotted Crème', 'Ruled Walnut', 'Communion', 'Folio']);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- src/notepad-landing/data/copy.test.ts
```

Expected: FAIL with `Cannot find module './copy'`.

- [ ] **Step 3: Write the copy module**

Create `src/notepad-landing/data/copy.ts`:

```ts
export const copy = {
  section01: {
    eyebrow: '— THE NOTEPAD —',
    h1: 'For what you cannot afford to forget.',
    sub: 'The notepad that remembers what God has been saying — across your devotions, your sermons, the threads you’ve been walking with for months.',
    activeFormLabel: 'ACTIVE FORM',
    shapeNames: ['Pencil', 'Heart', 'Journal'] as const,
    ctaPrimary: 'Open your notepad →',
    ctaGhost: 'Read what it does',
  },
  section02: {
    eyebrow: '— ONE NOTEPAD —',
    h2: 'Three voices. One quiet place.',
    body: 'The devotion you wrote this morning. The sermon you scribbled Sunday. The theme you’ve been walking with since March. They were never separate — only stored that way.',
    supporting:
      'Each note knows which kind of writing it is. The Notepad threads them together by what they share — a verse, a word, an unanswered question.',
  },
  section03: {
    eyebrow: '— THE LIVING GRAPH —',
    h2: 'A map of how God has been speaking.',
    body: 'Every scripture you’ve returned to. Every theme you’ve kept circling. Every prayer that found its echo somewhere else. The graph draws the lines you couldn’t see while you were writing.',
    supporting: 'Not a productivity diagram. An illuminated record of being walked with.',
    caption: 'Each connection traced through scripture. Click any verse to see the notes that share it.',
  },
  section04: {
    eyebrow: '— LAMPLIGHT —',
    h2: 'A companion who’s been reading along.',
    body: 'Lamplight is not a chatbot. It is the long quiet finally given a voice. It reads what you have already written and gives you back today’s devotion — drawn from your own pages, anchored in scripture, written for the season you are in.',
    cards: [
      {
        title: 'Today’s Lamp.',
        body: 'A morning card, written from your own writing — not a verse-of-the-day, but a word for where you actually are.',
      },
      {
        title: 'What God seems to be saying.',
        body: 'A weekly synthesis, drawn from the threads your notes have already started.',
      },
      {
        title: 'Your journey, told back to you.',
        body: 'Seasonal Reflections that draw a line through what you walked, what carried you, what changed.',
      },
    ],
    trust: 'Off until you invite it. Private by default. Never trains on your notes. Always cited. One click to quiet.',
  },
  section05: {
    eyebrow: '— SCRIPTURE INLINE —',
    h2: 'The Bible, in the margin of your sentence.',
    body: 'Type the reference. Hover. The verse is there — full text, in the translation you read. The flow you were in does not have to break.',
    supporting: 'Every scripture you cite becomes a thread. Every thread keeps the next note close.',
  },
  section06: {
    eyebrow: '— SEVEN PAPERS —',
    h2: 'Choose the paper that asks the right thing of you.',
    body: 'Some mornings want a clean page. Some want lined. Some want a page the color of communion bread. Seven paper styles — each one a different way of being met.',
    papers: [
      { name: 'Linen', blurb: 'the morning before the day arrives', clip: '/notepad-landing/templates/t1' },
      { name: 'Vellum', blurb: 'for long-form devotional writing', clip: '/notepad-landing/templates/t2' },
      { name: 'Margin', blurb: 'for sermon capture, fast', clip: '/notepad-landing/templates/t3' },
      { name: 'Dotted Crème', blurb: 'for thinking in lists', clip: '/notepad-landing/templates/t4' },
      { name: 'Ruled Walnut', blurb: 'for the heavier writing', clip: '/notepad-landing/templates/t1' },
      { name: 'Communion', blurb: 'for the lament psalms', clip: '/notepad-landing/templates/t2' },
      { name: 'Folio', blurb: 'for the slow morning, the long quiet', clip: '/notepad-landing/templates/t3' },
    ] as const,
  },
  section07: {
    eyebrow: '— MARKED IN SCRIPTURE —',
    h2: 'The small thing, marked.',
    body: 'Eight tiers, from New Flame to Glory. Each one rooted in a verse, each one a refusal of the lie that your slow, faithful work doesn’t count.',
    pullQuote: '“Do not despise the day of small beginnings.” — Zechariah 4:10',
    bodyContinued: 'This is not a verse you frame on a wall. It is a verse the Notepad keeps reading over you.',
  },
  section08: {
    eyebrow: '— WHAT IS YOURS, STAYS YOURS —',
    h2: 'Private. Cited. Yours.',
    lines: [
      'Lamplight never trains on your notes.',
      'Every insight cites the source — the note, the verse, the date.',
      'Bring in what you already have. PDFs, Word, markdown — your sermon notes auto-link by the scripture they share.',
    ] as const,
  },
  section09: {
    h2: 'The first page is open.',
    sub: 'No account required to begin. Sign in to sync. Write offline. Come back to yourself.',
    ctaPrimary: 'Open your notepad →',
    ctaSecondary: 'Already writing? Sign in →',
  },
} as const;

export type Copy = typeof copy;
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- src/notepad-landing/data/copy.test.ts
```

Expected: PASS (all 6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/data/
git commit -m "feat(notepad-landing): centralize all section copy in data/copy.ts"
```

---

## Task 6: usePrefersReducedMotion hook

**Files:**
- Create: `src/notepad-landing/hooks/use-prefers-reduced-motion.ts`
- Create: `src/notepad-landing/hooks/use-prefers-reduced-motion.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad-landing/hooks/use-prefers-reduced-motion.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

type Listener = (event: { matches: boolean }) => void;

function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    addEventListener: (_event: 'change', listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: 'change', listener: Listener) => {
      listeners.delete(listener);
    },
  };

  window.matchMedia = vi.fn().mockReturnValue(mediaQueryList);

  return {
    fire: (next: boolean) => {
      matches = next;
      listeners.forEach((l) => l({ matches: next }));
    },
  };
}

describe('usePrefersReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns false when the user has not requested reduced motion', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when the user has requested reduced motion', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => {
      mm.fire(true);
    });
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- src/notepad-landing/hooks/use-prefers-reduced-motion.test.tsx
```

Expected: FAIL with `Cannot find module './use-prefers-reduced-motion'`.

- [ ] **Step 3: Implement the hook**

Create `src/notepad-landing/hooks/use-prefers-reduced-motion.ts`:

```ts
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(QUERY);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener('change', listener);
    return () => {
      mql.removeEventListener('change', listener);
    };
  }, []);

  return reduced;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- src/notepad-landing/hooks/use-prefers-reduced-motion.test.tsx
```

Expected: PASS (all 3 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/hooks/
git commit -m "feat(notepad-landing): add usePrefersReducedMotion hook"
```

---

## Task 7: useIntersectionStage hook

**Files:**
- Create: `src/notepad-landing/hooks/use-intersection-stage.ts`
- Create: `src/notepad-landing/hooks/use-intersection-stage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/notepad-landing/hooks/use-intersection-stage.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntersectionStage } from './use-intersection-stage';
import { useRef } from 'react';

type Cb = (entries: { isIntersecting: boolean }[]) => void;
let intersectionCb: Cb | null = null;

beforeEach(() => {
  intersectionCb = null;
  window.IntersectionObserver = vi.fn().mockImplementation((cb: Cb) => {
    intersectionCb = cb;
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  }) as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  intersectionCb = null;
});

describe('useIntersectionStage', () => {
  it('returns false initially', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionStage(ref);
    });
    expect(result.current).toBe(false);
  });

  it('returns true once the element intersects', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionStage(ref);
    });
    act(() => {
      intersectionCb?.([{ isIntersecting: true }]);
    });
    expect(result.current).toBe(true);
  });

  it('stays true once it has intersected (one-shot)', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionStage(ref);
    });
    act(() => {
      intersectionCb?.([{ isIntersecting: true }]);
    });
    act(() => {
      intersectionCb?.([{ isIntersecting: false }]);
    });
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- src/notepad-landing/hooks/use-intersection-stage.test.tsx
```

Expected: FAIL with `Cannot find module './use-intersection-stage'`.

- [ ] **Step 3: Implement the hook**

Create `src/notepad-landing/hooks/use-intersection-stage.ts`:

```ts
import { RefObject, useEffect, useState } from 'react';

export interface IntersectionStageOptions {
  rootMargin?: string;
  threshold?: number;
}

export function useIntersectionStage<T extends Element>(
  ref: RefObject<T | null>,
  options: IntersectionStageOptions = {},
): boolean {
  const { rootMargin = '0px 0px -10% 0px', threshold = 0.15 } = options;
  const [staged, setStaged] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setStaged(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (staged) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setStaged(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold, staged]);

  return staged;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- src/notepad-landing/hooks/use-intersection-stage.test.tsx
```

Expected: PASS (all 3 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/hooks/
git commit -m "feat(notepad-landing): add useIntersectionStage hook for one-shot reveal"
```

---

## Task 8: Three.js particle system + Pencil/Heart/Journal shape modules

**Files:**
- Create: `src/notepad-landing/three/shapes/pencil.ts`
- Create: `src/notepad-landing/three/shapes/heart.ts`
- Create: `src/notepad-landing/three/shapes/journal.ts`
- Create: `src/notepad-landing/three/particle-system.ts`

> No unit tests for the Three.js engine; visual verification only. This task is judged by `npm run dev` showing the morph.

- [ ] **Step 1: Port the three shape modules from `hero_section.md`**

The reference at `/Users/newmac/Downloads/Psalms_app/hero_section.md` lines 614–759 contains three pure functions `makePencil()`, `makeHeart()`, `makeJournal()` that each return a `Float32Array` of XYZ positions for a given `PARTICLE_COUNT`. Port them as default-exported functions.

Create `src/notepad-landing/three/shapes/pencil.ts`:

```ts
export function makePencil(particleCount: number): Float32Array {
  const pos = new Float32Array(particleCount * 3);
  const scatter = 0.018;
  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    const angle = Math.random() * Math.PI * 2;
    let x: number, y: number, z: number;

    const S = 0.72;
    if (t < 0.07) {
      const tipT = t / 0.07;
      const radius = tipT * 0.045;
      y = (-1.85 + tipT * 0.25) * S;
      x = Math.cos(angle) * radius * S;
      z = Math.sin(angle) * radius * S;
    } else if (t < 0.17) {
      const taperT = (t - 0.07) / 0.10;
      const radius = 0.045 + taperT * 0.075;
      y = (-1.6 + taperT * 0.45) * S;
      x = Math.cos(angle) * radius * S;
      z = Math.sin(angle) * radius * S;
    } else if (t < 0.82) {
      const bodyT = (t - 0.17) / 0.65;
      const hexRadius = 0.12 / Math.cos(((angle % (Math.PI / 3)) - Math.PI / 6));
      const clampedHex = Math.min(hexRadius, 0.145);
      const facetRadius = clampedHex * (0.92 + 0.08 * Math.cos(angle * 6));
      y = (-1.15 + bodyT * 2.5) * S;
      x = Math.cos(angle) * facetRadius * S;
      z = Math.sin(angle) * facetRadius * S;
    } else if (t < 0.90) {
      const ferruleT = (t - 0.82) / 0.08;
      const radius = 0.135 + Math.sin(ferruleT * Math.PI) * 0.01;
      y = (1.35 + ferruleT * 0.18) * S;
      x = Math.cos(angle) * radius * S;
      z = Math.sin(angle) * radius * S;
    } else {
      const eraserT = (t - 0.90) / 0.10;
      const radius = 0.13 * (1 - eraserT * 0.15);
      y = (1.53 + eraserT * 0.32) * S;
      x = Math.cos(angle) * radius * S;
      z = Math.sin(angle) * radius * S;
    }

    pos[i * 3] = x + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * scatter;
  }
  return pos;
}
```

Create `src/notepad-landing/three/shapes/heart.ts`:

```ts
export function makeHeart(particleCount: number): Float32Array {
  const pos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const t = Math.random() * Math.PI * 2;
    const s = Math.random() * Math.PI;
    const scatter = 0.03;
    const heartX = (16 * Math.pow(Math.sin(t), 3)) / 16;
    const heartY = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
    const depth = Math.sin(s) * 0.5;
    pos[i * 3] = heartX + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 1] = heartY + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 2] = depth + (Math.random() - 0.5) * scatter;
  }
  return pos;
}
```

Create `src/notepad-landing/three/shapes/journal.ts`:

```ts
export function makeJournal(particleCount: number): Float32Array {
  const pos = new Float32Array(particleCount * 3);
  const scatter = 0.015;
  const scale = 1.2;
  for (let i = 0; i < particleCount; i++) {
    const section = Math.random();
    let x: number, y: number, z: number;

    if (section < 0.35) {
      const px = Math.random() * 0.85;
      const py = (Math.random() - 0.5) * 1.2;
      const curvature = Math.sin(px * Math.PI * 0.5) * 0.15;
      x = -px - 0.02;
      y = py;
      z = curvature;
    } else if (section < 0.70) {
      const px = Math.random() * 0.85;
      const py = (Math.random() - 0.5) * 1.2;
      const curvature = Math.sin(px * Math.PI * 0.5) * 0.15;
      x = px + 0.02;
      y = py;
      z = curvature;
    } else if (section < 0.78) {
      const sy = (Math.random() - 0.5) * 1.2;
      const sz = (Math.random() - 0.5) * 0.18;
      x = (Math.random() - 0.5) * 0.04;
      y = sy;
      z = Math.abs(sz) * 0.8 + 0.01;
    } else if (section < 0.88) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const edgeX = side * 0.87;
      const ey = (Math.random() - 0.5) * 1.15;
      const layerDepth = Math.random() * 0.12;
      x = edgeX + (Math.random() - 0.5) * 0.02;
      y = ey;
      z = Math.sin(Math.abs(edgeX) * Math.PI * 0.5) * 0.15 - layerDepth;
    } else if (section < 0.94) {
      const lineIdx = Math.floor(Math.random() * 12);
      const lineY = 0.45 - lineIdx * 0.075;
      const lineX = -0.12 - Math.random() * 0.6;
      x = lineX;
      y = lineY + (Math.random() - 0.5) * 0.008;
      z = Math.sin(Math.abs(lineX) * Math.PI * 0.5) * 0.15 + 0.01;
    } else {
      const lineIdx = Math.floor(Math.random() * 12);
      const lineY = 0.45 - lineIdx * 0.075;
      const lineX = 0.12 + Math.random() * 0.6;
      x = lineX;
      y = lineY + (Math.random() - 0.5) * 0.008;
      z = Math.sin(Math.abs(lineX) * Math.PI * 0.5) * 0.15 + 0.01;
    }

    pos[i * 3] = x * scale + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 1] = y * scale + (Math.random() - 0.5) * scatter;
    pos[i * 3 + 2] = z * scale + (Math.random() - 0.5) * scatter;
  }
  return pos;
}
```

- [ ] **Step 2: Implement the particle system mount function**

Create `src/notepad-landing/three/particle-system.ts`. This is the engine adapted from `hero_section.md` lines 502–1050. Particle colors use the Live Psalms palette (Silence → Seedpearl → Cocoa lerp).

```ts
import * as THREE from 'three';
import { makePencil } from './shapes/pencil';
import { makeHeart } from './shapes/heart';
import { makeJournal } from './shapes/journal';

export interface MountOptions {
  prm: boolean;
  onShapeChange?: (index: number) => void;
}

interface MountReturn {
  setShape: (index: number) => void;
  cleanup: () => void;
}

const COLOR_LIGHT = new THREE.Color(0xf6f0e6); // Silence
const COLOR_MID = new THREE.Color(0xdfd3bf); // Seedpearl
const COLOR_WARM = new THREE.Color(0x7c6656); // Cocoa
const BG = new THREE.Color(0x0e0e0e);

export function mountParticleSystem(canvas: HTMLCanvasElement, options: MountOptions): MountReturn {
  const { prm } = options;

  if (prm) {
    // Static fallback: paint a single Journal silhouette via 2D context and return a no-op.
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#0e0e0e';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const positions = makeJournal(2000);
      ctx.fillStyle = 'rgba(246, 240, 230, 0.8)';
      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      const s = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.25;
      for (let i = 0; i < positions.length; i += 3) {
        const x = cx + positions[i] * s;
        const y = cy - positions[i + 1] * s;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    return {
      setShape: () => {},
      cleanup: () => {},
    };
  }

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const PARTICLE_COUNT = isMobile ? 10000 : 25000;

  // WebGL fallback per spec §10: if creating the renderer throws (no WebGL support),
  // log and paint the static Journal silhouette as if prm were true.
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    console.warn('[notepad-landing] WebGL unavailable — falling back to static silhouette', err);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#0e0e0e';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const positions = makeJournal(2000);
      ctx.fillStyle = 'rgba(246, 240, 230, 0.8)';
      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      const s = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.25;
      for (let i = 0; i < positions.length; i += 3) {
        const x = cx + positions[i] * s;
        const y = cy - positions[i + 1] * s;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    return { setShape: () => {}, cleanup: () => {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.5;

  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.FogExp2(0x0e0e0e, 0.02);

  const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 5);

  // Shape buffers
  const shapes = [makePencil(PARTICLE_COUNT), makeHeart(PARTICLE_COUNT), makeJournal(PARTICLE_COUNT)];

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  positions.set(shapes[0]);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const randoms = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const ratio = i / PARTICLE_COUNT;
    const color =
      ratio < 0.5
        ? COLOR_LIGHT.clone().lerp(COLOR_MID, ratio * 2)
        : COLOR_MID.clone().lerp(COLOR_WARM, (ratio - 0.5) * 2);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = 0.012 + Math.random() * 0.02;
    randoms[i] = Math.random();
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMorph: { value: 0 },
      uMouse3D: { value: new THREE.Vector3(0, 0, 0) },
      uMouseActive: { value: 0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aRandom;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uMorph;
      uniform vec3 uMouse3D;
      uniform float uMouseActive;
      void main() {
        vColor = color;
        vec3 pos = position;
        float breath = sin(uTime * 0.5 + aRandom * 6.28) * 0.02;
        pos += normalize(pos + vec3(0.0001)) * breath;
        float scatter = sin(uMorph * 3.14159) * 0.3;
        pos += normalize(pos + vec3(0.001)) * scatter * aRandom;

        vec3 toParticle = pos - uMouse3D;
        float xyDist = length(toParticle.xy);
        float fullDist = length(toParticle);
        float mouseRadius = 1.4;
        float influence = 1.0 - smoothstep(0.0, mouseRadius, xyDist);
        influence = influence * influence * uMouseActive;
        if (influence > 0.001) {
          vec3 pushDir = fullDist > 0.001 ? normalize(toParticle) : vec3(0.0, 1.0, 0.0);
          pos += pushDir * (influence * 0.3);
          float swirlSpeed = uTime * 2.0 + aRandom * 6.28;
          vec2 radial = pos.xy - uMouse3D.xy;
          float angle = (influence * 0.25) * (1.0 + sin(swirlSpeed) * 0.3);
          float cosA = cos(angle);
          float sinA = sin(angle);
          vec2 rotated = vec2(radial.x * cosA - radial.y * sinA, radial.x * sinA + radial.y * cosA);
          pos.xy = uMouse3D.xy + rotated;
          pos.z += sin(swirlSpeed * 0.7 + aRandom * 3.14) * influence * 0.15;
        }

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * 500.0 / -mvPos.z;
        gl_PointSize = max(gl_PointSize, 1.5);
        gl_Position = projectionMatrix * mvPos;
        vAlpha = 0.85 + 0.15 * (1.0 - smoothstep(0.0, 10.0, -mvPos.z));
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
        vec3 brightColor = vColor * 2.2 + 0.15;
        gl_FragColor = vec4(brightColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Lights
  const ambient = new THREE.AmbientLight(0xffeedd, 3);
  scene.add(ambient);

  // Morph state
  let currentShape = 0;
  let targetShape = 0;
  let morphStartTime = 0;
  let isMorphing = false;
  const morphDuration = 2.5;
  const clock = new THREE.Clock();

  function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function startMorph(idx: number) {
    if (isMorphing || idx === currentShape) return;
    targetShape = idx;
    isMorphing = true;
    morphStartTime = clock.getElapsedTime();
  }

  let autoMorphTimer = window.setInterval(() => {
    const next = (currentShape + 1) % shapes.length;
    startMorph(next);
  }, 5000);

  // Mouse
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2(9999, 9999);
  const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersectPoint = new THREE.Vector3();
  const localMouse = new THREE.Vector3();
  const invMatrix = new THREE.Matrix4();
  let mouseOnScreen = false;
  let mouseActiveSmooth = 0;

  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mouseOnScreen = true;
  }
  function onMouseLeave() {
    mouseNDC.set(9999, 9999);
    mouseOnScreen = false;
  }

  if (!isTouch) {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
  }

  function onResize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
  window.addEventListener('resize', onResize);

  let rafId = 0;
  let stopped = false;
  function animate() {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    material.uniforms.uTime.value = elapsed;
    mouseActiveSmooth += ((mouseOnScreen ? 1 : 0) - mouseActiveSmooth) * 0.08;
    material.uniforms.uMouseActive.value = mouseActiveSmooth;

    raycaster.setFromCamera(mouseNDC, camera);
    raycaster.ray.intersectPlane(mousePlane, intersectPoint);
    invMatrix.copy(particles.matrixWorld).invert();
    localMouse.copy(intersectPoint).applyMatrix4(invMatrix);
    material.uniforms.uMouse3D.value.copy(localMouse);

    if (isMorphing) {
      const rawProgress = Math.min((elapsed - morphStartTime) / morphDuration, 1);
      const morphProgress = easeInOutCubic(rawProgress);
      material.uniforms.uMorph.value = morphProgress;
      const src = shapes[currentShape];
      const tgt = shapes[targetShape];
      const posArr = geometry.attributes.position.array as Float32Array;
      const len = PARTICLE_COUNT * 3;
      for (let i = 0; i < len; i++) {
        posArr[i] = src[i] + (tgt[i] - src[i]) * morphProgress;
      }
      geometry.attributes.position.needsUpdate = true;
      if (rawProgress >= 1) {
        isMorphing = false;
        currentShape = targetShape;
        material.uniforms.uMorph.value = 0;
        options.onShapeChange?.(currentShape);
      } else if (rawProgress > 0.4 && rawProgress < 0.6) {
        options.onShapeChange?.(targetShape);
      }
    }

    particles.rotation.y = elapsed * 0.05;
    particles.position.y = Math.sin(elapsed * 0.3) * 0.05;
    renderer.render(scene, camera);
  }
  animate();

  return {
    setShape: (idx: number) => {
      window.clearInterval(autoMorphTimer);
      startMorph(idx);
      autoMorphTimer = window.setInterval(() => {
        const next = (currentShape + 1) % shapes.length;
        startMorph(next);
      }, 5000);
    },
    cleanup: () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.clearInterval(autoMorphTimer);
      window.removeEventListener('resize', onResize);
      if (!isTouch) {
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseleave', onMouseLeave);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 3: Type-check the new files**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/notepad-landing/three/
git commit -m "feat(notepad-landing): port Three.js particle system + Pencil/Heart/Journal shapes"
```

---

## Task 9: Section 01 — Particle Hero component

**Files:**
- Create: `src/notepad-landing/sections/01-particle-hero.tsx`
- Create: `src/notepad-landing/styles/landing.css`
- Modify: `src/notepad-landing/index.tsx` (use the new section)
- Verify: existing `src/notepad-landing/index.test.tsx` still passes

- [ ] **Step 1: Create the section component**

Create `src/notepad-landing/sections/01-particle-hero.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '../data/copy';
import { mountParticleSystem } from '../three/particle-system';

interface ParticleHeroProps {
  prm: boolean;
}

export function ParticleHero({ prm }: ParticleHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapeIdx, setShapeIdx] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const handle = mountParticleSystem(canvasRef.current, {
      prm,
      onShapeChange: setShapeIdx,
    });
    return handle.cleanup;
  }, [prm]);

  const { eyebrow, h1, sub, ctaPrimary, ctaGhost, activeFormLabel, shapeNames } = copy.section01;

  return (
    <section className="hero" aria-labelledby="hero-h1">
      <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />
      <div className="hero-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="hero-h1" className="hero-h1">{h1}</h1>
        <p className="hero-sub">{sub}</p>
        <div className="hero-actions">
          <Link to="/notepad/notes" className="cta-primary">{ctaPrimary}</Link>
          <a href="#section-02" className="cta-ghost">{ctaGhost}</a>
        </div>
      </div>
      <div className="hero-form-indicator" aria-hidden="true">
        <div className="form-label">{activeFormLabel}</div>
        <div className="form-name">{shapeNames[shapeIdx]}</div>
        <div className="form-counter">{`0${shapeIdx + 1} / 0${shapeNames.length}`}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create the stylesheet skeleton**

Create `src/notepad-landing/styles/landing.css`:

```css
:root {
  --np-bg-dark: #0e0e0e;
  --np-bg-paper: #f6f0e6;        /* Silence */
  --np-bg-paper-cool: #edece5;   /* Crème */
  --np-ink: #432c29;             /* Rum Raisin */
  --np-ink-mid: #66544f;         /* Chocolate */
  --np-ink-warm: #7c6656;        /* Cocoa */
  --np-ink-soft: #d0cab9;        /* Warm Sand */
  --np-display: 'Cormorant Garamond', Georgia, serif;
  --np-body: 'Source Serif Pro', Georgia, serif;
  --np-mono: 'JetBrains Mono', 'IBM Plex Mono', monospace;
  --np-script: 'Pinyon Script', cursive;
  --np-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.notepad-landing {
  background: var(--np-bg-paper);
  color: var(--np-ink);
  font-family: var(--np-body);
}

.hero {
  position: relative;
  min-height: 100vh;
  background: var(--np-bg-dark);
  color: #efedee;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  padding: 4rem 3.5rem 6rem;
}

.hero-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: 640px;
}

.eyebrow {
  font-family: var(--np-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.25em;
  color: #c4b5a0;
  margin-bottom: 2rem;
}

.hero-h1 {
  font-family: var(--np-display);
  font-size: clamp(2.4rem, 5vw, 4.6rem);
  line-height: 1.05;
  font-weight: 400;
  letter-spacing: -0.02em;
  color: #f4f0e8;
  margin-bottom: 1.4rem;
}

.hero-sub {
  font-family: var(--np-body);
  font-size: clamp(0.95rem, 1.3vw, 1.1rem);
  line-height: 1.7;
  color: #b7ada0;
  max-width: 520px;
  margin-bottom: 2.4rem;
  border-left: 2px solid rgba(196, 181, 160, 0.25);
  padding-left: 1.2rem;
}

.hero-actions {
  display: flex;
  gap: 0.9rem;
  align-items: center;
}

.cta-primary,
.cta-ghost {
  display: inline-block;
  font-family: var(--np-body);
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  padding: 0.9rem 1.8rem;
  border-radius: 999px;
  text-decoration: none;
  transition: background 0.4s var(--np-ease), color 0.4s var(--np-ease), transform 0.4s var(--np-ease);
}

.cta-primary {
  border: 1.5px solid #c4b5a0;
  color: #f4f0e8;
  background: transparent;
}

.cta-primary:hover {
  background: #c4b5a0;
  color: #0e0e0e;
  transform: translateY(-2px);
}

.cta-ghost {
  border: 1.5px solid rgba(180, 170, 160, 0.25);
  color: #b7ada0;
}

.cta-ghost:hover {
  border-color: #c4b5a0;
  color: #c4b5a0;
}

.hero-form-indicator {
  position: absolute;
  right: 3.5rem;
  bottom: 6rem;
  z-index: 2;
  text-align: right;
  color: #8d8478;
}

.hero-form-indicator .form-label {
  font-family: var(--np-mono);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

.hero-form-indicator .form-name {
  font-family: var(--np-display);
  font-size: 1.8rem;
  font-style: italic;
  color: #c4b5a0;
  letter-spacing: -0.01em;
}

.hero-form-indicator .form-counter {
  font-family: var(--np-mono);
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: #8d8478;
  margin-top: 0.5rem;
}

@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 3rem 1.5rem 5rem;
  }
  .hero-form-indicator {
    display: none;
  }
}
```

- [ ] **Step 3: Use the new section in the index**

Replace the body of `src/notepad-landing/index.tsx` with:

```tsx
import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { ParticleHero } from './sections/01-particle-hero';

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
    </div>
  );
}
```

- [ ] **Step 4: Run the index test**

```bash
npm test -- src/notepad-landing/index.test.tsx
```

Expected: PASS (the existing two assertions — H1 and CTA href).

- [ ] **Step 5: Run dev and eyeball it**

```bash
npm run dev
```

Open `http://localhost:5173/notepad`. Expected:
- Dark background.
- Particle morph cycling Pencil → Heart → Journal every 5 seconds.
- H1 "For what you cannot afford to forget." in display serif.
- "Active Form" label updating to the current shape.
- Hover over particles → swirl.
- CTA "Open your notepad →" routes to `/notepad/notes`.

If anything looks broken, fix before continuing.

Stop server.

- [ ] **Step 6: Commit**

```bash
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 01 — particle-morph hero"
```

---

## Task 10: Section 02 — Three Voices

**Files:**
- Create: `src/notepad-landing/sections/02-three-voices.tsx`
- Modify: `src/notepad-landing/styles/landing.css` (add section styles)
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Create the section component**

Create `src/notepad-landing/sections/02-three-voices.tsx`:

```tsx
import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface ThreeVoicesProps {
  prm: boolean;
}

export function ThreeVoices({ prm }: ThreeVoicesProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, supporting } = copy.section02;

  return (
    <section
      ref={ref}
      id="section-02"
      className={`section three-voices${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec02-h2"
    >
      <div className="section-grid">
        <div className="section-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="sec02-h2">{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
        </div>
        <div className="section-media">
          <video
            className="section-video"
            autoPlay={!prm}
            muted
            loop
            playsInline
            preload="metadata"
            poster="/notepad-landing/notepad-poster.jpg"
            controls={prm}
            aria-label="The Live Psalms Notepad UI showing devotion, sermon, and theme writing modes"
          >
            <source src="/notepad-landing/notepad.webm" type="video/webm" />
            <source src="/notepad-landing/notepad.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add section styles**

Append to `src/notepad-landing/styles/landing.css`:

```css
.section {
  padding: clamp(5rem, 10vw, 9rem) clamp(1.5rem, 5vw, 3.5rem);
  background: var(--np-bg-paper);
  color: var(--np-ink);
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.9s var(--np-ease), transform 0.9s var(--np-ease);
}

.section.is-staged {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .section {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

.section-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(2rem, 5vw, 5rem);
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.section h2 {
  font-family: var(--np-display);
  font-size: clamp(1.8rem, 3.2vw, 2.8rem);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin: 0.5rem 0 1.4rem;
}

.section .body {
  font-family: var(--np-body);
  font-size: clamp(1rem, 1.4vw, 1.15rem);
  line-height: 1.75;
  color: var(--np-ink-mid);
}

.section .supporting {
  font-family: var(--np-body);
  font-style: italic;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--np-ink-warm);
  margin-top: 1rem;
}

.section-video {
  width: 100%;
  height: auto;
  border-radius: 12px;
  border: 1px solid rgba(102, 84, 79, 0.08);
}

@media (max-width: 768px) {
  .section-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Add the section to the index**

Update `src/notepad-landing/index.tsx`:

```tsx
import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { ParticleHero } from './sections/01-particle-hero';
import { ThreeVoices } from './sections/02-three-voices';

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
      <ThreeVoices prm={prm} />
    </div>
  );
}
```

- [ ] **Step 4: Run dev and verify**

```bash
npm run dev
```

Scroll past hero. Section 02 fades in, video plays. Stop.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 02 — Three Voices with notepad UI video"
```

---

## Task 11: Section 03 — The Living Graph (full-bleed)

**Files:**
- Create: `src/notepad-landing/sections/03-living-graph.tsx`
- Modify: `src/notepad-landing/styles/landing.css`
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Create the section component**

Create `src/notepad-landing/sections/03-living-graph.tsx`:

```tsx
import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface LivingGraphProps {
  prm: boolean;
}

export function LivingGraph({ prm }: LivingGraphProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, supporting, caption } = copy.section03;

  return (
    <section
      ref={ref}
      className={`section living-graph${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec03-h2"
    >
      <div className="living-graph-media">
        <video
          className="living-graph-video"
          autoPlay={!prm}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/notepad-landing/graph-poster.jpg"
          controls={prm}
          aria-label="The Live Psalms knowledge graph showing notes connected by shared scripture"
        >
          <source src="/notepad-landing/graph.webm" type="video/webm" />
          <source src="/notepad-landing/graph.mp4" type="video/mp4" />
        </video>
        <div className="living-graph-overlay">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="sec03-h2">{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
        </div>
        <p className="living-graph-caption">{caption}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/notepad-landing/styles/landing.css`:

```css
.living-graph {
  padding: 0;
  background: var(--np-bg-paper-cool);
}

.living-graph-media {
  position: relative;
  width: 100%;
  min-height: 90vh;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.living-graph-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.living-graph-overlay {
  position: relative;
  z-index: 1;
  max-width: 540px;
  padding: 3rem 3.5rem;
  background: linear-gradient(180deg, rgba(246, 240, 230, 0) 0%, rgba(246, 240, 230, 0.92) 80%);
}

.living-graph-overlay h2 {
  font-style: italic;
}

.living-graph-caption {
  position: absolute;
  z-index: 1;
  bottom: 1.4rem;
  right: 2rem;
  font-family: var(--np-mono);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(67, 44, 41, 0.7);
  max-width: 320px;
  text-align: right;
}

@media (max-width: 768px) {
  .living-graph-overlay {
    padding: 2rem 1.5rem;
  }
  .living-graph-caption {
    display: none;
  }
}
```

- [ ] **Step 3: Mount in index**

```tsx
import { LivingGraph } from './sections/03-living-graph';

// in the JSX, after <ThreeVoices /> :
<LivingGraph prm={prm} />
```

- [ ] **Step 4: Run dev and verify**

```bash
npm run dev
```

Scroll. Section 03 fills viewport with graph video; copy overlays bottom-left.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 03 — Living Graph full-bleed"
```

---

## Task 12: Section 04 — Lamplight

**Files:**
- Create: `src/notepad-landing/sections/04-lamplight.tsx`
- Modify: `src/notepad-landing/styles/landing.css`
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Create the component**

Create `src/notepad-landing/sections/04-lamplight.tsx`:

```tsx
import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface LamplightProps {
  prm: boolean;
}

export function Lamplight({ prm: _prm }: LamplightProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, cards, trust } = copy.section04;

  return (
    <section
      ref={ref}
      className={`section lamplight${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec04-h2"
    >
      <div className="lamplight-content">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec04-h2">{h2}</h2>
        <p className="body lamplight-body">{body}</p>

        <div className="lamplight-cards">
          {cards.map((card) => (
            <article key={card.title} className="lamplight-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>

        <p className="lamplight-trust">{trust}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/notepad-landing/styles/landing.css`:

```css
.lamplight {
  background: var(--np-bg-paper);
}

.lamplight-content {
  max-width: 1100px;
  margin: 0 auto;
}

.lamplight-content > .body.lamplight-body {
  max-width: 620px;
  margin-top: 1rem;
}

.lamplight-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin: 3.5rem 0 2.5rem;
}

.lamplight-card {
  border-top: 1px solid rgba(102, 84, 79, 0.18);
  padding-top: 1.4rem;
}

.lamplight-card h3 {
  font-family: var(--np-display);
  font-size: 1.2rem;
  font-style: italic;
  font-weight: 500;
  margin-bottom: 0.6rem;
}

.lamplight-card p {
  font-family: var(--np-body);
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--np-ink-mid);
}

.lamplight-trust {
  font-family: var(--np-mono);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--np-ink-warm);
  margin-top: 2rem;
  padding-top: 1.4rem;
  border-top: 1px solid rgba(102, 84, 79, 0.12);
}

@media (max-width: 768px) {
  .lamplight-cards {
    grid-template-columns: 1fr;
    gap: 1.4rem;
  }
}
```

- [ ] **Step 3: Mount in index**

```tsx
import { Lamplight } from './sections/04-lamplight';
// add after <LivingGraph prm={prm} />:
<Lamplight prm={prm} />
```

- [ ] **Step 4: Verify in dev + commit**

```bash
npm run dev
# verify, then stop
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 04 — Lamplight with three inset cards"
```

---

## Task 13: Section 05 — Scripture in the Margin

**Files:**
- Create: `src/notepad-landing/sections/05-scripture-margin.tsx`
- Modify: `src/notepad-landing/styles/landing.css`
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Create the component**

Create `src/notepad-landing/sections/05-scripture-margin.tsx`:

```tsx
import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface ScriptureMarginProps {
  prm: boolean;
}

export function ScriptureMargin({ prm }: ScriptureMarginProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, supporting } = copy.section05;

  return (
    <section
      ref={ref}
      className={`section scripture-margin${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec05-h2"
    >
      <div className="section-grid">
        <div className="section-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="sec05-h2">{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
        </div>
        <div className="section-media">
          <video
            className="section-video"
            autoPlay={!prm}
            muted
            loop
            playsInline
            preload="metadata"
            poster="/notepad-landing/templates/t1-poster.jpg"
            controls={prm}
            aria-label="Closeup of scripture hover-preview inside the notepad"
          >
            <source src="/notepad-landing/templates/t1.webm" type="video/webm" />
            <source src="/notepad-landing/templates/t1.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add a small style addendum**

Append to `src/notepad-landing/styles/landing.css`:

```css
.scripture-margin {
  background: var(--np-bg-paper-cool);
}
```

- [ ] **Step 3: Mount in index**

```tsx
import { ScriptureMargin } from './sections/05-scripture-margin';
// add after <Lamplight prm={prm} />:
<ScriptureMargin prm={prm} />
```

- [ ] **Step 4: Verify + commit**

```bash
npm run dev
# verify section 05 renders, then stop
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 05 — Scripture in the Margin"
```

---

## Task 14: Section 06 — Seven Papers (carousel with Emil blur crossfade)

**Files:**
- Create: `src/notepad-landing/sections/06-seven-papers.tsx`
- Modify: `src/notepad-landing/styles/landing.css`
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Create the component**

Create `src/notepad-landing/sections/06-seven-papers.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

interface SevenPapersProps {
  prm: boolean;
}

const AUTO_ADVANCE_MS = 5000;

export function SevenPapers({ prm }: SevenPapersProps) {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const { eyebrow, h2, body, papers } = copy.section06;

  useEffect(() => {
    if (prm || !staged) return;
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % papers.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [prm, staged, papers.length]);

  return (
    <section
      ref={ref}
      className={`section seven-papers${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec06-h2"
    >
      <div className="seven-papers-content">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec06-h2">{h2}</h2>
        <p className="body">{body}</p>

        <div className="paper-stage">
          {papers.map((paper, i) => (
            <video
              key={paper.name + i}
              className={`paper-clip${i === activeIdx ? ' is-active' : ''}`}
              autoPlay={!prm}
              muted
              loop
              playsInline
              preload="metadata"
              poster={`${paper.clip}-poster.jpg`}
              aria-hidden={i !== activeIdx}
            >
              <source src={`${paper.clip}.webm`} type="video/webm" />
              <source src={`${paper.clip}.mp4`} type="video/mp4" />
            </video>
          ))}
        </div>

        <div className="paper-label" aria-live="polite">
          <p className="paper-name">{papers[activeIdx].name}</p>
          <p className="paper-blurb">{papers[activeIdx].blurb}</p>
        </div>

        <div className="paper-dots" role="tablist" aria-label="Choose a paper style">
          {papers.map((paper, i) => (
            <button
              key={paper.name}
              role="tab"
              aria-selected={i === activeIdx}
              aria-label={paper.name}
              className={`paper-dot${i === activeIdx ? ' is-active' : ''}`}
              onClick={() => setActiveIdx(i)}
              type="button"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/notepad-landing/styles/landing.css`:

```css
.seven-papers {
  background: var(--np-bg-paper);
}

.seven-papers-content {
  max-width: 920px;
  margin: 0 auto;
  text-align: center;
}

.seven-papers .body {
  max-width: 540px;
  margin: 1rem auto 2.6rem;
}

.paper-stage {
  position: relative;
  width: 100%;
  max-width: 720px;
  aspect-ratio: 16 / 10;
  margin: 0 auto 1.6rem;
  border-radius: 12px;
  overflow: hidden;
  background: var(--np-bg-paper-cool);
}

.paper-clip {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  filter: blur(22px);
  transform: scale(1.05);
  transition:
    opacity 0.7s cubic-bezier(0.55, 0, 0.45, 1),    /* power3.out approx */
    filter 0.7s cubic-bezier(0.55, 0, 0.45, 1),
    transform 0.7s cubic-bezier(0.55, 0, 0.45, 1);
}

.paper-clip.is-active {
  opacity: 1;
  filter: blur(0);
  transform: scale(1);
  transition-delay: 0.1s;
}

@media (prefers-reduced-motion: reduce) {
  .paper-clip,
  .paper-clip.is-active {
    transition: none;
    filter: none;
    transform: none;
  }
}

.paper-label {
  margin-bottom: 1.4rem;
  min-height: 3.2rem;
}

.paper-name {
  font-family: var(--np-script);
  font-size: clamp(2.2rem, 4vw, 3.2rem);
  color: var(--np-ink);
  line-height: 1;
  margin-bottom: 0.4rem;
}

.paper-blurb {
  font-family: var(--np-body);
  font-style: italic;
  font-size: 0.95rem;
  color: var(--np-ink-warm);
}

.paper-dots {
  display: inline-flex;
  gap: 0.6rem;
  justify-content: center;
}

.paper-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--np-ink-warm);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background 0.3s var(--np-ease);
}

.paper-dot.is-active {
  background: var(--np-ink);
  border-color: var(--np-ink);
}

.paper-dot:focus-visible {
  outline: 2px solid var(--np-ink);
  outline-offset: 3px;
}
```

- [ ] **Step 3: Mount in index**

```tsx
import { SevenPapers } from './sections/06-seven-papers';
// add after <ScriptureMargin prm={prm} />:
<SevenPapers prm={prm} />
```

- [ ] **Step 4: Verify carousel + dots + reduced-motion mode**

```bash
npm run dev
```

In DevTools, toggle `prefers-reduced-motion` (Cmd+Shift+P → "Rendering" → "Emulate CSS prefers-reduced-motion"). Confirm:
- Default: clips auto-advance every 5s with blur crossfade.
- Reduced motion: clips snap-cut with manual dot navigation only.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 06 — Seven Papers carousel with Emil blur crossfade"
```

---

## Task 15: Section 07 — Tier Path (Pinyon Script pull quote)

**Files:**
- Create: `src/notepad-landing/sections/07-tier-path.tsx`
- Modify: `src/notepad-landing/styles/landing.css`
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Create the component**

Create `src/notepad-landing/sections/07-tier-path.tsx`:

```tsx
import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

export function TierPath() {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, body, pullQuote, bodyContinued } = copy.section07;

  return (
    <section
      ref={ref}
      className={`section tier-path${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec07-h2"
    >
      <div className="tier-path-content">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec07-h2">{h2}</h2>
        <p className="body">{body}</p>
        <blockquote className="tier-pullquote">{pullQuote}</blockquote>
        <p className="body">{bodyContinued}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/notepad-landing/styles/landing.css`:

```css
.tier-path {
  background: var(--np-bg-paper-cool);
}

.tier-path-content {
  max-width: 700px;
  margin: 0 auto;
}

.tier-pullquote {
  font-family: var(--np-script);
  font-size: clamp(2.8rem, 6vw, 4.8rem);
  line-height: 1.1;
  color: var(--np-ink);
  margin: 2.4rem 0 2rem;
  padding-left: 2rem;
  border: none;
}
```

- [ ] **Step 3: Mount in index**

```tsx
import { TierPath } from './sections/07-tier-path';
// add after <SevenPapers prm={prm} />:
<TierPath />
```

- [ ] **Step 4: Verify + commit**

```bash
npm run dev
# verify, stop
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 07 — Tier Path with Pinyon Script pull quote"
```

---

## Task 16: Section 08 — Trust / Import triptych

**Files:**
- Create: `src/notepad-landing/sections/08-trust-import.tsx`
- Modify: `src/notepad-landing/styles/landing.css`
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Create the component**

Create `src/notepad-landing/sections/08-trust-import.tsx`:

```tsx
import { useRef } from 'react';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';

export function TrustImport() {
  const ref = useRef<HTMLElement>(null);
  const staged = useIntersectionStage(ref);
  const { eyebrow, h2, lines } = copy.section08;

  return (
    <section
      ref={ref}
      className={`section trust-import${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec08-h2"
    >
      <div className="trust-content">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="sec08-h2">{h2}</h2>
        <ul className="trust-triptych">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/notepad-landing/styles/landing.css`:

```css
.trust-import {
  background: var(--np-bg-paper);
}

.trust-content {
  max-width: 1100px;
  margin: 0 auto;
  text-align: center;
}

.trust-triptych {
  list-style: none;
  padding: 0;
  margin: 2.4rem 0 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.trust-triptych li {
  font-family: var(--np-display);
  font-style: italic;
  font-size: clamp(1.05rem, 1.5vw, 1.3rem);
  line-height: 1.5;
  color: var(--np-ink-mid);
  padding-top: 1.4rem;
  border-top: 1px solid rgba(102, 84, 79, 0.18);
}

@media (max-width: 768px) {
  .trust-triptych {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Mount + verify + commit**

```tsx
import { TrustImport } from './sections/08-trust-import';
// after <TierPath />:
<TrustImport />
```

```bash
npm run dev
# verify, stop
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 08 — Trust / Import triptych"
```

---

## Task 17: Section 09 — Closing CTA (dark, particles re-form into Journal)

**Files:**
- Create: `src/notepad-landing/sections/09-closing-cta.tsx`
- Modify: `src/notepad-landing/styles/landing.css`
- Modify: `src/notepad-landing/index.tsx`

- [ ] **Step 1: Create the component**

The closing CTA is a smaller, settled re-mount of the particle system stuck on the Journal shape (no morph cycle).

Create `src/notepad-landing/sections/09-closing-cta.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '../data/copy';
import { useIntersectionStage } from '../hooks/use-intersection-stage';
import { mountParticleSystem } from '../three/particle-system';

interface ClosingCTAProps {
  prm: boolean;
}

export function ClosingCTA({ prm }: ClosingCTAProps) {
  const ref = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staged = useIntersectionStage(ref, { rootMargin: '0px 0px -20% 0px', threshold: 0.2 });
  const { h2, sub, ctaPrimary, ctaSecondary } = copy.section09;

  useEffect(() => {
    if (!staged || !canvasRef.current) return;
    const handle = mountParticleSystem(canvasRef.current, { prm });
    // Settle on the Journal shape (index 2) and disable the cycle by re-calling setShape every cycle.
    handle.setShape(2);
    return handle.cleanup;
  }, [prm, staged]);

  return (
    <section
      ref={ref}
      className={`section closing-cta${staged ? ' is-staged' : ''}`}
      aria-labelledby="sec09-h2"
    >
      <canvas ref={canvasRef} className="closing-canvas" aria-hidden="true" />
      <div className="closing-content">
        <h2 id="sec09-h2">{h2}</h2>
        <p className="closing-sub">{sub}</p>
        <Link to="/notepad/notes" className="cta-primary closing-cta-primary">{ctaPrimary}</Link>
        <Link to="/login" className="closing-cta-secondary">{ctaSecondary}</Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/notepad-landing/styles/landing.css`:

```css
.closing-cta {
  position: relative;
  background: var(--np-bg-dark);
  color: #efedee;
  text-align: center;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.closing-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.closing-content {
  position: relative;
  z-index: 1;
  max-width: 560px;
  padding: 0 1.5rem;
}

.closing-content h2 {
  font-family: var(--np-display);
  font-size: clamp(2rem, 4vw, 3.4rem);
  color: #f4f0e8;
  font-style: italic;
  margin-bottom: 1.2rem;
}

.closing-sub {
  font-family: var(--np-body);
  font-size: 0.95rem;
  line-height: 1.7;
  color: #b7ada0;
  margin-bottom: 2rem;
}

.closing-cta-primary {
  background: transparent;
  border: 1.5px solid #c4b5a0;
  color: #f4f0e8;
}

.closing-cta-primary:hover {
  background: #c4b5a0;
  color: #0e0e0e;
}

.closing-cta-secondary {
  display: inline-block;
  margin-top: 1.2rem;
  font-family: var(--np-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #8d8478;
  text-decoration: none;
  transition: color 0.3s var(--np-ease);
}

.closing-cta-secondary:hover {
  color: #c4b5a0;
}
```

- [ ] **Step 3: Mount in index**

Final `src/notepad-landing/index.tsx`:

```tsx
import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { ParticleHero } from './sections/01-particle-hero';
import { ThreeVoices } from './sections/02-three-voices';
import { LivingGraph } from './sections/03-living-graph';
import { Lamplight } from './sections/04-lamplight';
import { ScriptureMargin } from './sections/05-scripture-margin';
import { SevenPapers } from './sections/06-seven-papers';
import { TierPath } from './sections/07-tier-path';
import { TrustImport } from './sections/08-trust-import';
import { ClosingCTA } from './sections/09-closing-cta';

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
      <ThreeVoices prm={prm} />
      <LivingGraph prm={prm} />
      <Lamplight prm={prm} />
      <ScriptureMargin prm={prm} />
      <SevenPapers prm={prm} />
      <TierPath />
      <TrustImport />
      <ClosingCTA prm={prm} />
    </div>
  );
}
```

- [ ] **Step 4: Verify in dev**

```bash
npm run dev
```

Scroll from top to bottom. Confirm every section renders, closing CTA shows dark ground with Journal silhouette of particles + final CTA.

- [ ] **Step 5: Commit**

```bash
git add src/notepad-landing/
git commit -m "feat(notepad-landing): Section 09 — closing CTA with settled Journal particles"
```

---

## Task 18: Reduced-motion verification pass

**Files:**
- No file changes expected unless a defect is found.

- [ ] **Step 1: Enable reduced motion at OS level**

macOS → System Settings → Accessibility → Display → Reduce motion: **ON**.

Or in Chrome DevTools: Cmd+Shift+P → "Show Rendering" → "Emulate CSS prefers-reduced-motion" → "reduce".

- [ ] **Step 2: Walk through every section**

```bash
npm run dev
```

For each section, verify:
- Hero: static Journal silhouette (no morph cycle, no mouse swirl).
- Sections 02 / 03 / 05: videos do **not** autoplay; user-controllable via controls.
- Section 06: clips do not auto-advance; manual dot navigation only; no blur transition.
- Section reveal: no fade/translate; sections render immediately.
- Section 09: particle system shows static Journal; no auto-cycle.

- [ ] **Step 3: Fix any non-compliant behavior**

If any section autoplays a video or animates a transform in reduced-motion mode, fix the relevant component/CSS.

- [ ] **Step 4: Disable reduced motion, re-verify default behavior**

Confirm normal mode still works.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A src/notepad-landing/
git commit -m "fix(notepad-landing): reduced-motion compliance pass"
```

(Skip if no changes needed.)

---

## Task 19: Performance pass — code-split Three.js

**Files:**
- Modify: `src/notepad-landing/index.tsx` (or each section) to lazy-load Three.js
- Verify: Vite chunk output

- [ ] **Step 1: Convert ParticleHero + ClosingCTA mounts to lazy import**

The cleanest way is to dynamically import the particle system inside the `useEffect`:

In `src/notepad-landing/sections/01-particle-hero.tsx`, replace the static import:

```tsx
// Remove:
import { mountParticleSystem } from '../three/particle-system';

// Inside the useEffect, replace the body with:
useEffect(() => {
  if (!canvasRef.current) return;
  let cleanup = () => {};
  let cancelled = false;
  import('../three/particle-system').then(({ mountParticleSystem }) => {
    if (cancelled || !canvasRef.current) return;
    const handle = mountParticleSystem(canvasRef.current, { prm, onShapeChange: setShapeIdx });
    cleanup = handle.cleanup;
  });
  return () => {
    cancelled = true;
    cleanup();
  };
}, [prm]);
```

Apply the same transformation to `src/notepad-landing/sections/09-closing-cta.tsx`.

- [ ] **Step 2: Run a build and inspect chunks**

```bash
npm run build
```

Look at the output. There should be a separate JS chunk for the particle system / Three.js (Vite names it from the dynamic import — something like `particle-system-<hash>.js`). Confirm Three.js is **not** in the main entry chunk.

- [ ] **Step 3: Confirm everything still renders**

```bash
npm run preview
```

Open `http://localhost:4173/notepad`. Particle hero mounts (~100–300ms later than before because of the chunk fetch). All else renders normally.

- [ ] **Step 4: Commit**

```bash
git add src/notepad-landing/sections/
git commit -m "perf(notepad-landing): code-split Three.js — particle-system loads on demand"
```

---

## Task 20: Full test run + Lighthouse smoke

**Files:**
- None (verification only).

- [ ] **Step 1: Run full vitest suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Manual Lighthouse run**

```bash
npm run preview
```

Open `http://localhost:4173/notepad` in Chrome → DevTools → Lighthouse → Mobile + Performance + Accessibility. Run.

Targets:
- Performance ≥ 90 (mobile)
- Accessibility ≥ 95
- Best Practices ≥ 95
- LCP ≤ 2.5s
- CLS ≤ 0.05

If any target misses, investigate (likely culprits: video preload, image sizes, CLS from hero canvas resize). Fix and re-run.

- [ ] **Step 5: Commit any performance fixes**

If you made changes:

```bash
git add -A
git commit -m "perf(notepad-landing): Lighthouse pass — <specific fix>"
```

(Skip if no changes needed.)

---

## Task 21: Final smoke + push

**Files:**
- None.

- [ ] **Step 1: Final dev walkthrough**

```bash
npm run dev
```

Walk the full page top-to-bottom on:
- Desktop (1440px wide)
- Tablet (DevTools 768px)
- Mobile (DevTools 414px)

Confirm copy is readable, layout doesn't break, videos play, hero particles morph, all CTAs work, scrolling is smooth.

- [ ] **Step 2: Click the primary CTA**

From `/notepad`, click `Open your notepad →`. Confirm you land at `/notepad/notes` and the existing Notepad editor renders.

- [ ] **Step 3: Confirm route by URL**

Type `http://localhost:5173/notepad/notes` directly. Editor renders.
Type `http://localhost:5173/notepad`. Landing renders.

- [ ] **Step 4: Stop server, run a clean test**

```bash
npm test
npx tsc --noEmit
npm run build
```

All three pass.

- [ ] **Step 5: Check git status**

```bash
git status
git log --oneline -25
```

Confirm the branch contains roughly 20 commits, each scoped to a single task.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin deepen-architecture
```

The plan is complete. Phase 13 (QA) — Playwright + code review — happens against this branch on a separate pass.
