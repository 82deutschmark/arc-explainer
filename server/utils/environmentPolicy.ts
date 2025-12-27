/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-25
 * PURPOSE: Environment detection utility for BYOK (Bring Your Own Key) enforcement.
 *          In production, users must provide their own API keys.
 *          In dev/staging, server keys from environment variables work as fallback.
 * SRP/DRY check: Pass - single responsibility for environment policy decisions.
 */

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
