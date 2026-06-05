// src/notepad-landing/sections/garden-scene/paper-overlay.tsx
// Verbatim SVG noise URL from reference index.html:58
const NOISE_URL =
  "data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E" +
  "%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E";

export function PaperOverlay() {
  return (
    <div
      className="garden-paper-overlay"
      aria-hidden="true"
      style={{ backgroundImage: `url("${NOISE_URL}")` }}
    />
  );
}
