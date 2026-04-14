import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/sections/Hero';
import { ProjectsGrid } from '@/components/sections/ProjectsGrid';
import { PurposeGallery } from '@/components/sections/PurposeGallery';
import { ProjectDetail } from '@/components/sections/ProjectDetail';
import { WaterRipple } from '@/components/ui-custom/WaterRipple';
import { VideoIntro } from '@/components/ui-custom/VideoIntro';
import { OrganicBackdrop } from '@/components/ui-custom/OrganicBackdrop';
import { SplitTransition } from '@/components/ui-custom/SplitTransition';
import type { TransitionPhase } from '@/components/ui-custom/SplitTransition';
import { useProjectColors } from '@/hooks/useProjectColors';
import type { Project } from '@/types';
import './App.css';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const [transitionColor, setTransitionColor] = useState('#8B8378');
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showNav, setShowNav] = useState(false);
  const [savedScrollY, setSavedScrollY] = useState(0);

  const projects = useProjectColors();
  const isDetailPage = location.pathname.startsWith('/purpose/');
  const isPurposePage = location.pathname === '/purpose';
  const hideFooter = isDetailPage || isPurposePage;

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  const handleProjectClick = (project: Project) => {
    setSavedScrollY(window.scrollY);
    setTransitionColor(project.overlayColor);
    setIsTransitioning(true);
    setTransitionPhase('expanding');
    setPendingNavigation(`/purpose/${project.id}`);
    document.body.style.overflow = 'hidden';
  };

  const handlePhaseComplete = useCallback(() => {
    if (transitionPhase === 'expanding') {
      // Panels cover the screen — navigate now
      const isGoingHome = pendingNavigation === '/';
      if (pendingNavigation) {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
      // Scroll to saved position when going back, top when going to detail
      if (isGoingHome) {
        window.scrollTo(0, savedScrollY);
      } else {
        window.scrollTo(0, 0);
      }
      setTransitionPhase('revealing');
    } else if (transitionPhase === 'revealing') {
      setIsTransitioning(false);
      setTransitionPhase('idle');
      if (!isDetailPage) {
        document.body.style.overflow = 'auto';
      }
    }
  }, [transitionPhase, pendingNavigation, navigate, isDetailPage, savedScrollY]);

  const handleBackToProjects = () => {
    setIsTransitioning(true);
    setTransitionPhase('expanding');
    setPendingNavigation('/');
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
    setTimeout(() => {
      setShowNav(true);
    }, 1000);
  };

  useEffect(() => {
    setShowNav(false);
  }, []);

  return (
    <>
      {showIntro && <VideoIntro onComplete={handleIntroComplete} />}

      <div className="relative min-h-screen" style={{ background: 'var(--plaster)', zIndex: 1 }}>
        <OrganicBackdrop />
        <div className="relative" style={{ zIndex: 1 }}>
          <Header showNav={showNav} darkText={isDetailPage} />

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
                    <Hero showNav={showNav} />
                  </WaterRipple>
                  <ProjectsGrid projects={projects} onProjectClick={handleProjectClick} />
                </main>
              }
            />
            <Route
              path="/purpose"
              element={
                <PurposeGallery projects={projects} onProjectClick={handleProjectClick} />
              }
            />
            <Route
              path="/purpose/:projectId"
              element={
                <ProjectDetailRoute projects={projects} onBack={handleBackToProjects} />
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

      <svg
        className="absolute -top-[9999px] -left-[9999px] w-0 h-0 pointer-events-none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id="clip-pattern3" clipPathUnits="objectBoundingBox">
            <path d="M1 1H0.293592V0.868235H0V0.412941C0.0268256 0.241176 0.256754 0.0822454 0.500745 0C0.788326 0.098025 0.962742 0.26 0.99851 0.409412L1 1Z" />
          </clipPath>
          <clipPath id="clip-pattern5" clipPathUnits="objectBoundingBox">
            <path d="M0.00886287 0.313679C0.0269396 0.216981 0.172073 0 0.502947 0C0.798211 0 0.962906 0.196934 0.992581 0.318396C1.02374 0.511792 0.937683 0.525943 0.921363 0.625C0.921363 0.716981 1 0.746462 1 0.833726C0.988294 0.89801 0.974952 0.93728 0.949553 1H0.0504066C0.0237622 0.936348 0.00886178 0.908019 0.00292682 0.834906C-0.0104279 0.748821 0.0726626 0.735849 0.0771149 0.625C0.0696933 0.525943 -0.0297155 0.520047 0.00886287 0.313679Z" />
          </clipPath>
          <clipPath id="clip-pattern6" clipPathUnits="objectBoundingBox">
            <path d="M0 1H0.152466C0.185351 0.960002 0.327354 0.884713 0.505232 0.884713C0.683109 0.884713 0.818635 0.968237 0.849028 1H1V0.347104C0.985052 0.222406 0.838565 0.00477544 0.497758 6.98837e-05C0.156951 -0.00463567 0.0239163 0.229466 0 0.347104V1Z" />
          </clipPath>
        </defs>
      </svg>
    </>
  );
}

/** Wrapper that resolves the project from the URL param */
function ProjectDetailRoute({ projects, onBack }: { projects: Project[]; onBack: () => void }) {
  const { projectId } = useParams();
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-mersi-dark/60">Project not found</p>
      </div>
    );
  }

  return <ProjectDetail project={project} onBack={onBack} />;
}

export default App;
