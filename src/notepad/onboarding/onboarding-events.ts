// src/notepad/onboarding/onboarding-events.ts
//
// Decoupled event sink so React-free domain classes (NoteCollection,
// FolderHierarchy) and TipTap extensions can emit onboarding progress events
// without importing the provider. The provider registers itself on mount via
// setOnboardingSink and unregisters on unmount.
import type { OnboardingEvent } from './onboarding-types';

type Sink = (e: OnboardingEvent) => void;

let sink: Sink | null = null;

/** The provider registers itself here on mount; classes/components emit through it. */
export function setOnboardingSink(fn: Sink | null): void {
  sink = fn;
}

/** Emit an onboarding event to the registered sink. Never throws into callers. */
export function emitOnboardingEvent(e: OnboardingEvent): void {
  try {
    sink?.(e);
  } catch (err) {
    // Never break callers; surface a dev-only warning so a throwing sink isn't
    // fully invisible during development.
    if (import.meta.env?.DEV) console.warn('[onboarding-events] sink threw:', err);
  }
}
