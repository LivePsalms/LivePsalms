# Graph node drift animation — design

**Date:** 2026-06-07
**Component:** `src/notepad/graph/graph-view.ts`
**Status:** Approved (brainstorming) — ready for implementation plan

## Goal

Make the knowledge graph feel alive with a subtle, continuous node animation,
without reintroducing the layout/size problems that caused the earlier overlap
regression.

## Chosen behaviour: "drift / float" (Gentle)

Every node continuously floats along its own small elliptical path. Each node has
a fixed, distinct phase, so the graph shimmers organically rather than sliding as
a block. The motion runs forever once the layout has settled.

Tuning (validated in the visual companion against a graph-scale preview):
- **Amplitude:** ~4.5 world units ("Gentle" — clearly alive, still relaxed).
- **Speed:** ~0.8 rad/s.
- **Path shape:** elliptical (the y axis runs at 0.78× the x frequency).

## Core safety property: render-only

The effect is applied **only at draw time**. It never touches the d3-force
simulation, the layout, `forceCollide`, or auto-fit. The settled layout stays
frozen; `draw()` adds a small per-node offset when painting.

This deliberately sidesteps the size/position coupling trap behind the previous
overlap regression: because drift is not part of the layout, it cannot push nodes
into each other, and it cannot fight auto-fit.

## How it works

The production rAF loop already repaints every frame after the layout settles
(`startAutoTick` → `sim.tick()` + `onTick()` → `draw()`), so no new animation
infrastructure is required. `draw()` reads a wall clock and, per node, computes:

```
t  = now() / 1000
ox = AMP * sin(t * SPD + phase)
oy = AMP * cos(t * SPD * 0.78 + phase * 1.3)
```

It then draws that node's circle, label, active-node glow, and hover ring at
`(n.x + ox, n.y + oy)`, and draws each edge using the **offset endpoints** of its
source and target nodes, so every visual element stays attached.

`AMP` and `SPD` are module-level constants. Amplitude is expressed in **world
units**, so it scales with zoom alongside the nodes (drift stays proportional to
node size whether zoomed in or out) and requires no special screen-space handling
— the existing `setTransform(scale*dpr, …)` pipeline applies it.

### Per-node phase

Derived deterministically from the node id via a stable string hash, computed once
at build time and stored on the `SimNode`. Stable across redraws and distinct per
node (no per-frame randomness, no popping when the graph rebuilds).

### Hit-testing

Unchanged. Pointer hit-testing continues to use the base `n.x / n.y` positions;
drift is purely visual. The maximum on-screen offset (~10px) is far smaller than
node radii, so hover/click still land correctly. No interaction code changes.

Note: dragging in this view pans the **canvas** (`transform.x/y`), not individual
nodes, so drift never conflicts with a dragged node.

## Accessibility

Respect `prefers-reduced-motion`. Add an injectable dependency
`prefersReducedMotion?: () => boolean`; when it returns true, the amplitude is
treated as 0 and the graph renders perfectly static.

## Testability

Add an injectable `now?: () => number` dependency (defaults to
`performance.now()`) so tests can drive the clock deterministically.

## Dependencies added to `GraphViewDeps`

```ts
now?: () => number;                    // defaults to performance.now()
prefersReducedMotion?: () => boolean;  // defaults to false (no matchMedia => animate)
```

## Rejected alternative

Re-heating the physics simulation (raising `alpha`) to create "live jitter."
Rejected: it reintroduces real layout motion, fights auto-fit, and risks the exact
overlap/resize problems just eliminated. Render-only drift achieves the same feel
with none of the risk.

## Test plan (TDD)

1. **Drift moves a node:** with a non-reduced-motion clock, a node's drawn
   position differs between two distinct `now()` values.
2. **Edges follow nodes:** an edge's drawn endpoints track the offset positions of
   its source/target nodes at a given clock value.
3. **Reduced motion freezes:** with `prefersReducedMotion() === true`, a node's
   drawn position is identical across different clock values.
4. **Phase stability:** a node's phase (and therefore its offset at a fixed clock)
   is unchanged across a rebuild of the same graph.

## Out of scope

- Combining drift with other styles (breathing/glow/edge-flow) — possible later.
- A user-facing setting to toggle or tune drift intensity.
