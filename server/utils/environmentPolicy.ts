/**
 * Author: Cascade (OpenAI o4-preview)
 * Date: 2026-01-08
 * PURPOSE: Environment detection + BYOK policy helper utilities.
 *          Handles production enforcement, sentinel-based fallbacks, and provider key resolution.
 * SRP/DRY check: Pass - environment + BYOK policy logic only.
 */

import type { SnakeBenchRunMatchRequest } from '../../shared/types.js';

const TEST_API_KEY_SENTINEL = 'test';
type SnakeBenchProvider = NonNullable<SnakeBenchRunMatchRequest['provider']>;
const PROVIDER_ENV_VAR_MAP: Record<SnakeBenchProvider, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  xai: 'XAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
};
const DEFAULT_PROVIDER: SnakeBenchProvider = 'openrouter';

const normalizeApiKeyInput = (value: string | undefined): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const normalizeProvider = (provider?: string): SnakeBenchProvider => {
  if (!provider) return DEFAULT_PROVIDER;
  const normalized = provider.toLowerCase() as SnakeBenchProvider;
  if (normalized in PROVIDER_ENV_VAR_MAP) {
    return normalized;
  }
  return DEFAULT_PROVIDER;
};

/**
 * Check if the application is running in production mode.
 * Production is determined by NODE_ENV === 'production'.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if the application is running in development mode.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Check if user-provided API keys are required.
 * In production: User keys are MANDATORY for all paid providers.
 * In dev/staging: User keys are optional (server fallback allowed).
 */
export function requiresUserApiKey(): boolean {
  return isProduction();
}

/**
 * Validate that a user API key is present when required.
 * Returns an error message if validation fails, or null if valid.
 * 
 * @param apiKey - The user-provided API key (may be undefined/empty)
 * @param providerName - Human-readable provider name for error messages
 * @returns Error message string if validation fails, null if valid
 */
export function validateUserApiKey(
  apiKey: string | undefined,
  providerName: string
): string | null {
  // In dev/staging, always allow (server keys will be used as fallback)
  if (!requiresUserApiKey()) {
    return null;
  }

  // In production, user key is required
  if (!apiKey || apiKey.trim().length === 0) {
    return `Production requires your ${providerName} API key. Your key is used for this session only and is never stored.`;
  }

  return null;
}

/**
 * Helper to get the effective API key - user key in production, 
 * user key or server fallback in dev/staging.
 * 
 * @param userKey - User-provided API key
 * @param serverKey - Server environment variable key
 * @returns The effective key to use, or undefined if none available
 */
export function getEffectiveApiKey(
  userKey: string | undefined,
  serverKey: string | undefined
): string | undefined {
  // Always prefer user key if provided
  if (userKey && userKey.trim().length > 0) {
    return userKey;
  }

  // In dev/staging, allow server key fallback
  if (!requiresUserApiKey()) {
    return serverKey;
  }

  // In production with no user key, return undefined (will fail validation)
  return undefined;
}

/**
 * True if the provided key uses the "test" sentinel bypass.
 */
export function isTestBypassKey(apiKey: string | undefined): boolean {
  return normalizeApiKeyInput(apiKey).toLowerCase() === TEST_API_KEY_SENTINEL;
}

/**
 * Resolve the configured server API key for the given provider.
 */
export function getServerApiKeyForProvider(provider?: SnakeBenchProvider): string | undefined {
  const normalized = normalizeProvider(provider);
  const envVar = PROVIDER_ENV_VAR_MAP[normalized];
  return envVar ? process.env[envVar] : undefined;
}

export interface SnakeBenchApiKeyResolution {
  apiKey?: string;
  provider: SnakeBenchProvider;
  usedServerFallback: boolean;
  usedSentinel: boolean;
  error?: string;
}

/**
 * Resolve the effective API key for SnakeBench operations, supporting the "test" sentinel.
 */
export function resolveSnakeBenchApiKey(
  rawUserKey: string | undefined,
  provider?: SnakeBenchRunMatchRequest['provider'],
  options: { allowTestSentinel?: boolean } = {},
): SnakeBenchApiKeyResolution {
  const normalizedProvider = normalizeProvider(provider);
  const trimmed = normalizeApiKeyInput(rawUserKey);
  const allowTestSentinel = options.allowTestSentinel ?? false;
  const sentinelUsed = allowTestSentinel && isTestBypassKey(trimmed);
  const serverKey = getServerApiKeyForProvider(normalizedProvider);

  if (requiresUserApiKey()) {
    if (!trimmed && !sentinelUsed) {
      return {
        provider: normalizedProvider,
        usedSentinel: false,
        usedServerFallback: false,
        error: 'Production requires your API key. Your key is used for this session only and is never stored.',
      };
    }
    if (sentinelUsed && !serverKey) {
      return {
        provider: normalizedProvider,
        usedSentinel: true,
        usedServerFallback: false,
        error: 'Production fallback is unavailable because the server API key is not configured.',
      };
    }
  }

  if (trimmed && !sentinelUsed) {
    return {
      provider: normalizedProvider,
      apiKey: trimmed,
      usedSentinel: false,
      usedServerFallback: false,
    };
  }

  if (sentinelUsed) {
    return {
      provider: normalizedProvider,
      apiKey: serverKey,
      usedSentinel: true,
      usedServerFallback: true,
    };
  }

  const fallback = getEffectiveApiKey(undefined, serverKey);
  if (fallback) {
    return {
      provider: normalizedProvider,
      apiKey: fallback,
      usedSentinel: false,
      usedServerFallback: true,
    };
  }

  return {
    provider: normalizedProvider,
    usedSentinel: false,
    usedServerFallback: false,
    error: requiresUserApiKey()
      ? 'Production requires your API key. Your key is used for this session only and is never stored.'
      : undefined,
  };
}
