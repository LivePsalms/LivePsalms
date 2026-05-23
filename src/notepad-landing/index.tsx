import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { ParticleHero } from './sections/01-particle-hero';
import { ThreeVoices } from './sections/02-three-voices';

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
      <ThreeVoices prm={prm} />
    </div>
  );
}
