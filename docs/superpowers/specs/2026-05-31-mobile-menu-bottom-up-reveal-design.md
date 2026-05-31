# Mobile menu — bottom-up disclosure reveal

**Date**: 2026-05-31
**Surface**: `src/components/layout/MobileBottomDock.tsx` (mobile only, `< 768px`)
**Scope**: replace the existing right-side Radix `Sheet` drawer with a bottom-anchored panel that expands upward from above the MENU pill, using three simultaneous animation mechanics (panel reveal, button text swap, staggered item reveal).

## Goal

Give the mobile MENU pill a sleek, highly responsive bottom-up reveal that combines a panel max-height expansion, a button label swap (MENU ↔ CLOSE MENU), and a stagger-fade-translate reveal of the nav items. Corner radius stays uniform throughout the expansion (no scaleY stretch).

## Non-goals

- Does **not** touch the desktop nav in `HeaderDesktop.tsx`. Desktop already has its own scroll-collapse + burger behavior with different geometry (top-right vs bottom-center).
- Does **not** introduce a backdrop, scrim, swipe-down dismiss, escape-key dismiss, focus trap, or body-scroll lock. The user explicitly chose **button-only close**.
- Does **not** ship as a Radix component. This is the WAI-ARIA Disclosure pattern, not a Dialog.

## Behavior

### State machine

Two independent booleans inside the dock component:

| State | Initial | Toggled by | Side-effects |
|---|---|---|---|
| `panelOpen` | `false` | Tap MENU / CLOSE MENU button | When set to `false`, `socialExpanded` is forced to `false` in the same setter so reopening starts clean |
| `socialExpanded` | `false` | Tap SOCIAL row (only visible when `panelOpen === true`) | None |

### Open sequence (tap MENU)

1. `panelOpen` flips to `true`.
2. Panel max-height tweens `0 → 420px` over 500ms with `cubic-bezier(0.16, 1, 0.3, 1)` (ceiling chosen to accommodate the Social-expanded case without re-triggering the transition). Panel opacity tweens `0 → 1` over 400ms ease.
3. Button label swap fires at 180ms: MENU text becomes `display:none`, CLOSE MENU text becomes `display:inline`. The pill `min-width` simultaneously transitions over 300ms ease-out to fit the wider "CLOSE MENU" label so the pill doesn't snap.
4. Each `<li>` in `.menu-links` fades opacity `0 → 1` and translates `translateY(20px) → translateY(0)` over 400ms, delayed by `calc(100ms * var(--i))` where `--i` is its 1-indexed row position.

Total perceived open time: ~700ms.

### Close sequence (tap CLOSE MENU)

1. `panelOpen` flips to `false`. `socialExpanded` forced to `false` in same setter.
2. Items return to `opacity: 0; translateY(20px)` over 200ms ease (no stagger on close — items collapse together).
3. Panel max-height tweens back to 0 over 500ms with same easing.
4. Button label swaps back to MENU instantly at 180ms.

### Social nested reveal

