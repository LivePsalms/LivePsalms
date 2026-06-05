# Footer Legal Pages — Privacy Policy & Terms and Conditions

**Date:** 2026-06-01
**Status:** Approved (design)

## Summary

Add user-accessible **Privacy Policy** and **Terms and Conditions** pages to the
LivePsalms app, surfaced from the global footer. Today the footer has a single
placeholder `Privacy` link (`href="#"`) and no legal content exists anywhere in
the app. This work adds two routed pages, wires the footer to them, and converts
the two source documents into styled, on-brand prose.

## Goals

- Two routed, shareable pages: `/privacy` and `/terms`.
- Footer shows **Privacy + Terms** links side by side, plus the existing copyright.
- Long legal content (headings, paragraphs, lists, and many tables) renders
  legibly, on-brand, and responsively — including on mobile.
- No new runtime dependencies (content is hand-converted to semantic JSX).
- Legal text edits remain straightforward in the future.

## Non-goals

- No markdown-rendering library (`react-markdown` etc.) — explicitly declined.
- No CMS / backend storage of legal text; content lives in the React components.
- No cookie banner, consent flows, or account-setting changes.
- No changes to the actual legal substance beyond the substitutions listed below.

## Decisions (from brainstorming)

1. **Presentation:** two separate routed pages (`/privacy`, `/terms`).
2. **Rendering:** hand-converted semantic JSX styled by a scoped CSS prose block
   (no markdown dependency).
3. **Footer:** Privacy + Terms links side by side; copyright opposite.
4. **Visibility:** legal pages are utility pages — they hide the global `Footer`
   and the `FinalReflectionCta`, like Contact/Community. Users navigate back via
   the always-present `Header`.

## Architecture

### Files

```
src/components/sections/LegalPage.tsx      ← shared layout shell
src/components/sections/PrivacyPolicy.tsx  ← Privacy Policy content (semantic JSX)
src/components/sections/Terms.tsx          ← Terms & Conditions content (semantic JSX)
src/index.css                              ← add `.legal-prose` style block
src/App.tsx                                ← add two routes + visibility flags
src/components/layout/Footer.tsx           ← Privacy + Terms links
```

### `LegalPage` component

A presentational shell shared by both documents.

- **Props:** `title: string`, `lastUpdated: string` (or a small `meta` block for
  Effective + Last Updated dates), `children: React.ReactNode`.
- **Renders:**
  - `<main>` landmark with `aria-label={title}`, `min-h-screen`, background
    `var(--app-bg)`, and top padding to clear the fixed `Header` (match the
    Contact/Community `py-32` convention).
  - A centered reading column, `max-w-[760px]`, horizontally centered with
    comfortable horizontal padding (`px-6 md:px-8`).
  - A header area: Cormorant Garamond `<h1>` title and an Inter "Effective Date /
    Last Updated" meta line in muted `hsl(var(--mersi-dark) / 0.55)`.
  - `<div className="legal-prose">{children}</div>` for the document body.
- **Behavior:** on mount, set `document.title` and scroll the window to top so
  navigating from the footer always lands at the top of the document.

### `PrivacyPolicy` / `Terms` components

Each renders `<LegalPage title=… lastUpdated=…>` with the converted document body
as plain semantic JSX (`<h2>`, `<h3>`, `<p>`, `<ul>/<ol>`, `<table>`,
`<blockquote>`, `<a>`). No per-element wrapper components — styling comes from the
`.legal-prose` scope.

### `.legal-prose` CSS block

Added to the global stylesheet. Styles plain tags inside `.legal-prose` in the
brand voice:

- `h2`, `h3`: Cormorant Garamond, with the existing heading color/weight feel;
  sensible top/bottom margins and a clear size ramp (h2 > h3).
- `p`, `li`: Inter, ~15–16px, line-height ~1.7, color `hsl(var(--mersi-dark))`,
  muted variants where appropriate.
