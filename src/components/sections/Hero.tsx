import { useRef } from 'react';

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-visible"
    >
      {/* Background PSALMS Logo - Large Outline Style */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden px-4">
        <img
          src="/logo-hero.png"
          alt="PSALMS"
          className="w-[95vw] md:w-[80vw] max-w-4xl object-contain"
          style={{
            opacity: 0.12,
            filter: 'invert(1)',
          }}
        />
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2" style={{ zIndex: 2 }}>
        <div
          className="w-10 md:w-12 h-1 rounded-full"
          style={{ background: 'var(--warm-sand)', opacity: 0.4 }}
        ></div>
      </div>

    </section>
  );
}
