# Lamplight — Entitlements UI, sans paywall (Sub-Project 6, partial)

**Status:** Draft (2026-05-27)
**Owner:** Notepad — AI companion feature
**Parent brief:** `Lamplight_AI_details.md` (root)
**Predecessors:**
- Sub-Project 1 — Foundation (`2026-05-25-lamplight-foundation-design.md`, shipped)
- Sub-Project 2 — Signal Layer (`2026-05-26-lamplight-signal-layer-design.md`, shipped)
- Sub-Project 3 — Reasoning Layer (`2026-05-26-lamplight-reasoning-layer-design.md`, shipped)
- Sub-Project 4 — Today's Lamp (`2026-05-27-todays-lamp-design.md`, shipped)
- Sub-Project 5 — Connection Cards (`2026-05-27-connection-cards-design.md`, shipped)
**Deferred sibling:** Sub-Project 6 (full) — paywall purchase flow + plan upgrade UX (not in this slice)

## Purpose

Sub-Project 6 in the brief bundles two unrelated deliverables under "Entitlements UI":

1. A real paywall card (replacing Foundation's placeholder), with purchase flow.
2. Admin tooling to re-queue failed embedding jobs.

This slice ships everything in (2) plus the *display* half of (1) — showing the user what tier they have, when their promo ends — and leaves the purchase flow for a later slice. After this slice ships:

- An operator with `profiles.is_admin = true` can navigate to `/admin/lamplight`, see counts of jobs by status, filter failed `lamplight_jobs` by kind / email / date, retry a single job, retry all failed jobs in bulk, and read a per-user token-spend leaderboard.
- A signed-in user opening `/profile` sees a small entitlement block in the Lamplight section — their tier (Plus / Lite / None), the entitlement source (promo / grant / subscription), and the promo countdown when one is active.
- Every Voyage embedding call and every Anthropic generation call writes one row to a new `lamplight_usage` audit table. The table powers the leaderboard and is the data foundation for the eventual paywall metering.

**Zero billing integration.** Nothing in this slice talks to Stripe, RevenueCat, Apple, or Google. Entitlement is still granted by SQL (the Foundation `lamplight_entitlements` table); we only *render* it here.

The slice is sized for ~1 week, one engineer.

## Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Scope of this slice | **Admin re-queue tooling + user-facing entitlement display + `lamplight_usage` telemetry table** | Paywall purchase flow and per-user rate limits deferred to a future slice. |
| 2 | Admin auth model | **`profiles.is_admin boolean`** | Set manually via SQL. No UI to toggle. Survives env changes; one DB-level fact, easy to grant/revoke. |
| 3 | Admin surface location | **New route `/admin/lamplight`** | Dedicated page guarded by `is_admin`. Room to grow into a real ops console without polluting Profile. |
| 4 | Admin operations | **List failed + filters + counts + retry one + retry all** | "Abandoned" status, manual "embed all my notes" backfill, and per-user grant/revoke UI all deferred. |
| 5 | Entitlement display surface | **Inside `LamplightSettingsSection` on Profile** | "Checked once, then forgotten" — Profile is the natural home. Tab strip already saturated with Connection Cards. |
| 6 | `lamplight_usage` purpose this slice | **Write-only audit log + admin aggregate panel** | Top-N users by token spend, last 7d / 30d window. No per-user "your usage" surface (premature without billing). |
| 7 | Admin write surface | **`SECURITY DEFINER` RPCs only** | No admin UPDATE/DELETE RLS policy on `lamplight_jobs`. Every admin write goes through a function whose first line is `if not is_lamplight_admin() then raise exception 'not authorized'`. |
| 8 | Bulk retry cap | **100 jobs per call** | Keeps the requeue transaction bounded. Repeat the call if more than 100 jobs are failed. |
| 9 | Cost map location | **In code, not DB** | Display-only estimate; the source of truth is provider pricing, not the app. Lives in `src/admin/lamplight-cost.ts` so it's grep-able and easy to update. |
| 10 | Usage insert reliability | **Fire-and-forget with `.catch(log)`** | A usage-table outage must never break embedding or generation. Audit is best-effort by design. |

## Scope

### In

- Migration `015_lamplight_entitlements_ui.sql`:
  - `profiles.is_admin` column (default false).
  - `is_lamplight_admin()` SQL helper.
  - `lamplight_usage` table + RLS (user reads own; admin reads all).
  - Admin SELECT policy on `lamplight_jobs`.
  - Five `SECURITY DEFINER` RPCs: `admin_list_lamplight_jobs`, `admin_lamplight_job_counts`, `admin_requeue_lamplight_job`, `admin_requeue_failed_lamplight_jobs`, `admin_lamplight_usage_top`.
- `/admin/lamplight` route (`src/admin/AdminLamplightPage.tsx`) with three panels: Job counts strip, Failed jobs table, Usage leaderboard.
- `useIsAdmin()` gate hook.
- `<EntitlementBlock />` rendered inside the existing `LamplightSettingsSection.tsx`.
- Adapter extensions on `LamplightAdapter` for the six admin operations; Supabase + Fake implementations.
- Usage instrumentation in `supabase/functions/embed-note/index.ts` and `supabase/functions/lamplight-generate/index.ts`. Shared `usage.ts` helper under `_shared/`.
- Cost map at `src/admin/lamplight-cost.ts`.
- Tests:
  - RLS extension: admin can read all jobs/usage; non-admin only own. All five admin RPCs raise for non-admin.
  - Admin requeue (single + bulk): correct field reset, idempotent.
  - Usage aggregation: correct sums + email join + window filter.
  - Usage instrumentation: row written per Voyage/Anthropic call; primary work survives a usage insert failure.
  - `<EntitlementBlock />` copy for all four entitlement+promo permutations.
  - `/admin/lamplight` page: non-admin redirect; admin sees all three panels; retry button calls adapter once.
  - Cost-map pricing: pin `estCostCents` against known token counts so a future pricing typo gets caught.

### Out

- Paywall purchase flow. No Stripe / RevenueCat / Apple / Google integration. Foundation's `PaywallCard` placeholder remains for the `tier='none' && !promo` state in the Lamplight tab.
- Plan upgrade UX, billing portal, receipt handling.
- Per-user rate limits or cost caps. Voyage's `truncation: true` (Signal Layer) and Anthropic's prompt size remain the only ceilings.
- Per-user "your token usage this month" surface. Premature without a billing relationship to anchor it to.
- An admin "embed all this user's notes now" backfill button. Deferred until a real support ticket demands it; the existing `scripts/backfill-note-embeddings.ts` covers ad-hoc support today.
- A `lamplight_jobs.status = 'abandoned'` state for permanently-dead jobs. Today an admin re-queues; if it fails 3× again, it lands back at `failed`. No need for a third terminal state until we see jobs that *should never* re-run.
- Admin UI to flip `profiles.is_admin`. Set via SQL Editor.
- Bulk retry across multiple kinds in one call. The optional `p_kind` filter is single-valued; pass null for all kinds, but the bulk path is capped per-kind in practice.
- Brand-styled chrome on `/admin/lamplight`. The page reuses the existing shadcn `Table`/`Button`/`Input`/`Select` primitives — utilitarian, not devotional.

## Database — migration `015_lamplight_entitlements_ui.sql`

### `profiles.is_admin`

```sql
alter table public.profiles
  add column is_admin boolean not null default false;
comment on column public.profiles.is_admin is
  'Manually toggled in SQL by service-role. Gates /admin surfaces. Not user-editable.';
```

No UI ever flips this. Operators set it with:

```sql
update public.profiles set is_admin = true where id = '<uuid>';
```

### `is_lamplight_admin()`

```sql
create or replace function public.is_lamplight_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_lamplight_admin() to authenticated;
```

`stable` lets the planner cache the result inside one query. `security definer` is required because the policies we build on top would otherwise recurse against themselves when a row is being evaluated. The `coalesce(..., false)` guarantees the function returns `false` (not `null`) for unauthenticated callers.

### `lamplight_usage`

```sql
create table public.lamplight_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  model text not null,
  artifact_kind text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  status text not null check (status in ('ok','error')),
  error_code text,
  created_at timestamptz not null default now()
);
create index lamplight_usage_user_created
  on public.lamplight_usage (user_id, created_at desc);
create index lamplight_usage_created
  on public.lamplight_usage (created_at desc);

alter table public.lamplight_usage enable row level security;

create policy "Users can view own lamplight_usage"
  on public.lamplight_usage for select
  using (auth.uid() = user_id or public.is_lamplight_admin());
```

No INSERT/UPDATE/DELETE policy is defined: service-role bypasses RLS, and no authenticated client ever writes to this table. The single SELECT policy is permissive-OR (own row OR admin), so admins see everything while users see only their own rows.

`artifact_kind` is a free-text column (no CHECK). The set of valid kinds grows with each new feature, and the table is read by admins and aggregation queries that handle unknown kinds gracefully — a CHECK would force a schema change every time a sibling feature ships a new kind.

### Admin SELECT policy on `lamplight_jobs`

```sql
create policy "Admins can view all lamplight_jobs"
  on public.lamplight_jobs for select
  using (public.is_lamplight_admin());
```

This adds to (rather than replaces) the four existing user-scoped policies from migration 008. We deliberately do NOT add admin UPDATE/DELETE policies. All admin writes flow through the SECURITY DEFINER RPCs below, where every call begins with the admin gate. That keeps the write surface auditable: every admin-driven mutation is a function call we wrote.

### `admin_list_lamplight_jobs`

```sql
create or replace function public.admin_list_lamplight_jobs(
  p_status text[] default array['failed'],
  p_kind text[] default null,
  p_user_search text default null,
  p_since timestamptz default now() - interval '7 days',
  p_limit int default 200
)
returns table (
  id uuid,
  user_id uuid,
  email text,
  kind text,
  status text,
  attempts int,
  payload jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select j.id, j.user_id, u.email::text, j.kind, j.status, j.attempts,
         j.payload, j.scheduled_at, j.started_at, j.finished_at, j.error
  from public.lamplight_jobs j
  left join auth.users u on u.id = j.user_id
  where j.status = any(p_status)
    and (p_kind is null or j.kind = any(p_kind))
    and (
      p_user_search is null
      or u.email ilike '%' || p_user_search || '%'
      or j.user_id::text = p_user_search
    )
    and j.scheduled_at >= p_since
  order by coalesce(j.finished_at, j.scheduled_at) desc
  limit greatest(1, least(p_limit, 500));
end;
$$;
grant execute on function public.admin_list_lamplight_jobs(text[], text[], text, timestamptz, int) to authenticated;
```

The `auth.users` join is allowed inside SECURITY DEFINER (the function owner is `postgres` / `supabase_admin`, which can read `auth.users`). Without it the admin would only see UUIDs, which makes triage painful.

### `admin_lamplight_job_counts`

```sql
create or replace function public.admin_lamplight_job_counts(
  p_since timestamptz default now() - interval '24 hours'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'queued',  count(*) filter (where status = 'queued'),
    'running', count(*) filter (where status = 'running'),
    'done',    count(*) filter (where status = 'done'),
    'failed',  count(*) filter (where status = 'failed'),
    'since',   p_since
  ) into v_result
  from public.lamplight_jobs
  where scheduled_at >= p_since;

  return v_result;
end;
$$;
grant execute on function public.admin_lamplight_job_counts(timestamptz) to authenticated;
```

### `admin_requeue_lamplight_job`

```sql
create or replace function public.admin_requeue_lamplight_job(p_job_id uuid)
returns public.lamplight_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lamplight_jobs;
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  update public.lamplight_jobs
     set status       = 'queued',
         attempts     = 0,
         error        = null,
         scheduled_at = now(),
         started_at   = null,
         finished_at  = null
   where id = p_job_id
  returning * into v_row;

  if not found then
    raise exception 'job not found: %', p_job_id;
  end if;

  return v_row;
end;
$$;
grant execute on function public.admin_requeue_lamplight_job(uuid) to authenticated;
```

Resetting `attempts` to 0 gives the worker its full 3-try window again. The cron sweep (Signal Layer, runs every minute) will claim the row at the next tick. Admins who want sub-second retry can call `supabase.functions.invoke('embed-note', { job_id })` after the RPC returns — the page does this.

### `admin_requeue_failed_lamplight_jobs`

```sql
create or replace function public.admin_requeue_failed_lamplight_jobs(
  p_kind text default null,
  p_limit int default 100
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  with picked as (
    select id from public.lamplight_jobs
     where status = 'failed'
       and (p_kind is null or kind = p_kind)
     order by finished_at asc nulls last
     limit greatest(1, least(p_limit, 100))
  )
  update public.lamplight_jobs j
     set status       = 'queued',
         attempts     = 0,
         error        = null,
         scheduled_at = now(),
         started_at   = null,
         finished_at  = null
   from picked
   where j.id = picked.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.admin_requeue_failed_lamplight_jobs(text, int) to authenticated;
```

The 100-row cap is enforced at the function level so a misconfigured client cannot run away with it.

### `admin_lamplight_usage_top`

```sql
create or replace function public.admin_lamplight_usage_top(
  p_window_days int default 7,
  p_limit int default 50
)
returns table (
  user_id uuid,
  email text,
  tokens_in bigint,
  tokens_out bigint,
  calls bigint,
  errors bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_lamplight_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select uu.user_id,
         u.email::text,
         uu.tokens_in,
         uu.tokens_out,
         uu.calls,
         uu.errors
  from (
    select user_id,
           sum(tokens_in)::bigint  as tokens_in,
           sum(tokens_out)::bigint as tokens_out,
           count(*)::bigint        as calls,
           count(*) filter (where status = 'error')::bigint as errors
    from public.lamplight_usage
    where created_at >= now() - make_interval(days => greatest(1, p_window_days))
    group by user_id
    order by sum(tokens_in) + sum(tokens_out) desc
    limit greatest(1, least(p_limit, 200))
  ) uu
  left join auth.users u on u.id = uu.user_id;
end;
$$;
grant execute on function public.admin_lamplight_usage_top(int, int) to authenticated;
```

Estimated cost in cents is computed *client-side* from `(tokens_in, tokens_out, model)`. The RPC doesn't return a single "cost" column because rows aggregate across models — the leaderboard maps over results and sums `estCostCents` per row. (A future iteration can break the aggregation by model if the leaderboard mixes too many models per user.)

## Edge function instrumentation

### Shared helper — `supabase/functions/_shared/usage.ts`

```ts
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface UsageRow {
  user_id: string;
  model: string;
  artifact_kind: string;
  tokens_in: number;
  tokens_out: number;
  status: 'ok' | 'error';
  error_code?: string | null;
}

export async function recordLamplightUsage(
  supabase: SupabaseClient,
  row: UsageRow,
): Promise<void> {
  // Fire-and-forget. Audit failure must never break the primary work path.
  const { error } = await supabase.from('lamplight_usage').insert(row);
  if (error) {
    console.error('[lamplight_usage] insert failed', error.message, { row });
  }
}
```

The helper is awaited (so we surface errors in logs), but callers ignore the return value and wrap the call in `.catch(...)` if it sits on the critical path.

### `embed-note`

After every Voyage call, the worker records one row per processed job. On success: `model='voyage-3-large'`, `artifact_kind='embedding_refresh'`, `tokens_in = response.usage.total_tokens`, `tokens_out = 0`, `status='ok'`. On Voyage error after retry exhaustion (i.e. when we mark the job `failed`): same fields with `status='error'`, `error_code = 'voyage_' || http_status`, tokens at 0. Mid-retry transient errors do NOT write a row — only terminal outcomes do. This keeps the row count close to "one row per billable Voyage call" rather than one per HTTP attempt.

### `lamplight-generate`

After every Anthropic call dispatched from one of the kinds (`daily_devotion`, `connection_card_why`), record one row with `model = <Anthropic model id>`, `artifact_kind = <dispatch kind>`, tokens from `response.usage.{input_tokens, output_tokens}`, `status='ok'`. On a thrown error path (validator failure, network error), record `status='error'` with `error_code` set to the failure reason string (`validators_failed`, `network`, `no_embedding`, …). Skip the row entirely for `smoke_test`.

## UI — `/admin/lamplight`

### Route registration

`src/App.tsx` imports `AdminLamplightPage` and registers `<Route path="/admin/lamplight" element={<AdminLamplightPage />} />`. No nested guard at the routing layer — the page itself runs `useIsAdmin()` and redirects on `false`.

### `useIsAdmin()`

```ts
export function useIsAdmin(): { isAdmin: boolean | null; loading: boolean } {
  const { user } = useAuthSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let cancelled = false;
    supabase.rpc('is_lamplight_admin').then(({ data, error }) => {
      if (cancelled) return;
      setIsAdmin(error ? false : Boolean(data));
    });
    return () => { cancelled = true; };
  }, [user?.id]);
  return { isAdmin, loading: isAdmin === null };
}
```

The hook returns `null` while the RPC is in flight so the page can render a skeleton instead of flashing the redirect target.

### Page shell

```
┌─ /admin/lamplight ────────────────────────────────────────────┐
│ Lamplight Ops                              [Refresh]          │
│                                                                │
│ ┌─Job counts (last 24h)──────────────────────────────────────┐ │
│ │ Queued 3  Running 0  Done 412  Failed 2   [Window: 24h ▾] │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌─Failed jobs────────────────────────────────────────────────┐ │
│ │ Kind ▾  embedding_refresh                                  │ │
│ │ Email   [_______]   Since [Last 7 days ▾]  [Retry all]    │ │
│ │ ───────────────────────────────────────────────────────── │ │
│ │ 17:42  embedding_refresh  jane@ex.com  x3  voyage_429 [↻]│ │
│ │ 17:31  embedding_refresh  ben@ex.com   x3  voyage_500 [↻]│ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌─Token spend (top 50, last 7d)──────────────────────────────┐ │
│ │ Window [7d ▾]                                              │ │
│ │ jane@ex.com   412k in · 18k out · ~$1.24  · 89 calls       │ │
│ │ ben@ex.com    220k in ·  9k out · ~$0.62  · 33 calls       │ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

Hooks (one per panel, plain `useState` + `useEffect` — no React Query dependency added):

- `useAdminJobCounts(windowHours)` — auto-refreshes every 30s.
- `useAdminFailedJobs(filters)` — refetches when filters change. Filters: `kind`, `email`, `sinceDays`.
- `useAdminUsageTop(windowDays)` — refetches on window change.

Retry single button calls `adapter.adminRequeueJob(id)` then `supabase.functions.invoke('embed-note', { body: { job_id: id } })` (fire-and-forget, so sub-second feedback even before the cron sweep). On success, the row is optimistically removed from the table; the next refetch confirms.

"Retry all" shows a confirm dialog when count > 5: "Re-queue N failed jobs? They'll retry from attempts=0." Calls `adapter.adminRequeueAllFailed(currentKindFilter || undefined)` and toasts the count returned.

### Empty / loading / error states

- Loading the page: skeleton blocks for each panel.
- Loading inside a panel: row-level skeleton or `…`.
- Empty Failed jobs: "No failed jobs in the selected window — Lamplight is healthy."
- Empty leaderboard: "No usage recorded in the selected window."
- Non-admin: `<Navigate to="/" replace />` after `useIsAdmin()` resolves to `false`.

## UI — `<EntitlementBlock />` inside `LamplightSettingsSection`

### Placement

Inside `src/auth/components/LamplightSettingsSection.tsx`, render `<EntitlementBlock />` between the existing `<h3>Lamplight</h3>` heading and the first `<label>` (the on/off checkbox). The block reuses the existing card chrome — same padding, same `var(--alabaster)` background — so it visually nests inside the section rather than introducing a new card.

### Hook

The existing `useLamplightEntitlement()` hook (Foundation) already returns `{ entitlement, promo }` where `entitlement: LamplightEntitlement | null` and `promo: PromoConfig`. No changes required.

### Display matrix

| `entitlement.tier` | `promo.promoActive` | Block renders | Copy |
|---|---|---|---|
| `'plus'` | any | yes | **Lamplight Plus** · until `{expiresAt|fmt('MMM D, YYYY')}` (omit "until …" if `expiresAt` is null); caption: `via {source}` |
| `'lite'` | any | yes | **Lamplight Lite** · until `{expiresAt|fmt}` (or just **Lamplight Lite**); caption: `via {source}` |
| `'none'` | true | yes | **Free during launch promo** · ends `{promoEndsAt|fmt}`; no caption |
| `'none'` | false | no | block does not render; the Lamplight tab's existing `PaywallCard` handles this state |

Date format: relative-aware. If `expiresAt` is within 14 days, show `"in 3 days"`; otherwise `"Jun 15, 2026"`. Uses `Intl.RelativeTimeFormat` + `Intl.DateTimeFormat` (no library). Null-safe: if `expiresAt` is missing, drop the "until …" segment instead of rendering "until null".

Styling: same as the surrounding settings section — `var(--alabaster)` background, `var(--deep-umber)` text, Cormorant Garamond serif heading, Outfit sans-serif body. Tiny block — roughly 60–80 px tall.

## Cost map — `src/admin/lamplight-cost.ts`

```ts
// Display-only estimate. Source of truth is provider pricing.
// Update when Voyage or Anthropic adjust rates.
const PRICE_PER_M_TOKENS_CENTS: Record<string, { in: number; out: number }> = {
  'voyage-3-large':    { in: 18,   out: 0    },  // $0.18 / 1M
  'claude-haiku-4-5':  { in: 100,  out: 500  },  // verify against Anthropic pricing page before merge
  'claude-sonnet-4-6': { in: 300,  out: 1500 },
};

export function estCostCents(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICE_PER_M_TOKENS_CENTS[model] ?? { in: 0, out: 0 };
  return Math.round((tokensIn * p.in + tokensOut * p.out) / 1_000_000);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
```

A test pins the math for two known models against known token counts so a future pricing typo gets caught.

## Adapter additions

### `src/notepad/storage/lamplight-adapter.ts`

Add to the existing interface (alphabetical with existing methods):

```ts
export interface AdminJobFilters {
  status?: Array<'queued' | 'running' | 'done' | 'failed'>;
  kind?: string[];
  userSearch?: string;
  since?: string; // ISO timestamp
  limit?: number;
}
export interface AdminJobRow {
  id: string;
  userId: string;
  email: string | null;
  kind: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  attempts: number;
  payload: unknown;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}
export interface AdminJobCounts {
  queued: number; running: number; done: number; failed: number; since: string;
}
export interface AdminUsageRow {
  userId: string; email: string | null;
  tokensIn: number; tokensOut: number; calls: number; errors: number;
}

export interface LamplightAdapter {
  // … existing methods …
  isLamplightAdmin(): Promise<boolean>;
  adminListJobs(filters: AdminJobFilters): Promise<AdminJobRow[]>;
  adminJobCounts(sinceIso: string): Promise<AdminJobCounts>;
  adminRequeueJob(jobId: string): Promise<AdminJobRow>;
  adminRequeueAllFailed(kind?: string, limit?: number): Promise<number>;
  adminUsageTop(windowDays: number, limit?: number): Promise<AdminUsageRow[]>;
}
```

### `src/notepad/storage/supabase-lamplight-adapter.ts`

Each method is a thin `supabase.rpc(...)` wrapper that maps snake_case columns to camelCase. Errors throw. Pattern matches the existing `enqueueEmbedding` implementation.

### `src/notepad/storage/fake-lamplight-adapter.ts`

In-memory implementations against the existing fake state, so tests can simulate admin flows without a database. The fake adapter already carries a `jobs: AdminJobRow[]` array (Signal Layer); we add a `usage: AdminUsageRow[]` shape and the six methods on top of those.

## State machine — admin retry lifecycle

```
[failed]                              [queued]
   │                                     │
   │ admin clicks ↻                      │
   │ admin_requeue_lamplight_job(id) ─►  │
   │ attempts=0, error=null,             │
   │ scheduled_at=now(),                 │
   │ started_at=null, finished_at=null   │
   │                                     │
   │           or: admin_requeue_failed_lamplight_jobs(kind, ≤100)
   │
   ▼
[queued] ──► claimed by cron sweep or by client invoke ──► [running] ──► …
```

The retry is intentionally additive — it does not skip the worker's validation, hash check, or retry logic. Re-running a job that succeeds quietly because its content_hash is current is a feature, not a regression: the worker bails to `done` without calling Voyage again.

## Acceptance criteria

This slice is done when every item below holds.

1. Migration `015_lamplight_entitlements_ui.sql` runs clean on a fresh project. `profiles.is_admin` exists. `lamplight_usage` exists with the two indexes. The five admin RPCs are callable by `authenticated`. `is_lamplight_admin()` returns `false` for non-admins and unauthenticated callers, `true` for admins.
2. Setting `profiles.is_admin = true` for an account loads `/admin/lamplight` successfully. Setting it false redirects to `/`.
3. The admin sees three panels: counts strip (with window selector), failed-jobs table with filters (kind, email, since), and a top-50 usage leaderboard (with window selector).
4. Retry single resets `status=queued, attempts=0, error=null, scheduled_at=now(), started_at=null, finished_at=null` and the row disappears from the "failed" view. The cron sweep processes it within 60 s, or the page's explicit `invoke('embed-note', {job_id})` processes it within ~1 s.
5. "Retry all failed" calls the bulk RPC, returns the count (≤ 100), toasts the count, and refreshes the table.
6. After an `embed-note` invocation, a `lamplight_usage` row exists with `model='voyage-3-large'`, `artifact_kind='embedding_refresh'`, tokens from the Voyage response, `status='ok'`. After a `lamplight-generate` invocation with `kind='daily_devotion'` or `'connection_card_why'`, a row exists with the corresponding Anthropic model and token counts. `smoke_test` does not create a row.
7. Inducing a terminal Voyage `429` writes a single `lamplight_usage` row with `status='error'`, `error_code='voyage_429'`, tokens 0. Mid-retry transient errors do not write a row.
8. A user opening `/profile` sees the entitlement block in the Lamplight section. Copy matches the matrix in §"Display matrix" for all four entitlement+promo permutations.
9. RLS: user A cannot read user B's `lamplight_usage` rows. Admin reads both. Non-admin call to any `admin_*` RPC raises `not authorized`. Existing `lamplight_jobs` user-scoped policies remain in effect; admin SELECT additionally grants global read.
10. A usage-table insert failure (mocked transport error inside `recordLamplightUsage`) does NOT cause the primary embedding/generation work to fail — the function returns its normal success/failure based on its own work, and the usage error is logged.
11. `npm run lint`, `tsc -b`, `vitest run` pass. All seven new test files green. No regressions in Foundation (four-state branching, profile, forget-data), Signal Layer (queue, sweep, BSB ingest, backfill), Reasoning Layer, Today's Lamp, or Connection Cards.
12. Pricing-table test pins `estCostCents('voyage-3-large', 1_000_000, 0) === 18` and `estCostCents('claude-sonnet-4-6', 1_000_000, 500_000) === 1050`.

## Files touched / created

### New files

- `supabase/migrations/015_lamplight_entitlements_ui.sql`
- `supabase/functions/_shared/usage.ts`
- `src/admin/AdminLamplightPage.tsx`
- `src/admin/components/JobCountsStrip.tsx`
- `src/admin/components/FailedJobsTable.tsx`
- `src/admin/components/UsageLeaderboard.tsx`
- `src/admin/hooks/useIsAdmin.ts`
- `src/admin/hooks/useAdminJobCounts.ts`
- `src/admin/hooks/useAdminFailedJobs.ts`
- `src/admin/hooks/useAdminUsageTop.ts`
- `src/admin/lamplight-cost.ts`
- `src/auth/components/EntitlementBlock.tsx`
- Tests:
  - `supabase/migrations/015_admin_rls.test.ts` (or extension to `rls-isolation.test.ts`)
  - `src/admin/admin-requeue.test.ts`
  - `src/admin/admin-usage-aggregation.test.ts`
  - `supabase/functions/_shared/usage.test.ts` (instrumentation parity)
  - `src/auth/components/EntitlementBlock.test.tsx`
  - `src/admin/AdminLamplightPage.test.tsx`
  - `src/admin/lamplight-cost.test.ts`

### Modified files

- `src/App.tsx` — register `/admin/lamplight` route.
- `src/notepad/storage/lamplight-adapter.ts` — add admin methods + types.
- `src/notepad/storage/supabase-lamplight-adapter.ts` — implement admin methods via RPC.
- `src/notepad/storage/fake-lamplight-adapter.ts` — in-memory admin methods.
- `src/auth/components/LamplightSettingsSection.tsx` — render `<EntitlementBlock />`.
- `supabase/functions/embed-note/index.ts` — call `recordLamplightUsage` after terminal outcome.
- `supabase/functions/lamplight-generate/index.ts` — call `recordLamplightUsage` for `daily_devotion` and `connection_card_why`.

### Untouched

- All Foundation, Signal Layer, Reasoning Layer, Today's Lamp, Connection Cards UI.
- Foundation's `PaywallCard` (still rendered for `tier='none' && !promo` in the Lamplight tab).
- `lamplight_entitlements`, `lamplight_settings`, `lamplight_artifacts`, `lamplight_embeddings`, `bible_passages`, `notes`, `folders`, `profiles` (other than the new `is_admin` column).

## Open follow-ups (later slices)

These are deliberately deferred and called out so they don't get forgotten.

1. **Paywall purchase flow** (the other half of original Sub-Project 6). Stripe / RevenueCat integration, plan upgrade UX, billing portal, receipt webhooks. Foundation's `PaywallCard` is replaced by the real card; entitlement granting transitions from manual SQL to webhook-driven.
2. **Per-user "your usage this month"** surface inside the Lamplight settings, once a billing relationship exists to give it meaning.
3. **`lamplight_jobs.status = 'abandoned'`** — a third terminal state for jobs that should never re-run. Wait until we see a class of jobs that warrants it.
4. **Admin "embed all my notes" backfill button** — turn the `scripts/backfill-note-embeddings.ts` logic into an admin-callable RPC, scoped to one user. Wait until support actually needs it.
5. **Per-kind aggregation in the usage leaderboard** — current rollup sums across models. Once Reasoning Layer ships multiple Anthropic models, break out by `(user_id, model)` to make the cost map honest.
6. **Per-user cost cap** — once we have spend telemetry from this slice, set a soft cap that pauses generation when a user crosses a threshold in a 24h window. Hard rate-limit is YAGNI'd until we observe abuse.
7. **Doctrinal Review board sign-off** (Sub-Project 7 in the brief). Pre-launch artifact; reviews prompt templates + banned phrases + contested passages. Independent of paywall.

## Notes for the implementer

- `is_lamplight_admin()` is `stable security definer`. Keep it tiny — one `select`, one `coalesce`. Anything more complex risks breaking the planner's ability to inline it inside RLS policies.
- Every admin RPC's first line is the admin gate. Do not "optimize" by lifting the check into a single wrapper — the explicit check at each entrypoint is the auditable contract.
- `recordLamplightUsage` is best-effort. Callers MUST wrap it in `.catch(...)` if it sits on the critical path. Putting it inside a `try { … } catch (e) { console.error(e) }` block at the callsite is the canonical shape.
- The cost map is display-only. Do NOT introduce a `cost_cents` column on `lamplight_usage` — it would lock the historical record to whatever pricing was current at insert time, and provider pricing changes are common enough that the leaderboard must compute live from token counts.
- `<EntitlementBlock />` must handle a null `entitlement` gracefully (no row in `lamplight_entitlements`). Default to `tier='none', source=null, expiresAt=null` and apply the matrix from there.
- The admin SELECT policy on `lamplight_jobs` is **additive** to the existing user policies. Do not refactor the existing four into a single `using ((auth.uid() = user_id) or public.is_lamplight_admin())` — the explicit separation makes the user-vs-admin scopes legible in audit, and Postgres OR-merges permissive policies anyway.
- The `auth.users` email join inside SECURITY DEFINER functions is intentional. The function owner can read `auth.users`; the authenticated caller cannot. This is exactly the leak we want — admins see emails, users do not.
- Keep `/admin/lamplight` utilitarian. The brand UI elsewhere is devotional; this is internal ops. Reusing the existing shadcn primitives without re-skinning communicates that distinction.
