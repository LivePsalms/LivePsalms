import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Hero } from '@/components/sections/Hero';
import { PinnedImageSection } from '@/components/sections/PinnedImageSection';
import { GalleryStrip } from '@/components/sections/GalleryStrip';
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
        <WaterRipple
          rippleColor="rgba(40, 35, 30, 0.12)"
          rippleDuration={1800}
          maxRipples={6}
          className="min-h-screen"
        >
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
                <Hero />
                <PinnedImageSection />
                <GalleryStrip />
                <ProjectsGrid onProjectClick={handleProjectClick} />
              </main>
            )}
          </div>
        </WaterRipple>
      </div>
    </>
  );
}

export default App;
