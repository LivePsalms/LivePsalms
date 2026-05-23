import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { ParticleHero } from './sections/01-particle-hero';
import { ThreeVoices } from './sections/02-three-voices';
import { LivingGraph } from './sections/03-living-graph';

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
      <ThreeVoices prm={prm} />
      <LivingGraph prm={prm} />
    </div>
  );
}
