/**
 * Author: Cascade (OpenAI o4-preview)
 * Date: 2026-01-08
 * PURPOSE: Unit tests covering BYOK helpers, including the "test" sentinel fallback for SnakeBench.
 *          Ensures production/dev environments handle user keys, server fallbacks, and sentinel logic correctly.
 * SRP/DRY check: Pass - focused solely on environmentPolicy utilities.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  isProduction,
  isTestBypassKey,
  resolveSnakeBenchApiKey,
} from '../../../server/utils/environmentPolicy';

describe('environmentPolicy BYOK helpers', () => {
  const originalEnv = { ...process.env };
  const setNodeEnv = (value?: string) => {
    if (value === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = value;
    }
  };

  beforeEach(() => {
    // Reset env to a clean copy before each test
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  afterEach(() => {
    // Restore NODE_ENV and provider keys after each test
    setNodeEnv(originalEnv.NODE_ENV);
    ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'XAI_API_KEY', 'GEMINI_API_KEY'].forEach((key) => {
      if (originalEnv[key]) {
        process.env[key] = originalEnv[key] as string;
      } else {
        delete process.env[key];
      }
    });
  });

  it('detects production mode correctly', () => {
    setNodeEnv('production');
    expect(isProduction()).toBe(true);
    setNodeEnv('development');
    expect(isProduction()).toBe(false);
  });

  it('identifies the sentinel "test" api key (case-insensitive)', () => {
    expect(isTestBypassKey('test')).toBe(true);
    expect(isTestBypassKey(' TEST ')).toBe(true);
    expect(isTestBypassKey('prod-key')).toBe(false);
  });

  it('allows sentinel fallback in production when server key is configured', () => {
    setNodeEnv('production');
    process.env.OPENROUTER_API_KEY = 'server-secret';

    const result = resolveSnakeBenchApiKey('test', 'openrouter', { allowTestSentinel: true });

    expect(result.error).toBeUndefined();
    expect(result.apiKey).toBe('server-secret');
    expect(result.usedSentinel).toBe(true);
    expect(result.usedServerFallback).toBe(true);
  });

  it('rejects sentinel fallback in production when server key is missing', () => {
    setNodeEnv('production');
    delete process.env.OPENROUTER_API_KEY;

    const result = resolveSnakeBenchApiKey('test', 'openrouter', { allowTestSentinel: true });

    expect(result.error).toMatch(/fallback is unavailable/i);
    expect(result.apiKey).toBeUndefined();
  });

  it('rejects empty user key in production when sentinel disabled', () => {
    setNodeEnv('production');
    delete process.env.OPENROUTER_API_KEY;

    const result = resolveSnakeBenchApiKey('', 'openrouter');

    expect(result.error).toMatch(/production requires your api key/i);
    expect(result.apiKey).toBeUndefined();
  });

  it('falls back to server key in development without user input', () => {
    setNodeEnv('development');
    process.env.OPENROUTER_API_KEY = 'dev-server-key';

    const result = resolveSnakeBenchApiKey(undefined, 'openrouter');

    expect(result.apiKey).toBe('dev-server-key');
    expect(result.usedServerFallback).toBe(true);
    expect(result.usedSentinel).toBe(false);
    expect(result.error).toBeUndefined();
  });
});
