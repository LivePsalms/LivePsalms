# Lamplight Entitlements UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the non-paywall half of Lamplight Sub-Project 6 — an `/admin/lamplight` ops surface for re-queueing failed embedding jobs, a user-facing entitlement block on Profile, and a `lamplight_usage` audit table feeding an admin token-spend leaderboard.

**Architecture:** One Postgres migration (`015`) creates `profiles.is_admin`, a `lamplight_usage` table, an additive admin SELECT policy on `lamplight_jobs`, and six `SECURITY DEFINER` admin RPCs (1 helper + 5 admin ops). Two existing edge functions (`embed-note`, `lamplight-generate`) gain a fire-and-forget `recordLamplightUsage` call at terminal outcome. The new `/admin/lamplight` page is utilitarian (shadcn primitives) and gated client-side by `useIsAdmin()`. The user-facing entitlement block lives inside the existing `LamplightSettingsSection`. Every admin write flows through a SECURITY DEFINER RPC whose first line is the admin gate — no admin UPDATE/DELETE RLS policy is created.

**Tech Stack:** Postgres / pgvector, Supabase (RLS, Edge Functions, RPCs), Deno (edge), TypeScript, React, Vite, vitest, Tailwind / shadcn UI primitives.

**Reference spec:** `docs/superpowers/specs/2026-05-27-lamplight-entitlements-ui-design.md`

---

## File Structure

### Created
- `supabase/migrations/015_lamplight_entitlements_ui.sql` — the migration
- `supabase/functions/_shared/usage.ts` — shared `recordLamplightUsage` helper
- `supabase/functions/_shared/usage.test.ts` — helper unit test
- `src/admin/AdminLamplightPage.tsx` — top-level admin page
- `src/admin/AdminLamplightPage.test.tsx` — page-level test
- `src/admin/components/JobCountsStrip.tsx` — count panel
- `src/admin/components/FailedJobsTable.tsx` — failed-jobs table
- `src/admin/components/UsageLeaderboard.tsx` — token-spend leaderboard
- `src/admin/hooks/useIsAdmin.ts` — admin gate hook
- `src/admin/hooks/useIsAdmin.test.ts` — hook test
- `src/admin/hooks/useAdminJobCounts.ts`
- `src/admin/hooks/useAdminFailedJobs.ts`
- `src/admin/hooks/useAdminUsageTop.ts`
- `src/admin/lamplight-cost.ts` — pure cost calculator
- `src/admin/lamplight-cost.test.ts`
- `src/auth/components/EntitlementBlock.tsx`
- `src/auth/components/EntitlementBlock.test.tsx`
- `src/notepad/storage/admin-lamplight.test.ts` — admin RPC integration tests (extends `lamplight-rls.test.ts` patterns)

### Modified
- `src/App.tsx` — register `/admin/lamplight` route
- `src/notepad/storage/lamplight-adapter.ts` — admin types + interface methods
- `src/notepad/storage/supabase-lamplight-adapter.ts` — admin method implementations
- `src/notepad/storage/fake-lamplight-adapter.ts` — admin method fake implementations
- `src/auth/components/LamplightSettingsSection.tsx` — render `<EntitlementBlock />`
- `supabase/functions/embed-note/index.ts` — usage call at terminal outcome
- `supabase/functions/_shared/process-job.ts` — accept a usage-recording callback so terminal outcomes call it
- `supabase/functions/_shared/voyage.ts` — return `{ vectors, totalTokens }` so the worker can record token counts
- `supabase/functions/lamplight-generate/index.ts` — usage call after Anthropic dispatch

---

## Test environment

Integration tests in `src/notepad/storage/admin-lamplight.test.ts` extend the existing `lamplight-rls.test.ts` env-var pattern. **Three NEW env vars** must be provisioned before the tests can run locally (or against staging):

- `SUPABASE_TEST_SERVICE_ROLE_KEY` — service-role JWT for the test project, used to set up test fixtures.
- `SUPABASE_TEST_ADMIN_EMAIL` / `SUPABASE_TEST_ADMIN_PASS` — credentials for an admin test account (the `beforeAll` block sets `is_admin = true` on this account via service-role).

When any of these is missing, the new admin test suite skips cleanly (`maybeDescribe`). CI must set them or the suite remains in skip-mode.

Existing env vars used: `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_USER_A_EMAIL`, `SUPABASE_TEST_USER_A_PASS`.

---

## Task 1: Migration scaffold — `profiles.is_admin` + `is_lamplight_admin()`

**Files:**
- Create: `supabase/migrations/015_lamplight_entitlements_ui.sql`
- Create: `src/notepad/storage/admin-lamplight.test.ts`

- [ ] **Step 1: Create the migration with header + first additions**

Write `supabase/migrations/015_lamplight_entitlements_ui.sql`:

```sql
-- 015_lamplight_entitlements_ui.sql
-- Sub-Project 6 (partial — no paywall): admin tooling, entitlement display,
-- and write-only usage telemetry. Adds `profiles.is_admin`, a SQL helper
-- `is_lamplight_admin()`, a `lamplight_usage` table, an additive admin
-- SELECT policy on `lamplight_jobs`, and 5 SECURITY DEFINER admin RPCs.

-- ── profiles.is_admin ────────────────────────────────────────────────────
alter table public.profiles
  add column is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Manually toggled in SQL by service-role. Gates /admin surfaces. Not user-editable.';

-- ── is_lamplight_admin() helper ──────────────────────────────────────────
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

- [ ] **Step 2: Create the integration test scaffold (failing — function doesn't exist yet at runtime)**

Write `src/notepad/storage/admin-lamplight.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL = process.env.SUPABASE_TEST_URL;
const SUPABASE_ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SUPABASE_SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.SUPABASE_TEST_ADMIN_EMAIL;
const ADMIN_PASS = process.env.SUPABASE_TEST_ADMIN_PASS;
const USER_A_EMAIL = process.env.SUPABASE_TEST_USER_A_EMAIL;
const USER_A_PASS = process.env.SUPABASE_TEST_USER_A_PASS;

const haveEnv =
  SUPABASE_URL && SUPABASE_ANON && SUPABASE_SERVICE &&
  ADMIN_EMAIL && ADMIN_PASS && USER_A_EMAIL && USER_A_PASS;

const maybeDescribe = haveEnv ? describe : describe.skip;

async function signedClient(email: string, password: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON!);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE!);
}

maybeDescribe('Lamplight admin RPCs (integration)', () => {
  let admin: { client: SupabaseClient; userId: string };
  let userA: { client: SupabaseClient; userId: string };

  beforeAll(async () => {
    admin = await signedClient(ADMIN_EMAIL!, ADMIN_PASS!);
    userA = await signedClient(USER_A_EMAIL!, USER_A_PASS!);
    const svc = serviceClient();
    await svc.from('profiles').update({ is_admin: true }).eq('id', admin.userId);
    await svc.from('profiles').update({ is_admin: false }).eq('id', userA.userId);
  });

  it('is_lamplight_admin returns true for admin, false for non-admin', async () => {
    const { data: aData, error: aErr } = await admin.client.rpc('is_lamplight_admin');
    expect(aErr).toBeNull();
    expect(aData).toBe(true);

    const { data: uData, error: uErr } = await userA.client.rpc('is_lamplight_admin');
    expect(uErr).toBeNull();
    expect(uData).toBe(false);
  });
});
```

- [ ] **Step 3: Apply the migration locally**

Run: `supabase db reset` (or `supabase migration up` if you have a separate test DB)
Expected: migration applies clean; no syntax errors.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/notepad/storage/admin-lamplight.test.ts`
Expected: PASS when test env vars are set, otherwise the suite is skipped (`maybeDescribe`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/015_lamplight_entitlements_ui.sql src/notepad/storage/admin-lamplight.test.ts
git commit -m "feat(lamplight): migration 015 scaffold + is_lamplight_admin()"
```

---

## Task 2: `lamplight_usage` table + RLS

**Files:**
- Modify: `supabase/migrations/015_lamplight_entitlements_ui.sql`
- Modify: `src/notepad/storage/admin-lamplight.test.ts`

- [ ] **Step 1: Append the table + RLS to the migration**

Append to `supabase/migrations/015_lamplight_entitlements_ui.sql`:

```sql
-- ── lamplight_usage ──────────────────────────────────────────────────────
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

-- Permissive-OR policy: own rows, OR admin sees all. No INSERT/UPDATE/DELETE
-- policy — service-role bypasses RLS, and no authenticated client writes here.
create policy "Users can view own lamplight_usage"
  on public.lamplight_usage for select
  using (auth.uid() = user_id or public.is_lamplight_admin());
```

- [ ] **Step 2: Add the RLS isolation test**

Append inside the existing `maybeDescribe` block in `src/notepad/storage/admin-lamplight.test.ts` (above the closing `});`):

```ts
  it('lamplight_usage: user can read own rows, admin reads all, others blocked', async () => {
    const svc = serviceClient();
    const tag = `usage-rls-${Date.now()}`;

    // userA owns a row.
    const { error: insErr } = await svc.from('lamplight_usage').insert({
      user_id: userA.userId,
      model: 'voyage-3-large',
      artifact_kind: tag,
      tokens_in: 100, tokens_out: 0,
      status: 'ok',
    });
    expect(insErr).toBeNull();

    // userA sees their row.
    const { data: ownData, error: ownErr } = await userA.client
      .from('lamplight_usage').select('id').eq('artifact_kind', tag);
    expect(ownErr).toBeNull();
    expect(ownData?.length).toBe(1);

    // admin sees the same row.
    const { data: admData, error: admErr } = await admin.client
      .from('lamplight_usage').select('id').eq('artifact_kind', tag);
    expect(admErr).toBeNull();
    expect(admData?.length).toBe(1);

    // Direct INSERT from authenticated client is blocked (no INSERT policy).
    const { error: blockedErr } = await userA.client
      .from('lamplight_usage').insert({
        user_id: userA.userId,
        model: 'voyage-3-large',
        artifact_kind: `${tag}-blocked`,
        tokens_in: 0, tokens_out: 0,
        status: 'ok',
      });
    expect(blockedErr).not.toBeNull();

    // Cleanup.
    await svc.from('lamplight_usage').delete().eq('artifact_kind', tag);
  });
