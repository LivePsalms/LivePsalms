import { useEffect, useRef, useState } from 'react';

const generateNoiseTexture = (): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
      </filter>
      <rect width="200" height="200" filter="url(#noise)" opacity="1"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const noiseURI = generateNoiseTexture();

interface PhotoDevelopImageProps {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  threshold?: number;
  /** When provided, bypasses IntersectionObserver and controls reveal externally. */
  revealed?: boolean;
  style?: React.CSSProperties;
}

export function PhotoDevelopImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  threshold = 0.3,
  revealed,
  style,
}: PhotoDevelopImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const controlled = revealed !== undefined;

  useEffect(() => {
    if (controlled) {
      if (revealed && !hasAnimated) {
        setIsVisible(true);
        setHasAnimated(true);
      }
      return;
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setIsVisible(true);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setIsVisible(true);
            setHasAnimated(true);
          }
        });
      },
      { threshold, rootMargin: '0px' },
    );

    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [hasAnimated, threshold, controlled, revealed]);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const done = prefersReduced || hasAnimated;
  const active = isVisible && !prefersReduced;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ willChange: active && !hasAnimated ? 'opacity' : 'auto', ...style }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`w-full h-full object-cover ${imgClassName}`}
        style={{
          filter: done ? 'grayscale(0) contrast(1)' : isVisible ? 'grayscale(0) contrast(1)' : 'grayscale(1) contrast(1.1)',
          opacity: done ? 1 : isVisible ? 1 : 0.15,
          transition: active
            ? 'filter 2.2s cubic-bezier(0.19, 1, 0.22, 1), opacity 2.2s cubic-bezier(0.19, 1, 0.22, 1)'
            : 'none',
        }}
      />

      {/* Grain layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${noiseURI})`,
          backgroundSize: '200px 200px',
          backgroundRepeat: 'repeat',
          mixBlendMode: 'multiply',
          opacity: done ? 0.12 : isVisible ? 0.12 : 1,
          transition: active ? 'opacity 2.2s cubic-bezier(0.4, 0, 0.6, 1)' : 'none',
          willChange: active && !hasAnimated ? 'opacity' : 'auto',
        }}
      />

      {/* Warm tint layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: 'rgba(120, 85, 55, 1)',
          mixBlendMode: 'soft-light',
          opacity: done ? 0 : isVisible ? 0 : 0.3,
          transition: active ? 'opacity 2.2s cubic-bezier(0.7, 0, 0.84, 0)' : 'none',
          willChange: active && !hasAnimated ? 'opacity' : 'auto',
        }}
      />
    </div>
  );
}
