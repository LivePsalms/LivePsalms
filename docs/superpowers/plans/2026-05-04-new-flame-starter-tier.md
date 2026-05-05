# New Flame Starter Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "New Flame" starter tier (threshold 0) so the profile page rank card is visible for every user, including those with zero notes.

**Architecture:** Three small, sequential edits — one data addition, one type tightening with downstream propagation, one JSX conditional removal. No new files, no schema change, no new tests.

**Tech Stack:** TypeScript, React, Vite. Verification via `tsc -b` (type check) and manual browser smoke test via the running dev server at `http://localhost:5173`.

**Note on TDD:** This project has no test runner or existing tests (verified: no `*.test.*` files; no `test` script in `package.json`). Scaffolding a test runner for a three-line data change is out of scope. Verification is type-check + manual smoke test, called out explicitly in each task.

---

## File Structure

| File | Change |
|---|---|
| `src/notepad/gamification/tiers.ts` | Prepend `New Flame` entry; tighten `getTierForCount` return type from `Tier \| null` to `Tier`; initialize accumulator to `TIERS[0]` |
| `src/notepad/hooks/useUserTier.ts` | Update `UseUserTierResult.currentTier` from `Tier \| null` to `Tier` |
| `src/auth/ProfilePage.tsx` | Remove `{currentTier && (…)}` conditional around the rank card |

Tasks are ordered so the type tightening lands before its consumers, keeping the working tree compiling at each commit.

---

### Task 1: Add the New Flame tier and tighten the return type

**Files:**
- Modify: `src/notepad/gamification/tiers.ts`

- [ ] **Step 1: Read the current file**

Run:
```bash
cat src/notepad/gamification/tiers.ts
```

Expected: see the `Tier` interface, the `TIERS` array starting with `Spark` (threshold 10), `getTierForCount` returning `Tier | null`, and `getNextTier`.

- [ ] **Step 2: Prepend the New Flame entry to TIERS**

Insert this entry as the **first** element of the `TIERS` array (before `Spark`):

```ts
{
  name: 'New Flame',
  threshold: 0,
  scripture: 'Do not despise these small beginnings, for the Lord rejoices to see the work begin',
  reference: 'Zechariah 4:10',
},
```

After the edit, `TIERS` should look like:

```ts
export const TIERS: Tier[] = [
  {
    name: 'New Flame',
    threshold: 0,
    scripture: 'Do not despise these small beginnings, for the Lord rejoices to see the work begin',
    reference: 'Zechariah 4:10',
  },
  {
    name: 'Spark',
    threshold: 10,
    scripture: 'The Lord is my light and my salvation',
    reference: 'Psalm 27:1',
  },
  // … remaining tiers unchanged
];
```

- [ ] **Step 3: Tighten `getTierForCount` return type and initializer**

Replace the existing function:

```ts
/**
 * Get the current tier for a given highest note count.
 * Returns null if below the first threshold (< 10).
 */
export function getTierForCount(highestNoteCount: number): Tier | null {
  let current: Tier | null = null;
  for (const tier of TIERS) {
    if (highestNoteCount >= tier.threshold) {
      current = tier;
    } else {
      break;
    }
  }
  return current;
}
```

with:

```ts
/**
 * Get the current tier for a given highest note count.
 * Always returns a tier — defaults to TIERS[0] (New Flame, threshold 0).
 */
export function getTierForCount(highestNoteCount: number): Tier {
  let current: Tier = TIERS[0];
  for (const tier of TIERS) {
    if (highestNoteCount >= tier.threshold) {
      current = tier;
    } else {
      break;
    }
  }
  return current;
}
```

Leave `getNextTier` untouched.

- [ ] **Step 4: Type-check**

Run:
```bash
npx tsc -b
```

Expected: errors in `src/notepad/hooks/useUserTier.ts` and/or `src/auth/ProfilePage.tsx` complaining that `Tier` is not assignable to `Tier | null` consumers, or similar narrowing complaints. **These errors are expected** and will be resolved in Tasks 2 and 3.

