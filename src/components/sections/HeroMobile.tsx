import type { HeroProps } from './HeroDesktop';

/**
 * Mobile-specific Hero composition. Same 4 beats as desktop —
 * wordmark intro, scroll-collapse (shortened), static silhouette image,
 * quote sequence (cross-fade), bridge copy — rebuilt for one-thumb scroll.
 * Built out across Tasks 4-7. This is the shell only.
 *
 * `onIntroComplete` and `onHandoff` are wired in Task 4; renamed with a
 * leading underscore so the no-unused-vars rule allows the placeholder.
 */
export function HeroMobile({
  introActive = false,
  onIntroComplete: _onIntroComplete,
  onHandoff: _onHandoff,
}: HeroProps) {
  return (
    <div data-testid="hero-mobile" data-intro-active={introActive ? 'true' : 'false'}>
      {/* Beats are wired in Tasks 4-7. */}
    </div>
  );
}
