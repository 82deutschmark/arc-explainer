/**
 * Author: Claude Sonnet 4.5
 * Date: 2026-01-04
 * PURPOSE: Vitest configuration for unit and integration tests
 *          Provides fast test execution with TypeScript support and coverage reporting
 * SRP/DRY check: Pass - Single configuration file for all test types
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/e2e/**',
      'tests/**/*.spec.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/types.ts',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts',
        'playwright.config.ts'
      ],
      // Start with conservative thresholds, ratchet up as we add tests
      thresholds: {
        lines: 20,      // Start at 20%, target 60%
        functions: 20,  // Start at 20%, target 60%
        branches: 20,   // Start at 20%, target 60%
        statements: 20  // Start at 20%, target 60%
      }
    },
    // Timeout for async tests (important for database operations)
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  }
});
