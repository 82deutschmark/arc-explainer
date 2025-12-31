/**
 * Author: Cascade (original), Claude Sonnet 4.5 (formatCostSmart, formatUsdLocale additions)
 * Date: 2025-12-30
 * PURPOSE: Shared formatting utilities for numbers, currency, and model-specific labels.
 *          Centralizes logic used by both server and client for consistent display.
 *          Added specialized formatters: smart unit conversion and locale-aware currency.
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

/**
 * Format cost with smart unit conversion (millicents/cents/dollars).
 * Used for displaying very small costs in readable units.
 *
 * @param value - Cost value in dollars
 * @returns Formatted string with appropriate unit (e.g., "2.50 m", "5.00 c", "$1.2345")
 *
 * @example
 * formatCostSmart(0.00025) // "0.25 m" (millicents)
 * formatCostSmart(0.05)    // "5.00 c" (cents)
 * formatCostSmart(1.2345)  // "$1.2345"
 * formatCostSmart(0)       // "Free"
 * formatCostSmart(null)    // "N/A"
 */
export function formatCostSmart(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (value === 0) return 'Free';

  if (value < 0.01) {
    return `${(value * 1000).toFixed(2)} m`; // millicents
  }
  if (value < 1) {
    return `${(value * 100).toFixed(2)} c`; // cents
  }
  return `$${value.toFixed(4)}`;
}

/**
 * Format USD amount using locale-aware Intl.NumberFormat.
 * Useful for displaying prices in international contexts.
 *
 * @param value - Numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Locale-formatted currency string or 'N/A'
 *
 * @example
 * formatUsdLocale(1234.56)    // "$1,234.56" (en-US locale)
 * formatUsdLocale(0.5, 4)     // "$0.5000"
 * formatUsdLocale(null)       // "N/A"
 */
export function formatUsdLocale(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null) return 'N/A';
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
