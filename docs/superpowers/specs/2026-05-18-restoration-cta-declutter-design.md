# Restoration CTA Declutter Design

**Date:** 2026-05-18
**Scope:** Redesign the Zone 7 CTA on every purpose detail page to give the notepad invitation a single primary action. Move the newsletter signup into a small in-place modal triggered by a tiny secondary link.

**Supersedes:** parts of [2026-05-18-restoration-cta-notepad-link-design.md](2026-05-18-restoration-cta-notepad-link-design.md). The earlier design added the notepad CTA *above* the existing newsletter form, producing two competing primary actions in one zone. This pass keeps the same notepad invitation but demotes the newsletter to an in-modal action.

---

## Goal

The current `RestorationCTA` stacks three actions in one screen (read the heading, jot a reflection, sign up for the newsletter). Two competing primary actions (notepad vs. email form) crowd the same vertical column. This redesign collapses the section to a single primary CTA (notepad) with a single tiny secondary affordance (a text link that opens a newsletter signup modal).

## Current State

After the previous PR, `RestorationCTA` in [src/components/sections/MoodBoard.tsx](src/components/sections/MoodBoard.tsx) renders, in order:

1. `<h3>` — `"Continue Restoring Your {purposeWord}"`
2. `<p>` — `"Take a few moments to pause, reflect, and jot down what God is revealing to you."`
3. `<Link to="/notepad">` — `"Open your notepad →"` rendered as an underlined text link.
4. Hairline divider — `<div className="w-16 h-px bg-white/10 my-8" aria-hidden="true" />`
5. `<p>` — `"Sign up for our newsletter to receive devotions that restores you"`
6. `<input type="email">` + `<button>Subscribe</button>`

The CTA is rendered 11 times across the 11 purpose-detail components (`PeaceZones`, `HopeZones`, `StrengthZones`, `WholenessZones`, `PurposeZones`, `ConnectionZones`, `IdentityZones`, `JoyZones`, `ForgivenessZones`, `SurrenderZones`, `TrustZones`) via the shared `RestorationCTA` component.