- `ul`, `ol`: standard list markers and indentation.
- `a`: visible link treatment (underline or accent color) with hover state.
- `blockquote`: left border + subtle background to set off the callout notices
  (e.g. "Important Notice", "Our Commitment").
- `table`: full-width, collapsed borders, padded `th`/`td`, header row emphasis,
  hairline borders in `hsl(var(--mersi-dark) / …)`.
- **Table responsiveness:** each table is wrapped in a `div` with
  `overflow-x: auto` so wide tables scroll horizontally on narrow viewports
  instead of breaking the layout. (Either a reusable wrapper element in the JSX or
  a `.legal-prose table { display:block; overflow-x:auto }` rule — implementer's
  choice, but wide tables MUST scroll, not overflow.)

### Routing & visibility (`App.tsx`)

- Add routes:
  - `<Route path="/privacy" element={<PrivacyPolicy />} />`
  - `<Route path="/terms" element={<Terms />} />`
- Extend the visibility logic: add `isPrivacyPage` / `isTermsPage` (or a combined
  `isLegalPage`) and include them in the `hideFooter` expression
  ([App.tsx:121](../../../src/App.tsx#L121)) so legal pages render Header + content
  only (no `FinalReflectionCta`, no global `Footer`).

### Footer (`Footer.tsx`)

Replace the single placeholder anchor
([Footer.tsx:93-104](../../../src/components/layout/Footer.tsx#L93-L104)) with two
React Router `<Link>` elements:

- Left side: `Privacy` → `/privacy` and `Terms` → `/terms`, side by side in a
  small flex group (`gap`), each keeping the current classes
  (`text-white/50 … hover:text-white/80 transition-colors`).
- Right side: existing `© 2026 Live Psalms` copyright, unchanged.
- Preserve the `.footer-animate` class and the existing `border-t`/`justify-between`
  bottom-bar layout.
- Add `import { Link } from 'react-router-dom';`.

## Content fidelity — substitutions

Applied across **both** documents during conversion. All other text (effective
dates, legal clauses, tables, reference links) is reproduced verbatim.

| In source document | Becomes |
| --- | --- |
| `privacy@livepsalms.com` | `support@livepsalms.com` |
| `security@livepsalms.com` | `support@livepsalms.com` |
| `legal@livepsalms.com` | `legal@livepsalms.com` *(unchanged)* |
| `[Your Address], [City, State, ZIP], USA` | `17130 Van Buren Blvd, Unit 855, Riverside, CA 92504` |
| `[Your Phone Number]` | `+1 (818) 800-4075` |

- Email addresses render as `mailto:` links.
- Reference/citation links (the `[1]…[10]` sources) render as real `<a>` tags
  with `target="_blank" rel="noopener noreferrer"`.
- The Terms document's "Author: Manus AI on behalf of LivePsalms" line is dropped
  (internal authorship note, not user-facing legal content).

## Accessibility

- Each page uses a `<main>` landmark with an `aria-label`.
- One `<h1>` per page (the document title); section headings use `<h2>`/`<h3>`.
- Links are real anchors; external links use `rel="noopener noreferrer"`.
- Color contrast of body text on `var(--app-bg)` matches existing Contact page
  treatment (`hsl(var(--mersi-dark))`), which is already in use.

## Testing / verification

- `npm run build` passes (TypeScript + Vite).
- Lint passes.
- Manual checks:
  - `/privacy` and `/terms` render full content from the top.
  - Footer Privacy and Terms links navigate to the correct pages.
  - Wide tables scroll horizontally on a narrow (~375px) viewport rather than
    overflowing the layout.
  - Header is present on both pages for back navigation; no `FinalReflectionCta`
    and no global `Footer` appear on legal pages.

## Out of scope / future

- Filling in any remaining real-world legal details beyond the substitutions above.
- A combined `/legal` index or in-page table-of-contents / anchor navigation.
- Versioning or change-notification of the legal documents.