```

- [ ] **Step 3: Re-apply migration + run test**

Run: `supabase db reset && npx vitest run src/notepad/storage/admin-lamplight.test.ts`
Expected: both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_lamplight_entitlements_ui.sql src/notepad/storage/admin-lamplight.test.ts
git commit -m "feat(lamplight): lamplight_usage table + RLS"
```

---

## Task 3: Admin SELECT policy on `lamplight_jobs`

**Files:**
- Modify: `supabase/migrations/015_lamplight_entitlements_ui.sql`
- Modify: `src/notepad/storage/admin-lamplight.test.ts`

- [ ] **Step 1: Append admin SELECT policy to migration**

Append to `supabase/migrations/015_lamplight_entitlements_ui.sql`:

```sql
-- ── lamplight_jobs: additive admin SELECT ────────────────────────────────
-- Existing user-scoped policies (migration 008) remain. Postgres OR-merges
-- permissive policies, so admins see all rows; non-admins still see only own.
create policy "Admins can view all lamplight_jobs"
  on public.lamplight_jobs for select
  using (public.is_lamplight_admin());
```

- [ ] **Step 2: Append test**

Append inside `maybeDescribe`:

```ts
  it('admin can read another user\'s lamplight_jobs; non-admin cannot', async () => {
    const svc = serviceClient();
    const tag = `job-rls-${Date.now()}`;

    // Insert a job owned by userA via service-role (bypasses RLS).
    const { data: inserted, error: insErr } = await svc.from('lamplight_jobs').insert({
      user_id: userA.userId,
      kind: 'embedding_refresh',
      status: 'failed',
      payload: { note_id: tag, content_hash: 'h' },
      attempts: 3,
      error: 'voyage_500',
      finished_at: new Date().toISOString(),
    }).select('id').single();
    expect(insErr).toBeNull();
    const jobId = inserted!.id as string;

    // Admin sees it.
    const { data: admData, error: admErr } = await admin.client
      .from('lamplight_jobs').select('id').eq('id', jobId);
    expect(admErr).toBeNull();
    expect(admData?.length).toBe(1);

    // Other non-admin user cannot.
    const { data: otherData, error: otherErr } = await userA.client
      .from('lamplight_jobs').select('id').eq('id', jobId);
    expect(otherErr).toBeNull();
    // userA owns it, so they CAN see it. Insert a job owned by admin and try with userA:
    // Above test verifies admin can see userA's. Now we want to check the inverse —
    // userA cannot see admin's job:
    const { data: admOwn, error: admOwnErr } = await svc.from('lamplight_jobs').insert({
      user_id: admin.userId,
      kind: 'embedding_refresh',
      status: 'failed',
      payload: { note_id: `${tag}-admin`, content_hash: 'h' },
      attempts: 3,
      error: 'voyage_500',
      finished_at: new Date().toISOString(),
    }).select('id').single();
    expect(admOwnErr).toBeNull();
    const { data: userViewOfAdmin } = await userA.client
      .from('lamplight_jobs').select('id').eq('id', admOwn!.id);
    expect(userViewOfAdmin?.length ?? 0).toBe(0);

    // Cleanup.
    await svc.from('lamplight_jobs').delete().in('id', [jobId, admOwn!.id]);
  });
```

- [ ] **Step 3: Re-apply + run**

Run: `supabase db reset && npx vitest run src/notepad/storage/admin-lamplight.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_lamplight_entitlements_ui.sql src/notepad/storage/admin-lamplight.test.ts
git commit -m "feat(lamplight): additive admin SELECT on lamplight_jobs"
```

---

## Task 4: Read RPCs — `admin_list_lamplight_jobs` + `admin_lamplight_job_counts`

**Files:**
- Modify: `supabase/migrations/015_lamplight_entitlements_ui.sql`
- Modify: `src/notepad/storage/admin-lamplight.test.ts`

- [ ] **Step 1: Append both RPC definitions to the migration**

```sql
-- ── admin_list_lamplight_jobs ────────────────────────────────────────────
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

-- ── admin_lamplight_job_counts ───────────────────────────────────────────
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

- [ ] **Step 2: Append tests**

```ts
  it('admin_list_lamplight_jobs: admin gets rows; non-admin raises', async () => {
    const svc = serviceClient();
    const tag = `list-rpc-${Date.now()}`;
    await svc.from('lamplight_jobs').insert({
      user_id: userA.userId, kind: 'embedding_refresh', status: 'failed',
      payload: { note_id: tag, content_hash: 'h' },
      attempts: 3, error: 'voyage_429',
      finished_at: new Date().toISOString(),
    });

    const { data, error } = await admin.client.rpc('admin_list_lamplight_jobs', {
      p_status: ['failed'], p_user_search: USER_A_EMAIL,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as Array<{ payload: { note_id: string } }>).some(r => r.payload?.note_id === tag)).toBe(true);

    const { error: nonAdmErr } = await userA.client.rpc('admin_list_lamplight_jobs', {});
    expect(nonAdmErr).not.toBeNull();
    expect(nonAdmErr!.message).toMatch(/not authorized/);

    await svc.from('lamplight_jobs').delete().eq('payload->>note_id', tag);
  });

  it('admin_lamplight_job_counts: returns {queued, running, done, failed, since}', async () => {
    const { data, error } = await admin.client.rpc('admin_lamplight_job_counts', {});
    expect(error).toBeNull();
    const obj = data as Record<string, unknown>;
    expect(obj).toHaveProperty('queued');
    expect(obj).toHaveProperty('running');
    expect(obj).toHaveProperty('done');
    expect(obj).toHaveProperty('failed');
    expect(obj).toHaveProperty('since');

    const { error: nonAdmErr } = await userA.client.rpc('admin_lamplight_job_counts', {});
    expect(nonAdmErr).not.toBeNull();
    expect(nonAdmErr!.message).toMatch(/not authorized/);
  });
```

- [ ] **Step 3: Re-apply + run**

Run: `supabase db reset && npx vitest run src/notepad/storage/admin-lamplight.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_lamplight_entitlements_ui.sql src/notepad/storage/admin-lamplight.test.ts
git commit -m "feat(lamplight): admin_list_lamplight_jobs + admin_lamplight_job_counts RPCs"
```

---

## Task 5: Write RPCs — `admin_requeue_lamplight_job` + `admin_requeue_failed_lamplight_jobs`

**Files:**
- Modify: `supabase/migrations/015_lamplight_entitlements_ui.sql`
- Modify: `src/notepad/storage/admin-lamplight.test.ts`

- [ ] **Step 1: Append both RPC definitions**

```sql
-- ── admin_requeue_lamplight_job (single) ─────────────────────────────────
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

-- ── admin_requeue_failed_lamplight_jobs (bulk) ───────────────────────────
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

- [ ] **Step 2: Append tests**

```ts
  it('admin_requeue_lamplight_job resets fields; non-admin raises', async () => {
    const svc = serviceClient();
    const tag = `requeue-${Date.now()}`;
    const { data: inserted } = await svc.from('lamplight_jobs').insert({
      user_id: userA.userId, kind: 'embedding_refresh', status: 'failed',
      payload: { note_id: tag, content_hash: 'h' },
      attempts: 3, error: 'voyage_500',
      finished_at: new Date().toISOString(),
    }).select('*').single();
    const jobId = inserted!.id as string;

    const { data, error } = await admin.client.rpc('admin_requeue_lamplight_job', { p_job_id: jobId });
    expect(error).toBeNull();
    const row = data as { status: string; attempts: number; error: string | null; finished_at: string | null };
    expect(row.status).toBe('queued');
    expect(row.attempts).toBe(0);
    expect(row.error).toBeNull();
    expect(row.finished_at).toBeNull();

    const { error: nonAdmErr } = await userA.client.rpc('admin_requeue_lamplight_job', { p_job_id: jobId });
    expect(nonAdmErr).not.toBeNull();
    expect(nonAdmErr!.message).toMatch(/not authorized/);

    await svc.from('lamplight_jobs').delete().eq('id', jobId);
  });

  it('admin_requeue_failed_lamplight_jobs returns count requeued; capped at 100', async () => {
    const svc = serviceClient();
    const tag = `bulk-requeue-${Date.now()}`;
    // Seed 3 failed jobs of a unique kind to isolate the bulk action.
    const fakeKind = `embedding_refresh_${tag}`;
    for (let i = 0; i < 3; i++) {
      await svc.from('lamplight_jobs').insert({
        user_id: userA.userId, kind: fakeKind, status: 'failed',
        payload: { note_id: `${tag}-${i}`, content_hash: 'h' },
        attempts: 3, error: 'voyage_500',
        finished_at: new Date().toISOString(),
      });
    }

    const { data, error } = await admin.client.rpc('admin_requeue_failed_lamplight_jobs', {
      p_kind: fakeKind, p_limit: 100,
    });
    expect(error).toBeNull();
    expect(data).toBe(3);

    const { data: rows } = await svc.from('lamplight_jobs').select('status').eq('kind', fakeKind);
    expect(rows!.every(r => r.status === 'queued')).toBe(true);

    await svc.from('lamplight_jobs').delete().eq('kind', fakeKind);
  });
```

