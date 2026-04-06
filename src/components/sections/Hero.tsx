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

      {/* Mist Glow — full-bleed seamless transition into next section */}
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: 0,
          right: 0,
          height: '300px',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {/* Wide ambient wash */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            bottom: '-120px',
            left: '-10%',
            right: '-10%',
            background:
              'radial-gradient(ellipse 100% 50% at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 25%, rgba(255,253,250,0.45) 50%, rgba(248,244,239,0.12) 75%, transparent 100%)',
          }}
        />
        {/* Soft horizontal band for full-bleed stretch */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            bottom: '-60px',
            left: '-20%',
            right: '-20%',
            background:
              'radial-gradient(ellipse 120% 35% at 50% 50%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.45) 40%, rgba(252,249,245,0.12) 70%, transparent 100%)',
          }}
        />
      </div>
    </section>
  );
}
