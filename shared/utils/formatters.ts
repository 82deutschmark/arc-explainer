/**
 * Author: Cascade
 * Date: 2025-12-29
 * PURPOSE: Shared formatting utilities for numbers, currency, and model-specific labels.
 *          Centralizes logic used by both server and client for consistent display.
 * SRP/DRY check: Pass - pure formatting functions only.
 */

/**
 * Format a numeric value as a localized integer string.
 * Returns 'N/A' for non-finite or non-numeric values.
 *
 * @param value - Value to format (any type, safely handles non-numbers)
 * @returns Formatted integer string or 'N/A'
 */
export function formatInt(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  return Math.round(value).toLocaleString();
}

/**
 * Format a numeric value as USD currency string.
 * Returns 'N/A' for non-finite or non-numeric values.
 *
 * @param value - Value to format (any type, safely handles non-numbers)
 * @returns Formatted USD string (e.g., '$0.001234') or 'N/A'
 */
export function formatUsd(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  return `$${value.toFixed(6)}`;
}

/**
 * Format a percentage value (0-1 range) as a display string.
 * Returns 'N/A' for non-finite or non-numeric values.
 *
 * @param value - Value between 0 and 1
 * @param decimals - Number of decimal places (default 1)
 * @returns Formatted percentage string (e.g., '75.0%') or 'N/A'
 */
export function formatPercent(value: unknown, decimals = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format an optional number with fixed precision and a fallback.
 * 
 * @param value - Numeric value or null
 * @param digits - Precision digits
 * @param fallback - Fallback string (default '-')
 */
export function formatOptionalNumber(value: number | null | undefined, digits: number, fallback = '-'): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value.toFixed(digits);
}

/**
 * Convert snake death reason values into human-readable labels.
 * 
 * @param reason - Raw snake death reason string (e.g. 'body_collision')
 */
export function formatReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'unknown';
  return reason.replace(/_/g, ' ').trim();
}
