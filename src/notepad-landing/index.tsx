import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { ParticleHero } from './sections/01-particle-hero';
import { ThreeVoices } from './sections/02-three-voices';
import { LivingGraph } from './sections/03-living-graph';
import { Lamplight } from './sections/04-lamplight';
import { ScriptureMargin } from './sections/05-scripture-margin';
import { SevenPapers } from './sections/06-seven-papers';
import { TierPath } from './sections/07-tier-path';
import { TrustImport } from './sections/08-trust-import';
import { ClosingCTA } from './sections/09-closing-cta';

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  return (
    <div className="notepad-landing">
      <ParticleHero prm={prm} />
      <ThreeVoices prm={prm} />
      <LivingGraph prm={prm} />
      <Lamplight prm={prm} />
      <ScriptureMargin prm={prm} />
      <SevenPapers prm={prm} />
      <TierPath />
      <TrustImport />
      <ClosingCTA prm={prm} />
    </div>
  );
}
