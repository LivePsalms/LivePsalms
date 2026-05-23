import './styles/landing.css';
import { usePrefersReducedMotion } from './hooks/use-prefers-reduced-motion';
import { useAdaptiveNavTheme } from './hooks/use-adaptive-nav-theme';
import { ParticleHero } from './sections/01-particle-hero';
import { ThreeVoices } from './sections/02-three-voices';
import { LivingGraph } from './sections/03-living-graph';
import { Lamplight } from './sections/04-lamplight';
import { ScriptureMargin } from './sections/05-scripture-margin';
import { SevenPapers } from './sections/06-seven-papers';
import { TierPath } from './sections/07-tier-path';
import { TrustImport } from './sections/08-trust-import';
import { ClosingCTA } from './sections/09-closing-cta';

// Section selectors paired with their background lightness so the global nav
// can adapt as the user scrolls. Scoped under .notepad-landing to avoid
// matching same-named classes on other routes.
const NAV_THEME_SECTIONS = [
  { selector: '.notepad-landing .hero', theme: 'dark' },
  { selector: '.notepad-landing .three-voices', theme: 'light' },
  { selector: '.notepad-landing .living-graph', theme: 'light' },
  { selector: '.notepad-landing .lamplight', theme: 'light' },
  { selector: '.notepad-landing .scripture-margin', theme: 'light' },
  { selector: '.notepad-landing .seven-papers', theme: 'light' },
  { selector: '.notepad-landing .tier-path', theme: 'light' },
  { selector: '.notepad-landing .trust-import', theme: 'light' },
  { selector: '.notepad-landing .closing-cta', theme: 'dark' },
] as const;

export function NotepadLanding() {
  const prm = usePrefersReducedMotion();
  useAdaptiveNavTheme(NAV_THEME_SECTIONS);
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
