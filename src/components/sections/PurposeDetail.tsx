import { useLayoutEffect, useRef } from 'react';
import type { Project } from '@/types';
import { MoodBoard } from '@/components/sections/MoodBoard';
import { LineMaskReveal } from '@/components/ui-custom/LineMaskReveal';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import { ImageReveal } from '@/components/ui-custom/ImageReveal';
import { useDetailReveal } from '@/transitions/useDetailReveal';
import { DETAIL_REVEAL_TIMELINE } from '@/transitions/purpose-detail-reveal';

// TODO(handoff): devotion-specific strings below (label, title, scripture)
// are duplicated in src/data/devotions.ts. A future refactor should make
// this component consume that data instead.

interface PurposeDetailProps {
  project: Project;
  exiting?: boolean;
  onExitComplete?: () => void;
}


export function PurposeDetail({ project, exiting, onExitComplete }: PurposeDetailProps) {
  const isRestoration1 = project.id === 'restoration1';
  const isRestoration3 = project.id === 'restoration3';
  const isStrength = project.id === 'strength';
  const isWholeness = project.id === 'wholeness';
  const isPurpose = project.id === 'purpose';
  const isConnection = project.id === 'connection';
  const isIdentity = project.id === 'identity';
  const isJoy = project.id === 'joy';
  const isForgiveness = project.id === 'forgiveness';
  const isSurrender = project.id === 'surrender';
  const isTrust = project.id === 'trust';
  const isDevotion =
    isRestoration1 ||
    isRestoration3 ||
    isStrength ||
    isWholeness ||
    isPurpose ||
    isConnection ||
    isIdentity ||
    isJoy ||
    isForgiveness ||
    isSurrender ||
    isTrust;
  const sectionRef = useRef<HTMLDivElement>(null);

  const { isVisible, textReady, contentRef: heroContentRef, imageRef: heroImageRef } =
    useDetailReveal({ project, exiting: !!exiting, onExitComplete });

  // Scroll reset before paint stays here — useLayoutEffect timing is the point.
  useLayoutEffect(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = '';
    });
  }, [project]);

  return (
    <section
      ref={sectionRef}
      className="min-h-screen"
      style={{ backgroundColor: project.overlayColor }}
    >

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen overflow-hidden">
        {/* Left Content */}
        <div ref={heroContentRef} className="relative flex flex-col justify-start px-6 lg:px-16 pt-24 lg:pt-28 pb-32 lg:pb-20 order-2 lg:order-1">
          {isDevotion ? (
            <>
              {/* Label */}
              <LineMaskReveal
                className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10"
                duration={1400}
                stagger={120}
                threshold={0.1}
                enabled={textReady}
              >
                <span>
                  {isRestoration1
                    ? 'Restoration of Peace'
                    : isRestoration3
                    ? 'The Restoration of Hope'
                    : isStrength
                    ? 'The Restoration of Strength'
                    : isWholeness
                    ? 'The Restoration of Wholeness'
                    : isPurpose
                    ? 'The Restoration of Purpose'
                    : isConnection
                    ? 'The Restoration of Connection'
                    : isIdentity
                    ? 'The Restoration of Identity'
                    : isJoy
                    ? 'The Restoration of Joy'
                    : isForgiveness
                    ? 'The Serenity of Forgiveness'
                    : isSurrender
                    ? 'The Serenity of Surrender'
                    : 'The Serenity of Trust'}
                </span>
              </LineMaskReveal>

              {/* Title */}
              <div
                className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12 overflow-hidden"
              >
                <h1
                  style={{
                    fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)',
                    lineHeight: 0.95,
                    paddingBottom:
                      isStrength ||
                      isWholeness ||
                      isPurpose ||
                      isConnection ||
                      isIdentity ||
                      isJoy ||
                      isForgiveness ||
                      isSurrender ||
                      isTrust
                        ? '0.22em'
                        : undefined,
                    transform: textReady ? 'translateY(0)' : 'translateY(110%)',
                    transition: `transform 1.6s ${DETAIL_REVEAL_TIMELINE.easing}`,
                  }}
                >
                  {isRestoration1
                    ? 'Beside Still Waters'
                    : isRestoration3
                    ? 'A Future You Cannot See Yet'
                    : isStrength
                    ? 'Wings Like Eagles'
                    : isWholeness
                    ? 'The Years Restored'
                    : isPurpose
                    ? 'All Things Working'
                    : isConnection
                    ? 'Brought Near'
                    : isIdentity
                    ? 'The New Has Come'
                    : isJoy
                    ? 'Mouths Filled with Laughter'
                    : isForgiveness
                    ? 'Let It Fall From Your Hands'
                    : isSurrender
                    ? 'Be Still and Know'
                    : 'The Path He Makes Straight'}
                </h1>
              </div>

              {/* Scripture quote */}
              <div className="mb-20">
                <LineMaskReveal
                  className="font-['Cormorant_Garamond'] italic text-2xl md:text-3xl text-white/60 leading-snug"
                  duration={1500}
                  stagger={100}
                  threshold={0.1}
                  enabled={textReady}
                >
                  {isRestoration1 ? (
                    <>
                      <p>&ldquo;He makes me lie down in green pastures,</p>
                      <p>he leads me beside quiet waters,</p>
                      <p>he refreshes my soul.&rdquo;</p>
                    </>
                  ) : isRestoration3 ? (
                    <>
                      <p>&ldquo;For I know the plans I have for you,&rdquo;</p>
                      <p>declares the Lord, &ldquo;plans to prosper you</p>
                      <p>and not to harm you, plans to give you</p>
                      <p>hope and a future.&rdquo;</p>
                    </>
                  ) : isStrength ? (
                    <>
                      <p>&ldquo;But those who hope in the Lord</p>
                      <p>will renew their strength.</p>
                      <p>They will soar on wings like eagles;</p>
                      <p>they will run and not grow weary,</p>
                      <p>they will walk and not be faint.&rdquo;</p>
                    </>
                  ) : isWholeness ? (
                    <>
                      <p>&ldquo;I will repay you for the years</p>
                      <p>the locusts have eaten&hellip;</p>
                      <p>You will have plenty to eat,</p>
                      <p>until you are full, and you will</p>
                      <p>praise the name of the Lord.&rdquo;</p>
                    </>
                  ) : isPurpose ? (
                    <>
                      <p>&ldquo;And we know that in all things</p>
                      <p>God works for the good of those</p>
                      <p>who love him, who have been called</p>
                      <p>according to his purpose.&rdquo;</p>
                    </>
                  ) : isConnection ? (
                    <>
                      <p>&ldquo;But now in Christ Jesus</p>
                      <p>you who once were far away</p>
                      <p>have been brought near</p>
                      <p>by the blood of Christ.&rdquo;</p>
                    </>
                  ) : isIdentity ? (
                    <>
                      <p>&ldquo;Therefore, if anyone is in Christ,</p>
                      <p>the new creation has come:</p>
                      <p>The old has gone,</p>
                      <p>the new is here!&rdquo;</p>
                    </>
                  ) : isJoy ? (
                    <>
                      <p>&ldquo;When the Lord restored</p>
                      <p>the fortunes of Zion,</p>
                      <p>we were like those who dreamed.</p>
                      <p>Our mouths were filled with laughter,</p>
                      <p>our tongues with songs of joy.&rdquo;</p>
                    </>
                  ) : isForgiveness ? (
                    <>
                      <p>&ldquo;Be kind and compassionate</p>
                      <p>to one another,</p>
                      <p>forgiving each other,</p>
                      <p>just as in Christ</p>
                      <p>God forgave you.&rdquo;</p>
                    </>
                  ) : isSurrender ? (
                    <>
                      <p>&ldquo;Be still, and know</p>
                      <p>that I am God;</p>
                      <p>I will be exalted</p>
                      <p>among the nations,</p>
                      <p>I will be exalted in the earth.&rdquo;</p>
                    </>
                  ) : (
                    <>
                      <p>&ldquo;Trust in the Lord</p>
                      <p>with all your heart</p>
                      <p>and lean not on</p>
                      <p>your own understanding;</p>
                      <p>he will make your paths straight.&rdquo;</p>
                    </>
                  )}
                </LineMaskReveal>
                <p
                  className="mt-3 not-italic text-xs tracking-[0.25em] uppercase text-white/40"
                  style={{
                    opacity: textReady ? 1 : 0,
                    transition: `opacity 1.2s ${DETAIL_REVEAL_TIMELINE.easing} 0.6s`,
                  }}
                >
                  {isRestoration1 ? (
                    <>Psalm 23:2&ndash;3</>
                  ) : isRestoration3 ? (
                    'Jeremiah 29:11'
                  ) : isStrength ? (
                    'Isaiah 40:31'
                  ) : isWholeness ? (
                    <>Joel 2:25&ndash;26</>
                  ) : isPurpose ? (
                    'Romans 8:28'
                  ) : isConnection ? (
                    'Ephesians 2:13'
                  ) : isIdentity ? (
                    '2 Corinthians 5:17'
                  ) : isJoy ? (
                    <>Psalm 126:1&ndash;2</>
                  ) : isForgiveness ? (
                    <>Ephesians 4:31&ndash;32</>
                  ) : isSurrender ? (
                    'Psalm 46:10'
                  ) : (
                    <>Proverbs 3:5&ndash;6</>
                  )}
                </p>
              </div>

              {/* Down arrow + Journey */}
              <div
                className="self-end flex items-center gap-3 text-white/50 mt-auto"
                style={{
                  opacity: textReady ? 1 : 0,
                  transition: `opacity 1.4s ${DETAIL_REVEAL_TIMELINE.easing} 1s`,
                }}
              >
                <svg
                  className="w-4 h-4 journey-arrow"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M8 1v12M3 9l5 5 5-5" />
                </svg>
                <span className="text-xs tracking-[0.2em] uppercase">Journey</span>
              </div>
            </>
          ) : (
            <>
              {/* Location & Year */}
              {(project.location || project.year) && (
                <LineMaskReveal
                  className="flex items-center gap-8 mb-8 text-sm text-mersi-dark/70"
                  duration={1400}
                  stagger={120}
                  threshold={0.1}
                  enabled={textReady}
                >
                  <span>
                    {[project.location, project.year].filter(Boolean).join(' — ')}
                  </span>
                </LineMaskReveal>
              )}

              {/* Description */}
              {project.description && (
                <LineMaskReveal
                  className="text-lg md:text-xl text-mersi-dark/80 max-w-md mb-12 leading-relaxed"
                  duration={1500}
                  stagger={130}
                  threshold={0.1}
                  enabled={textReady}
                >
                  <p>{project.description}</p>
                </LineMaskReveal>
              )}

              {/* Project Title */}
              <LineMaskReveal
                className="text-6xl md:text-7xl lg:text-8xl font-bold text-mersi-dark tracking-tight"
                duration={1600}
                stagger={140}
                threshold={0.1}
                enabled={textReady}
              >
                <h1>{project.name}</h1>
              </LineMaskReveal>
            </>
          )}
        </div>

        {/* Right Image — meditative radial reveal */}
        <div ref={heroImageRef} className="relative h-[50vh] lg:h-screen order-1 lg:order-2 overflow-hidden">
          <ImageReveal
            src={project.thumbnail}
            alt={project.name}
            avgColor={project.overlayColor}
            className="w-full h-full"
            revealed={isVisible}
            duration={2600}
          />
        </div>
      </div>

      {/* Services Section */}
      {project.services && project.services.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 lg:px-16 py-20">
          {/* Left - Sticky Image */}
          <div className="relative h-[60vh] lg:h-[80vh] lg:sticky lg:top-20">
            <PhotoDevelopImage
              src={project.images[1] || project.thumbnail}
              alt={`${project.name} interior`}
              className="w-full h-full"
            />
          </div>

          {/* Right - Services List */}
          <div className="flex flex-col justify-center py-10">
            <LineMaskReveal
              className="text-2xl md:text-3xl font-semibold text-mersi-dark mb-12"
              duration={1000}
              stagger={90}
            >
              <h2>{project.description}</h2>
            </LineMaskReveal>

            <div className="space-y-0">
              {project.services.map((service, index) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between py-4 border-t border-mersi-dark/20 group cursor-pointer hover:bg-mersi-dark/5 transition-colors duration-300 px-2 -mx-2"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-2 h-2 rounded-full bg-mersi-dark/30 group-hover:bg-mersi-dark transition-colors duration-300" />
                    <span className="text-base md:text-lg text-mersi-dark">
                      {service.name}
                    </span>
                  </div>
                  <span className="text-sm text-mersi-dark/50">
                    {service.number}
                  </span>
                </div>
              ))}
            </div>

            {/* Area Display */}
            {project.area && (
              <LineMaskReveal
                className="mt-16 text-7xl md:text-8xl lg:text-9xl font-bold text-mersi-dark tracking-tighter"
                duration={1100}
                stagger={100}
              >
                <span>
                  {project.area}
                  <span className="text-3xl md:text-4xl align-top ml-2">m²</span>
                </span>
              </LineMaskReveal>
            )}
          </div>
        </div>
      )}

      {/* Image Gallery */}
      {project.images.length > 2 && (
        <div className="px-6 lg:px-16 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {project.images.slice(2).map((image, index) => (
              <PhotoDevelopImage
                key={index}
                src={image}
                alt={`${project.name} view ${index + 3}`}
                className="aspect-[4/3]"
                imgClassName="hover:scale-105 transition-transform duration-700"
                threshold={0.2}
              />
            ))}
          </div>
        </div>
      )}

      <MoodBoard project={project} />
    </section>
  );
}