- [ ] **Step 3: Re-apply + run**

Run: `supabase db reset && npx vitest run src/notepad/storage/admin-lamplight.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_lamplight_entitlements_ui.sql src/notepad/storage/admin-lamplight.test.ts
git commit -m "feat(lamplight): admin requeue RPCs (single + bulk)"
```

---

## Task 6: Usage RPC — `admin_lamplight_usage_top`

**Files:**
- Modify: `supabase/migrations/015_lamplight_entitlements_ui.sql`
- Modify: `src/notepad/storage/admin-lamplight.test.ts`

- [ ] **Step 1: Append the RPC**

```sql
-- ── admin_lamplight_usage_top ────────────────────────────────────────────
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

- [ ] **Step 2: Append test**

```ts
  it('admin_lamplight_usage_top aggregates correctly; non-admin raises', async () => {
    const svc = serviceClient();
    const tag = `usage-top-${Date.now()}`;
    await svc.from('lamplight_usage').insert([
      { user_id: userA.userId, model: 'voyage-3-large', artifact_kind: tag,
        tokens_in: 100, tokens_out: 0, status: 'ok' },
      { user_id: userA.userId, model: 'claude-sonnet-4-6', artifact_kind: tag,
        tokens_in: 50, tokens_out: 30, status: 'ok' },
      { user_id: userA.userId, model: 'voyage-3-large', artifact_kind: tag,
        tokens_in: 0, tokens_out: 0, status: 'error', error_code: 'voyage_429' },
    ]);

    const { data, error } = await admin.client.rpc('admin_lamplight_usage_top', {
      p_window_days: 7, p_limit: 200,
    });
    expect(error).toBeNull();
    const rows = data as Array<{ user_id: string; tokens_in: number; tokens_out: number; calls: number; errors: number }>;
    const mine = rows.find(r => r.user_id === userA.userId);
    expect(mine).toBeTruthy();
    expect(Number(mine!.tokens_in)).toBeGreaterThanOrEqual(150);
    expect(Number(mine!.tokens_out)).toBeGreaterThanOrEqual(30);
    expect(Number(mine!.errors)).toBeGreaterThanOrEqual(1);

    const { error: nonAdmErr } = await userA.client.rpc('admin_lamplight_usage_top', {});
    expect(nonAdmErr).not.toBeNull();
    expect(nonAdmErr!.message).toMatch(/not authorized/);

    await svc.from('lamplight_usage').delete().eq('artifact_kind', tag);
  });
```

- [ ] **Step 3: Re-apply + run**

Run: `supabase db reset && npx vitest run src/notepad/storage/admin-lamplight.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_lamplight_entitlements_ui.sql src/notepad/storage/admin-lamplight.test.ts
git commit -m "feat(lamplight): admin_lamplight_usage_top RPC"
```

---

## Task 7: Cost map utility

**Files:**
- Create: `src/admin/lamplight-cost.ts`
- Create: `src/admin/lamplight-cost.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/admin/lamplight-cost.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { estCostCents, formatCents } from './lamplight-cost';

describe('lamplight-cost', () => {
  it('voyage-3-large: 1M in tokens → 18 cents', () => {
    expect(estCostCents('voyage-3-large', 1_000_000, 0)).toBe(18);
  });

  it('claude-sonnet-4-6: 1M in + 500k out → 1050 cents', () => {
    expect(estCostCents('claude-sonnet-4-6', 1_000_000, 500_000)).toBe(1050);
  });

  it('unknown model defaults to 0 cents', () => {
    expect(estCostCents('mystery-model', 9_999_999, 9_999_999)).toBe(0);
  });

  it('formatCents renders dollars with two decimals', () => {
    expect(formatCents(1050)).toBe('$10.50');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(7)).toBe('$0.07');
  });
});
```

- [ ] **Step 2: Run test (FAIL — module missing)**

Run: `npx vitest run src/admin/lamplight-cost.test.ts`
Expected: FAIL — cannot resolve `./lamplight-cost`.

- [ ] **Step 3: Implement the module**

Create `src/admin/lamplight-cost.ts`:

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

- [ ] **Step 4: Run test (PASS)**

Run: `npx vitest run src/admin/lamplight-cost.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/admin/lamplight-cost.ts src/admin/lamplight-cost.test.ts
git commit -m "feat(lamplight): cost map utility"
```

---

## Task 8: Adapter types + interface additions

**Files:**
- Modify: `src/notepad/storage/lamplight-adapter.ts`

- [ ] **Step 1: Append types + interface methods**

Open `src/notepad/storage/lamplight-adapter.ts`. Append the following AT THE END OF THE FILE (after all existing exports), but ALSO add the new methods to the existing `LamplightAdapter` interface. The existing interface ends somewhere in the file — find it (search for `export interface LamplightAdapter`) and add the six methods inside it after the existing methods, before its closing `}`.

Add these new exports at the end of the file:

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
  queued: number;
  running: number;
  done: number;
  failed: number;
  since: string;
}

export interface AdminUsageRow {
  userId: string;
  email: string | null;
  tokensIn: number;
  tokensOut: number;
  calls: number;
  errors: number;
}
```

Then, inside the existing `LamplightAdapter` interface, add the six new methods (preserving alphabetical/grouping conventions of the existing interface):

```ts
  isLamplightAdmin(): Promise<boolean>;
  adminListJobs(filters: AdminJobFilters): Promise<AdminJobRow[]>;
  adminJobCounts(sinceIso: string): Promise<AdminJobCounts>;
  adminRequeueJob(jobId: string): Promise<AdminJobRow>;
  adminRequeueAllFailed(kind?: string, limit?: number): Promise<number>;
  adminUsageTop(windowDays: number, limit?: number): Promise<AdminUsageRow[]>;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: errors on `SupabaseLamplightAdapter` and `FakeLamplightAdapter` for the missing methods — that's correct, the next tasks implement them. Note the errors; do not commit yet.

- [ ] **Step 3: Skip commit — types only become valid after the next two tasks**

Move directly to Task 9 without committing. (Working-tree state is allowed to be mid-implementation across consecutive tasks; the commit happens at the end of Task 10.)

---

## Task 9: SupabaseLamplightAdapter — admin method implementations

**Files:**
- Modify: `src/notepad/storage/supabase-lamplight-adapter.ts`

- [ ] **Step 1: Add the six method implementations**

At the top of the file, extend the import from `./lamplight-adapter` to include the new types:

```ts
import type {
  LamplightAdapter,
  LamplightSettings,
  LamplightEntitlement,
  PromoConfig,
  LamplightVoice,
  LamplightTradition,
  LamplightTier,
  LamplightEntitlementSource,
  DailyDevotionGenerateResult,
  ConnectionNeighbor,
  ConnectionWhyResult,
  AdminJobFilters,
  AdminJobRow,
  AdminJobCounts,
  AdminUsageRow,
} from './lamplight-adapter';
```

Append these methods inside the `SupabaseLamplightAdapter` class (after the existing method bodies, before the closing `}`):

```ts
  async isLamplightAdmin(): Promise<boolean> {
    const { data, error } = await this.#client.rpc('is_lamplight_admin');
    if (error) return false;
    return Boolean(data);
  }

  async adminListJobs(filters: AdminJobFilters): Promise<AdminJobRow[]> {
    const { data, error } = await this.#client.rpc('admin_list_lamplight_jobs', {
      p_status: filters.status ?? ['failed'],
      p_kind: filters.kind ?? null,
      p_user_search: filters.userSearch ?? null,
      p_since: filters.since ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      p_limit: filters.limit ?? 200,
    });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      email: (r.email as string) ?? null,
      kind: r.kind as string,
      status: r.status as AdminJobRow['status'],
      attempts: r.attempts as number,
      payload: r.payload,
      scheduledAt: r.scheduled_at as string,
      startedAt: (r.started_at as string) ?? null,
      finishedAt: (r.finished_at as string) ?? null,
      error: (r.error as string) ?? null,
    }));
  }

  async adminJobCounts(sinceIso: string): Promise<AdminJobCounts> {
    const { data, error } = await this.#client.rpc('admin_lamplight_job_counts', {
      p_since: sinceIso,
    });
    if (error) throw error;
    const obj = (data ?? {}) as Record<string, unknown>;
    return {
      queued: Number(obj.queued ?? 0),
      running: Number(obj.running ?? 0),
      done: Number(obj.done ?? 0),
      failed: Number(obj.failed ?? 0),
      since: String(obj.since ?? sinceIso),
    };
  }

  async adminRequeueJob(jobId: string): Promise<AdminJobRow> {
    const { data, error } = await this.#client.rpc('admin_requeue_lamplight_job', {
      p_job_id: jobId,
    });
    if (error) throw error;
    const r = data as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      email: null,
      kind: r.kind as string,
      status: r.status as AdminJobRow['status'],
      attempts: r.attempts as number,
      payload: r.payload,
      scheduledAt: r.scheduled_at as string,
      startedAt: (r.started_at as string) ?? null,
      finishedAt: (r.finished_at as string) ?? null,
      error: (r.error as string) ?? null,
    };
  }

  async adminRequeueAllFailed(kind?: string, limit?: number): Promise<number> {
    const { data, error } = await this.#client.rpc('admin_requeue_failed_lamplight_jobs', {
      p_kind: kind ?? null,
      p_limit: limit ?? 100,
    });
    if (error) throw error;
    return Number(data ?? 0);
  }

  async adminUsageTop(windowDays: number, limit?: number): Promise<AdminUsageRow[]> {
    const { data, error } = await this.#client.rpc('admin_lamplight_usage_top', {
      p_window_days: windowDays,
      p_limit: limit ?? 50,
    });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      userId: r.user_id as string,
      email: (r.email as string) ?? null,
      tokensIn: Number(r.tokens_in ?? 0),
      tokensOut: Number(r.tokens_out ?? 0),
      calls: Number(r.calls ?? 0),
      errors: Number(r.errors ?? 0),
    }));
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: still errors on `FakeLamplightAdapter` (missing methods); SupabaseLamplightAdapter should be clean. Move to next task.

