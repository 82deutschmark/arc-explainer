/**
 * Author: GPT-6 / Codex; Claude Sonnet 4.5
 * Date: 2026-10-29
 * PURPOSE: Setup file for frontend tests with React Testing Library
 *          Configures Vitest's typed DOM matchers and cleanup behavior.
 * SRP/DRY check: Pass - Centralized test setup for all frontend tests
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test automatically
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia (commonly needed for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Mock IntersectionObserver (needed for lazy-loading components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;
