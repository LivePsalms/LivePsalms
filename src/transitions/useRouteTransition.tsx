import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/all';
import { RouteTransition } from './route-transition';
import type { RouteTransitionDeps } from './route-transition';
import type { Project } from '@/types';
import { FALLBACK_OVERLAY_COLOR } from '@/data/projects';

/**
 * React glue for `RouteTransition`. Wires DOM/GSAP/router deps into the class,
 * mounts the popstate-driven back-button interception on detail pages, and
 * fires the belt-and-suspenders scroll restore in a `useLayoutEffect` on
 * pathname change.
 */
export function useRouteTransition(projects: Project[]): {
  status: ReturnType<RouteTransition['getSnapshot']>['status'];
  color: string;
  transition: RouteTransition;
} {
  const navigate = useNavigate();
  const location = useLocation();

  const transition = useMemo(() => {
    const deps: RouteTransitionDeps = {
      navigate: (target) => navigate(target),
      killScrollTriggers: () => ScrollTrigger.getAll().forEach((st) => st.kill()),
      setBodyOverflow: (v) => {
        document.body.style.overflow = v;
        // The original implementation also toggled documentElement.overflow
        // when locking; keep that behavior on lock to avoid scroll bleed.
        document.documentElement.style.overflow = v === 'hidden' ? v : '';
      },
      scrollWindow: (y) => {
        const prev = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, y);
        document.documentElement.scrollTop = y;
        document.body.scrollTop = y;
        requestAnimationFrame(() => {
          document.documentElement.style.scrollBehavior = prev;
        });
      },
      getScrollY: () => window.scrollY,
    };
    return new RouteTransition(deps, FALLBACK_OVERLAY_COLOR);
  }, [navigate]);

  const state = useSyncExternalStore(transition.subscribe, transition.getSnapshot);

  // Belt-and-suspenders scroll reset on pathname change. The class no-ops
  // gracefully if the transition flow already handled the scroll.
  useLayoutEffect(() => {
    transition.handleLocationChanged();
  }, [location.pathname, transition]);

  // Browser back-button interception, active only on detail pages and only
  // when the transition is idle (so a popstate during a transition doesn't
  // re-enter `beginExit`).
  const isDetailPage = location.pathname.startsWith('/purpose/');
  useEffect(() => {
    if (!isDetailPage || state.status !== 'idle') return;
    window.history.pushState(null, '', location.pathname);
    const handlePopState = () => {
      const projectId = location.pathname.split('/purpose/')[1];
      const project = projects.find((p) => p.id === projectId);
      transition.beginExit(project?.overlayColor || FALLBACK_OVERLAY_COLOR);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDetailPage, location.pathname, projects, state.status, transition]);

  return { status: state.status, color: state.color, transition };
}
