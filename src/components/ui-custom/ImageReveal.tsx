import { useEffect, useRef, useState } from 'react';

interface ImageRevealProps {
  src: string;
  alt?: string;
  avgColor?: string;
  className?: string;
  threshold?: number;
  duration?: number;
  /** When provided, bypasses IntersectionObserver and controls reveal externally. */
  revealed?: boolean;
}

export function ImageReveal({
  src,
  alt = '',
  avgColor,
  className = '',
  threshold = 0.75,
  duration = 2600,
  revealed,
}: ImageRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const [computedAvgColor, setComputedAvgColor] = useState<string>(avgColor || '#888');
  const hasRevealedRef = useRef(false);
  const [focalPoint, setFocalPoint] = useState({ x: 50, y: 50 });

  const controlled = revealed !== undefined;

  useEffect(() => {
    setFocalPoint({
      x: 40 + Math.random() * 20,
      y: 40 + Math.random() * 20,
    });
  }, []);

  useEffect(() => {
    if (avgColor) {
      setComputedAvgColor(avgColor);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 1, 1);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        setComputedAvgColor(`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`);
      } catch {
        // cross-origin or tainted canvas — keep fallback
      }
    };
  }, [src, avgColor]);

  const animateReveal = () => {
    const img = imgRef.current;
    const veil = veilRef.current;
    if (!img || !veil || hasRevealedRef.current) return;
    hasRevealedRef.current = true;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      img.style.opacity = '1';
      img.style.filter = 'none';
      veil.style.background = 'transparent';
      return;
    }

    const startTime = performance.now();
    const D = duration;
    const fp = focalPoint;
    const color = computedAvgColor;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeExpoOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const easeSigmoid = (t: number) => {
      const x = t * 2 - 1;
      return (1 + x / Math.sqrt(1 + x * x)) / 2;
    };
    const easeSineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
    const easeVeil = (t: number) => {
      const x = t * 2 - 1;
      return 0.5 + x * (1 - Math.abs(x) * 0.5);
    };

    img.style.willChange = 'filter, opacity';
    veil.style.willChange = 'background';

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / D, 1);

      const opacity = easeOut(progress);
      const blur = 24 * (1 - easeExpoOut(progress));
      const saturate = 0.4 + 0.6 * easeSigmoid(progress);
      const contrast = 0.85 + 0.15 * progress;
      const brightnessProgress =
        elapsed >= 900 && elapsed <= 1700 ? easeSineInOut((elapsed - 900) / 800) : 0;
      const brightness = 1.0 + 0.04 * brightnessProgress;

      img.style.opacity = String(opacity);
      img.style.filter = `blur(${blur}px) saturate(${saturate}) contrast(${contrast}) brightness(${brightness})`;

      const veilSize = 180 * easeVeil(progress);
      veil.style.background = `radial-gradient(circle ${veilSize}% at ${fp.x}% ${fp.y}%, transparent 0%, ${color} 100%)`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        img.style.willChange = 'auto';
        veil.style.willChange = 'auto';
      }
    };

    requestAnimationFrame(animate);
  };

  // Controlled mode
  useEffect(() => {
    if (controlled && revealed) {
      animateReveal();
    }
  }, [controlled, revealed]);

  // IntersectionObserver mode
  useEffect(() => {
    if (controlled) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      animateReveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) animateReveal();
        });
      },
      { threshold },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [controlled, threshold]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: computedAvgColor, zIndex: 1 }}
      />

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="relative w-full h-full object-cover"
        style={{
          opacity: 0,
          filter: 'blur(24px) saturate(0.4) contrast(0.85)',
          zIndex: 2,
        }}
      />

      <div
        ref={veilRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle 0% at ${focalPoint.x}% ${focalPoint.y}%, transparent 0%, ${computedAvgColor} 100%)`,
          zIndex: 3,
        }}
      />
    </div>
  );
}
