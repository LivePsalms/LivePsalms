import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Only extend matchers in jsdom environment
if (typeof window !== 'undefined') {
  expect.extend(matchers);
}
