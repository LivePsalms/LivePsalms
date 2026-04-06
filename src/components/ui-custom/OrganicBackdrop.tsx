// src/components/ui-custom/OrganicBackdrop.tsx
export function OrganicBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Wash 1: top of page, white mist (replaces Hero's old mist glow) */}
      <div
        style={{
          position: 'absolute',
          top: '85vh',
          left: '-10%',
          right: '-10%',
          height: '420px',
          background:
            'radial-gradient(ellipse 100% 50% at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 25%, rgba(255,253,250,0.45) 50%, rgba(248,244,239,0.12) 75%, transparent 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '90vh',
          left: '-20%',
          right: '-20%',
          height: '320px',
          background:
            'radial-gradient(ellipse 120% 35% at 50% 50%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.45) 40%, rgba(252,249,245,0.12) 70%, transparent 100%)',
        }}
      />

      {/* Wash 2: middle of page, warm sand glow */}
      <div
        style={{
          position: 'absolute',
          top: '180vh',
          left: '40%',
          width: '60vw',
          height: '60vw',
          maxWidth: '900px',
          maxHeight: '900px',
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(circle, rgba(188,179,163,0.10) 0%, rgba(188,179,163,0.05) 40%, transparent 70%)',
          borderRadius: '50%',
        }}
      />

      {/* Wash 3: lower page, warm white drift */}
      <div
        style={{
          position: 'absolute',
          top: '280vh',
          left: '-15%',
          width: '70vw',
          height: '50vw',
          maxWidth: '1100px',
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,255,255,0.18) 0%, rgba(245,240,232,0.08) 50%, transparent 80%)',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
