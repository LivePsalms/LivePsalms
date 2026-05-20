import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';

interface NextDevotionHandoffProps {
  currentProject: Project;
  nextProject: Project;
  nextDevotion: Devotion;
  variant?: 'desktop' | 'mobile';
}

/**
 * Final zone of each devotion's moodboard. Renders a 50/50 split-image
 * composition behind a hero-mask-clipped pill containing the next devotion's
 * meta. On click (Task 7), the pill expands to fullscreen and navigates to
 * the next devotion page.
 */
export function NextDevotionHandoff({
  currentProject: _currentProject,
  nextProject,
  nextDevotion,
  variant = 'desktop',
}: NextDevotionHandoffProps) {
  // currentProject is reserved for future use (e.g. analytics, ABT).
  // Underscore prefix silences the unused-arg lint.

  if (variant === 'mobile') {
    return <MobileLayout nextProject={nextProject} nextDevotion={nextDevotion} />;
  }
  return <DesktopLayout nextProject={nextProject} nextDevotion={nextDevotion} />;
}

interface LayoutProps {
  nextProject: Project;
  nextDevotion: Devotion;
}

function DesktopLayout({ nextProject, nextDevotion }: LayoutProps) {
  return (
    <section
      className="next-handoff relative flex-shrink-0 h-screen overflow-hidden"
      style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}
    >
      {/* Split background */}
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="next-handoff-img-left absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="next-handoff-img-right absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      {/* Vertical seam line */}
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />

      <Pill nextProject={nextProject} nextDevotion={nextDevotion} variant="desktop" />
    </section>
  );
}

function MobileLayout({ nextProject, nextDevotion }: LayoutProps) {
  return (
    <section
      className="next-handoff relative w-full overflow-hidden"
      style={{ minHeight: '100vh', backgroundColor: nextProject.overlayColor }}
    >
      {/* Two vertical columns */}
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            src={nextProject.thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="next-handoff-img-left absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="relative overflow-hidden">
          <img
            src={nextDevotion.firstMoodboardImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="next-handoff-img-right absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 left-1/2 w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        aria-hidden="true"
      />

      <Pill nextProject={nextProject} nextDevotion={nextDevotion} variant="mobile" />
    </section>
  );
}

interface PillProps extends LayoutProps {
  variant: 'desktop' | 'mobile';
}

function Pill({ nextProject, nextDevotion, variant }: PillProps) {
  const isMobile = variant === 'mobile';
  const pillStyle: React.CSSProperties = {
    backgroundColor: nextProject.overlayColor,
    clipPath: 'url(#hero-mask-clip)',
    width: isMobile ? '92%' : 'min(62vw, 920px)',
    aspectRatio: '11 / 3.2',
    boxShadow: '0 25px 50px -20px rgba(0,0,0,0.55)',
  };

  return (
    <div
      className="next-handoff-pill absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={pillStyle}
    >
      <div
        className="absolute inset-0 grid items-center text-white"
        style={{
          gridTemplateColumns: '1fr auto 1fr',
          padding: isMobile ? '0 14%' : '0 10%',
          fontFamily: '"Cormorant Garamond", Georgia, serif',
        }}
      >
        {/* Left column: label + title */}
        <div className="flex flex-col gap-1 text-left">
          <span
            className="next-handoff-label"
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Next Devotion
          </span>
          <span
            className="next-handoff-title"
            style={{
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: isMobile ? '12px' : '28px',
              lineHeight: 1,
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            {nextDevotion.title}
          </span>
        </div>

        {/* Center column: monogram */}
        <div
          className="next-handoff-monogram"
          style={{
            fontFamily: 'ui-sans-serif, system-ui',
            fontSize: isMobile ? '11px' : '22px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          {nextDevotion.monogram}
        </div>

        {/* Right column: category + scripture */}
        <div className="flex flex-col gap-1 text-right">
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {nextDevotion.label.replace(/^(The )?(Restoration of |Serenity of )/, '')}
          </span>
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: isMobile ? '6px' : '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            {nextDevotion.scriptureRef} <span aria-hidden="true">↗</span>
          </span>
        </div>
      </div>
    </div>
  );
}
