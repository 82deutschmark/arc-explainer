/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-25
 * PURPOSE: Client-side environment detection for BYOK (Bring Your Own Key) enforcement.
 *          Mirrors server/utils/environmentPolicy.ts logic for frontend use.
 * SRP/DRY check: Pass - single responsibility for client-side environment checks.
 */

/**
 * Check if the application is running in production mode.
 * Uses Vite's import.meta.env.MODE which is 'production' in prod builds.
 */
export function isProduction(): boolean {
  return import.meta.env.MODE === 'production';
}

/**
 * Check if the application is running in development mode.
 */
export function isDevelopment(): boolean {
  return import.meta.env.MODE === 'development' || import.meta.env.DEV === true;
}

/**
 * Check if user-provided API keys are required.
 * In production: User keys are MANDATORY for all paid providers.
 * In dev/staging: User keys are optional (server fallback allowed).
 */
export function requiresUserApiKey(): boolean {
  return isProduction();
}
