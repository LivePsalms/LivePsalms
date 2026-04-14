import { useState, useCallback } from 'react';
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
import { FALLBACK_OVERLAY_COLOR } from '@/data/projects';
import type { Project } from '@/types';
import './App.css';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const [transitionColor, setTransitionColor] = useState(FALLBACK_OVERLAY_COLOR);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showNav, setShowNav] = useState(false);
  const projects = useProjectColors();
  const isDetailPage = location.pathname.startsWith('/purpose/');
  const isPurposePage = location.pathname === '/purpose';
  const hideFooter = isDetailPage || isPurposePage;

  const handleProjectClick = (project: Project) => {
    setTransitionColor(project.overlayColor);
    setIsTransitioning(true);
    setTransitionPhase('expanding');
    setPendingNavigation(`/purpose/${project.id}`);
    document.body.style.overflow = 'hidden';
  };

  const handlePhaseComplete = useCallback(() => {
    if (transitionPhase === 'expanding') {
      if (pendingNavigation) {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
      // Reset scroll while overlay covers the page
      document.body.style.overflow = 'auto';
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.style.overflow = 'hidden';
      setTransitionPhase('revealing');
    } else if (transitionPhase === 'revealing') {
      setIsTransitioning(false);
      setTransitionPhase('idle');
      document.body.style.overflow = 'auto';
    }
  }, [transitionPhase, pendingNavigation, navigate]);

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