---

## Task 10: FakeLamplightAdapter — admin method fakes

**Files:**
- Modify: `src/notepad/storage/fake-lamplight-adapter.ts`

- [ ] **Step 1: Read the file to confirm its existing `jobs` array shape**

Run: `grep -n "jobs:\|enqueueEmbedding\|enqueueCalls" src/notepad/storage/fake-lamplight-adapter.ts`
Note the existing state shape. The fake already tracks jobs by Signal Layer.

- [ ] **Step 2: Extend the imports**

At the top of `src/notepad/storage/fake-lamplight-adapter.ts`, ensure these types are imported from `./lamplight-adapter` (add the four new ones to the existing import group):

```ts
import type {
  LamplightAdapter,
  // … existing imports …
  AdminJobFilters,
  AdminJobRow,
  AdminJobCounts,
  AdminUsageRow,
} from './lamplight-adapter';
```

- [ ] **Step 3: Add admin state fields and method implementations**

Inside `class FakeLamplightAdapter`, add new state fields near the existing ones:

```ts
  // Admin fake state.
  public isAdmin = false;
  public usageRows: Array<{
    userId: string;
    model: string;
    artifactKind: string;
    tokensIn: number;
    tokensOut: number;
    status: 'ok' | 'error';
    errorCode?: string | null;
    createdAt: string;
  }> = [];
  public adminJobs: AdminJobRow[] = [];
```

Add the methods at the end of the class:

```ts
  async isLamplightAdmin(): Promise<boolean> {
    return this.isAdmin;
  }

  async adminListJobs(filters: AdminJobFilters): Promise<AdminJobRow[]> {
    const status = filters.status ?? ['failed'];
    const since = filters.since ? new Date(filters.since).getTime() : 0;
    return this.adminJobs.filter((j) => {
      if (!status.includes(j.status)) return false;
      if (filters.kind && !filters.kind.includes(j.kind)) return false;
      if (filters.userSearch) {
        const q = filters.userSearch.toLowerCase();
        const matchEmail = (j.email ?? '').toLowerCase().includes(q);
        const matchId = j.userId === filters.userSearch;
        if (!matchEmail && !matchId) return false;
      }
      if (since && new Date(j.scheduledAt).getTime() < since) return false;
      return true;
    }).slice(0, filters.limit ?? 200);
  }

  async adminJobCounts(sinceIso: string): Promise<AdminJobCounts> {
    const sinceMs = new Date(sinceIso).getTime();
    const inWindow = this.adminJobs.filter(j => new Date(j.scheduledAt).getTime() >= sinceMs);
    const by = (s: AdminJobRow['status']) => inWindow.filter(j => j.status === s).length;
    return {
      queued: by('queued'),
      running: by('running'),
      done: by('done'),
      failed: by('failed'),
      since: sinceIso,
    };
  }

  async adminRequeueJob(jobId: string): Promise<AdminJobRow> {
    const idx = this.adminJobs.findIndex(j => j.id === jobId);
    if (idx < 0) throw new Error(`job not found: ${jobId}`);
    const next: AdminJobRow = {
      ...this.adminJobs[idx],
      status: 'queued',
      attempts: 0,
      error: null,
      scheduledAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };
    this.adminJobs[idx] = next;
    return next;
  }

  async adminRequeueAllFailed(kind?: string, limit?: number): Promise<number> {
    const cap = Math.min(Math.max(1, limit ?? 100), 100);
    const candidates = this.adminJobs
      .filter(j => j.status === 'failed' && (!kind || j.kind === kind))
      .slice(0, cap);
    candidates.forEach((j) => {
      const i = this.adminJobs.findIndex(x => x.id === j.id);
      this.adminJobs[i] = {
        ...j,
        status: 'queued',
        attempts: 0,
        error: null,
        scheduledAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      };
    });
    return candidates.length;
  }

  async adminUsageTop(windowDays: number, limit?: number): Promise<AdminUsageRow[]> {
    const cutoff = Date.now() - Math.max(1, windowDays) * 24 * 3600 * 1000;
    const byUser = new Map<string, { tokensIn: number; tokensOut: number; calls: number; errors: number }>();
    for (const row of this.usageRows) {
      if (new Date(row.createdAt).getTime() < cutoff) continue;
      const cur = byUser.get(row.userId) ?? { tokensIn: 0, tokensOut: 0, calls: 0, errors: 0 };
      cur.tokensIn += row.tokensIn;
      cur.tokensOut += row.tokensOut;
      cur.calls += 1;
      if (row.status === 'error') cur.errors += 1;
      byUser.set(row.userId, cur);
    }
    return Array.from(byUser.entries())
      .map(([userId, agg]) => ({ userId, email: null, ...agg }))
      .sort((a, b) => (b.tokensIn + b.tokensOut) - (a.tokensIn + a.tokensOut))
      .slice(0, limit ?? 50);
  }
```

- [ ] **Step 4: Type-check everything**

Run: `npx tsc -b --noEmit`
Expected: zero errors. (If there are errors, fix the type drift before continuing.)

- [ ] **Step 5: Run the existing test suite to make sure nothing regressed**

Run: `npx vitest run`
Expected: PASS (except integration tests requiring env vars, which skip gracefully).

- [ ] **Step 6: Commit Tasks 8–10 together**

```bash
git add src/notepad/storage/lamplight-adapter.ts src/notepad/storage/supabase-lamplight-adapter.ts src/notepad/storage/fake-lamplight-adapter.ts
git commit -m "feat(lamplight): adapter types + admin methods (supabase + fake)"
```

---

## Task 11: Shared `usage.ts` helper

**Files:**
- Create: `supabase/functions/_shared/usage.ts`
- Create: `supabase/functions/_shared/usage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/usage.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { recordLamplightUsage, type UsageRow } from './usage';

function fakeSupabase(insertImpl: (row: unknown) => Promise<{ error: { message: string } | null }>) {
  return {
    from: () => ({ insert: insertImpl }),
  } as unknown as Parameters<typeof recordLamplightUsage>[0];
}

const baseRow: UsageRow = {
  user_id: 'u1',
  model: 'voyage-3-large',
  artifact_kind: 'embedding_refresh',
  tokens_in: 100,
  tokens_out: 0,
  status: 'ok',
};

describe('recordLamplightUsage', () => {
  it('inserts the row and resolves on success', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    await recordLamplightUsage(fakeSupabase(insert), baseRow);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(baseRow);
  });

  it('does not throw on insert error — logs and resolves', async () => {
    const insert = vi.fn(async () => ({ error: { message: 'rls_violation' } }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordLamplightUsage(fakeSupabase(insert), baseRow)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test (FAIL — module missing)**

Run: `npx vitest run supabase/functions/_shared/usage.test.ts`
Expected: FAIL — cannot resolve `./usage`.

- [ ] **Step 3: Implement the module**

Create `supabase/functions/_shared/usage.ts`:

```ts
// Fire-and-forget audit insert. A usage-table outage must never break the
// primary work path (embedding, generation). Errors log; the function resolves.

export interface UsageRow {
  user_id: string;
  model: string;
  artifact_kind: string;
  tokens_in: number;
  tokens_out: number;
  status: 'ok' | 'error';
  error_code?: string | null;
}

// Minimal Supabase client shape required by this helper. Keeping the type
// narrow makes it easy to fake in unit tests and avoids cross-runtime
// (Deno vs Node) type drag from the official client.
export interface UsageSupabaseClient {
  from(table: 'lamplight_usage'): {
    insert(row: UsageRow): Promise<{ error: { message: string } | null }>;
  };
}

