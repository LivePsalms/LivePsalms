import { describe, it, expect, vi, afterEach } from 'vitest';
import { setOnboardingSink, emitOnboardingEvent } from './onboarding-events';

afterEach(() => setOnboardingSink(null));

describe('onboarding event sink', () => {
  it('routes emitted events to the registered sink', () => {
    const sink = vi.fn();
    setOnboardingSink(sink);
    emitOnboardingEvent('note-created');
    emitOnboardingEvent('folder-created');
    expect(sink).toHaveBeenCalledWith('note-created');
    expect(sink).toHaveBeenCalledWith('folder-created');
  });
  it('never throws when no sink is registered', () => {
    setOnboardingSink(null);
    expect(() => emitOnboardingEvent('search-used')).not.toThrow();
  });
  it('stops delivering events after the sink is set to null', () => {
    const sink = vi.fn();
    setOnboardingSink(sink);
    setOnboardingSink(null);
    emitOnboardingEvent('note-created');
    expect(sink).not.toHaveBeenCalled();
  });
});
