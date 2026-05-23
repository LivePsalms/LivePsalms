import { useCallback, useMemo, useState } from 'react';
import { Routes, Route, useLocation, useParams } from 'react-router-dom';
import { decideHeroIntro, persistIntroPlayed } from '@/components/sections/hero-intro-gate';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/sections/Hero';
import { HeroLoadingOverlay } from '@/components/sections/HeroLoadingOverlay';
import { MidSectionMotion } from '@/components/sections/MidSectionMotion';
import { TwoPathInterlude } from '@/components/sections/TwoPathInterlude';
import { PurposeGrid } from '@/components/sections/PurposeGrid';
import { FinalReflectionCta } from '@/components/sections/FinalReflectionCta';
import { PurposeStack } from '@/components/sections/PurposeStack';
import { PurposeDetail } from '@/components/sections/PurposeDetail';
import { Notepad } from '@/components/sections/Notepad';
import { NotepadLanding } from '@/notepad-landing';
import { CommunityComingSoon } from '@/components/sections/CommunityComingSoon';
import { Contact } from '@/components/sections/Contact';
import { WaterRipple } from '@/components/ui-custom/WaterRipple';
import { SplitTransition } from '@/components/ui-custom/SplitTransition';
import type { TransitionPhase } from '@/components/ui-custom/SplitTransition';
import { useLoadingOverlay } from '@/hooks/useLoadingOverlay';
import { useProjectColors } from '@/hooks/useProjectColors';
import type { Project } from '@/types';
import { AuthProvider } from '@/auth/context/AuthProvider';
import { LoginPage } from '@/auth/LoginPage';
import { ProfilePage } from '@/auth/ProfilePage';
import { WelcomePage } from '@/auth/WelcomePage';
import { useRouteTransition } from '@/transitions/useRouteTransition';
import './App.css';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

function App() {
  const location = useLocation();
  const projects = useProjectColors();
  // Single-shot computation of all the intro-related decisions at first mount.
  // useMemo with [] deps keeps it stable across re-renders and avoids
  // re-reading window state on every render.
  const initialDecision = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        homeIntroPlays: false,
        prefersReducedMotion: false,
      };
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const decision = decideHeroIntro({
      storage: window.sessionStorage,
      prefersReducedMotion,
    });
    if (decision.persistFlag) {
      persistIntroPlayed(window.sessionStorage);
    }
    const isInitiallyOnHome = window.location.pathname === '/';
    return {
      homeIntroPlays: isInitiallyOnHome && decision.playIntro,
      prefersReducedMotion,
    };
  }, []);

  const [introActive, setIntroActive] = useState<boolean>(initialDecision.homeIntroPlays);
  // Header is hidden during the home intro and fades in at the handoff beat
  // via showNav. On any path where the home intro doesn't play (session-skip
  // OR initial route is not /), the header starts visible — the loading
  // overlay sits above it during navigation.
  const [headerVisible, setHeaderVisible] = useState<boolean>(() => !initialDecision.homeIntroPlays);

  // Loading overlay starts inactive. Activation is driven exclusively by
  // handleNavTrigger from Header click sources (see below). Reduced-motion
  // suppression lives inside that wrapper.
  const overlay = useLoadingOverlay({
    minMs: 1500,
    initialActive: false,
  });

  const handleNavTrigger = useCallback(() => {
    if (initialDecision.prefersReducedMotion) return;
    overlay.trigger();
  }, [overlay, initialDecision.prefersReducedMotion]);

  const handleIntroComplete = useCallback(() => {
    setIntroActive(false);
    if (typeof window !== 'undefined') {
      persistIntroPlayed(window.sessionStorage);
    }
  }, []);
  const handleIntroHandoff = useCallback(() => {
    setHeaderVisible(true);
  }, []);

  const { status, color, transition } = useRouteTransition(projects);

  const isDetailPage = location.pathname.startsWith('/purpose/');
  const isPurposePage = location.pathname === '/purpose';
  const isNotepadLanding = location.pathname === '/notepad';
  const isNotepadEditor = location.pathname.startsWith('/notepad/notes');
  const isNotepadAny = isNotepadLanding || isNotepadEditor;
  const isLoginPage = location.pathname === '/login';
  const isProfilePage = location.pathname === '/profile';
  const isWelcomePage = location.pathname === '/welcome';
  const isCommunityPage = location.pathname === '/community';
  const isContactPage = location.pathname === '/contact';
  const hideFooter = isDetailPage || isPurposePage || isNotepadAny || isLoginPage || isProfilePage || isWelcomePage || isCommunityPage || isContactPage;

  const handleProjectClick = useCallback(
    (project: Project) => transition.beginNavigation(`/purpose/${project.id}`, project.overlayColor),
    [transition],
  );

  const handleExitComplete = useCallback(() => transition.completeExit('/'), [transition]);

  // Map the four-state status onto SplitTransition's three-state phase prop.
  // `exiting` is the text-fade pre-overlay phase, during which the overlay is hidden.
  const splitActive = status === 'expanding' || status === 'revealing';
  const splitPhase: TransitionPhase = splitActive ? status : 'idle';

  return (
    <AuthProvider>
      <>
        <div className="relative min-h-screen" style={{ background: 'var(--app-bg)', zIndex: 1 }}>
        <div className="relative" style={{ zIndex: 1 }}>
          {!isNotepadEditor && !isLoginPage && !isProfilePage && !isWelcomePage && <Header darkText={isDetailPage || isPurposePage} showNav={headerVisible} onNavTrigger={handleNavTrigger} />}

          <Routes>
            <Route
              path="/"
              element={
                <main>
                  <WaterRipple
                    rippleColor="rgba(40, 35, 30, 0.12)"
                    rippleDuration={1800}
                    maxRipples={6}
                    disabled={introActive}
                  >
                    <Hero introActive={introActive} onIntroComplete={handleIntroComplete} onHandoff={handleIntroHandoff} />
                  </WaterRipple>
                  <MidSectionMotion />
                  <TwoPathInterlude />
                  <PurposeGrid projects={projects} onProjectClick={handleProjectClick} />
                </main>
              }
            />
            <Route path="/notepad" element={<NotepadLanding />} />
            <Route path="/notepad/notes" element={<Notepad />} />
            <Route path="/community" element={<CommunityComingSoon />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/purpose"
              element={<PurposeStack projects={projects} />}
            />
            <Route
              path="/purpose/:projectId"
              element={
                <PurposeDetailRoute
                  projects={projects}
                  exiting={status === 'exiting'}
                  onExitComplete={handleExitComplete}
                />
              }
            />
          </Routes>

          {!hideFooter && <FinalReflectionCta />}
        </div>
      </div>

      {!hideFooter && <Footer />}

      <SplitTransition
        isActive={splitActive}
        overlayColor={color}
        phase={splitPhase}
        onPhaseComplete={transition.completePhase}
      />

      <div className="grain-bg" aria-hidden="true" />

      <HeroLoadingOverlay active={overlay.active} />
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
      key={project.id}
      project={project}
      exiting={exiting}
      onExitComplete={onExitComplete}
    />
  );
}

export default App;