export async function recordLamplightUsage(
  supabase: UsageSupabaseClient,
  row: UsageRow,
): Promise<void> {
  try {
    const { error } = await supabase.from('lamplight_usage').insert(row);
    if (error) {
      console.error('[lamplight_usage] insert failed', error.message, { row });
    }
  } catch (e) {
    console.error('[lamplight_usage] insert threw', e, { row });
  }
}
```

- [ ] **Step 4: Run test (PASS)**

Run: `npx vitest run supabase/functions/_shared/usage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/usage.ts supabase/functions/_shared/usage.test.ts
git commit -m "feat(lamplight): shared recordLamplightUsage helper"
```

---

## Task 12: `embed-note` instrumentation

**Files:**
- Modify: `supabase/functions/_shared/voyage.ts`
- Modify: `supabase/functions/_shared/process-job.ts`
- Modify: `supabase/functions/embed-note/index.ts`
- Modify: `supabase/functions/_shared/process-job.test.ts`
- Modify: `supabase/functions/_shared/voyage.test.ts`

The current shape: `embedDocuments` returns `Promise<number[][]>` (vectors only — total_tokens is discarded). `EmbedFn = (texts: string[]) => Promise<number[][]>`. To record real token counts we must thread `total_tokens` through the embed pipeline.

- [ ] **Step 1: Extend `embedDocuments` to return `{ vectors, totalTokens }`**

Open `supabase/functions/_shared/voyage.ts`. Locate `embedDocuments` (~line 23) and the inner `embedOnce` (~line 50+) function. Change `embedDocuments` (and `embedBatched`) to return `{ vectors: number[][]; totalTokens: number }`, summing `json.usage?.total_tokens ?? 0` across batches inside `embedBatched`. Concretely:

```ts
export interface EmbedDocumentsResult {
  vectors: number[][];
  totalTokens: number;
}

export async function embedDocuments(texts: string[], deps: VoyageDeps): Promise<EmbedDocumentsResult> {
  return embedBatched(texts, 'document', deps);
}

// embedBatched (rename return type; preserve existing batching logic):
async function embedBatched(texts: string[], inputType: InputType, deps: VoyageDeps): Promise<EmbedDocumentsResult> {
  if (texts.length === 0) return { vectors: [], totalTokens: 0 };
  const vectors: number[][] = [];
  let totalTokens = 0;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const result = await embedOnce(batch, inputType, deps, 0);
    vectors.push(...result.vectors);
    totalTokens += result.totalTokens;
  }
  return { vectors, totalTokens };
}

// embedOnce — change the success branch's `return json.data.map(d => d.embedding)`
// to `return { vectors: json.data.map(d => d.embedding), totalTokens: json.usage?.total_tokens ?? 0 };`
// Update the recursive retry call's return type accordingly.
```

For `embedQuery`, keep its public contract as `Promise<number[]>` (it has no callers that need tokens yet); internally it can discard the token count from `embedBatched`:

```ts
export async function embedQuery(text: string, deps: VoyageDeps): Promise<number[]> {
  const { vectors } = await embedBatched([text], 'query', deps);
  return vectors[0];
}
```

- [ ] **Step 2: Update `voyage.test.ts` to assert the new return shape**

Open `supabase/functions/_shared/voyage.test.ts`. Wherever it asserts on the result of `embedDocuments(...)`, change the assertion from `expect(result).toEqual([...vectors])` to `expect(result.vectors).toEqual([...vectors])` and add an assertion for `totalTokens` based on the mocked `usage.total_tokens` in the fake response.

Run: `npx vitest run supabase/functions/_shared/voyage.test.ts`
Expected: PASS.

- [ ] **Step 3: Update `EmbedFn` and `processJobs` in `process-job.ts`**

Open `supabase/functions/_shared/process-job.ts`. Change the `EmbedFn` type and the calling code:

```ts
// Existing (line ~34):
// export type EmbedFn = (texts: string[]) => Promise<number[][]>;
//
// New:
export type EmbedFn = (texts: string[]) => Promise<{ vectors: number[][]; totalTokens: number }>;
```

Find the inside of `processJobs` where embed is called (around lines 64–77). The current code uses the array directly; change to:

```ts
let vectors: number[][];
let tokensIn: number;
try {
  const result = await embed([plaintext]);
  vectors = result.vectors;
  tokensIn = result.totalTokens;
  await ops.upsertEmbedding({ ...embeddingRow, vector: vectors[0] });
} catch (err) {
  await ops.markFailedOrRetry(job, err, (job.attempts ?? 0) + 1);
  // Only record usage when this is the FINAL attempt (i.e. we just marked failed).
  if ((job.attempts ?? 0) + 1 >= MAX_ATTEMPTS) {
    await ops.recordUsage({
      user_id: job.user_id,
      model: 'voyage-3-large',
      artifact_kind: 'embedding_refresh',
      tokens_in: 0,
      tokens_out: 0,
      status: 'error',
      error_code: extractVoyageErrorCode(err),
    });
  }
  continue;
}

// Success path — record usage BEFORE markDone so an audit failure can't leave
// a "done" job without a usage row.
await ops.recordUsage({
  user_id: job.user_id,
  model: 'voyage-3-large',
  artifact_kind: 'embedding_refresh',
  tokens_in: tokensIn,
  tokens_out: 0,
  status: 'ok',
});
await ops.markDone(job.id);
```

(The exact local variable names — `plaintext`, `embeddingRow`, `MAX_ATTEMPTS` — match the existing file; preserve those.)

- [ ] **Step 4: Extend `DbOps` and add `extractVoyageErrorCode`**

Still in `process-job.ts`, extend the `DbOps` interface (~line 26):

```ts
export interface DbOps {
  // … existing fields (loadNote, upsertEmbedding, markDone, markFailedOrRetry, etc.) …
  recordUsage(row: {
    user_id: string;
    model: 'voyage-3-large';
    artifact_kind: 'embedding_refresh';
    tokens_in: number;
    tokens_out: number;
    status: 'ok' | 'error';
    error_code?: string | null;
  }): Promise<void>;
}
```

Add this helper at the bottom of the file:

```ts
function extractVoyageErrorCode(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err);
  const m = msg.match(/voyage_(\d+)/i) ?? msg.match(/\b(4\d\d|5\d\d)\b/);
  return m ? `voyage_${m[1]}` : 'voyage_unknown';
}
```

- [ ] **Step 5: Update `process-job.test.ts` fakes + assertions**

Open `supabase/functions/_shared/process-job.test.ts`. Two changes:

A. Every fake `EmbedFn` previously returning `[[…vector]]` now returns `{ vectors: [[…vector]], totalTokens: 7 }` (pick any positive integer). Example:

```ts
const embed: EmbedFn = async (texts) => ({
  vectors: texts.map(() => new Array(1024).fill(0)),
  totalTokens: 7,
});
```

B. Every fake `DbOps` must include `recordUsage: vi.fn(async () => {})`. Add assertions on the new field to existing tests:

- Happy-path test (after `await processJobs(...)`):

```ts
expect(ops.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
  user_id: 'u1',
  artifact_kind: 'embedding_refresh',
  status: 'ok',
  model: 'voyage-3-large',
  tokens_in: 7,
  tokens_out: 0,
}));
```

- Final-failure test (i.e. the test that exercises attempts >= 3):

```ts
expect(ops.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
  user_id: 'u1',
  artifact_kind: 'embedding_refresh',
  status: 'error',
  model: 'voyage-3-large',
}));
```

- Mid-retry tests (attempts < 3): assert NOT called.

```ts
expect(ops.recordUsage).not.toHaveBeenCalled();
```

Run: `npx vitest run supabase/functions/_shared/process-job.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire `recordUsage` into `embed-note/index.ts`**

Open `supabase/functions/embed-note/index.ts`. Add at the top of the imports:

```ts
import { recordLamplightUsage } from '../_shared/usage.ts';
```

Inside `buildOps(supabase)`, add a `recordUsage` field (alongside `loadNote`, `markDone`, etc.):

```ts
    async recordUsage(row) {
      await recordLamplightUsage(supabase, row);
    },
```

Also update the `embed` lambda built in the request handler — `embedDocuments` now returns an object, so:

```ts
// Before:
// const embed: EmbedFn = async (texts) => embedDocuments(texts, { apiKey, fetch });

// After:
const embed: EmbedFn = async (texts) => embedDocuments(texts, { apiKey, fetch });
```

(No change needed at the call site — the signature now matches the new `EmbedFn` automatically.)

