// src/notepad-landing/sections/garden-scene/stations/05-seven-papers.tsx
import { useEffect, useRef } from 'react';
import { copy } from '../../../data/copy';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

interface Props { isActive: boolean }

export function StationSevenPapers({ isActive }: Props) {
  const { eyebrow, h2, body } = copy.section06;
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (prefersReducedMotion) {
      v.pause();
      return;
    }
    if (isActive) {
      void v.play().catch(() => { /* iOS may reject; poster stays visible */ });
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive, prefersReducedMotion]);

  return (
    <article
      id="section-06"
      className={`garden-station garden-station--seven-papers${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair">
        <div className="garden-station-content garden-station-content--left">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="body">{body}</p>
        </div>
        <div className="seven-papers-video-wrap">
          <video
            ref={videoRef}
            className="seven-papers-video"
            poster="/notepad-landing/templates-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="A cinematic drift through the seven paper styles available in the Notepad — Linen, Vellum, Margin, Dotted Crème, Ruled Walnut, Communion, and Folio."
          >
            <source src="/notepad-landing/templates.webm" type="video/webm" />
            <source src="/notepad-landing/templates.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
