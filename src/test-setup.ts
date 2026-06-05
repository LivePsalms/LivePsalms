/// <reference types="@testing-library/jest-dom" />
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Only extend matchers in jsdom environment
if (typeof window !== 'undefined') {
  expect.extend(matchers);

  // jsdom does not implement HTMLMediaElement play/pause. Stub them so
  // tests that mount <video>/<audio> elements don't spam stderr with
  // "Not implemented" warnings. Tests that need to assert play/pause
  // behavior can still vi.spyOn() these prototype methods.
  if (typeof HTMLMediaElement !== 'undefined') {
    HTMLMediaElement.prototype.play = function play() {
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      /* no-op */
    };
  }
}
