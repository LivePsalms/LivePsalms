# Notepad Landing Page — Design Spec

**Date:** 2026-05-22
**Status:** Approved (Phase 1 intake locked in vault product file)
**Product file:** [`wiki/products/live-psalms-notepad-landing.md`](/Users/newmac/Documents/Branding-Content-OS%20Vault/wiki/products/live-psalms-notepad-landing.md) in the Branding-Content-OS vault
**Supersedes:** `live-psalms-notepad-page` (archived 2026-05-22)

---

## 1. Purpose

Build an in-app landing page for the Live Psalms Notepad feature. When a user clicks *Notepad* in the global nav, route them to a motion-rich landing that surfaces the value of the Notepad in the Live Psalms brand voice before they enter the editor. The existing `/notepad` route (which currently mounts the working editor) becomes this landing page; the editor moves to `/notepad/notes`.

**Why it exists:** Today, clicking *Notepad* drops the user directly into a writing surface with no orientation. The landing creates a quiet, recognition-driven moment between *clicking the nav* and *opening the editor*. It also doubles as the discoverability surface for Lamplight, the graph, scripture-inline, and the seven paper styles — features that today have no marketing real-estate.

**Single conversion:** every CTA on the page routes to `/notepad/notes`.

---

## 2. Route changes

### Before
```tsx
<Route path="/notepad" element={<Notepad />} />
```

### After
```tsx
<Route path="/notepad" element={<NotepadLanding />} />
<Route path="/notepad/notes" element={<Notepad />} />
```

### Affected logic in `src/App.tsx`

Current line 96:
```tsx
const isNotepadPage = location.pathname === '/notepad';
```

Becomes:
```tsx
const isNotepadLanding = location.pathname === '/notepad';
const isNotepadEditor = location.pathname.startsWith('/notepad/notes');
const isNotepadAny = isNotepadLanding || isNotepadEditor;
```

`hideFooter` (line 102) continues to use `isNotepadAny` (landing also hides the global footer — the landing has its own closing CTA).

Header visibility (line 121) currently hides on `isNotepadPage`. The landing should **show** the global header (it is a marketing-style surface inside the app, not a writing surface), so the condition becomes `!isNotepadEditor` for the existing branch. The header on the landing stays dark-mode-friendly because the hero ground is dark.

### Internal-link audit

Every existing `to="/notepad"` or `navigate('/notepad')` call in the codebase must be reviewed and reclassified as one of:
- **Landing intent** — stays `/notepad`
- **Editor intent** — becomes `/notepad/notes`

The audit produces a checklist of every call site with its disposition. Captured in implementation plan.

---

## 3. Component architecture

### File layout
```
src/notepad-landing/
  index.tsx                         # page composer + route element
  sections/
    01-particle-hero.tsx            # VANTA-style Three.js morph hero (Pencil → Heart → Journal)
    02-three-voices.tsx             # paired with notepad_video.mp4
    03-living-graph.tsx             # paired with graph.mp4, full-bleed
    04-lamplight.tsx                # still + ink-particle drift, no video
    05-scripture-margin.tsx         # closeup template clip
    06-seven-papers.tsx             # template-carousel with Emil blur crossfade
    07-tier-path.tsx                # Pinyon Script pull-quote moment
    08-trust-import.tsx             # triptych of trust lines
    09-closing-cta.tsx              # particles re-form into Journal silhouette
  three/
    particle-system.ts              # raw Three.js morph engine — extracted from VANTA hero ref
    paper-world.ts                  # raw Three.js scroll-driven scene — extracted from Napa main ref
    shapes/
      pencil.ts                     # PARTICLE_COUNT × Float32Array of XYZ
      heart.ts
      journal.ts
  hooks/
    use-prefers-reduced-motion.ts   # returns boolean; subscribes to matchMedia
    use-intersection-stage.ts       # IntersectionObserver wrapper for section reveal
    use-scroll-progress.ts          # rAF-throttled scroll → [0,1] mapped per section
  data/
    copy.ts                         # ALL section copy as exported constants — single source of truth
    papers.ts                       # the seven paper-style metadata (label, blurb, clip)
  styles/
    landing.css                     # CSS variables + section-specific styles
public/notepad-landing/
  graph.mp4                         # re-encoded from Graph_video.mov
  graph.webm
  graph-poster.jpg
  notepad.mp4
  notepad.webm
  notepad-poster.jpg
  templates/
    t1.mp4 / t1.webm / t1-poster.jpg     # × 4
```

