/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27
 * PURPOSE: Shared SQL helpers, constants, and utility functions for SnakeBench repositories.
 *          Provides centralized logic for slug normalization, date parsing, rating math,
 *          and common WHERE fragments to ensure consistency across split repository modules.
 * SRP/DRY check: Pass - centralizes common SnakeBench logic.
 */

import { logger } from '../utils/logger.ts';

// --- Constants ---

export const DEFAULT_TRUESKILL_MU = 25.0;
export const DEFAULT_TRUESKILL_SIGMA = DEFAULT_TRUESKILL_MU / 3.0;
export const DEFAULT_TRUESKILL_BETA = DEFAULT_TRUESKILL_MU / 6.0;
export const DEFAULT_TRUESKILL_TAU = 0.5;
export const DEFAULT_TRUESKILL_DRAW_PROBABILITY = 0.1;
export const TRUESKILL_DISPLAY_MULTIPLIER = 50.0;

export const ELO_K = 32;

export const RESULT_RANK: Record<string, number> = { won: 0, tied: 1, lost: 2 };
export const RESULT_SCORE: Record<string, [number, number]> = {
  won: [1, 0],
  lost: [0, 1],
  tied: [0.5, 0.5],
};

// --- Helpers ---

/**
 * Normalizes a model slug by removing the ':free' suffix.
 * This ensures that paid and free versions of the same model are treated as one for analytics.
 */
export const normalizeSlug = (slug: string): string => {
  if (!slug) return '';
  return slug.replace(/:free$/, '');
};

/**
 * SQL fragment for slug normalization to be used in PostgreSQL queries.
 */
export const SQL_NORMALIZE_SLUG = (col: string) => `regexp_replace(${col}, ':free$', '')`;

/**
 * SQL expression for TrueSkill exposed rating calculation.
 * Formula: COALESCE(trueskill_exposed, trueskill_mu - 3 * trueskill_sigma)
 *
 * This represents the conservative skill estimate where we subtract 3 standard deviations
 * from the mean to account for uncertainty. The exposed rating is pre-calculated when available.
 *
 * @param prefix - Table alias prefix (e.g., 'm' for 'm.trueskill_mu')
 */
export const SQL_TRUESKILL_EXPOSED = (prefix: string = 'm'): string =>
  `COALESCE(${prefix}.trueskill_exposed, ${prefix}.trueskill_mu - 3 * ${prefix}.trueskill_sigma)`;

/**
 * Clamps a limit value to a safe range.
 */
export const clampLimit = (limit: any, defaultVal: number = 20, maxVal: number = 200): number => {
  const n = Number(limit);
  return Number.isFinite(n) ? Math.max(1, Math.min(Math.floor(n), maxVal)) : defaultVal;
};

/**
 * Clamps an offset value to a safe range.
 */
export const clampOffset = (offset: any): number => {
  const n = Number(offset);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
};

/**
 * Parses a date string or timestamp into a Date object or null.
 */
export const parseSqlDate = (value: any): Date | null => {
  if (!value) return null;
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (!trimmed) return null;

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    const d = new Date(asNumber);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const d = new Date(trimmed);
  return Number.isFinite(d.getTime()) ? d : null;
};

/**
 * Elo expected score calculation.
 */
export const calculateExpectedElo = (ratingA: number, ratingB: number): number => {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
};

/**
 * Numeric guard for score/cost.
 */
export const safeNumeric = (val: any, fallback: number = 0): number => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Shared error logger for repositories.
 */
export const logRepoError = (method: string, error: unknown, context: string = 'snakebench-db'): void => {
  const message = error instanceof Error ? error.message : String(error);
  logger.warn(`SnakeBench.${method}: ${message}`, context);
};
