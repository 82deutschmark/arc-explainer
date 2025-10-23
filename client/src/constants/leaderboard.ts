/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Frontend constants mirroring key thresholds from MetricsRepository/AccuracyRepository
 *          logic so UI components can render consistent status messaging.
 * SRP/DRY check: Pass — encapsulates leaderboard presentation constants in one module.
 */

export const LEADERBOARD_LIMITS = {
  TOP_MODELS: 5,
  TABLE_ROWS: 15,
} as const;

export const LEADERBOARD_THRESHOLDS = {
  SIGNIFICANT_ATTEMPTS: 100, // matches RANKING_CRITERIA.MIN_ATTEMPTS_FAILURE_ANALYSIS
  HIGH_ACCURACY: 70,
  MEDIUM_ACCURACY: 50,
  HIGH_TRUSTWORTHINESS: 0.8,
  MEDIUM_TRUSTWORTHINESS: 0.6,
  HIGH_RELIABILITY: 0.95,
  MEDIUM_RELIABILITY: 0.85,
  HIGH_CONFIDENCE_RATE: 70,
  OVERCONFIDENT_RATE: 50,
} as const;

export const formatPercentage = (value: number | undefined | null, precision = 1) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(precision)}%`;
};

export const formatRatioAsPercentage = (
  value: number | undefined | null,
  precision = 1
) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(precision)}%`;
};

export const formatCount = (value: number | undefined | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString();
};

