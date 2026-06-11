import { useEffect } from 'react';

const LOCK_CLASS = 'app-shell-locked';

/**
 * Locks the document into an app-shell state on app routes. When `locked` is
 * true, adds the `app-shell-locked` class to <html>; CSS then pins html/body
 * (`position: fixed; overflow: hidden`) so there is no scrollable/draggable
 * surface beneath the route's `fixed` overlay. On iOS this stops the toolbar /
 * tab bar from drifting during rubber-band scroll or pinch.
 *
 * Driven by a single central call in App.tsx keyed on the current route, so it
 * needs no ref-counting: one consumer owns the class.
 */
export function useAppShellLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    html.classList.add(LOCK_CLASS);
    return () => {
      html.classList.remove(LOCK_CLASS);
    };
  }, [locked]);
}