- [ ] **Step 7: Full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/voyage.ts supabase/functions/_shared/voyage.test.ts supabase/functions/_shared/process-job.ts supabase/functions/_shared/process-job.test.ts supabase/functions/embed-note/index.ts
git commit -m "feat(lamplight): embed-note records lamplight_usage at terminal outcomes"
```

---

## Task 13: `lamplight-generate` instrumentation

**Files:**
- Modify: `supabase/functions/lamplight-generate/index.ts`
- Modify: `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`
- Modify: `supabase/functions/lamplight-generate/connection-why-pipeline.test.ts`

- [ ] **Step 1: Read the dispatch structure**

Run: `grep -n "body.kind === \|kind: 'daily_devotion'\|kind: 'connection_card_why'\|usage\." supabase/functions/lamplight-generate/index.ts`
Note: the function dispatches on `body.kind`. The Anthropic SDK returns `response.usage.{input_tokens, output_tokens}` for each call.

- [ ] **Step 2: Import the helper at the top of `lamplight-generate/index.ts`**

```ts
import { recordLamplightUsage } from '../_shared/usage.ts';
```

- [ ] **Step 3: Wrap each Anthropic dispatch in usage recording**

For the `daily_devotion` branch, locate where the Anthropic response is obtained (e.g. `const response = await anthropic.messages.create({...})`). Immediately after a successful call (and before returning), add:

```ts
await recordLamplightUsage(supabase, {
  user_id: userId,
  model: response.model ?? 'claude-haiku-4-5',
  artifact_kind: 'daily_devotion',
  tokens_in: response.usage?.input_tokens ?? 0,
  tokens_out: response.usage?.output_tokens ?? 0,
  status: 'ok',
});
```

Wrap the body of each `daily_devotion` and `connection_card_why` branch in a try/catch (if not already). In the catch, before re-throwing or returning the error response, record:

```ts
await recordLamplightUsage(supabase, {
  user_id: userId,
  model: 'claude-haiku-4-5', // best-effort default
  artifact_kind: 'daily_devotion', // or 'connection_card_why' in that branch
  tokens_in: 0,
  tokens_out: 0,
  status: 'error',
  error_code: classifyGenerateError(err),
});
```

Add `classifyGenerateError` near the bottom of the file:

```ts
function classifyGenerateError(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
  if (msg.includes('validators_failed')) return 'validators_failed';
  if (msg.includes('no_embedding'))      return 'no_embedding';
  if (msg.includes('not_neighbor'))      return 'not_neighbor';
  if (msg.includes('network'))           return 'network';
  return 'unknown';
}
```

The `smoke_test` branch should NOT call `recordLamplightUsage`.

- [ ] **Step 4: Add an assertion in each pipeline test**

Open `supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts`. The existing tests pass mocks for the dependencies; add a `recordUsage` spy parameter to the mock chain, OR pass a `supabase` mock whose `.from('lamplight_usage').insert()` is a vi.fn. Existing patterns in the file dictate which: prefer the simplest hook.

Concretely: add an assertion to the happy-path test:

```ts
expect(mockSupabase.from).toHaveBeenCalledWith('lamplight_usage');
// or: expect(recordUsageSpy).toHaveBeenCalledWith(expect.objectContaining({
//   artifact_kind: 'daily_devotion', status: 'ok',
// }));
```

Do the same in `connection-why-pipeline.test.ts` with `artifact_kind: 'connection_card_why'`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run supabase/functions/lamplight-generate/`
Expected: PASS.

- [ ] **Step 6: Run full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/lamplight-generate/index.ts supabase/functions/lamplight-generate/daily-devotion-pipeline.test.ts supabase/functions/lamplight-generate/connection-why-pipeline.test.ts
git commit -m "feat(lamplight): lamplight-generate records usage for daily_devotion + connection_card_why"
```

---

## Task 14: `<EntitlementBlock />` component

**Files:**
- Create: `src/auth/components/EntitlementBlock.tsx`
- Create: `src/auth/components/EntitlementBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/auth/components/EntitlementBlock.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntitlementBlock } from './EntitlementBlock';
import type { LamplightEntitlement, PromoConfig } from '@/notepad/storage/lamplight-adapter';

const promoActive: PromoConfig = { promoActive: true, promoEndsAt: '2099-06-15T00:00:00Z' };
const promoOff: PromoConfig    = { promoActive: false, promoEndsAt: null };

const plus: LamplightEntitlement = {
  userId: 'u1', tier: 'plus', source: 'subscription',
  grantedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-06-15T00:00:00Z',
};
const lite: LamplightEntitlement = {
  userId: 'u1', tier: 'lite', source: 'grant',
  grantedAt: '2026-01-01T00:00:00Z', expiresAt: null,
};
const none: LamplightEntitlement = {
  userId: 'u1', tier: 'none', source: null, grantedAt: null, expiresAt: null,
};

describe('EntitlementBlock', () => {
  it('renders Plus + expiry + source caption', () => {
    render(<EntitlementBlock entitlement={plus} promo={promoOff} />);
    expect(screen.getByText(/Lamplight Plus/i)).toBeInTheDocument();
    expect(screen.getByText(/Jun 15, 2099/)).toBeInTheDocument();
    expect(screen.getByText(/via subscription/i)).toBeInTheDocument();
  });

  it('renders Lite without expiry (null) and source caption', () => {
    render(<EntitlementBlock entitlement={lite} promo={promoOff} />);
    expect(screen.getByText(/Lamplight Lite/i)).toBeInTheDocument();
    expect(screen.queryByText(/until/i)).not.toBeInTheDocument();
    expect(screen.getByText(/via grant/i)).toBeInTheDocument();
  });

  it('renders launch promo copy when tier=none and promo active', () => {
    render(<EntitlementBlock entitlement={none} promo={promoActive} />);
    expect(screen.getByText(/Free during launch promo/i)).toBeInTheDocument();
    expect(screen.getByText(/Jun 15, 2099/)).toBeInTheDocument();
  });

  it('renders nothing when tier=none and promo inactive', () => {
    const { container } = render(<EntitlementBlock entitlement={none} promo={promoOff} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles null entitlement gracefully (treats as none)', () => {
    const { container } = render(<EntitlementBlock entitlement={null} promo={promoOff} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (FAIL)**

Run: `npx vitest run src/auth/components/EntitlementBlock.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/auth/components/EntitlementBlock.tsx`:

```tsx
import type { LamplightEntitlement, PromoConfig } from '@/notepad/storage/lamplight-adapter';

export interface EntitlementBlockProps {
  entitlement: LamplightEntitlement | null;
  promo: PromoConfig;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(d);
}

export function EntitlementBlock({ entitlement, promo }: EntitlementBlockProps) {
  const tier = entitlement?.tier ?? 'none';

  if (tier === 'none' && !promo.promoActive) return null;

  let heading: string;
  let detail: string | null = null;
  let caption: string | null = null;

  if (tier === 'plus' || tier === 'lite') {
    heading = tier === 'plus' ? 'Lamplight Plus' : 'Lamplight Lite';
    const fmt = formatDate(entitlement?.expiresAt ?? null);
    detail = fmt ? `until ${fmt}` : null;
    caption = entitlement?.source ? `via ${entitlement.source}` : null;
  } else {
    // tier === 'none' && promo.promoActive
    heading = 'Free during launch promo';
    const fmt = formatDate(promo.promoEndsAt);
    detail = fmt ? `ends ${fmt}` : null;
  }

  return (
    <div
      className="mb-4 px-4 py-3 rounded-md"
      style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
      data-testid="entitlement-block"
    >
      <div
        className="text-sm"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        {heading}
        {detail ? <span className="ml-2 text-xs" style={{ color: 'var(--silica)' }}>· {detail}</span> : null}
      </div>
      {caption ? (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--silica)' }}>{caption}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test (PASS)**

Run: `npx vitest run src/auth/components/EntitlementBlock.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/components/EntitlementBlock.tsx src/auth/components/EntitlementBlock.test.tsx
git commit -m "feat(lamplight): EntitlementBlock component"
```

---

## Task 15: Wire `<EntitlementBlock />` into `LamplightSettingsSection`

**Files:**
- Modify: `src/auth/components/LamplightSettingsSection.tsx`

- [ ] **Step 1: Add a hook + render to `LamplightSettingsSection`**

Open `src/auth/components/LamplightSettingsSection.tsx`. The component already uses `useLamplightSettings`. We need entitlement + promo data — read them via the existing adapter.

At the top of the component body (after the existing `useLamplightSettings` call), add:

```ts
import { useEffect, useState } from 'react';
// … existing imports …
import { EntitlementBlock } from './EntitlementBlock';
import type { LamplightEntitlement, PromoConfig } from '@/notepad/storage/lamplight-adapter';

// … inside the component …
const [entitlement, setEntitlement] = useState<LamplightEntitlement | null>(null);
const [promo, setPromo] = useState<PromoConfig>({ promoActive: false, promoEndsAt: null });

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const [ent, p] = await Promise.all([
        adapter.getEntitlement(userId),
        adapter.getPromoConfig(),
      ]);
      if (cancelled) return;
      setEntitlement(ent);
      setPromo(p);
    } catch {
      // Best-effort — block just won't render if these fail.
    }
  })();
  return () => { cancelled = true; };
}, [adapter, userId]);
```

Then, inside the JSX, render `<EntitlementBlock />` between the `<h3>` heading and the first `<label>`:

```tsx
<h3 ...>Lamplight</h3>

<EntitlementBlock entitlement={entitlement} promo={promo} />

<label className="flex items-center gap-2 mb-4 text-xs cursor-pointer">
  ...
```

- [ ] **Step 2: Run the section's existing test, if one exists**

Run: `npx vitest run src/auth/components/LamplightSettingsSection.test.tsx`
Expected: PASS (if it exists). If no test file, skip this step.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Manually verify in dev**

Run: `npm run dev` (or `npm start`)
Open `/profile`, scroll to the Lamplight section. With a test account that has no entitlement and promo inactive, the block does not render. With promo active, the launch-promo block renders.

- [ ] **Step 5: Commit**

```bash
git add src/auth/components/LamplightSettingsSection.tsx
git commit -m "feat(lamplight): render EntitlementBlock inside LamplightSettingsSection"
```

---

## Task 16: `useIsAdmin` hook

**Files:**
- Create: `src/admin/hooks/useIsAdmin.ts`
- Create: `src/admin/hooks/useIsAdmin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/admin/hooks/useIsAdmin.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIsAdmin } from './useIsAdmin';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));
vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: vi.fn(() => ({ user: { id: 'u1' }, loading: false, session: { user: { id: 'u1' } } })),
}));

