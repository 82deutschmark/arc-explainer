/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Validate streaming config defaults and explicit overrides for production
 *          behavior shared between backend and frontend.
 * SRP/DRY check: Pass - Scoped to resolveStreamingConfig behavior only.
 */

import { describe, it, expect } from 'vitest';
import { resolveStreamingConfig } from '../shared/config/streaming.ts';

describe('resolveStreamingConfig', () => {
  it('keeps streaming enabled by default in production', () => {
    const previousEnv = {
      streamingEnabled: process.env.STREAMING_ENABLED,
      legacyBackend: process.env.ENABLE_SSE_STREAMING,
      frontend: process.env.VITE_STREAMING_ENABLED,
      legacyFrontend: process.env.VITE_ENABLE_SSE_STREAMING,
      nodeEnv: process.env.NODE_ENV,
    };

    try {
      delete process.env.STREAMING_ENABLED;
      delete process.env.ENABLE_SSE_STREAMING;
      delete process.env.VITE_STREAMING_ENABLED;
      delete process.env.VITE_ENABLE_SSE_STREAMING;
      process.env.NODE_ENV = 'production';

      const config = resolveStreamingConfig();

      expect(config.enabled).toBe(true);
      expect(config.backendSource).toBeUndefined();
      expect(config.frontendSource).toBeUndefined();
      expect(config.defaultValue).toBe(true);
    } finally {
      process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
      process.env.ENABLE_SSE_STREAMING = previousEnv.legacyBackend;
      process.env.VITE_STREAMING_ENABLED = previousEnv.frontend;
      process.env.VITE_ENABLE_SSE_STREAMING = previousEnv.legacyFrontend;
      process.env.NODE_ENV = previousEnv.nodeEnv;
    }
  });

  it('honors explicit false overrides', () => {
    const previousEnv = {
      streamingEnabled: process.env.STREAMING_ENABLED,
      nodeEnv: process.env.NODE_ENV,
    };

    try {
      process.env.STREAMING_ENABLED = 'false';
      process.env.NODE_ENV = 'production';

      const config = resolveStreamingConfig();

      expect(config.enabled).toBe(false);
      expect(config.backendSource?.key).toBe('STREAMING_ENABLED');
      expect(config.backendSource?.value).toBe(false);
    } finally {
      process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
      process.env.NODE_ENV = previousEnv.nodeEnv;
    }
  });
});