If you see *no* errors, that's also fine — TypeScript may accept the wider-than-declared returns silently.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/gamification/tiers.ts
git commit -m "$(cat <<'EOF'
feat: add New Flame starter tier (threshold 0)

Prepends a 'New Flame' entry to TIERS so getTierForCount always
returns a tier. Return type tightened from Tier | null to Tier;
consumers updated in following commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update the useUserTier hook to the non-nullable type

**Files:**
- Modify: `src/notepad/hooks/useUserTier.ts`

- [ ] **Step 1: Read the current file**

Run:
```bash
cat src/notepad/hooks/useUserTier.ts
```

Expected: a hook returning `currentTier: Tier | null`, `nextTier: Tier | null`, plus level-up state.

- [ ] **Step 2: Change the `currentTier` field type to non-nullable**

Locate this interface near the top of the file:

```ts
interface UseUserTierResult {
  currentTier: Tier | null;
  nextTier: Tier | null;
  showLevelUp: boolean;
  levelUpTier: Tier | null;
  dismissLevelUp: () => void;
}
```

Change `currentTier`'s type:

```ts
interface UseUserTierResult {
  currentTier: Tier;
  nextTier: Tier | null;
  showLevelUp: boolean;
  levelUpTier: Tier | null;
  dismissLevelUp: () => void;
}
```

Leave `nextTier` and `levelUpTier` as `Tier | null`. `nextTier` is null at the top of the ladder (Glory); `levelUpTier` is null when no level-up modal is active.

