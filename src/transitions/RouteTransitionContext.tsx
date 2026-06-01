import { createContext, useContext } from 'react';

/**
 * Exposes the route-level SplitTransition curtain reveal (the two-panel
 * open/close used by the home-grid project click) so that deeply nested
 * consumers — the NextDevotionHandoff pill and the /purpose stack pill — can
 * trigger the SAME reveal instead of prop-drilling through five layers.
 *
 * Provided by App, wired to `RouteTransition.beginNavigation`.
 */
export interface RouteTransitionContextValue {
  /**
   * Play the curtain reveal and navigate to `target`, painting the panels in
   * `color`. No-op if a transition is already in flight (the controller guards
   * that). Mirrors how the home grid navigates.
   */
  beginCurtainNavigation: (target: string, color: string) => void;
}

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null);

export const RouteTransitionProvider = RouteTransitionContext.Provider;

/** Curtain-navigation trigger, or `null` when rendered outside the provider. */
export function useRouteTransitionContext(): RouteTransitionContextValue | null {
  return useContext(RouteTransitionContext);
}
