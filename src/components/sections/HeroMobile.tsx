import type { HeroProps } from './HeroDesktop';

/**
 * Mobile-specific Hero composition. Same 4 beats as desktop —
 * wordmark intro, scroll-collapse (shortened), static silhouette image,
 * quote sequence (cross-fade), bridge copy — rebuilt for one-thumb scroll.
 * Built out across Tasks 4-7. This is the shell only.
 */
export function HeroMobile({ introActive = false, onIntroComplete, onHandoff }: HeroProps) {
  // onIntroComplete and onHandoff are wired in Task 4. Until then they are intentionally
  // unused on the shell; the dispatcher test does not exercise them.
  void onIntroComplete;
  void onHandoff;
  return (
    <div data-testid="hero-mobile" data-intro-active={introActive ? 'true' : 'false'}>
      {/* Beats are wired in Tasks 4-7. */}
    </div>
  );
}
