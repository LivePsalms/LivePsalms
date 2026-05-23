// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StationLivingGraph } from './02-living-graph';

type Listener = (event: { matches: boolean }) => void;
function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const mql = {
    get matches() { return matches; },
    addEventListener: (_e: 'change', l: Listener) => { listeners.add(l); },
    removeEventListener: (_e: 'change', l: Listener) => { listeners.delete(l); },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return { fire: (n: boolean) => { matches = n; listeners.forEach((l) => l({ matches: n })); } };
}

describe('<StationLivingGraph /> playback', () => {
  const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
  const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {});

  beforeEach(() => {
    installMatchMedia(false);
    playSpy.mockClear();
    pauseSpy.mockClear();
  });
  afterEach(() => cleanup());

  it('does not play on mount when isActive=false', () => {
    render(<StationLivingGraph isActive={false} />);
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays when isActive=true on mount', () => {
    render(<StationLivingGraph isActive={true} />);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('pauses and resets currentTime to 0 when isActive transitions to false', () => {
    const { rerender } = render(<StationLivingGraph isActive={true} />);
    expect(playSpy).toHaveBeenCalledTimes(1);
    rerender(<StationLivingGraph isActive={false} />);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    const video = document.querySelector<HTMLVideoElement>('.living-graph-video');
    expect(video?.currentTime).toBe(0);
  });
});
