// src/notepad-landing/sections/garden-scene/stations/02-living-graph.tsx
import { useEffect, useRef } from 'react';
import { copy } from '../../../data/copy';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

interface Props { isActive: boolean }

export function StationLivingGraph({ isActive }: Props) {
  const { eyebrow, h2, body, supporting, caption } = copy.section03;
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
      id="section-03"
      className={`garden-station garden-station--living-graph${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair">
        <div className="garden-station-content garden-station-content--left">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
          <p className="caption">{caption}</p>
        </div>
        <div className="living-graph-video-wrap">
          <video
            ref={videoRef}
            className="living-graph-video"
            poster="/notepad-feature-video-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="The Notepad Living Graph in motion — nodes representing scriptures and notes connect as the user navigates them."
          >
            <source src="/notepad-feature-video.webm" type="video/webm" />
            <source src="/notepad-feature-video.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
