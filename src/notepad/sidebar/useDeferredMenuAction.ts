import { useRef } from 'react';

/**
 * Defers a menu item's action until the menu has finished closing.
 *
 * Radix closes a menu on item select. Running an action that opens a dialog (or
 * moves focus) in the same tick races with that close and the dialog is
 * dismissed instantly. Instead, stash the action with `run(...)` from the item's
 * `onSelect`, and execute it from the menu content's `onCloseAutoFocus` — after
 * focus/pointer cleanup is done.
 *
 * Wire `onCloseAutoFocus` onto `DropdownMenuContent` and/or `ContextMenuContent`.
 *
 * Also guards against the Radix "ghost click": when a menu closes, the
 * synthesized click can fall through to the element beneath the trigger (e.g.
 * the row, which would open/navigate). `wasJustOpen()` lets that element's
 * onClick ignore clicks fired right after a menu close.
 */
const GHOST_CLICK_WINDOW_MS = 500;

export function useDeferredMenuAction() {
  const pending = useRef<(() => void) | null>(null);
  const closedAt = useRef(0);

  const run = (fn: () => void) => {
    // Stamp at selection time — the ghost click can fire before onCloseAutoFocus.
    closedAt.current = performance.now();
    pending.current = fn;
  };

  const onCloseAutoFocus = (e: Event) => {
    closedAt.current = performance.now();
    if (!pending.current) return;
    e.preventDefault(); // don't bounce focus back to the trigger
    const fn = pending.current;
    pending.current = null;
    fn();
  };

  /** True if a menu closed within the last frame-or-so — used to swallow the
   *  ghost click on the underlying row. */
  const wasJustOpen = () => performance.now() - closedAt.current < GHOST_CLICK_WINDOW_MS;

  return { run, onCloseAutoFocus, wasJustOpen };
}
