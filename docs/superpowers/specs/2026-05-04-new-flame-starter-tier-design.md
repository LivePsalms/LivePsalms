# New Flame Starter Tier — Design Spec

**Date:** 2026-05-04
**Status:** Draft

## Overview

The profile page already renders a "Spiritual Rank" card driven by `getTierForCount(highestNoteCount)`. Today, anyone with fewer than 10 notes falls below the first tier (Spark, threshold 10), so `getTierForCount` returns `null` and the card is hidden entirely. This spec adds **New Flame** as a starter tier with `threshold: 0`, so every signed-in user — including a brand-new account with zero notes — sees their rank and note count on the profile.

## Scope

- Add one entry to `TIERS` in [src/notepad/gamification/tiers.ts](../../../src/notepad/gamification/tiers.ts).
- Tighten `getTierForCount`'s return type from `Tier | null` to `Tier`.
- Remove the `{currentTier && (…)}` conditional in [src/auth/ProfilePage.tsx](../../../src/auth/ProfilePage.tsx) so the card always renders.
- Update the consumer hook [src/notepad/hooks/useUserTier.ts](../../../src/notepad/hooks/useUserTier.ts) to reflect the new non-nullable type for `currentTier`.

## Non-Goals

- No progress-to-next-tier indicator (text or bar). The card stays minimal: name, scripture, reference, count.
- No DB migration. Tiers remain derived in code from the existing `highest_note_count` column on `profiles`.
- No changes to the level-up modal, animation, or trigger logic.
- No changes to the rank shown elsewhere in the app (the level-up flow already handles each crossing).

## 1. Tier Data Change

Prepend a new entry to `TIERS`:

```ts
{
  name: 'New Flame',
  threshold: 0,
  scripture: 'Do not despise these small beginnings, for the Lord rejoices to see the work begin',
  reference: 'Zechariah 4:10',
}
```

Order matters: `getTierForCount` walks `TIERS` in order and returns the last tier whose threshold is ≤ the count, so New Flame must come first.

## 2. Type Tightening

`getTierForCount` currently returns `Tier | null`. With a threshold-0 entry at the front, the function always finds a match (any non-negative count satisfies `count >= 0`). Update the signature:

```ts
export function getTierForCount(highestNoteCount: number): Tier
```

The internal `current` accumulator can be initialized to `TIERS[0]` instead of `null`. This keeps the function correct even if the array is reordered later, as long as `TIERS[0].threshold === 0`.

`getNextTier` is unchanged. For `highestNoteCount = 0`, it skips New Flame (`0 < 0` is false) and returns Spark, which is the desired behavior.

## 3. ProfilePage Change

In [src/auth/ProfilePage.tsx](../../../src/auth/ProfilePage.tsx) line 225, drop the conditional:

```tsx
// Before
{currentTier && (
  <div style={sectionStyle}>
    …
  </div>
)}

// After
<div style={sectionStyle}>
  …
</div>
```

`currentTier` is now `Tier`, so all field accesses (`currentTier.name`, `currentTier.scripture`, `currentTier.reference`) are unconditional.

The "X notes written" line continues to display `profile?.noteCount ?? 0` — current count, not the high-water mark — matching today's behavior.

## 4. useUserTier Hook Change

In [src/notepad/hooks/useUserTier.ts](../../../src/notepad/hooks/useUserTier.ts):

- The `UseUserTierResult.currentTier` field becomes `Tier` (was `Tier | null`).
- `prevTierRef` continues to be typed `Tier | null` because it stays null until the first effect run.
- The level-up trigger logic is unchanged. Trace for a new user:
  1. First render: `currentTier = New Flame (0)`. Effect runs, `initializedRef.current === false`, so it stores `prev = New Flame` and returns. No modal.
  2. User reaches 10 notes: `currentTier` re-evaluates to Spark (10). Effect runs, `currentThreshold (10) > prevThreshold (0)` → modal fires for Spark. Same as today.
  3. New user idle at 0 notes: rerenders happen, `current === prev === New Flame`, `0 > 0` is false → no spurious modal.

## 5. Files Touched

| File | Change |
|---|---|
| `src/notepad/gamification/tiers.ts` | Prepend New Flame entry; tighten return type of `getTierForCount`; initialize `current` to `TIERS[0]` |
| `src/auth/ProfilePage.tsx` | Remove `{currentTier && …}` conditional |
| `src/notepad/hooks/useUserTier.ts` | Change `currentTier` field type from `Tier \| null` to `Tier` |

## 6. Verification

- Manual: load profile page as a new account (0 notes) → "New Flame" card visible with the Zechariah verse and "0 notes written".
- Manual: load profile page as an existing account at any tier → unchanged from today.
- Manual: when a user crosses 10 notes, the existing level-up modal still fires for Spark.
- Type check: `tsc -b` passes after the return-type change and downstream consumer updates.