### Why this shape

- **Each section is its own file, ~100–250 lines.** A reader can hold one section in context without scrolling.
- **Three.js code lives in plain `.ts` files** outside React. Sections import `mountParticleSystem(canvasEl, options)` and call it inside a single `useEffect`. This keeps Three.js lifecycle and React lifecycle separable.
- **Copy is centralized in `data/copy.ts`** so Phase 9 (or future editorial passes) can change wording in one place.
- **`hooks/` are reused across sections.** `usePrefersReducedMotion` and `useIntersectionStage` are the only React-side behavior shared.

### Data flow

```
App.tsx
  └─ /notepad route → NotepadLanding (src/notepad-landing/index.tsx)
       ├─ usePrefersReducedMotion()  ──── prm: boolean
       │   └─ passed down to every section as prop
       ├─ <ParticleHero prm={prm} />
       │     └─ useEffect → mountParticleSystem(canvasRef.current, { prm })
       │           └─ if prm: paint static Journal silhouette once and return cleanup
       │           └─ else: full morph engine with mouse interaction
       ├─ <ThreeVoices prm={prm} videoSrc=".../notepad.mp4" />
       │     └─ <video autoPlay={!prm} muted loop playsInline poster=".../notepad-poster.jpg" />
       ├─ <LivingGraph prm={prm} videoSrc=".../graph.mp4" />  // full-bleed
       ├─ <Lamplight prm={prm} />
       ├─ <ScriptureMargin prm={prm} />
       ├─ <SevenPapers prm={prm} clips={[...]} />
       │     └─ if prm: manual prev/next, no auto-cycle
       │     └─ else: 5s autoplay with Emil blur-crossfade transitions
       ├─ <TierPath />                   // pure type, no motion
       ├─ <TrustImport />                // pure type, no motion
       └─ <ClosingCTA prm={prm} />       // re-mounts particle system, final morph into Journal
```

No global state. No context. No store. Every section is a pure function of `prm` and (for video sections) its own asset path.

---

## 4. Three.js integration pattern

Each Three.js scene follows the same lifecycle pattern:

```tsx
function ParticleHero({ prm }: { prm: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const cleanup = mountParticleSystem(canvasRef.current, { prm });
    return cleanup;
  }, [prm]);

  return <canvas ref={canvasRef} aria-hidden="true" className="hero-canvas" />;
}
```

`mountParticleSystem` returns a cleanup function that:
1. Cancels the rAF loop.
2. Disposes geometry, materials, shaders.
3. Removes the WebGL context.
4. Detaches event listeners.

**Why a cleanup function rather than a ref:** Strict Mode double-invokes effects in dev. The cleanup must fully tear down so the second mount is clean.

**Performance gates inside `mountParticleSystem`:**
- Mobile (viewport < 768px): `PARTICLE_COUNT = 10000` instead of 25000.
- Mobile (touch): disable mouse swirl uniform.
- `prm = true`: skip the entire engine; render a static Journal silhouette once via 2D canvas (no WebGL context at all).

---

## 5. Asset pipeline

### Source files (already on disk)
```
/Users/newmac/Downloads/Psalms_app/reference/notepad_video.mov   # 12 MB
/Users/newmac/Downloads/Psalms_app/reference/Graph_video.mov     # 60 MB
/Users/newmac/Downloads/Psalms_app/reference/notepad_feature/
  Template_video1.mov / Template_video2.mov / Template_video3.mov / Template_video4.mov
```

