# Lamplight — Admin entry link on Profile

**Status:** Draft (2026-05-28)
**Owner:** Notepad — AI companion feature
**Parent slice:** Sub-Project 6 (partial) — Entitlements UI sans paywall (`2026-05-27-lamplight-entitlements-ui-design.md`, shipped on `feat/lamplight-entitlements-ui`)

## Purpose

Sub-Project 6 (partial) shipped `/admin/lamplight` for any user with `profiles.is_admin = true`. There is currently no in-app affordance to reach the route — admins must type `/admin/lamplight` into the URL bar.

This micro-slice adds a single discoverable entry point on the Profile page, visible only to admins, that routes to `/admin/lamplight`. Zero new data, zero new RPCs, zero new schema. One presentational component, one wire-in, one test file.

Sized for ~1 hour, one engineer.

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Placement | **Standalone block near top of Profile** | Between the header card (avatar + name) and the first existing section. First-class affordance, no scrolling required. |
| 2 | Shape | **Two-line link block** — heading "Lamplight Ops" + caption "Job queue, usage, retries" + right-aligned chevron | Enough context to know what's behind the link without becoming a heavy visual card. |
| 3 | Auth gate | **Reuses `useIsAdmin()` from Task 16** | No new RPC. Hook already exists, already tested, already gates `/admin/lamplight` itself. |
| 4 | Loading behavior | **Render `null` while loading** | No flash. `useIsAdmin` settles in <100ms; the gap is invisible. |
| 5 | Non-admin behavior | **Render `null`** | Non-admins never see the link, never know it exists. |
| 6 | Routing | **`<Link to="/admin/lamplight">` via react-router-dom** | Already imported in `ProfilePage.tsx` (`useNavigate`). Standard SPA navigation. |
| 7 | Component location | **`src/auth/components/AdminEntryLink.tsx`** | Lives alongside `EntitlementBlock.tsx` — both are profile-surface presentational pieces. |
| 8 | Brand chrome | **`var(--alabaster)` background + `var(--pale-stone)` border + Cormorant Garamond heading + Outfit caption** | Matches `<EntitlementBlock />` and the rest of the Lamplight surfaces on Profile. |
| 9 | Iconography | **`ChevronRight` from `lucide-react`** | Already used elsewhere in the codebase (e.g., `lucide-react` is in `package.json`). No new dependency. |
| 10 | Tests | **Three unit cases: loading / non-admin / admin** | Mirror the `useIsAdmin.test.ts` mock pattern. No integration test required — `useIsAdmin` itself is integration-tested. |

## Scope

### In

- New `src/auth/components/AdminEntryLink.tsx` — presentational component that conditionally renders the link block.
- New `src/auth/components/AdminEntryLink.test.tsx` — three unit cases (loading, non-admin, admin).
- Modified `src/auth/ProfilePage.tsx` — import + render `<AdminEntryLink />` in the slot immediately after the header card.

### Out

- Any new schema, RPC, hook, or adapter method. `useIsAdmin()` is reused as-is.
- A breadcrumb / back-button on `/admin/lamplight` pointing back to `/profile`. The admin page already supports the browser's history back button.
- A second discoverability surface (e.g., a header-bar icon). Out of scope for this slice; can be added later if real admins ask for it.
- Mobile-specific styling beyond what the existing Tailwind utility classes provide. The block is a single-row flex with a right-aligned arrow — it renders correctly at any viewport width without responsive overrides.
- Analytics on clicks. There is no analytics infrastructure in the project today; adding one for this surface is out of scope.

## Architecture

```
src/auth/ProfilePage.tsx
   └─ <AdminEntryLink />          ← new, conditionally renders
         │
         ├─ useIsAdmin()           ← reuses hook from src/admin/hooks/useIsAdmin.ts
         │     │
         │     └─ supabase.rpc('is_lamplight_admin')
         │
         └─ <Link to="/admin/lamplight">     ← react-router-dom Link
```

The component is purely presentational + gated. It has no internal state, no side effects beyond what `useIsAdmin()` itself does (one `is_lamplight_admin` RPC on mount, memoized by `user?.id`).

## Component — `src/auth/components/AdminEntryLink.tsx`

```tsx
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useIsAdmin } from '@/admin/hooks/useIsAdmin';

export function AdminEntryLink() {
  const { isAdmin, loading } = useIsAdmin();
  if (loading || !isAdmin) return null;

  return (
    <Link
      to="/admin/lamplight"
      className="flex items-center gap-3 px-5 py-4 rounded-xl transition-colors hover:bg-[color:var(--pale-stone)]"
      style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
      data-testid="admin-entry-link"
    >
      <div className="flex-1">
        <div
          className="text-sm"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
        >
          Lamplight Ops
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--silica)' }}>
          Job queue, usage, retries
        </div>
      </div>
      <ChevronRight size={16} aria-hidden style={{ color: 'var(--silica)' }} />
    </Link>
  );
}
```

### Behavioral contract

| State (from `useIsAdmin()`) | Render |
|---|---|
| `{ isAdmin: null, loading: true }` | `null` — no flash |
| `{ isAdmin: false, loading: false }` | `null` — invisible to non-admins |
| `{ isAdmin: true, loading: false }` | The styled `<Link>` block |

No `aria-hidden` on the outer Link — it's a real semantic anchor element, focusable, keyboard-navigable, and announced to screen readers as "link, Lamplight Ops, Job queue, usage, retries." The `ChevronRight` is decorative (`aria-hidden`) so it doesn't double-announce.