When `socialExpanded` flips to `true`:
- The Instagram row inside the SOCIAL `<li>` reveals using the same max-height + opacity recipe scoped to a nested `.social-sub` container.
- The Instagram row sits as the first child of a flex-column SOCIAL `<li>`, so it appears **above** the SOCIAL label (per user direction).
- Panel container grows by the row height (the panel's `max-height: 360px` ceiling must accommodate the expanded case — use `420px` to be safe).
- Tapping SOCIAL again collapses Instagram back.

### Scroll-hide interaction

The dock currently uses `useScrollDirection` to hide on scroll-down. While `panelOpen === true`, override that to keep `visible = true`. Implementation: `const visible = panelOpen ? true : dir !== 'down';`. Prevents the panel from scrolling off mid-interaction.

### Loading-overlay handoff (preserved)

Each panel link continues to call `onNavTrigger?.()` for any label in `NAV_TRIGGER_LABELS` before navigation. Route change unmounts and remounts the dock, implicitly closing the panel. SOCIAL is not in `NAV_TRIGGER_LABELS` and does not fire the overlay.

## Markup

```tsx
<aside data-testid="mobile-bottom-dock" data-visible={visible} data-panel-state={panelOpen ? 'open' : 'closed'}>
  <div className="dock-cluster">
    <div
      id="mobile-menu-panel"
      className="menu-panel"
      aria-hidden={!panelOpen}
    >
      <ul className="menu-links">
        <li style={{ '--i': 1 }}>
          <Link to="/purpose" onClick={…}>PURPOSE</Link>
        </li>
        <li style={{ '--i': 2 }}>
          <Link to="/notepad" onClick={…}>NOTEPAD</Link>
        </li>
        <li style={{ '--i': 3 }}>
          <Link to="/community" onClick={…}>COMMUNITY</Link>
        </li>
        <li style={{ '--i': 4 }}>
          <Link to="/contact" onClick={…}>CONTACT</Link>
        </li>
        <li style={{ '--i': 5 }} className="social-row" data-social-state={socialExpanded ? 'open' : 'closed'}>
          <div className="social-sub" aria-hidden={!socialExpanded}>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              id="mobile-social-instagram"
            >
              INSTAGRAM ↗
            </a>
          </div>
          <button
            type="button"
            className="social-toggle"
            aria-expanded={socialExpanded}
            aria-controls="mobile-social-instagram"
            onClick={() => setSocialExpanded(v => !v)}
          >
            SOCIAL
          </button>
        </li>
      </ul>
    </div>

    <div className="dock-row">
      <Link to="/" aria-label="Home" className="logo-pill">…</Link>
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={panelOpen}
        aria-controls="mobile-menu-panel"
        onClick={() => setPanelOpen(v => !v)}
      >
        <span className="text-menu">MENU</span>
        <span className="text-close">CLOSE MENU</span>
      </button>
    </div>
  </div>
</aside>
```

The button has a single accessible name. When `panelOpen` is `false`, the visible text is "MENU"; when `true`, it is "CLOSE MENU". The `aria-expanded` attribute communicates state to assistive tech without needing `aria-label` overrides.

## CSS contract

All styles scoped to the new component. Tailwind classes for layout/spacing/color where they exist; a small `<style jsx>` or inline `<style>` block (or CSS module) for the animation rules that Tailwind can't express concisely.

```css
.menu-panel {
  width: 300px;
  max-width: calc(100vw - 32px);
  background: var(--deep-umber);
  border-radius: 16px;
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition:
    max-height 500ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 400ms ease;
}

[data-panel-state="open"] .menu-panel {
  max-height: 420px;
  opacity: 1;
  padding: 24px 0;
}

.menu-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: center;
}

.menu-links li {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 200ms ease, transform 200ms ease;
}

[data-panel-state="open"] .menu-links li {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) calc(100ms * var(--i)),
    transform 400ms cubic-bezier(0.16, 1, 0.3, 1) calc(100ms * var(--i));
}

.menu-links a,
.social-toggle {
  display: inline-block;
  color: white;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-decoration: none;
  background: none;
  border: 0;
  padding: 4px 8px;
  min-height: 32px;
  cursor: pointer;
}

.social-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.social-sub {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 250ms ease;
}

.social-row[data-social-state="open"] .social-sub {
  max-height: 40px;
  opacity: 1;
}

.menu-toggle {
  position: relative;
  min-width: 110px;
  transition: min-width 300ms ease-out;
}

[data-panel-state="open"] .menu-toggle {
  min-width: 150px;
}

.text-close { display: none; }
[data-panel-state="open"] .text-menu { display: none; }
[data-panel-state="open"] .text-close { display: inline; }

@media (prefers-reduced-motion: reduce) {
  .menu-panel,
  .menu-links li,
  .social-sub,
  .menu-toggle {
    transition: none !important;
  }
}
```

## Geometry

- The dock-cluster wraps both the panel and the dock-row in a single vertical flex column with `align-items: center` and `gap: 8px`. Panel sits above the dock-row.
- Panel width: fixed at 300px (centered), with `max-width: calc(100vw - 32px)` to handle very narrow viewports.
- Dock-row keeps its current geometry: logo (44×44) + 8px gap + MENU pill (44 tall, min-width transitions from 110px to 150px on open).
- The whole cluster's bottom edge is anchored at `pb-[max(0.75rem, env(safe-area-inset-bottom))]` — unchanged from current.

## Accessibility

- Button: `aria-expanded={panelOpen}`, `aria-controls="mobile-menu-panel"`. Single visible label that swaps via CSS `display:none/inline`.
- Panel `<div>`: `id="mobile-menu-panel"`, `aria-hidden={!panelOpen}`. No `role` attribute — it's a disclosure region, not a dialog.
- SOCIAL toggle: `aria-expanded={socialExpanded}`, `aria-controls="mobile-social-instagram"`.
- Tab order: MENU button → (when open) Instagram link → SOCIAL button → page content. Links remain real `<Link>` / `<a>` elements so keyboard navigation and screen-reader semantics are unchanged.
- No focus trap. Tabbing out of the panel proceeds to page content; this is correct for the disclosure pattern.
- Reduced motion: media query disables all transitions; the panel snaps instantly between states. Functionality is identical.

## Files touched

| File | Change |
|---|---|
| `src/components/layout/MobileBottomDock.tsx` | Replace `Sheet`/`SheetContent`/`SheetTrigger`/`SheetClose` imports + JSX with the new disclosure markup and add the inline `<style>` block for the animation contract. Drop the `useState` for `sheetOpen` in favor of `panelOpen` and `socialExpanded`. Update `visible` calc to override hide when panel is open. |
| `src/components/layout/MobileBottomDock.test.tsx` | Replace `getByRole('dialog')` assertions with `aria-expanded`/`aria-controls` checks against the toggle button and panel element. The "opens the Sheet drawer when MENU is clicked" test becomes "opens the panel when MENU is clicked" — assert `data-panel-state="open"` and that all 4 links + the SOCIAL button are present. Update the trigger button query: the previous test used `getByRole('button', { name: /open menu/i })` which relied on the explicit `aria-label`. The new button has a visible label of "MENU" (closed) or "CLOSE MENU" (open) and no `aria-label`, so the query becomes `getByRole('button', { name: /^menu$/i })` for the closed state and `getByRole('button', { name: /close menu/i })` for the open state. |

No new files. No changes to `@/data/projects` (still consumes `navItems` + `NAV_TRIGGER_LABELS`).

## Testing strategy

Update `MobileBottomDock.test.tsx` to cover:

1. **Closed by default**: `data-panel-state="closed"` on initial mount; the panel's links are not focusable (aria-hidden).
2. **Opens on MENU tap**: clicking the toggle flips `data-panel-state` to `"open"`, `aria-expanded="true"`, and all 4 nav links + SOCIAL button are present and queryable by role.
3. **Closes on CLOSE MENU tap**: a second click flips state back to `"closed"`; the toggle's visible text was CLOSE MENU at open and is MENU again at close (test via the two spans' computed styles or by querying the toggle's accessible-text per state).
4. **Social nested expand**: while panel is open, clicking SOCIAL flips its `data-social-state` to `"open"` and the Instagram link becomes queryable; clicking again collapses it.
5. **Closing panel collapses Social too**: open panel → expand Social → close panel → reopen panel → assert Social is collapsed.
6. **Scroll-hide override**: simulate scroll-down with panel open; assert `data-visible="true"` is preserved. Close panel, repeat scroll-down; assert `data-visible="false"`.
7. **Loading-overlay handoff**: tapping a `NAV_TRIGGER_LABELS` link fires `onNavTrigger`. Tapping SOCIAL does **not** fire it.
8. **Reduced motion**: existing assertion on `motion-reduce:transition-none` on the outer aside is preserved; add a sanity check that the inline `<style>` block emits a `prefers-reduced-motion` rule (read via getComputedStyle on the panel under a mocked matchMedia).

## Out-of-scope follow-ups

None — the design is self-contained within the dock component. If desktop ever needs a similar bottom-up reveal, that's a separate spec.