Do not modify any other line in this file. The level-up effect logic is unchanged: `prevTierRef` continues to be `Tier | null`, and `prevTierRef.current?.threshold ?? 0` still handles the initial-mount null correctly.

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc -b
```

Expected: any error from this file should be gone. If `src/auth/ProfilePage.tsx` still errors (e.g., on the `{currentTier && …}` conditional being a type mismatch), that's expected — fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/notepad/hooks/useUserTier.ts
git commit -m "$(cat <<'EOF'
refactor: tighten useUserTier currentTier to non-nullable Tier

Reflects the tightened getTierForCount return type from the
previous commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Always render the rank card on the profile page

**Files:**
- Modify: `src/auth/ProfilePage.tsx` (around line 224–250)

- [ ] **Step 1: Read the current rank card block**

Run:
```bash
sed -n '223,251p' src/auth/ProfilePage.tsx
```

Expected: the JSX wrapped in `{currentTier && (` … `)}`.

- [ ] **Step 2: Remove the conditional wrapper**

Replace this block:

```tsx
        {/* Tier Display */}
        {currentTier && (
          <div style={sectionStyle}>
            <p style={labelStyle}>SPIRITUAL RANK</p>
            <p
              className="text-xl font-medium mb-1"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              {currentTier.name}
            </p>
            <p
              className="text-xs italic mb-3"
              style={{
                color: 'var(--silica)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              "{currentTier.scripture}" — {currentTier.reference}
            </p>
            <p className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              {totalNotes} {totalNotes === 1 ? 'note' : 'notes'} written
            </p>
          </div>
        )}
```

with:

```tsx
        {/* Tier Display */}
        <div style={sectionStyle}>
          <p style={labelStyle}>SPIRITUAL RANK</p>
          <p
            className="text-xl font-medium mb-1"
            style={{
              color: 'var(--deep-umber)',
              fontFamily: 'Cormorant Garamond, serif',
            }}
          >
            {currentTier.name}
          </p>
          <p
            className="text-xs italic mb-3"
            style={{
              color: 'var(--silica)',
              fontFamily: 'Cormorant Garamond, serif',
            }}
          >
            "{currentTier.scripture}" — {currentTier.reference}
          </p>
          <p className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
            {totalNotes} {totalNotes === 1 ? 'note' : 'notes'} written
          </p>
        </div>
```

The only structural change is removing the `{currentTier && (` opening and the matching `)}` closing — every inner line is preserved.

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc -b
```

Expected: clean exit, no errors anywhere.

- [ ] **Step 4: Commit**

```bash
git add src/auth/ProfilePage.tsx
git commit -m "$(cat <<'EOF'
feat: always render spiritual rank card on profile

Removes the {currentTier && …} guard so the card shows for every
user. With New Flame as the threshold-0 starter tier, currentTier
is always defined.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Manual smoke test in the browser

**Files:** none (verification only)

This task confirms the visible behavior. The auth bug from the earlier test report (secret API key in `.env.local`) blocks the live profile fetch, so this verifies via two paths.

- [ ] **Step 1: Confirm dev server is running**

Run:
```bash
lsof -i :5173 -t > /dev/null && echo "running" || echo "not running"
```

Expected: `running`. If not, start it: `npm run dev` in a background terminal, then re-check.

- [ ] **Step 2: Verify the tier card renders for a zero-count profile via direct component check**

This sub-step verifies the `getTierForCount(0)` result the card consumes. In a Node REPL or via a one-shot script, confirm the function returns the New Flame entry. Run:

```bash
npx tsx -e "import('./src/notepad/gamification/tiers.ts').then(m => { const t = m.getTierForCount(0); console.log(JSON.stringify(t, null, 2)); })"
```

Expected stdout:
```json
{
  "name": "New Flame",
  "threshold": 0,
  "scripture": "Do not despise these small beginnings, for the Lord rejoices to see the work begin",
  "reference": "Zechariah 4:10"
}
```

If `tsx` is not installed, run instead:
```bash
node --input-type=module -e "import('./src/notepad/gamification/tiers.ts').then(m => console.log(JSON.stringify(m.getTierForCount(0), null, 2)))"
```

- [ ] **Step 3: Verify higher counts still resolve to existing tiers**

Run:
```bash
npx tsx -e "import('./src/notepad/gamification/tiers.ts').then(m => { for (const c of [0, 9, 10, 49, 50, 150, 1000, 5000, 10000]) console.log(c, '→', m.getTierForCount(c).name); })"
```

Expected output:
```
0 → New Flame
9 → New Flame
10 → Spark
49 → Spark
50 → Ember
150 → Flame
1000 → Refiner
5000 → Glory
10000 → Glory
```

- [ ] **Step 4: Verify `getNextTier` is unaffected**

Run:
```bash
npx tsx -e "import('./src/notepad/gamification/tiers.ts').then(m => { for (const c of [0, 5, 10, 50, 5000]) { const t = m.getNextTier(c); console.log(c, '→', t ? t.name : 'null'); } })"
```

Expected output:
```
0 → Spark
5 → Spark
10 → Ember
50 → Flame
5000 → null
```

- [ ] **Step 5: (Optional, only if auth works) Browser sanity check**

If you have a working Supabase anon key and can sign in, navigate to `http://localhost:5173/profile` and confirm:
- The "SPIRITUAL RANK" card is visible
- For a zero-note account, the rank reads "New Flame" with the Zechariah 4:10 quote
- The "X notes written" count line is present

Skip this step if the secret-key issue from the earlier test report is unresolved — it blocks profile loading.

- [ ] **Step 6: Final type-check**

Run:
```bash
npx tsc -b
```

Expected: clean exit.

No commit for this task — it is verification only.

---

## Self-Review Notes

- **Spec coverage.** All four sections of the spec map to tasks: tier data (Task 1), type tightening (Task 1), ProfilePage conditional removal (Task 3), useUserTier hook update (Task 2). Verification matches §6 of the spec (Task 4).
- **Placeholders.** None — every code change shows the full before/after, every command shows expected output.
- **Type consistency.** `Tier` (capital T, from `tiers.ts`) is the only type touched; `Tier | null` is preserved for `nextTier` and `levelUpTier`; `prevTierRef` stays `Tier | null`.
- **Order safety.** The intermediate commit after Task 1 may have a transient type error in `useUserTier.ts` / `ProfilePage.tsx`. This is acceptable for a small three-commit sequence on a feature branch where the executor follows tasks in order; if strict per-commit cleanliness is required, all three edits can be combined into one commit instead.
