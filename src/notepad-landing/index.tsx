import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { ParticleHero } from './sections/01-particle-hero';
import { ThreeVoices } from './sections/02-three-voices';
import { LivingGraph } from './sections/03-living-graph';
import { Lamplight } from './sections/04-lamplight';
import { ScriptureMargin } from './sections/05-scripture-margin';

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
      <ThreeVoices prm={prm} />
      <LivingGraph prm={prm} />
      <Lamplight prm={prm} />
      <ScriptureMargin prm={prm} />
    </div>
  );
}
