// Module-level pub/sub for an adaptive nav-theme override.
//
// A page can publish 'dark' or 'light' to declare what background sits behind
// the nav strip at the current scroll position; the Header subscribes and
// flips its text/hover colors to stay legible. When the override is null,
// the Header falls back to its `darkText` prop (the per-route default).

export type NavTheme = 'dark' | 'light' | null;

type Listener = (theme: NavTheme) => void;

const listeners = new Set<Listener>();
let current: NavTheme = null;

export function setNavTheme(theme: NavTheme): void {
  if (current === theme) return;
  current = theme;
  listeners.forEach((l) => l(theme));
}

export function subscribeNavTheme(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function getNavTheme(): NavTheme {
  return current;
}
