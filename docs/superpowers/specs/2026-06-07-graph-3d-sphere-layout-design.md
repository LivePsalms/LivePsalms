# Graph 3D sphere layout — design

**Date:** 2026-06-07
**Component:** `src/notepad/graph/graph-view.ts` (+ minor `GraphPane.tsx`)
**Status:** Approved (brainstorming) — ready for implementation plan

## Goal

Replace the scattered 2D force-directed graph with a slowly rotating pseudo-3D
sphere of nodes, so the knowledge graph reads as one appealing, contained object
instead of a loose spread — while staying a *meaningful* graph (related notes stay
grouped) and keeping the existing Canvas 2D rendering, popover, and interaction
infrastructure.

## Chosen behaviour (from brainstorming)

- **Look:** true pseudo-3D sphere. Front nodes large & fully opaque; back nodes
  small & faded; painted back-to-front so the front occludes the back.
- **Motion:** auto-rotate slowly **and** drag to orbit. Auto-rotation pauses while
  hovering a node (so it stays clickable) and while dragging; it resumes after.
- **Arrangement:** relationship-aware — connected / shared-tag notes cluster on the
  sphere surface (a 3D force layout pulled onto the sphere).
- **Edges:** all drawn, alpha faded by endpoint depth (back edges dimmer).
- **Scope:** the sphere **replaces** the 2D layout entirely (not a toggle).
- **Platforms:** desktop **and** mobile (one-finger drag orbits, tap opens/peeks).

## Core architecture: fixed 3D layout, rotation at render time

Each node gets a **frozen 3D position** on a sphere, computed once when the graph
(re)builds — analogous to today's settle step. The sphere is **not** physically
re-simulated to spin. Instead a **camera** (yaw, pitch, zoom) rotates each frame
and the fixed 3D points are re-projected to 2D for drawing.

This deliberately mirrors the existing "render-only" philosophy (the retired drift
effect, the auto-fit): the layout stays frozen, only the *drawing* moves. Rotation
therefore cannot fight the layout, cannot cause overlap in 3D space, and is cheap
(a few trig ops per node per frame, like the old drift).

WebGL is intentionally **not** used. `three` is already a dependency, but the graph
is a hand-built Canvas 2D renderer with bespoke hit-testing and a DOM popover;
pseudo-3D via an orthographic projection in that same pipeline is far lower risk.
WebGL remains a possible future upgrade, out of scope here.

## Layout — relationship-aware sphere

A 3D force simulation positions nodes:

- **Link** attraction (connected notes pull together) — reuse `linkDistance` /
  `linkForce` settings semantics.
- **Charge** repulsion (spread nodes apart) — reuse `repelForce`.
- **Spherical constraint** — a custom `forceSphere(radius R)` that pulls every node
  toward radius R from the centre (e.g. nudge each node's position vector toward
  length R each tick). This is what turns a 3D cloud into a sphere *surface*.
- Optional: carry the existing shared-tags affinity into 3D so same-tag notes group.

**Dependency:** add **`d3-force-3d`** (the 3D sibling of `d3-force`, same
`forceSimulation` / `forceLink` / `forceManyBody` API the code already uses) and
implement `forceSphere` as a small custom force. The plan must verify the package
and its types resolve in this Vite + TS setup before building on it.

**No-dependency fallback (documented, not chosen):** run today's 2D force layout
then map the resulting disc onto the sphere surface. Simpler, no dependency, but
introduces projection distortion and edge-wrapping artifacts. Chosen approach is
the genuine 3D sim for cleaner, truly relationship-aware placement.

After the layout settles it is **frozen** (positions fixed); rotation happens only
at render time.

## Rendering — depth gives the 3D feel

`SimNode` gains a fixed 3D position (`x3, y3, z3`). Each `draw()`:

1. Rotate every node's 3D point by camera yaw (around Y) then pitch (around X).
2. Project **orthographically** to 2D screen space:
   `sx = cx + rx * scale`, `sy = cy + ry * scale`; depth = rotated z.
3. Map depth (back `-R` … front `+R`) to `0…1`. Node draw radius scales with depth
   (e.g. ~0.55× at the back to ~1.2× at the front); opacity scales with depth
   (e.g. ~0.3 at the back to 1.0 at the front).
4. **Edges:** project both endpoints, draw each as a line, alpha faded by the mean
   endpoint depth (back edges dimmer). Drawn before nodes.
5. **Nodes:** sorted back-to-front by depth and painted in that order, so nearer
   nodes occlude farther ones.
