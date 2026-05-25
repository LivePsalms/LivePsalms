# Purpose Grid — "Start Here" Hover CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed "Start Here" label to the bottom-right corner of every project card's hover overlay in the Purpose grid.

**Architecture:** Render a single absolutely-positioned `<span>` inside the existing `motion.div` that wraps the centered watermark + category label, so the new label inherits the same fade/scale transition without any extra animation wiring. Pure markup + Tailwind classes — no new tokens, no logic.

**Tech Stack:** React, Framer Motion, Tailwind CSS (existing project setup).

**Spec:** [docs/superpowers/specs/2026-05-18-purpose-grid-start-here-cta.md](../specs/2026-05-18-purpose-grid-start-here-cta.md)

---

### Task 1: Add the "Start Here" label to the hover overlay

**Files:**
- Modify: [src/components/sections/PurposeGrid.tsx:104-126](../../../src/components/sections/PurposeGrid.tsx#L104-L126)

The existing overlay in `ProjectCard` renders a centered logo watermark and category label inside a `motion.div`. We add one new `<span>` as a sibling of those centered children, positioned `absolute bottom-4 right-4` so it floats in the corner instead of joining the flex column. Animation, pointer-events, and mobile hiding are all inherited from the parent — no separate wiring needed.

- [ ] **Step 1: Read the current overlay block to confirm context has not drifted**

Run: read `src/components/sections/PurposeGrid.tsx` lines 104-126 and confirm the structure still matches the snippet below:

```tsx
<AnimatePresence>
  {isHovered && (
    <motion.div
      className="pg-hover-overlay absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      {/* Logo watermark */}
      <img
        src="/logo-icon.png"
        alt=""
        className="w-6 md:w-8 opacity-25 invert mb-3"
      />
      {/* Category label */}
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
        {overlayLabelById[project.id] ?? categoryLabel[project.category]}
      </span>
    </motion.div>
  )}
</AnimatePresence>
```

Expected: structure matches. If lines have shifted, locate the same `motion.div` block by searching for `pg-hover-overlay absolute inset-0 flex flex-col`.

- [ ] **Step 2: Add the "Start Here" span as the final child of the `motion.div`**

Insert immediately after the closing `</span>` of the category label and before the closing `</motion.div>`:

```tsx
      {/* Start-here CTA — anchored bottom-right of the overlay */}
      <span className="absolute bottom-4 right-4 text-[10px] uppercase tracking-[0.2em] text-white/60">
        Start here
      </span>
```

Rationale for each choice:
- `absolute bottom-4 right-4`: 16px inset from both edges; pulls the span out of the flex column so the centered content keeps its current layout.
- `text-[10px] uppercase tracking-[0.2em] text-white/60`: byte-for-byte identical to the category label so both elements read as one editorial voice. `uppercase` handles the casing, so the source string is `Start here` (any casing works — left lowercase to match the comment style elsewhere in the file).
- No new motion wrapper: the parent `motion.div` already runs an opacity+scale fade-in; the new span fades in with it.
- No `pointer-events-auto`: we want clicks to pass through to the card.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 4: Lint the changed file**

Run: `npx eslint src/components/sections/PurposeGrid.tsx`
Expected: no errors.

- [ ] **Step 5: Visual verification in the dev server**

Run: `npm run dev` (let it start, then open the printed local URL).

Verify on md+ viewport (≥768px wide):
1. Scroll to the Purpose grid section and let the strip→grid morph complete.
2. Hover any restoration card — confirm: centered watermark + "RESTORATION OF …" label appear AND "START HERE" appears in the bottom-right corner.
3. Hover any serenity card — confirm: centered watermark + "SERENITY OF …" label appear AND "START HERE" appears in the bottom-right corner.
4. Move cursor off — overlay (including "Start Here") fades back out together.
5. Click anywhere on the card, including over the "Start Here" label — the project click handler fires (pointer events pass through).

Resize the window below 768px:
6. Confirm the overlay (and therefore "Start Here") does not appear — hover is desktop-only by design.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/PurposeGrid.tsx
git commit -m "$(cat <<'EOF'
feat(purpose-grid): add "Start Here" CTA to hover overlay

Adds a bottom-right "Start Here" label to every project card's hover
overlay so the click affordance is explicit. Matches the existing
category-label type treatment; inherits the parent motion.div's fade
so no separate animation is required.

Spec: docs/superpowers/specs/2026-05-18-purpose-grid-start-here-cta.md
EOF
)"
```

---

## Acceptance Criteria Verification

After Task 1 completes, the following spec acceptance criteria should be satisfied (confirmed via Step 5 visual check):

1. ✅ On md+ viewports, hovering reveals centered watermark + label AND a new bottom-right "Start Here" label.
2. ✅ Both elements fade in together (same transition — they share a parent `motion.div`).
3. ✅ Clicking anywhere on the card, including over the new label, opens the project (overlay wrapper retains `pointer-events-none`).
4. ✅ The label is absent on mobile (overlay CSS already hides on <md) and absent when not hovered.
5. ✅ No regression in typecheck (Step 3) or in the existing strip→grid Flip morph (Step 5 #1 confirms morph still completes).

## Notes for the implementer

- The PurposeGrid component contains substantial scroll/Flip choreography. Do not touch any of it. The only edit is the addition of one `<span>` inside the `AnimatePresence` block.
- There is no dedicated unit test for `PurposeGrid` (other section tests in this directory exist but cover business logic — this is pure visual markup, so a unit test would be ceremony without value). Visual verification + typecheck are the appropriate gate.
- If you cannot run the dev server (e.g., port conflict), still ship the typecheck + lint and explicitly note in your handoff that visual verification was not performed.