### Re-encode targets (committed to `public/notepad-landing/`)
| Source | Output MP4 | Output WebM | Poster | Target size |
|---|---|---|---|---|
| `Graph_video.mov` (60 MB) | `graph.mp4` h.264 yuv420p crf 26 | `graph.webm` vp9 crf 32 | `graph-poster.jpg` 1920×1080 | ≤ 8 MB combined |
| `notepad_video.mov` (12 MB) | `notepad.mp4` h.264 yuv420p crf 24 | `notepad.webm` vp9 crf 32 | `notepad-poster.jpg` | ≤ 3 MB combined |
| `Template_video1-4.mov` (4 files) | `t{1-4}.mp4` | `t{1-4}.webm` | `t{1-4}-poster.jpg` | ≤ 2 MB each combined |

### Encode commands

Standardized ffmpeg invocations are documented in the implementation plan; the conventions used:

```bash
ffmpeg -i SRC.mov \
  -vf "scale='min(1920,iw)':-2,format=yuv420p" \
  -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -an OUT.mp4

ffmpeg -i SRC.mov \
  -vf "scale='min(1920,iw)':-2" \
  -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 -an OUT.webm

ffmpeg -i SRC.mov -ss 00:00:00.5 -vframes 1 -q:v 3 OUT-poster.jpg
```

All video tags use `<video muted autoPlay={!prm} loop playsInline preload="metadata" poster=".../X-poster.jpg">` with `<source type="video/webm">` first and `<source type="video/mp4">` as fallback.

---

## 6. Section-by-section spec

> Section copy is fully locked in [`data/copy.ts`](src/notepad-landing/data/copy.ts) — see Phase 1 of the vault product file for the exact strings. The implementation plan references `copy.section01.h1` etc. and does NOT re-quote them.

### 01 — Particle Hero
- Dark ground (`#0e0e0e` per VANTA reference; exact hex deferrable to Phase 4/7 but **dark stays dark per user lock**).
- Three.js morph between Pencil → Heart → Journal (target shapes derived from `hero_section.md` reference, ported verbatim).
- Particle colors re-skinned from VANTA's tan to Live Psalms palette: gradient lerp from Silence `#F6F0E6` → Seedpearl `#DFD3BF` → Cocoa `#7C6656`.
- Mouse-influenced swirl + push (uniform `uMouse3D`, smoothed mouseActive). Disabled on touch.
- Auto-cycle every 5s; three nav dots; the active form label text updates at the morph midpoint.
- Hero H1, sub, CTA, ghost CTA: real DOM nodes, NOT canvas-painted (a11y + SEO).

### 02 — Three Voices
- Paper ground (Silence `#F6F0E6`). The dark→paper transition is the deliberate brand moment.
- Two-column: copy left, looping `notepad.mp4` right, rounded with a 1px Cocoa border at 8% opacity.
- Sticky on scroll for ~120% viewport while copy fades in via `useIntersectionStage`.

### 03 — Living Graph
- **Full-bleed** `graph.mp4` against Silence ground.
- Copy overlaid bottom-left in Cormorant Garamond italic.
- Mono caption: bottom-right.
- Reduced motion: shows the poster only with copy overlay.

### 04 — Lamplight
- Paper ground; ink-particle drift (lightweight Three.js — < 60 particles).
- Single column, narrow measure (`max-width: 620px`).
- Three inset cards in a 1×3 horizontal row on desktop, stacked on mobile.
- Trust line in Inter mono at the foot, small.

### 05 — Scripture Margin
- Half-width Cormorant heading, half-width template clip showing inline scripture hover.
- Clip plays only when section is in view (Intersection-gated).

### 06 — Seven Papers
- Centered carousel: large clip in the middle, paper-style label below in Pinyon Script (the only display-script moment besides Section 07).
- Auto-advance every 5s with Emil blur-crossfade transition (0.7s, 22px blur peak, scales per `DESIGN.md`).
- Manual prev/next dots beneath.
- Reduced motion: static first frame of each clip; manual dots only.

### 07 — Tier Path
- No motion. Pure typography moment.
- Cormorant H2 + body + Pinyon Script pull quote + body cont.
- Pull quote: Zechariah 4:10 in Pinyon Script at ~64px, off-center.