## Wire-in — `src/auth/ProfilePage.tsx`

Add a single import:

```tsx
import { AdminEntryLink } from './components/AdminEntryLink';
```

Insert `<AdminEntryLink />` in the JSX **immediately after the header card** (back arrow + avatar + name + email + tier badge) and **before the first existing section block**. The exact insertion point depends on the current JSX shape — the implementer should locate the spot programmatically.

Visual order on Profile becomes:

```
┌──────────────────────────────────────────┐
│ [←]  [Avatar]  Name                       │
│                email · Tier               │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐    ← admin-only
│ Lamplight Ops                          → │
│ Job queue, usage, retries                │
└──────────────────────────────────────────┘

[ existing Profile sections continue below ]
```

For non-admins the second block is `null` and the layout collapses naturally — the spacing utility classes on the surrounding container handle gap collapse without a layout shift.

## Test — `src/auth/components/AdminEntryLink.test.tsx`

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminEntryLink } from './AdminEntryLink';

vi.mock('@/admin/hooks/useIsAdmin', () => ({
  useIsAdmin: vi.fn(),
}));

import { useIsAdmin } from '@/admin/hooks/useIsAdmin';

afterEach(cleanup);

describe('AdminEntryLink', () => {
  it('renders nothing while loading', () => {
    (useIsAdmin as ReturnType<typeof vi.fn>).mockReturnValue({ isAdmin: null, loading: true });
    const { container } = render(<MemoryRouter><AdminEntryLink /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for non-admin', () => {
    (useIsAdmin as ReturnType<typeof vi.fn>).mockReturnValue({ isAdmin: false, loading: false });
    const { container } = render(<MemoryRouter><AdminEntryLink /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });

  it('renders the link with correct copy + href for admin', () => {
    (useIsAdmin as ReturnType<typeof vi.fn>).mockReturnValue({ isAdmin: true, loading: false });
    render(<MemoryRouter><AdminEntryLink /></MemoryRouter>);
    const link = screen.getByTestId('admin-entry-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/lamplight');
    expect(screen.getByText(/Lamplight Ops/i)).toBeInTheDocument();
    expect(screen.getByText(/Job queue, usage, retries/i)).toBeInTheDocument();
  });
});
```

The `afterEach(cleanup)` matches the convention added in `EntitlementBlock.test.tsx` — jsdom accumulates renders across tests without it, causing false multi-element matches.

## Acceptance criteria

1. Non-admin user opens `/profile` → DOM contains no element with `data-testid="admin-entry-link"`. The slice introduces exactly one new network call (the `is_lamplight_admin` RPC fired by `useIsAdmin()` on mount); there is no additional traffic beyond that.
2. Admin user (`profiles.is_admin = true`) opens `/profile` → the link block renders above the existing sections, says "Lamplight Ops" / "Job queue, usage, retries", and has `href="/admin/lamplight"`.
3. Clicking the link navigates SPA-style to `/admin/lamplight` and the page loads as built in Task 19.
4. While `useIsAdmin()` is still resolving, the link does NOT render (no admin-only content flashes for non-admins).
5. `npx tsc -b --noEmit` clean. `npx vitest run` 905+ passing (the pre-existing `garden-scene.test.tsx` failure remains; this slice adds 3 passing tests). `npm run lint` clean for the two new files and the modified profile page.
6. No regression in `EntitlementBlock`, `LamplightSettingsSection`, `useIsAdmin`, or `AdminLamplightPage`. The link block is purely additive.

## Files touched / created

### New

- `src/auth/components/AdminEntryLink.tsx`
- `src/auth/components/AdminEntryLink.test.tsx`

### Modified

- `src/auth/ProfilePage.tsx` — one import, one JSX node.

### Untouched

- `src/admin/hooks/useIsAdmin.ts` (reused as-is)
- All Sub-Project 6 (partial) work from the prior slice
- Schema, RPCs, edge functions

## Open follow-ups (later slices)

1. **Secondary entry surface** — a header-bar icon or a slash-command (`/admin`) might be worth adding if the admin user base grows beyond one. YAGNI for now.
2. **Admin breadcrumb on `/admin/lamplight`** — a "← Profile" link in the admin page header for fast round-trip. Skip until a real admin asks for it; browser back works fine.
3. **Click telemetry** — when paywall analytics ship, instrument this link too to confirm admins are actually using it. Out of scope today.

## Notes for the implementer

- `useIsAdmin()` is fine to call from a second component. It uses local state and a per-user-id RPC; React's component tree handles two concurrent callers cleanly. (There's a tiny duplicate-RPC cost — both `AdminEntryLink` on `/profile` and `AdminLamplightPage` on `/admin/lamplight` fire the RPC on mount. If this ever becomes a hot path, memoize at the auth-session level via `useAuthSession` or React Query. Not worth doing now.)
- The `<Link>` element renders as a real `<a>` with focus/keyboard semantics. Do not replace it with `<div onClick>` — it would break keyboard navigation and screen-reader announcements.
- The `data-testid="admin-entry-link"` attribute is required — both the unit test and any future e2e test depend on it as a stable hook.
- Place the JSX insertion AFTER the header card and BEFORE any existing section card on `ProfilePage.tsx`. Use existing surrounding spacing utility classes; do not introduce new layout wrappers.
- This slice ships on the same branch as Sub-Project 6 (partial) (`feat/lamplight-entitlements-ui`) — there is no separate branch. Merge happens whenever you merge that branch.
