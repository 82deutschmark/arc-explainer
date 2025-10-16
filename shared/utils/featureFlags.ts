/**
 * Feature Flag Utilities
 *
 * Author: gpt-5-codex
 * Date: 2025-02-17T00:00:00Z
 * PURPOSE: Provide consistent helpers for interpreting environment-driven feature flags across server and client runtimes.
 * SRP/DRY check: Pass — single-purpose module for flag normalization reused by server and client streaming checks.
 */

const TRUTHY_FLAG_VALUES = new Set([
  'true',
  '1',
  'yes',
  'y',
  'on',
  'enable',
  'enabled'
]);

/**
 * Normalizes a string-based feature flag to a boolean.
 * Treats common truthy forms (case-insensitive) as enabled and everything else as disabled.
 */
export function isFeatureFlagEnabled(rawValue: string | undefined | null): boolean {
  if (typeof rawValue !== 'string') {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return TRUTHY_FLAG_VALUES.has(normalized);
}

export const featureFlagConstants = {
  TRUTHY_FLAG_VALUES
};
