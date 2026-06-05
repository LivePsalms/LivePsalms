# Footer Legal Pages (Privacy Policy & Terms) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add routed `/privacy` and `/terms` pages rendering the LivePsalms Privacy Policy and Terms & Conditions, linked from the global footer.

**Architecture:** A shared presentational `LegalPage` shell wraps two content components (`PrivacyPolicy`, `Terms`) written as plain semantic JSX. A scoped `.legal-prose` CSS block in `src/index.css` styles the prose (Cormorant headings, Inter body, bordered scrollable tables) in the brand voice. Two new React Router routes are added in `App.tsx`; legal pages join the `hideFooter` utility-page group so they render Header + content only. The footer's single placeholder `Privacy` anchor is replaced with two `<Link>`s (Privacy + Terms).

**Tech Stack:** Vite + React 19 + TypeScript, React Router v7, Tailwind (layout only) + inline styles, Vitest + React Testing Library + jsdom.

**Source of truth for content:** `docs/legal/privacy-policy.source.md` and `docs/legal/terms-and-conditions.source.md` (already committed; substitutions for emails/address/phone already applied). Convert these verbatim to JSX — do NOT re-edit the legal wording.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/components/sections/LegalPage.tsx` | Shared page shell: main landmark, reading column, title + dates header, prose wrapper, scroll-to-top + document.title on mount. |
| `src/components/sections/PrivacyPolicy.tsx` | Privacy Policy content as semantic JSX inside `LegalPage`. |
| `src/components/sections/Terms.tsx` | Terms & Conditions content as semantic JSX inside `LegalPage`. |
| `src/index.css` | Add the `.legal-prose` style block. |
| `src/App.tsx` | Add `/privacy` + `/terms` routes; add `isLegalPage` to `hideFooter`. |
| `src/components/layout/Footer.tsx` | Replace placeholder anchor with Privacy + Terms `<Link>`s. |
| `src/components/sections/LegalPage.test.tsx` | Test the shell behavior. |
| `src/components/sections/PrivacyPolicy.test.tsx` | Test title + content-fidelity substitutions. |
| `src/components/sections/Terms.test.tsx` | Test title + content-fidelity substitutions. |
| `src/components/layout/Footer.test.tsx` | Test Privacy + Terms link hrefs. |

---

## Task 1: `LegalPage` shared shell (TDD)

**Files:**
- Create: `src/components/sections/LegalPage.tsx`
- Test: `src/components/sections/LegalPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/LegalPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LegalPage } from './LegalPage';

afterEach(cleanup);