6. **Labels:** unchanged from the recent decision — only the hovered node's label
   is drawn, at its projected position.
7. **Active-node glow / hover ring:** drawn at the node's projected position, scaled
   by its depth.

**Accessibility (`prefers-reduced-motion`):** when set, auto-rotation is disabled —
the sphere renders static (depth shading preserved). Drag-to-orbit still works.

**Drift retires:** the gentle per-node drift is removed from the draw path; rotation
is the new "alive" motion. (`driftOffset` and its constants/phase may be deleted or
left dormant per the plan; running both would look jittery.)

## Interaction

All via the existing pointer handlers (`handleMouseDown/Move/Up`, `handleWheel`),
which already receive both mouse and touch through `onPointerDown/Move` in
`GraphPane.tsx`.

- **Auto-rotate:** yaw advances a small amount each frame in the rAF loop when not
  dragging, not hovering a node, and not reduced-motion.
- **Drag = orbit:** pointer drag updates camera yaw/pitch from the drag delta; pitch
  is clamped (e.g. ±~85°) so the globe can't flip. This replaces drag-to-pan.
- **Hover:** hit-test against **projected** positions; nearest-to-front node wins.
  Hovering pauses auto-rotation and shows that node's label + ring.
- **Click / tap:** same hit-test (front-most). Behaviour unchanged — `onNodeTap`
  (mobile peek) first, else scripture → popover, else `onNodeOpen`.
- **Wheel = zoom:** scales the projection (`scale`), clamped to min/max. Anchoring
  to the cursor is optional (sphere is centred, so simple centre-zoom is acceptable).
- **Auto-fit:** centre the sphere in the viewport and choose `scale` so the sphere
  (radius R + max node radius) fits with padding. Deterministic since R is known.
- **Popover:** anchors to the scripture node's **projected** screen position and
  updates as the sphere rotates; it hides (or is suppressed) when that node rotates
  to the far hemisphere.

## Components / units

- `forceSphere(R)` — small, pure-ish custom force; independently testable.
- 3D layout builder — assigns `x3/y3/z3`, runs the 3D sim, freezes positions.
- `project(node, camera)` — pure function: 3D point + camera → `{ sx, sy, depth }`.
  Unit-testable in isolation (front/back, depth ordering, rotation).
- Camera state — `{ yaw, pitch, scale }` with clamps; updated by drag / wheel /
  auto-rotate.
- `draw()` — projection + depth sort + depth-faded edges + nodes + hover label.
- Hit-testing — projected-position, front-most-wins.

Each unit has one job and a clear interface, so projection and the sphere force can
be tested without standing up the whole view.

## Testing (TDD)

New / rewritten tests in `graph-view.test.ts`:

1. **On-sphere layout:** after settle, every node sits ≈ radius R from centre.
2. **Relationship grouping:** connected nodes end up nearer (smaller 3D distance)
   than unconnected ones (coarse assertion).
3. **Projection/depth:** a node rotated to the front projects larger / more opaque
   than the same node rotated to the back; `project` math is correct for known
   angles.
4. **Depth sort:** nodes are painted back-to-front (drawn arc order follows depth).
5. **Edge depth-fade:** an edge with deeper endpoints is drawn at lower alpha.
6. **Hit-test front-most:** when two nodes overlap in screen space, the front one is
   returned by hover/click.
7. **Orbit:** a drag delta changes camera yaw/pitch (pitch clamped).
8. **Auto-rotate:** a render tick advances yaw when idle; does **not** advance while
   hovering, while dragging, or under reduced-motion.
9. **Auto-fit:** sphere is centred and scaled to fit a known viewport.
10. **Reduced-motion:** yaw does not advance across frames.

The injectable `now()` / `prefersReducedMotion()` deps already exist and drive these
deterministically. A camera-state test affordance (read yaw/pitch/scale) is added,
paralleling the existing `getTransform()` / `getHoveredNodeId()` test hooks.

## Out of scope

- WebGL / Three.js rendering (possible future upgrade).
- Perspective projection (orthographic only for now).
- A user setting to tune rotation speed or toggle sphere vs. 2D.
- Pinch-to-zoom gesture (wheel zoom on desktop; revisit pinch later if needed).

## Replaced behaviour

- 2D pan (drag now orbits), 2D auto-fit incl. the 1.25× initial-zoom factor,
  per-node drift, and edge-drift — all superseded by the sphere model and their
  tests rewritten accordingly.
