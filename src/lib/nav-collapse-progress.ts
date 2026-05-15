// Module-level pub/sub for the nav-collapse animation's progress.
//
// One publisher at a time — either the Hero's scroll-collapse timeline on `/`
// or the Header's fallback ScrollTrigger on other routes. Subscribers (the
// Header's nav DOM applier and the click-expand state machine) read directly
// from this module; no React Context is involved.

type Listener = (progress: number) => void;

const listeners = new Set<Listener>();
let current = 0;

export function setNavCollapseProgress(progress: number): void {
  current = progress;
  listeners.forEach((l) => l(progress));
}

export function subscribeNavCollapseProgress(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function getNavCollapseProgress(): number {
  return current;
}