describe('LegalPage', () => {
  it('renders the title as an h1', () => {
    render(
      <LegalPage title="Privacy Policy" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
        <p>body</p>
      </LegalPage>,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Privacy Policy' });
    expect(heading).toBeInTheDocument();
  });

  it('renders the effective and last-updated dates', () => {
    render(
      <LegalPage title="Privacy Policy" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
        <p>body</p>
      </LegalPage>,
    );
    expect(screen.getByText(/Effective Date/i)).toBeInTheDocument();
    expect(screen.getByText(/Last Updated/i)).toBeInTheDocument();
  });

  it('renders children inside a main landmark with an accessible name', () => {
    render(
      <LegalPage title="Terms & Conditions" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
        <p>distinctive-body-text</p>
      </LegalPage>,
    );
    const main = screen.getByRole('main', { name: 'Terms & Conditions' });
    expect(main).toBeInTheDocument();
    expect(screen.getByText('distinctive-body-text')).toBeInTheDocument();
  });

  it('wraps children in a .legal-prose container', () => {
    const { container } = render(
      <LegalPage title="Privacy Policy" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
        <p>body</p>
      </LegalPage>,
    );
    expect(container.querySelector('.legal-prose')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/sections/LegalPage.test.tsx`
Expected: FAIL — cannot resolve `./LegalPage`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/sections/LegalPage.tsx`:

```tsx
import { useEffect } from 'react';

interface LegalPageProps {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  children: React.ReactNode;
}

const TITLE_STYLE: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontStyle: 'italic',
  fontWeight: 500,
  fontSize: 'clamp(2rem, 5vw, 3rem)',
  lineHeight: 1.1,
  color: 'hsl(var(--mersi-dark))',
  margin: 0,
};

const META_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '11px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'hsl(var(--mersi-dark) / 0.55)',
  marginTop: '14px',
};

export function LegalPage({ title, effectiveDate, lastUpdated, children }: LegalPageProps) {
  useEffect(() => {
    document.title = `${title} — Live Psalms`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <main
      className="min-h-screen px-6 md:px-8 pt-32 pb-24"
      style={{ background: 'var(--app-bg)' }}
      aria-label={title}
    >
      <div className="max-w-[760px] mx-auto w-full">
        <header className="mb-12">
          <h1 style={TITLE_STYLE}>{title}</h1>
          <p style={META_STYLE}>
            Effective Date: {effectiveDate} · Last Updated: {lastUpdated}
          </p>
        </header>
        <div className="legal-prose">{children}</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/sections/LegalPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/LegalPage.tsx src/components/sections/LegalPage.test.tsx
git commit -m "feat(legal): add shared LegalPage shell component"
```

---

## Task 2: `.legal-prose` styles in `src/index.css`

**Files:**
- Modify: `src/index.css` (append a new block at end of file)

No dedicated unit test (pure CSS); verified visually in Task 7 and by the build.

- [ ] **Step 1: Append the `.legal-prose` block to `src/index.css`**

Add the following at the END of `src/index.css`:

```css
/* ── Legal pages (Privacy Policy, Terms & Conditions) ───────────────── */
.legal-prose {
  font-family: Inter, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.75;
  color: hsl(var(--mersi-dark) / 0.85);
}

.legal-prose h2 {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(1.5rem, 3.5vw, 2rem);
  line-height: 1.2;
  color: hsl(var(--mersi-dark));
  margin: 2.5rem 0 1rem;
}

.legal-prose h3 {
  font-family: Inter, system-ui, sans-serif;
  font-weight: 600;
  font-size: 1.05rem;
  letter-spacing: 0.01em;
  color: hsl(var(--mersi-dark));
  margin: 1.75rem 0 0.75rem;
}

.legal-prose p {
  margin: 0 0 1rem;
}

.legal-prose ul,
.legal-prose ol {
  margin: 0 0 1rem;
  padding-left: 1.4rem;
}

.legal-prose li {
  margin: 0 0 0.4rem;
}

.legal-prose a {
  color: hsl(var(--mersi-orange));
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: opacity 0.2s ease;
}

.legal-prose a:hover {
  opacity: 0.7;
}

.legal-prose strong {
  font-weight: 600;
  color: hsl(var(--mersi-dark));
}

.legal-prose blockquote {
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
  border-left: 3px solid hsl(var(--mersi-orange) / 0.6);
  background: hsl(var(--mersi-dark) / 0.04);
  border-radius: 0 6px 6px 0;
}

.legal-prose blockquote p:last-child {
  margin-bottom: 0;
}

.legal-prose hr {
  border: 0;
  border-top: 1px solid hsl(var(--mersi-dark) / 0.12);
  margin: 2.5rem 0;
}

/* Tables: wrapped for horizontal scroll on narrow viewports */
.legal-prose .table-wrap {
  overflow-x: auto;
  margin: 0 0 1.5rem;
  -webkit-overflow-scrolling: touch;
}

.legal-prose table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  min-width: 520px;
}

.legal-prose th,
.legal-prose td {
  text-align: left;
  vertical-align: top;
  padding: 0.6rem 0.75rem;
  border: 1px solid hsl(var(--mersi-dark) / 0.15);
}

.legal-prose th {
  font-weight: 600;
  color: hsl(var(--mersi-dark));
  background: hsl(var(--mersi-dark) / 0.05);
}
```

NOTE: if `--mersi-orange` is not defined in `src/index.css`, substitute `--mersi-dark` for the link/blockquote accent colors (check the `:root` block in `src/index.css` first; both `--mersi-dark` and `--app-bg` are confirmed present there).

- [ ] **Step 2: Verify the file still compiles**

Run: `npm run build`
Expected: build succeeds (TypeScript + Vite). No CSS errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(legal): add .legal-prose styles for legal pages"
```

---

## Task 3: `PrivacyPolicy` page (content conversion, TDD)

**Files:**
- Create: `src/components/sections/PrivacyPolicy.tsx`
- Test: `src/components/sections/PrivacyPolicy.test.tsx`

**Conversion rules (apply to every section of `docs/legal/privacy-policy.source.md`):**
- `## X` → `<h2>`, `### X` → `<h3>`, paragraphs → `<p>`, `> ...` → `<blockquote><p>...</p></blockquote>`, `---` → `<hr />`.
- `**bold**` → `<strong>`, inline `` `code` `` → keep as plain text inside the element (no special styling needed) OR wrap in `<code>` (optional).
- Markdown links `[text](url)` → `<a href="url" target="_blank" rel="noopener noreferrer">text</a>`. Email addresses → `<a href="mailto:support@livepsalms.com">support@livepsalms.com</a>` (and `legal@livepsalms.com` likewise).
- Every markdown table → `<div className="table-wrap"><table><thead>…</thead><tbody>…</tbody></table></div>`.
- Reproduce the wording EXACTLY from the source file. Do not paraphrase. The source already has the correct emails/address/phone.

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/PrivacyPolicy.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PrivacyPolicy } from './PrivacyPolicy';

afterEach(cleanup);

describe('PrivacyPolicy', () => {
  it('renders the page title', () => {
    render(<PrivacyPolicy />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Privacy Policy/i }),
    ).toBeInTheDocument();
  });

  it('uses the support@ email and never the old privacy@/security@ addresses', () => {
    const { container } = render(<PrivacyPolicy />);
    const text = container.textContent ?? '';
    expect(text).toContain('support@livepsalms.com');
    expect(text).not.toContain('privacy@livepsalms.com');
    expect(text).not.toContain('security@livepsalms.com');
  });

  it('shows the real mailing address and no bracket placeholders', () => {
    const { container } = render(<PrivacyPolicy />);
    const text = container.textContent ?? '';
    expect(text).toContain('17130 Van Buren Blvd, Unit 855, Riverside, CA 92504');
    expect(text).not.toContain('[Your Address]');
    expect(text).not.toContain('[City, State, ZIP]');
  });

  it('renders at least one scrollable table wrapper', () => {
    const { container } = render(<PrivacyPolicy />);
    expect(container.querySelector('.table-wrap table')).not.toBeNull();
  });

  it('contains a major section heading from the document', () => {
    render(<PrivacyPolicy />);
    expect(
      screen.getByRole('heading', { name: /How We Share Your Information/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/sections/PrivacyPolicy.test.tsx`
Expected: FAIL — cannot resolve `./PrivacyPolicy`.

- [ ] **Step 3: Write the implementation**

Create `src/components/sections/PrivacyPolicy.tsx`. Convert the FULL contents of `docs/legal/privacy-policy.source.md` to semantic JSX inside `LegalPage`, following the conversion rules above. Skeleton (fill in ALL sections 1–17 + references — do not stop early):

```tsx
import { LegalPage } from './LegalPage';

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
      <h2>Our Privacy Commitment</h2>
      <p>
        Welcome to LivePsalms. We provide a faith-based, interconnected note-taking
        platform designed for Christian devotional practices, sermon listening, and
        thematic Bible study. {/* …continue exactly per source… */}
      </p>
      {/* … remaining paragraphs of the commitment section … */}

      <hr />

      <h2>1. Data Controller and Contact Information</h2>
      <p>
        LivePsalms is the data controller responsible for the processing of your
        personal data as described in this Privacy Policy. If you have any questions,
        concerns, or requests regarding your privacy, you may contact us at:
      </p>
      <ul>
        <li>
          <strong>Email</strong>:{' '}
          <a href="mailto:support@livepsalms.com">support@livepsalms.com</a>
        </li>
        <li>
          <strong>Mailing Address</strong>: LivePsalms Privacy Team, 17130 Van Buren
          Blvd, Unit 855, Riverside, CA 92504, USA
        </li>
      </ul>
      {/* …continue through every section… */}

      {/* Example table conversion (Section 3.1): */}
      <h3>3.1 Personal Data Provided Directly by You</h3>
      <p>{/* lead-in paragraph per source */}</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Specific Fields</th>
              <th>Purpose</th>
              <th>Legal Basis (GDPR)</th>
              <th>Required?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Account Credentials</strong></td>
              <td>Email address, password (stored only as a secure bcrypt hash — we never store your plaintext password)</td>
              <td>To create, authenticate, and secure your account; to send transactional emails such as email verification and password reset links.</td>
              <td>Performance of contract</td>
              <td>Yes</td>
            </tr>
            {/* …remaining rows… */}
          </tbody>
        </table>
      </div>

      {/* …all sections through 17, then References as a <ul> of external <a> links… */}
    </LegalPage>
  );
}
```

Reference link example (References section): each `[n] [text](url)` becomes
`<li>[1] <a href="https://gdpr-info.eu/" target="_blank" rel="noopener noreferrer">EU General Data Protection Regulation (GDPR) — Full Text</a></li>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/sections/PrivacyPolicy.test.tsx`
Expected: PASS (5 tests). If the table-wrap test fails, ensure at least the Section 3.1 table is wrapped in `.table-wrap`.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/PrivacyPolicy.tsx src/components/sections/PrivacyPolicy.test.tsx
git commit -m "feat(legal): add Privacy Policy page content"
```

---

## Task 4: `Terms` page (content conversion, TDD)

**Files:**
- Create: `src/components/sections/Terms.tsx`
- Test: `src/components/sections/Terms.test.tsx`

Same conversion rules as Task 3, applied to `docs/legal/terms-and-conditions.source.md`.

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/Terms.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Terms } from './Terms';

afterEach(cleanup);

describe('Terms', () => {
  it('renders the page title', () => {
    render(<Terms />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Terms (&|and) Conditions/i }),
    ).toBeInTheDocument();
  });

  it('uses support@ for account-security contact and never security@', () => {
    const { container } = render(<Terms />);
    const text = container.textContent ?? '';
    expect(text).toContain('support@livepsalms.com');
    expect(text).not.toContain('security@livepsalms.com');
  });

  it('keeps legal@ for DMCA / disputes', () => {
    const { container } = render(<Terms />);
    expect(container.textContent ?? '').toContain('legal@livepsalms.com');
  });

  it('shows real address + phone and no bracket placeholders', () => {
    const { container } = render(<Terms />);
    const text = container.textContent ?? '';
    expect(text).toContain('17130 Van Buren Blvd, Unit 855, Riverside, CA 92504');
    expect(text).toContain('+1 (818) 800-4075');
    expect(text).not.toContain('[Your Address]');
    expect(text).not.toContain('[Your Phone Number]');
  });

  it('does not include the internal Manus AI author line', () => {
    const { container } = render(<Terms />);
    expect(container.textContent ?? '').not.toContain('Manus AI');
  });

  it('renders a major section heading from the document', () => {
    render(<Terms />);
    expect(
      screen.getByRole('heading', { name: /Acceptable Use Policy/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/sections/Terms.test.tsx`
Expected: FAIL — cannot resolve `./Terms`.

- [ ] **Step 3: Write the implementation**

Create `src/components/sections/Terms.tsx`, converting the FULL contents of `docs/legal/terms-and-conditions.source.md` to semantic JSX inside `LegalPage`. Use the same patterns as Task 3 (h2/h3/p/ul/blockquote/hr, `.table-wrap` around the Subscription Tiers table in Section 3.1, mailto + external links, References list). Reproduce wording exactly; do NOT include any "Author: Manus AI" line. Skeleton:

```tsx
import { LegalPage } from './LegalPage';

export function Terms() {
  return (
    <LegalPage title="Terms & Conditions" effectiveDate="May 28, 2026" lastUpdated="May 28, 2026">
      <h2>Welcome to LivePsalms</h2>
      <p>{/* …exact source text… */}</p>
      <hr />
      <h2>1. Description of Services and No-Advice Disclaimer</h2>
      {/* …all sections 1–16 + References… */}
    </LegalPage>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/sections/Terms.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Terms.tsx src/components/sections/Terms.test.tsx
git commit -m "feat(legal): add Terms & Conditions page content"
```

---

## Task 5: Wire routes + visibility in `App.tsx`

**Files:**
- Modify: `src/App.tsx` (imports near top with other section imports; route list at lines ~165-206; `hideFooter` at line ~121)

No new unit test (routing wiring is verified via Footer test in Task 6 + manual checks in Task 7).

- [ ] **Step 1: Add imports**

In `src/App.tsx`, with the other `@/components/sections/...` imports near the top, add:

```tsx
import { PrivacyPolicy } from '@/components/sections/PrivacyPolicy';
import { Terms } from '@/components/sections/Terms';
```

- [ ] **Step 2: Add the routes**

Inside the `<Routes>` block (after the `/contact` route), add:

```tsx
<Route path="/privacy" element={<PrivacyPolicy />} />
<Route path="/terms" element={<Terms />} />
```

- [ ] **Step 3: Add visibility flags**

Find the page-flag block (around line 116-121). After `const isContactPage = location.pathname === '/contact';` add:

```tsx
const isLegalPage = location.pathname === '/privacy' || location.pathname === '/terms';
```

Then add `isLegalPage` to the `hideFooter` expression so it reads:

```tsx
const hideFooter = isDetailPage || isPurposePage || isNotepadAny || isLoginPage || isProfilePage || isWelcomePage || isCommunityPage || isContactPage || isLegalPage;
```

- [ ] **Step 4: Verify build + full test suite**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run test`
Expected: all tests pass (including the new legal tests).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(legal): route /privacy and /terms; hide footer/CTA on legal pages"
```

---

## Task 6: Footer Privacy + Terms links (TDD)

**Files:**
- Modify: `src/components/layout/Footer.tsx` (lines ~93-104, plus an import)
- Test: `src/components/layout/Footer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/Footer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

afterEach(cleanup);

describe('Footer', () => {
  it('renders a Privacy link pointing to /privacy', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /^Privacy$/i });
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('renders a Terms link pointing to /terms', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /^Terms$/i });
    expect(link).toHaveAttribute('href', '/terms');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/layout/Footer.test.tsx`
Expected: FAIL — no link with href `/privacy` (current anchor is `href="#"`, and no Terms link exists). If GSAP/ScrollTrigger throws under jsdom, see the note in Step 3.

- [ ] **Step 3: Update the Footer**

In `src/components/layout/Footer.tsx`:

1. Add the import at the top (after the existing imports):

```tsx
import { Link } from 'react-router-dom';
```

2. Replace the bottom-bar block (currently lines ~93-104):

```tsx
{/* Bottom bar */}
<div className="footer-animate w-full flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6">
  <a
    href="#"
    className="text-white/50 text-xs md:text-sm font-sans tracking-wide hover:text-white/80 transition-colors duration-300"
  >
    Privacy
  </a>

  <p className="text-white/40 text-xs md:text-sm font-sans tracking-wide">
    &copy;2026 Live Psalms
  </p>
</div>
```

with:

```tsx
{/* Bottom bar */}
<div className="footer-animate w-full flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6">
  <div className="flex items-center gap-6">
    <Link
      to="/privacy"
      className="text-white/50 text-xs md:text-sm font-sans tracking-wide hover:text-white/80 transition-colors duration-300"
    >
      Privacy
    </Link>
    <Link
      to="/terms"
      className="text-white/50 text-xs md:text-sm font-sans tracking-wide hover:text-white/80 transition-colors duration-300"
    >
      Terms
    </Link>
  </div>

  <p className="text-white/40 text-xs md:text-sm font-sans tracking-wide">
    &copy;2026 Live Psalms
  </p>
</div>
```

NOTE on GSAP under jsdom: the existing `useEffect` registers `ScrollTrigger` and runs `gsap.from`/`gsap.to`. These are no-ops/harmless in jsdom and should not throw. If the test errors inside the effect, the test still mounts the component synchronously first; `getByRole('link')` queries the rendered DOM. Do NOT remove or guard the GSAP code to satisfy the test — if a genuine jsdom error appears, wrap only the assertion timing (the render is synchronous, so links exist immediately). Report any GSAP throw rather than working around it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/layout/Footer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Footer.tsx src/components/layout/Footer.test.tsx
git commit -m "feat(footer): link Privacy and Terms to legal pages"
```

---

## Task 7: Full verification + manual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. Fix any lint issues in the new files (unused imports, etc.) and re-run.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `tsc -b` + `vite build` succeed with no type errors.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, then in a browser:
- Visit `/privacy` — full Privacy Policy renders from the top; tables present; headings styled (Cormorant); links work.
- Visit `/terms` — full Terms renders; tables present.
- On the home page (`/`), scroll to the footer; click **Privacy** → lands on `/privacy` at the top; back, click **Terms** → lands on `/terms`.
- Confirm the legal pages show the Header but NOT the `FinalReflectionCta` and NOT the global `Footer`.
- Resize the browser to ~375px wide: confirm wide tables scroll horizontally inside their `.table-wrap` rather than overflowing the page.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(legal): lint/build fixes for legal pages"
```

(Skip this commit if Steps 2–4 required no changes.)

---

## Self-Review Notes (author checklist — already verified)

- **Spec coverage:** routed pages (T3,4,5) ✓; footer Privacy+Terms (T6) ✓; scoped `.legal-prose` no-dep rendering (T2,3,4) ✓; tables scroll on mobile (T2 `.table-wrap`, T3/T4 markup, T7 manual) ✓; substitutions (T3/T4 tests) ✓; hide CTA+footer on legal pages (T5) ✓; accessibility main/h1/external-rel (T1, conversion rules) ✓; Manus AI line dropped (T4 test) ✓.
- **Placeholder scan:** the `{/* …continue per source… */}` markers in Tasks 3-4 are deliberate — the full text lives in the committed `docs/legal/*.source.md` files, which the implementer converts verbatim. Tests assert key content is present so partial conversion fails CI.
- **Type consistency:** `LegalPage` props (`title`, `effectiveDate`, `lastUpdated`, `children`) are used identically in Tasks 1, 3, 4.
