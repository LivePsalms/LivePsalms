import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Hero } from '@/components/sections/Hero';
import { ProjectsGrid } from '@/components/sections/ProjectsGrid';
import { ProjectDetail } from '@/components/sections/ProjectDetail';
import { WaterRipple } from '@/components/ui-custom/WaterRipple';
import { VideoIntro } from '@/components/ui-custom/VideoIntro';
import { OrganicBackdrop } from '@/components/ui-custom/OrganicBackdrop';
import type { Project } from '@/types';
import './App.css';

function App() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showNav, setShowNav] = useState(false);

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    document.body.style.overflow = 'hidden';
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    document.body.style.overflow = 'auto';
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
    // Wait 1 second after video ends, then fade in the nav
    setTimeout(() => {
      setShowNav(true);
    }, 1000);
  };

  // Reset showNav when component mounts (page load/reload)
  useEffect(() => {
    setShowNav(false);
  }, []);

  return (
    <>
      {/* Video Intro - plays on every page load */}
      {showIntro && <VideoIntro onComplete={handleIntroComplete} />}
      
      <div className="relative min-h-screen" style={{ background: 'var(--plaster)' }}>
        <OrganicBackdrop />
        <div className="relative" style={{ zIndex: 1 }}>
          <Header showNav={showNav} />

          {selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              onBack={handleBackToProjects}
            />
          ) : (
            <main>
              <WaterRipple
                rippleColor="rgba(40, 35, 30, 0.12)"
                rippleDuration={1800}
                maxRipples={6}
              >
                <Hero showNav={showNav} />
              </WaterRipple>
              <ProjectsGrid onProjectClick={handleProjectClick} />
            </main>
          )}
        </div>
      </div>

      {/* Global film-grain overlay */}
      <div className="grain-bg" aria-hidden="true" />

      {/* Global SVG defs — category image mask clip paths used by ProjectCard */}
      <svg
        className="absolute -top-[9999px] -left-[9999px] w-0 h-0 pointer-events-none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Restoration (residential) */}
          <clipPath id="clip-pattern3" clipPathUnits="objectBoundingBox">
            <path d="M1 1H0.293592V0.868235H0V0.412941C0.0268256 0.241176 0.256754 0.0822454 0.500745 0C0.788326 0.098025 0.962742 0.26 0.99851 0.409412L1 1Z" />
          </clipPath>
          {/* Renewal (retail) */}
          <clipPath id="clip-pattern5" clipPathUnits="objectBoundingBox">
            <path d="M0.00886287 0.313679C0.0269396 0.216981 0.172073 0 0.502947 0C0.798211 0 0.962906 0.196934 0.992581 0.318396C1.02374 0.511792 0.937683 0.525943 0.921363 0.625C0.921363 0.716981 1 0.746462 1 0.833726C0.988294 0.89801 0.974952 0.93728 0.949553 1H0.0504066C0.0237622 0.936348 0.00886178 0.908019 0.00292682 0.834906C-0.0104279 0.748821 0.0726626 0.735849 0.0771149 0.625C0.0696933 0.525943 -0.0297155 0.520047 0.00886287 0.313679Z" />
          </clipPath>
          {/* Serenity (hospitality) */}
          <clipPath id="clip-pattern6" clipPathUnits="objectBoundingBox">
            <path d="M0 1H0.152466C0.185351 0.960002 0.327354 0.884713 0.505232 0.884713C0.683109 0.884713 0.818635 0.968237 0.849028 1H1V0.347104C0.985052 0.222406 0.838565 0.00477544 0.497758 6.98837e-05C0.156951 -0.00463567 0.0239163 0.229466 0 0.347104V1Z" />
          </clipPath>
        </defs>
      </svg>
    </>
  );
}

export default App;