### 08 — Trust / Import
- Three-line triptych in equal columns on desktop, stacked on mobile.
- All in Cormorant Garamond italic at ~24px.

### 09 — Closing CTA
- Returns to dark ground (`#0e0e0e`).
- Particle system re-mounts, runs once: Journal silhouette only (no morph cycle).
- Single CTA centered, secondary footnote beneath.

---

## 7. Reduced-motion contract

`usePrefersReducedMotion` reads `window.matchMedia('(prefers-reduced-motion: reduce)')` and subscribes. Every section accepts `prm: boolean` as a prop and branches:

| Element | `prm = false` (default) | `prm = true` |
|---|---|---|
| Hero particle morph | Full engine, 25K particles, mouse interaction, auto-cycle | Static Journal silhouette painted once via 2D canvas |
| Section reveal | Fade + Y-translate on `useIntersectionStage` | Immediate render, no transform |
| Video autoplay | `<video autoPlay loop>` | `<video controls>` (user-initiated) |
| Section 06 carousel auto-advance | 5s auto-advance + Emil crossfade | Manual prev/next, no transitions |
| Closing CTA particles | Re-mounts and runs | Skipped entirely |

No `setTimeout`-based animation should run when `prm` is true. All such logic is wrapped in `if (prm) return;` early-exit checks.

---

## 8. Performance budget

Lighthouse targets: ≥ 90 mobile, ≥ 95 desktop. LCP < 2.5s. CLS < 0.05. TBT < 200ms mobile.

Specific budgets:
- **Hero JS:** Three.js + particle system ≤ 200 KB gzip. Code-split via dynamic `import()` so the rest of the app doesn't pay for it.
- **Total page weight:** ≤ 12 MB (videos dominate; lazy-load all except hero canvas script).
- **First paint:** hero copy renders before particle canvas mounts. Canvas appears with a 200ms fade once `mountParticleSystem` returns.
- **Video loading:** `preload="metadata"` only. Videos start downloading when their section enters the viewport via `<IntersectionObserver rootMargin="200px">`.

---

## 9. Accessibility

- All Three.js canvases have `aria-hidden="true"`. The brand-voice copy is the accessible representation.
- All videos have `aria-label` describing what they show, and a captioned poster (`alt` on poster img when shown).
- Color contrast on dark hero: Silence text on `#0e0e0e` = ~17.1:1 (AAA).
- Color contrast on paper sections: Rum Raisin `#432C29` on Silence `#F6F0E6` = ~11.4:1 (AAA).
- Eyebrow labels in Inter mono have `aria-hidden="false"` but no semantic role — they're decorative typography, not headings.
- Heading hierarchy is enforced: one `<h1>` (hero), `<h2>` for each section, never skipped.
- Tab order: skip-to-content link at top; primary CTA reachable from hero in 2 tabs; all CTAs share a `.cta` focus style with a 2px Cocoa ring.

---

## 10. Error handling

- **Three.js mount failure** (no WebGL support): catch, log to console, render fallback CSS background (gradient between palette colors) + render copy normally. Section continues to function.
- **Video load failure**: `onError` handler falls back to the poster image with copy unchanged.
- **Reduced motion match-media unavailable**: default to `prm = true` (safer to be conservative).
- **Mobile detection without `matchMedia`**: assume mobile if `window.innerWidth < 768`; if `window` undefined (SSR — not currently a concern since this is a Vite SPA), default to a code-split deferred mount.

---

## 11. Testing strategy

### Unit tests (Vitest)
Located alongside the source files (`*.test.ts(x)`):

- `src/notepad-landing/data/copy.test.ts` — asserts the locked H1 string, sub string, and primary CTA text exactly (regression guard against editorial drift).
- `src/notepad-landing/hooks/use-prefers-reduced-motion.test.tsx` — asserts the hook returns true when `matchMedia('(prefers-reduced-motion: reduce)').matches` is true.
- `src/notepad-landing/index.test.tsx` — renders the page, asserts H1 in document, asserts primary CTA `href="/notepad/notes"`.
- `src/App.test.tsx` (extend existing if present, otherwise create) — asserts `<MemoryRouter initialEntries={["/notepad"]}>` renders `NotepadLanding`, and `["/notepad/notes"]` renders `Notepad`.

