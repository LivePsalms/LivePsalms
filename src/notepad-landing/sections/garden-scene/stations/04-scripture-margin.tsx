// src/notepad-landing/sections/garden-scene/stations/04-scripture-margin.tsx
import { useEffect, useRef } from 'react';
import { copy } from '../../../data/copy';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

interface Props { isActive: boolean }

export function StationScriptureMargin({ isActive }: Props) {
  const { eyebrow, h2, body, supporting } = copy.section05;
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
      id="section-05"
      className={`garden-station garden-station--scripture-margin${isActive ? ' active' : ''}`}
      aria-hidden={isActive ? undefined : 'true'}
    >
      <div className="garden-station-pair">
        <div className="garden-station-content garden-station-content--left">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{h2}</h2>
          <p className="body">{body}</p>
          <p className="supporting">{supporting}</p>
        </div>
        <div className="scripture-margin-video-wrap">
          <video
            ref={videoRef}
            className="scripture-margin-video"
            poster="/notepad-bible-study-video-poster.jpg"
            preload="metadata"
            muted
            loop
            playsInline
            aria-label="Personal Bible study inside the Notepad — opening a passage, searching to a verse, and asking about it with your own notes in hand."
          >
            <source src="/notepad-bible-study-video.webm" type="video/webm" />
            <source src="/notepad-bible-study-video.mp4"  type="video/mp4"  />
          </video>
        </div>
      </div>
    </article>
  );
}
