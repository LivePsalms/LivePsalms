import { useState, useCallback, useLayoutEffect, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/all';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/sections/Hero';
import { PurposeGrid } from '@/components/sections/PurposeGrid';
import { PurposeGallery } from '@/components/sections/PurposeGallery';
import { PurposeDetail } from '@/components/sections/PurposeDetail';
import { Notepad } from '@/components/sections/Notepad';
import { WaterRipple } from '@/components/ui-custom/WaterRipple';
import { OrganicBackdrop } from '@/components/ui-custom/OrganicBackdrop';
import { SplitTransition } from '@/components/ui-custom/SplitTransition';
import type { TransitionPhase } from '@/components/ui-custom/SplitTransition';
import { useProjectColors } from '@/hooks/useProjectColors';
import { FALLBACK_OVERLAY_COLOR } from '@/data/projects';
import type { Project } from '@/types';
import { AuthProvider } from '@/auth/AuthProvider';
import { LoginPage } from '@/auth/LoginPage';
import { ProfilePage } from '@/auth/ProfilePage';
import './App.css';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const [transitionColor, setTransitionColor] = useState(FALLBACK_OVERLAY_COLOR);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const exitingRef = useRef(false);
  const savedScrollY = useRef<number | null>(null);
  const isBackNav = useRef(false);
  const projects = useProjectColors();
  const isDetailPage = location.pathname.startsWith('/purpose/');
  const isPurposePage = location.pathname === '/purpose';
  const isNotepadPage = location.pathname === '/notepad';
  const isLoginPage = location.pathname === '/login';
  const isProfilePage = location.pathname === '/profile';
  const hideFooter = isDetailPage || isPurposePage || isNotepadPage || isLoginPage || isProfilePage;

  // Belt-and-suspenders scroll reset for direct URL loads / back-forward nav
  // where handlePhaseComplete didn't run. We do NOT kill ScrollTriggers here:
  // by the time this parent update effect fires, the new route's children
  // have already mounted and registered their own pins (MoodBoard) — killing
  // them would leave the page in a broken state.
  useLayoutEffect(() => {
    if (isBackNav.current) {
      // Restore saved scroll position after back navigation
      const y = savedScrollY.current ?? 0;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, y);
      requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = '';
      });
      savedScrollY.current = null;
      isBackNav.current = false;
    } else {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = '';
      });
    }
  }, [location.pathname]);

  // Intercept browser back button on detail pages to play exit animation
  useEffect(() => {
    if (!isDetailPage || isExiting) return;

    // Push a duplicate entry so popstate fires without leaving the page
    window.history.pushState(null, '', location.pathname);

    const handlePopState = () => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      isBackNav.current = true;
      setIsExiting(true);

      // Find the current project's overlay color for the transition
      const projectId = location.pathname.split('/purpose/')[1];
      const project = projects.find((p) => p.id === projectId);
      setTransitionColor(project?.overlayColor || FALLBACK_OVERLAY_COLOR);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDetailPage, isExiting, location.pathname, projects]);

  // When text exit completes, start SplitTransition and navigate back
  const handleExitComplete = useCallback(() => {
    setIsTransitioning(true);
    setTransitionPhase('expanding');
    setPendingNavigation('/');
    document.body.style.overflow = 'hidden';
    setIsExiting(false);
    exitingRef.current = false;
  }, []);

  const handleProjectClick = (project: Project) => {
    savedScrollY.current = window.scrollY;
    setTransitionColor(project.overlayColor);
    setIsTransitioning(true);
    setTransitionPhase('expanding');
    setPendingNavigation(`/purpose/${project.id}`);
    document.body.style.overflow = 'hidden';
  };

  const handlePhaseComplete = useCallback(() => {
    if (transitionPhase === 'expanding') {
      if (pendingNavigation) {
        // Reset scroll BEFORE the new route mounts so child layout effects
        // (e.g. MoodBoard's pinned ScrollTrigger) compute spacer positions
        // against scroll = 0 instead of the previous page's scroll position.
        ScrollTrigger.getAll().forEach((st) => st.kill());
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        // CSS `scroll-behavior: smooth` in index.css would otherwise animate
        // this scrollTo, leaving the next route mounted mid-scroll. Force
        // instant jump for the route-change reset.
        const restoreY = isBackNav.current ? (savedScrollY.current ?? 0) : 0;
        const prevBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, restoreY);
        document.documentElement.scrollTop = restoreY;
        document.body.scrollTop = restoreY;
        document.documentElement.style.scrollBehavior = prevBehavior;
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
      setTransitionPhase('revealing');
    } else if (transitionPhase === 'revealing') {
      setIsTransitioning(false);
      setTransitionPhase('idle');
      document.body.style.overflow = 'auto';
    }
  }, [transitionPhase, pendingNavigation, navigate]);

  return (
    <AuthProvider>
      <>
        <div className="relative min-h-screen" style={{ background: 'var(--plaster)', zIndex: 1 }}>
        <OrganicBackdrop />
        <div className="relative" style={{ zIndex: 1 }}>
          {!isNotepadPage && !isLoginPage && !isProfilePage && <Header darkText={isDetailPage} />}

          <Routes>
            <Route
              path="/"
              element={
                <main>
                  <WaterRipple
                    rippleColor="rgba(40, 35, 30, 0.12)"
                    rippleDuration={1800}
                    maxRipples={6}
                  >
                    <Hero />
                  </WaterRipple>
                  <PurposeGrid projects={projects} onProjectClick={handleProjectClick} />
                </main>
              }
            />
            <Route path="/notepad" element={<Notepad />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/purpose"
              element={
                <PurposeGallery projects={projects} onProjectClick={handleProjectClick} />
              }
            />
            <Route
              path="/purpose/:projectId"
              element={
                <PurposeDetailRoute
                  projects={projects}
                  exiting={isExiting}
                  onExitComplete={handleExitComplete}
                />
              }
            />
          </Routes>

          {!hideFooter && (
            <div className="h-[20vh] md:h-[25vh]" style={{ background: 'var(--plaster)' }} />
          )}
        </div>
      </div>

      {!hideFooter && <Footer />}

      <SplitTransition
        isActive={isTransitioning}
        overlayColor={transitionColor}
        phase={transitionPhase}
        onPhaseComplete={handlePhaseComplete}
      />

      <div className="grain-bg" aria-hidden="true" />

    </>
    </AuthProvider>
  );
}

/** Wrapper that resolves the project from the URL param */
function PurposeDetailRoute({
  projects,
  exiting,
  onExitComplete,
}: {
  projects: Project[];
  exiting: boolean;
  onExitComplete: () => void;
}) {
  const { projectId } = useParams();
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-mersi-dark/60">Project not found</p>
      </div>
    );
  }

  return (
    <PurposeDetail
      project={project}
      exiting={exiting}
      onExitComplete={onExitComplete}
    />
  );
}

export default App;