import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/auth/context/useAuthSession';

describe('useIsAdmin', () => {
  it('returns null while loading, then true when RPC returns true', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current.isAdmin).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });

  it('returns false on RPC error', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('returns false immediately when unauthenticated', async () => {
    (useAuthSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({ user: null, loading: false, session: null });
    const { result } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (FAIL)**

Run: `npx vitest run src/admin/hooks/useIsAdmin.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the hook**

Create `src/admin/hooks/useIsAdmin.ts`:

```ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/auth/context/useAuthSession';

export interface UseIsAdminResult {
  isAdmin: boolean | null;
  loading: boolean;
}

export function useIsAdmin(): UseIsAdminResult {
  const { user } = useAuthSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let cancelled = false;
    if (!supabase) { setIsAdmin(false); return; }
    supabase.rpc('is_lamplight_admin').then(({ data, error }) => {
      if (cancelled) return;
      setIsAdmin(error ? false : Boolean(data));
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  return { isAdmin, loading: isAdmin === null };
}
```

- [ ] **Step 4: Run test (PASS)**

Run: `npx vitest run src/admin/hooks/useIsAdmin.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/admin/hooks/useIsAdmin.ts src/admin/hooks/useIsAdmin.test.ts
git commit -m "feat(lamplight): useIsAdmin hook"
```

---

## Task 17: Admin data hooks — counts / jobs / usage

**Files:**
- Create: `src/admin/hooks/useAdminJobCounts.ts`
- Create: `src/admin/hooks/useAdminFailedJobs.ts`
- Create: `src/admin/hooks/useAdminUsageTop.ts`

- [ ] **Step 1: Create `useAdminJobCounts.ts`**

```ts
import { useEffect, useState, useCallback } from 'react';
import type { LamplightAdapter, AdminJobCounts } from '@/notepad/storage/lamplight-adapter';

const HOUR_MS = 3600 * 1000;

export interface UseAdminJobCountsArgs {
  adapter: LamplightAdapter;
  windowHours: number;
  autoRefreshMs?: number;
}

export interface UseAdminJobCountsResult {
  counts: AdminJobCounts | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAdminJobCounts({
  adapter,
  windowHours,
  autoRefreshMs = 30_000,
}: UseAdminJobCountsArgs): UseAdminJobCountsResult {
  const [counts, setCounts] = useState<AdminJobCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - windowHours * HOUR_MS).toISOString();
      const next = await adapter.adminJobCounts(since);
      setCounts(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [adapter, windowHours]);

  useEffect(() => {
    fetch();
    if (!autoRefreshMs) return;
    const t = setInterval(fetch, autoRefreshMs);
    return () => clearInterval(t);
  }, [fetch, autoRefreshMs]);

  return { counts, loading, error, refetch: fetch };
}
```

- [ ] **Step 2: Create `useAdminFailedJobs.ts`**

```ts
import { useEffect, useState, useCallback } from 'react';
import type { LamplightAdapter, AdminJobRow, AdminJobFilters } from '@/notepad/storage/lamplight-adapter';

export interface UseAdminFailedJobsArgs {
  adapter: LamplightAdapter;
  filters: AdminJobFilters;
}

export interface UseAdminFailedJobsResult {
  jobs: AdminJobRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAdminFailedJobs({
  adapter,
  filters,
}: UseAdminFailedJobsArgs): UseAdminFailedJobsResult {
  const [jobs, setJobs] = useState<AdminJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const filtersKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const next = await adapter.adminListJobs({ status: ['failed'], ...filters });
      setJobs(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [adapter, filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { jobs, loading, error, refetch: fetch };
}
```

- [ ] **Step 3: Create `useAdminUsageTop.ts`**

```ts
import { useEffect, useState, useCallback } from 'react';
import type { LamplightAdapter, AdminUsageRow } from '@/notepad/storage/lamplight-adapter';

export interface UseAdminUsageTopArgs {
  adapter: LamplightAdapter;
  windowDays: number;
  limit?: number;
}

export interface UseAdminUsageTopResult {
  rows: AdminUsageRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAdminUsageTop({
  adapter,
  windowDays,
  limit = 50,
}: UseAdminUsageTopArgs): UseAdminUsageTopResult {
  const [rows, setRows] = useState<AdminUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const next = await adapter.adminUsageTop(windowDays, limit);
      setRows(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [adapter, windowDays, limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, loading, error, refetch: fetch };
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/hooks/useAdminJobCounts.ts src/admin/hooks/useAdminFailedJobs.ts src/admin/hooks/useAdminUsageTop.ts
git commit -m "feat(lamplight): admin data hooks (counts, failed jobs, usage top)"
```

---

## Task 18: Admin UI components — strip, table, leaderboard

**Files:**
- Create: `src/admin/components/JobCountsStrip.tsx`
- Create: `src/admin/components/FailedJobsTable.tsx`
- Create: `src/admin/components/UsageLeaderboard.tsx`

- [ ] **Step 1: Create `JobCountsStrip.tsx`**

```tsx
import type { AdminJobCounts } from '@/notepad/storage/lamplight-adapter';

export interface JobCountsStripProps {
  counts: AdminJobCounts | null;
  loading: boolean;
  windowHours: number;
  onWindowChange: (hours: number) => void;
}

const WINDOW_OPTIONS = [
  { label: 'Last 1h',  value: 1 },
  { label: 'Last 24h', value: 24 },
  { label: 'Last 7d',  value: 24 * 7 },
  { label: 'Last 30d', value: 24 * 30 },
];

export function JobCountsStrip({ counts, loading, windowHours, onWindowChange }: JobCountsStripProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-md border" data-testid="job-counts-strip">
      <CountCell label="Queued"  value={counts?.queued}  loading={loading} />
      <CountCell label="Running" value={counts?.running} loading={loading} />
      <CountCell label="Done"    value={counts?.done}    loading={loading} />
      <CountCell label="Failed"  value={counts?.failed}  loading={loading} />
      <div className="ml-auto">
        <select
          aria-label="Window"
          value={windowHours}
          onChange={(e) => onWindowChange(Number(e.target.value))}
          className="text-xs border rounded px-2 py-1"
        >
          {WINDOW_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CountCell({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-lg font-medium">
        {loading ? '…' : (value ?? 0)}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create `FailedJobsTable.tsx`**

```tsx
import { useState } from 'react';
import type { AdminJobRow } from '@/notepad/storage/lamplight-adapter';

export interface FailedJobsTableProps {
  jobs: AdminJobRow[];
  loading: boolean;
  kindFilter: string;
  emailFilter: string;
  sinceDays: number;
  onKindChange: (k: string) => void;
  onEmailChange: (e: string) => void;
  onSinceDaysChange: (d: number) => void;
  onRetryOne: (jobId: string) => Promise<void>;
  onRetryAll: () => Promise<number>;
}

const KIND_OPTIONS = ['', 'embedding_refresh'];
const SINCE_OPTIONS = [
  { label: '24h', value: 1 },
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
];

export function FailedJobsTable(props: FailedJobsTableProps) {
  const { jobs, loading, kindFilter, emailFilter, sinceDays,
    onKindChange, onEmailChange, onSinceDaysChange, onRetryOne, onRetryAll } = props;
  const [bulkBusy, setBulkBusy] = useState(false);

  return (
    <div className="rounded-md border" data-testid="failed-jobs-table">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
        <label className="text-xs flex items-center gap-1">
          Kind
          <select value={kindFilter} onChange={(e) => onKindChange(e.target.value)} className="border rounded px-2 py-1">
            {KIND_OPTIONS.map(k => <option key={k} value={k}>{k || 'any'}</option>)}
          </select>
        </label>
        <label className="text-xs flex items-center gap-1">
          Email
          <input
            type="text" value={emailFilter}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="user@…"
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="text-xs flex items-center gap-1">
          Since
          <select value={sinceDays} onChange={(e) => onSinceDaysChange(Number(e.target.value))} className="border rounded px-2 py-1">
            {SINCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="ml-auto text-xs border rounded px-3 py-1 disabled:opacity-50"
          disabled={bulkBusy || jobs.length === 0}
          onClick={async () => {
            if (jobs.length > 5 && !confirm(`Re-queue ${jobs.length} failed jobs?`)) return;
            setBulkBusy(true);
            try { await onRetryAll(); } finally { setBulkBusy(false); }
          }}
        >
          Retry all
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-xs text-gray-500">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="px-4 py-6 text-xs text-gray-500">
          No failed jobs in the selected window — Lamplight is healthy.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Kind</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">×</th>
              <th className="text-left px-3 py-2">Error</th>
              <th className="text-right px-3 py-2">Retry</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} className="border-t">
                <td className="px-3 py-2">{(j.finishedAt ?? j.scheduledAt).slice(0, 16).replace('T', ' ')}</td>
                <td className="px-3 py-2 font-mono">{j.kind}</td>
                <td className="px-3 py-2">{j.email ?? j.userId.slice(0, 8)}</td>
                <td className="px-3 py-2">{j.attempts}</td>
                <td className="px-3 py-2 truncate max-w-[200px]" title={j.error ?? ''}>{j.error ?? ''}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    aria-label={`retry ${j.id}`}
                    className="border rounded px-2 py-1"
                    onClick={() => onRetryOne(j.id)}
                  >↻</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `UsageLeaderboard.tsx`**

```tsx
import type { AdminUsageRow } from '@/notepad/storage/lamplight-adapter';
import { estCostCents, formatCents } from '../lamplight-cost';

export interface UsageLeaderboardProps {
  rows: AdminUsageRow[];
  loading: boolean;
  windowDays: number;
  onWindowChange: (d: number) => void;
}

const WINDOW_OPTIONS = [
  { label: '24h', value: 1 },
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
];

function approxCostCents(row: AdminUsageRow): number {
  // Aggregate rows don't carry model — assume a worst-case split
  // (claude-haiku-4-5 input + output) for ballpark display. Replace with
  // per-model breakdown when the RPC ships that shape.
  return estCostCents('claude-haiku-4-5', row.tokensIn, row.tokensOut);
}

export function UsageLeaderboard({ rows, loading, windowDays, onWindowChange }: UsageLeaderboardProps) {
  return (
    <div className="rounded-md border" data-testid="usage-leaderboard">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <span className="text-xs uppercase tracking-wide text-gray-500">Token spend</span>
        <label className="ml-auto text-xs flex items-center gap-1">
          Window
          <select value={windowDays} onChange={(e) => onWindowChange(Number(e.target.value))} className="border rounded px-2 py-1">
            {WINDOW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      {loading ? (
        <div className="px-4 py-6 text-xs text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-xs text-gray-500">
          No usage recorded in the selected window.
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map(r => (
            <li key={r.userId} className="px-4 py-2 text-xs flex items-center gap-3">
              <span className="font-medium">{r.email ?? r.userId.slice(0, 8)}</span>
              <span className="text-gray-500">{r.tokensIn.toLocaleString()} in · {r.tokensOut.toLocaleString()} out</span>
              <span className="text-gray-500">~ {formatCents(approxCostCents(r))}</span>
              <span className="ml-auto text-gray-500">{r.calls} calls{r.errors > 0 ? ` · ${r.errors} err` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/components/JobCountsStrip.tsx src/admin/components/FailedJobsTable.tsx src/admin/components/UsageLeaderboard.tsx
git commit -m "feat(lamplight): admin UI components (counts, failed jobs, usage)"
```

---

## Task 19: `AdminLamplightPage` + route registration

**Files:**
- Create: `src/admin/AdminLamplightPage.tsx`
- Create: `src/admin/AdminLamplightPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing page-level test**

Create `src/admin/AdminLamplightPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/auth/context/useAuthSession', () => ({
  useAuthSession: vi.fn(() => ({ user: { id: 'u1' }, loading: false, session: { user: { id: 'u1' } } })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/lib/supabase';
import { AdminLamplightPage } from './AdminLamplightPage';

beforeEach(() => {
  (supabase.rpc as ReturnType<typeof vi.fn>).mockReset();
});

describe('AdminLamplightPage', () => {
  it('redirects when useIsAdmin resolves false', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: false, error: null });
    render(<MemoryRouter><AdminLamplightPage /></MemoryRouter>);
    await waitFor(() => {
      // Heuristic: when redirect happens, the page text is absent.
      expect(screen.queryByText(/Lamplight Ops/i)).not.toBeInTheDocument();
    });
  });

  it('renders all three panels when admin', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockImplementation(async (fn: string) => {
      if (fn === 'is_lamplight_admin') return { data: true, error: null };
      if (fn === 'admin_lamplight_job_counts') return { data: { queued: 1, running: 0, done: 5, failed: 2, since: '' }, error: null };
      if (fn === 'admin_list_lamplight_jobs') return { data: [], error: null };
      if (fn === 'admin_lamplight_usage_top') return { data: [], error: null };
      return { data: null, error: null };
    });
    render(<MemoryRouter><AdminLamplightPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Lamplight Ops/i)).toBeInTheDocument();
      expect(screen.getByTestId('job-counts-strip')).toBeInTheDocument();
      expect(screen.getByTestId('failed-jobs-table')).toBeInTheDocument();
      expect(screen.getByTestId('usage-leaderboard')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test (FAIL)**

Run: `npx vitest run src/admin/AdminLamplightPage.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the page**

Create `src/admin/AdminLamplightPage.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useAdminJobCounts } from './hooks/useAdminJobCounts';
import { useAdminFailedJobs } from './hooks/useAdminFailedJobs';
import { useAdminUsageTop } from './hooks/useAdminUsageTop';
import { JobCountsStrip } from './components/JobCountsStrip';
import { FailedJobsTable } from './components/FailedJobsTable';
import { UsageLeaderboard } from './components/UsageLeaderboard';
import { SupabaseLamplightAdapter } from '@/notepad/storage/supabase-lamplight-adapter';
import { supabase as supabaseClient } from '@/lib/supabase';

export function AdminLamplightPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const adapter = useMemo(
    () => (supabaseClient ? new SupabaseLamplightAdapter(supabaseClient) : null),
    [],
  );

  const [windowHours, setWindowHours] = useState(24);
  const [kindFilter, setKindFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [sinceDays, setSinceDays] = useState(7);
  const [usageWindowDays, setUsageWindowDays] = useState(7);

  const noopAdapter = useMemo(() => adapter, [adapter]);

  const counts = useAdminJobCounts({
    adapter: noopAdapter!,
    windowHours,
  });
  const failed = useAdminFailedJobs({
    adapter: noopAdapter!,
    filters: {
      status: ['failed'],
      kind: kindFilter ? [kindFilter] : undefined,
      userSearch: emailFilter || undefined,
      since: new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString(),
    },
  });
  const usage = useAdminUsageTop({
    adapter: noopAdapter!,
    windowDays: usageWindowDays,
  });

  if (adminLoading) {
    return <div className="p-6 text-xs text-gray-500">Loading…</div>;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  if (!adapter) {
    return <div className="p-6 text-xs text-red-600">Supabase client unavailable.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Lamplight Ops</h1>
      </header>

      <JobCountsStrip
        counts={counts.counts}
        loading={counts.loading}
        windowHours={windowHours}
        onWindowChange={setWindowHours}
      />

      <FailedJobsTable
        jobs={failed.jobs}
        loading={failed.loading}
        kindFilter={kindFilter}
        emailFilter={emailFilter}
        sinceDays={sinceDays}
        onKindChange={setKindFilter}
        onEmailChange={setEmailFilter}
        onSinceDaysChange={setSinceDays}
        onRetryOne={async (jobId) => {
          await adapter.adminRequeueJob(jobId);
          if (supabaseClient) {
            supabaseClient.functions.invoke('embed-note', { body: { job_id: jobId } }).catch(() => {});
          }
          await failed.refetch();
          await counts.refetch();
        }}
        onRetryAll={async () => {
          const n = await adapter.adminRequeueAllFailed(kindFilter || undefined);
          await failed.refetch();
          await counts.refetch();
          return n;
        }}
      />

      <UsageLeaderboard
        rows={usage.rows}
        loading={usage.loading}
        windowDays={usageWindowDays}
        onWindowChange={setUsageWindowDays}
      />
    </div>
  );
}
```

- [ ] **Step 4: Register the route in `App.tsx`**

Open `src/App.tsx`. Near the other `Route` registrations (around line 145–151), add:

```tsx
import { AdminLamplightPage } from '@/admin/AdminLamplightPage';
// … inside Routes …
<Route path="/admin/lamplight" element={<AdminLamplightPage />} />
```

- [ ] **Step 5: Run the page test (PASS)**

Run: `npx vitest run src/admin/AdminLamplightPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: zero errors.

- [ ] **Step 8: Manually verify in dev**

Run: `npm run dev`
- Open `/admin/lamplight` as a non-admin → redirects to `/`.
- Set `is_admin = true` on your test account via SQL Editor, sign out & in, navigate to `/admin/lamplight` → see the three panels.

- [ ] **Step 9: Commit**

```bash
git add src/admin/AdminLamplightPage.tsx src/admin/AdminLamplightPage.test.tsx src/App.tsx
git commit -m "feat(lamplight): /admin/lamplight page + route registration"
```

---

## Final verification

- [ ] **Run the entire suite + type-check + lint**

Run: `npx tsc -b --noEmit && npm run lint && npx vitest run`
Expected: zero errors, all tests green (integration tests skip when env vars unset).

- [ ] **Acceptance criteria walk-through**

Open the spec at `docs/superpowers/specs/2026-05-27-lamplight-entitlements-ui-design.md` and confirm each of the 12 acceptance criteria. If any criterion fails, file a follow-up task before reporting the slice complete.

- [ ] **Push** (only if explicitly requested)

```bash
git push origin main
```