The detail pages currently suppress the global `<FinalReflectionCta>` footer (see [src/App.tsx:94-98](src/App.tsx#L94)), so the Zone 7 newsletter form is the only newsletter signup on a detail page today. That constraint is preserved by routing the newsletter into a modal on this surface.

## New Behavior

### Visual structure (top → bottom) inside `RestorationCTA`

1. **Heading** — `"Continue Restoring Your {purposeWord}"` *(unchanged)*.
2. **Reflection prompt** — `"Take a few moments to pause, reflect, and jot down what God is revealing to you."` *(unchanged copy, same typography)*.
3. **Primary CTA — pill `<Link>`** — bordered pill rendered as a React Router `<Link to="/notepad">`. Visible label: `"Open your notepad"`, followed by an `aria-hidden` `<span>` containing `→`.
4. **Tiny secondary line** — small text rendered as: `Or <button type="button">join the newsletter</button>`. The bracketed portion is a `<DialogTrigger asChild>` button that opens the newsletter modal.

### What is removed from `RestorationCTA`

- The hairline divider `<div className="w-16 h-px bg-white/10 my-8" …>` (no longer separating two CTAs — there is only one primary CTA now).
- The `"Sign up for our newsletter to receive devotions that restores you"` `<p>` (relocates into the modal as a subtitle).
- The inline email `<input>` + Subscribe `<button>` (relocates into the modal).

### Styling specifics

- **Primary CTA pill** — `<Link>` with classes: `group inline-flex items-center gap-2 px-8 py-3.5 rounded-full border border-white/30 bg-white/5 text-sm text-white/95 tracking-wide hover:bg-white/10 hover:border-white/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 mt-2`.
  - Arrow `<span aria-hidden="true">→</span>` keeps the existing nudge behavior: `transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transform-none`.
- **Reflection prompt margin** — change from `mb-3` (which tightened it to the link beneath) to `mb-8` to give the pill button breathing room above it. The reflection prompt and the pill should feel like an invitation–response pair, not two stacked sentences.
- **Tiny secondary line** — wrapper `<p className="mt-6 text-xs text-white/40 tracking-wide">` with literal text "Or " followed by the trigger button. The trigger button uses classes: `underline underline-offset-4 decoration-white/30 text-white/70 hover:text-white hover:decoration-white/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-sm`. Label: `"join the newsletter"` (lowercase, sentence-final).

### `NewsletterDialog` component (new)

**Location:** new file at `src/components/sections/NewsletterDialog.tsx`.

**Public API:** the component accepts no props. It owns its own dialog state, internal trigger pattern, and form state. It exports a default-named function component `NewsletterDialog` and is composed with a `<DialogTrigger asChild>` rendering the caller's button. The caller wraps the trigger button as children:

```tsx
<NewsletterDialog>
  <button className="…">join the newsletter</button>
</NewsletterDialog>
```

Internally `NewsletterDialog` wraps the caller's children in `<DialogTrigger asChild>{children}</DialogTrigger>`, then renders `<DialogContent>` with the form.

**Behavior:**

- Built on the existing Radix `Dialog` primitive (`@/components/ui/dialog`).
- On submit: calls `subscribe()` from `@/components/sections/newsletter-actions` with `{ email, source: 'restoration-cta', client: supabase as unknown as NewsletterClient | null }`. The `as unknown as NewsletterClient | null` cast matches the boundary cast used in `FinalReflectionCta.tsx:71-73` — same comment about Supabase's `PostgrestFilterBuilder` shape applies.
- State machine: `'idle' | 'submitting' | 'success' | 'error'` plus an `alreadySubscribed: boolean` flag — identical to `FinalReflectionCta`.
- Modal stays open after success. The form is replaced by a success message in place; the user closes the modal manually via the standard close button or backdrop click. This matches `FinalReflectionCta`'s in-place success pattern.
- Microcopy reused verbatim from `FinalReflectionCta` for brand-voice consistency:
  - Success (new subscriber): `"Thanks — keep an eye on your inbox."`
  - Success (already subscribed): `"You're already in."`
  - Error: `"Try that again?"`

**Dialog content layout:**

- `<DialogTitle>` — italic Cormorant Garamond, sentence: `"Receive devotions in your inbox"`.
- `<DialogDescription>` — Inter 13-14px muted: `"A short note from us each week."`
- `<form>` with `<label className="sr-only">`, `<input type="email" required autoComplete="email" inputMode="email">`, and `<button type="submit">Subscribe</button>`.
- Success state: replaces the `<form>` with a `<p>` displaying the appropriate success microcopy.
- Error state: shows the error microcopy below the form (form remains; user can correct and resubmit).

**Dialog styling:** uses the default `DialogContent` chrome from the existing primitive — no overrides on the wrapper, padding, backdrop, or close button. Form fields inside the dialog use the same structural pattern as `FinalReflectionCta`'s form (transparent input, border-bottom underline, italic-friendly typography for the title/description) but with colors tuned for the dialog's light surface: dark ink for text, `hsl(var(--mersi-dark))` for the border-bottom and the submit button outline. Matches the visual language of `FinalReflectionCta` for brand consistency.

### Behavior

- Clicking the primary pill — SPA navigation to `/notepad`.
- Clicking the tiny "join the newsletter" link — opens the modal.
- Modal-open state: focus moves to the email input automatically (Radix Dialog default behavior).
- Escape key or backdrop click — closes the modal (Radix Dialog default behavior).
- Reduced motion — the pill arrow's translate is suppressed via `motion-reduce:transform-none`; modal's enter/exit animation is whatever the primitive uses by default (already respects reduced motion).
- Form submission — same `subscribe()` call as `FinalReflectionCta`. No new backend or migration is required.

### Out of scope

- No changes to `newsletter-actions.ts`, the Supabase schema, or any backend.
- No changes to `FinalReflectionCta.tsx`.
- No changes to the 11 call sites of `<RestorationCTA …/>` — the component's public API is unchanged.
- No copy changes to the heading or reflection prompt.
- No re-enabling of the global `<FinalReflectionCta>` on detail pages (intentionally left alone; detail-page newsletter signup happens only through the modal opened from this CTA).
- No new modal close-button styling — uses whatever `DialogContent` ships with today.

## Refactor footprint

- `RestorationCTA` in `MoodBoard.tsx`: JSX body is rewritten (component declaration and `RestorationCTAProps` type are unchanged). Roughly: drop 8 JSX elements (divider, newsletter prompt, form wrapper, input, button, two closing tags) and add 1 pill `<Link>` + 1 tiny `<p>` wrapper + 1 `<NewsletterDialog>` invocation.
- New file `src/components/sections/NewsletterDialog.tsx` — ~100 lines, single default export.

## Accessibility

- The pill `<Link>` retains a visible `focus-visible:ring-1 focus-visible:ring-white/40` focus state on the dark overlay.
- The tiny "join the newsletter" trigger is a `<button type="button">` (not an `<a>`) since it triggers a dialog, not navigation — matches WAI-ARIA guidance.
- The trigger gets the same focus-visible ring as the pill so keyboard users can see it on the dark overlay.
- `<DialogTitle>` and `<DialogDescription>` are required by the Radix primitive for proper `aria-labelledby` / `aria-describedby` wiring on the dialog — both are populated with real content (no `sr-only` workarounds).
- Form input has a `<label htmlFor="restoration-newsletter-email" className="sr-only">Email address</label>` — placeholder text alone is not a label.
- `<input>` carries `required`, `autoComplete="email"`, and `inputMode="email"` to match `FinalReflectionCta`.
- Success/error message regions use `aria-live="polite"` to announce status changes to screen readers (same pattern as `FinalReflectionCta`).

## Testing

The change is presentational + uses an existing well-tested action (`subscribe()` has its own test suite at `newsletter-actions.test.ts`). Manual verification covers:

1. On every purpose detail page (11 in total), navigate to the CTA zone and confirm:
   - The reflection prompt + pill button + tiny "Or join the newsletter" line render in that order.
   - No divider, no inline email form.
2. Click the pill → confirm SPA navigation to `/notepad`.
3. Click "join the newsletter" → confirm the modal opens, focus moves to the email input, the title and description render.
4. Submit a valid email → confirm the form is replaced by `"Thanks — keep an eye on your inbox."` in the same modal; modal stays open.
5. Submit the same email again (after re-opening the modal) → confirm `"You're already in."` message.
6. Submit with empty/invalid email → confirm browser-native validation prevents submission (or `subscribe()` returns `invalid-email` and `"Try that again?"` renders).
7. Press Escape / click the backdrop → confirm the modal closes and state resets to `idle` for the next open.
8. Keyboard `Tab` through the CTA — confirm focus reaches the pill, then the tiny "join the newsletter" trigger, both with visible focus rings.
9. OS "Reduce motion" enabled — confirm the pill arrow does not nudge horizontally on hover; modal enter/exit still functions (Radix handles reduced-motion internally).

No automated tests are added. `subscribe()` already has unit-test coverage; the new `NewsletterDialog` is a thin UI shell over an already-tested action, and the codebase has no React Testing Library installed.

## Risks

- **Source-tracking analytics**: the `source: 'restoration-cta'` value lands in whatever table `subscribe()` writes to. If product/analytics consumers expect a fixed enum of sources, this adds a new value. Mitigation: the `source` field is a free-form string today (see `FinalReflectionCta.tsx:69` using `'home-final-cta'`), so adding `'restoration-cta'` is consistent with the existing pattern.
- **Modal mounting in a horizontally-scrolled, GSAP-pinned container**: Radix portals dialog content to `document.body` by default, which sidesteps the parent's `transform: translate3d(…)` (a known gotcha that would otherwise position the dialog relative to the translated track). Confirmed in the primitive via `DialogPortal`. No mitigation needed.
- **Subscribe-modal close-button color**: the default `DialogContent` chrome assumes a light background. The form fields and close button should remain legible — confirm during manual verification. If the close button is invisible against the modal's default light background, that would be a primitive-level bug, not specific to this change.

## Open items (not blocking)

- The 3 placeholder-heading detail pages (Forgiveness, Surrender, Trust) still render `"Continue Restoring Your Serenity"`. Out of scope for this PR; the prior PR already documented this as intentional placeholder copy.
- The 11 `*Mobile` detail components are unchanged (they don't render `RestorationCTA`).
- The pre-existing layout issue where the Zone 7 CTA sits past the end of the pinned scroll range at viewports ≥ ~1600px wide is not addressed here. Worth a separate ticket.