### Manual / Phase 13
- Three.js scene visual fidelity (eyeball + Playwright screenshot).
- Mouse interaction in the hero (manual).
- Scroll behavior across all sections (manual + Playwright scroll snapshots).
- Mobile viewport at 414px (manual).
- `prefers-reduced-motion` toggle in DevTools (manual).
- Lighthouse run (Phase 13 specialist).

### Not tested
- Three.js scene internal state (geometry, uniforms).
- Particle positions.
- Camera positions during scroll.

These are visual-only and verified by eye + Playwright in Phase 13.

---

## 12. Implementation order

1. **Asset pipeline first.** Re-encode all `.mov` → `.mp4`/`.webm`/`.jpg` and commit to `public/notepad-landing/`. Verify file sizes against budget.
2. **Route migration.** Add `/notepad/notes` route, point old `/notepad` element at a temporary placeholder `<NotepadLanding />` that renders just the H1. Audit internal links. Confirm editor still loads at the new route.
3. **Copy module.** `data/copy.ts` with every locked string.
4. **Hooks.** `usePrefersReducedMotion`, `useIntersectionStage`, `useScrollProgress`.
5. **Three.js modules.** `particle-system.ts` with shape modules. Verify in isolation.
6. **Sections, in order:** 01 Hero → 02 Three Voices → 03 Living Graph → 04 Lamplight → 05 Scripture Margin → 06 Seven Papers → 07 Tier Path → 08 Trust → 09 Closing CTA.
7. **Reduced-motion pass.** Every section toggled and verified.
8. **Performance pass.** Lighthouse, code-split the Three.js bundle.
9. **Tests + final Playwright smoke.** Phase 13 owns the final QA.

Each step ends with a working build (`bun run build` succeeds) and the relevant section is visually correct in `bun run dev`.

---

## 13. Out of scope (explicitly)

- The Notepad editor itself. Untouched. We move its route, nothing else.
- Lamplight backend. The Lamplight section markets the feature; it does not implement the AI.
- Authentication for `/notepad/notes`. If the editor today requires auth, the landing inherits whatever guard the existing route already had.
- The global header and footer. We only check that the header shows on the landing (and not on the editor route, where it already hides).
- SEO meta tags beyond a basic `<title>` and `<meta description>` — Phase 10 of the Build OS workflow (telescoped) decides full SEO posture.
- Animation of the Notepad's actual graph rendering — we use the pre-recorded `Graph_video` as the marketing visual.

---

## 14. Open questions (non-blocking, deferred to implementation)

- Exact hex of the dark hero ground: `#0e0e0e` vs. Rum Raisin `#432C29`. Visual call during implementation; both are brand-aligned.
- Whether `prefers-color-scheme: dark` should affect any non-hero section (probably no — paper sections stay paper).
- The closing CTA's "Already writing? Sign in →" footnote routes where? Phase 10 confirms; default is `/login`.

---

## 15. References

- Hero reference: `/Users/newmac/Downloads/Psalms_app/hero_section.md`
- Main reference: `/Users/newmac/Downloads/Psalms_app/main_section.md`
- Template transition grammar: `/Users/newmac/Downloads/Psalms_app/reference/notepad_feature/DESIGN.md`
- Source copy + Lamplight spec: `/Users/newmac/Downloads/Psalms_app/content.md`
- Audience research: `/Users/newmac/Downloads/Psalms_app/deep-research-report (1).md`
- Brand inheritance: `/Users/newmac/Documents/Branding-Content-OS Vault/wiki/companies/live-psalms.md`
- Vault product file (this build): `/Users/newmac/Documents/Branding-Content-OS Vault/wiki/products/live-psalms-notepad-landing.md`
- Vault product file (archived predecessor): `/Users/newmac/Documents/Branding-Content-OS Vault/wiki/products/live-psalms-notepad-page.md`
