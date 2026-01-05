/**
 * Author: Claude Sonnet 4.5
 * Date: 2026-01-04
 * PURPOSE: Vitest configuration specifically for frontend React component tests
 *          Uses jsdom environment for DOM testing
 * SRP/DRY check: Pass - Separate config for frontend-specific testing needs
 */

import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.frontend.ts'],
    include: ['tests/frontend/**/*.test.tsx', 'tests/frontend/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage-frontend',
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types.ts',
        '**/*.d.ts',
        'server/**' // Exclude backend from frontend coverage
      ],
      thresholds: {
        lines: 20,      // Start at 20%, target 50%
        functions: 20,
        branches: 20,
        statements: 20
      }
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  }
});
