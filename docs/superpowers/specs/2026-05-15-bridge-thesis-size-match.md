# Bridge thesis — match size and weight to side beats

A small follow-up tweak to the [hero bridge pinned redesign](./2026-05-15-hero-bridge-pinned-redesign.md). After seeing the pinned three-beat sequence in motion, the thesis ("Restoration is a returning.") is judged too visually prominent — its size and weight emphasis pulls focus disproportionately. This change brings the thesis to full visual parity with the side beats.

## Change

In [src/index.css](../../../src/index.css), update the `.bridge-thesis` rule:

| Property | Before | After |
|---|---|---|
| `font-size` | `clamp(32px, 5.5vw, 60px)` | `clamp(24px, 4vw, 40px)` |
| `font-weight` | `400` | `300` |

All other properties (`font-family`, `font-style`, `line-height`, `color`, `max-width`) remain unchanged. After this change, `.bridge-thesis` is byte-identical to `.bridge-line-side` in declaration content.

## Why keep `.bridge-thesis` as a separate class

The class name still labels the beat's narrative role in the JSX (`<p className="bridge-thesis">` reads as "this is the thesis"). Keeping the class — even though its declaration now duplicates `.bridge-line-side` — means a future change that wants to re-introduce emphasis only touches CSS, not JSX. The duplication is acceptable for a 3-class block.

## Out of scope

- Removing `.bridge-thesis` and switching text 2's JSX to use `.bridge-line-side`
- Comma-grouping `.bridge-thesis` with `.bridge-line-side` to deduplicate declarations
- Any change to motion, timing, positioning, or any other CSS class
