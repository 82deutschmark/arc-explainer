/**
 * Author: Cascade
 * Date: 2026-01-30
 * PURPOSE: Unit coverage for SnakeBench SQL helpers to lock slug normalization,
 *          clamping, date parsing, Elo math, and numeric guards used by repositories.
 * SRP/DRY check: Pass — focuses solely on pure helper behaviours.
 */

import { describe, expect, it } from 'vitest';

import {
  SQL_NORMALIZE_SLUG,
  calculateExpectedElo,
  clampLimit,
  clampOffset,
  normalizeSlug,
  parseSqlDate,
  safeNumeric,
} from '../../../server/repositories/snakebenchSqlHelpers.ts';

describe('snakebenchSqlHelpers', () => {
  describe('normalizeSlug', () => {
    it('collapses free/paid suffixes case-insensitively and trims', () => {
      expect(normalizeSlug('model-x:free')).toBe('model-x');
      expect(normalizeSlug('model-x:PAID')).toBe('model-x');
      expect(normalizeSlug(' model-x:free ')).toBe('model-x');
    });

    it('returns empty string for falsy input and leaves other suffixes', () => {
      expect(normalizeSlug('')).toBe('');
      expect(normalizeSlug('gpt-5:pro')).toBe('gpt-5:pro');
    });
  });

  describe('SQL_NORMALIZE_SLUG', () => {
    it('returns SQL fragment with provided column', () => {
      expect(SQL_NORMALIZE_SLUG('m.slug')).toBe("regexp_replace(m.slug, ':(free|paid)$', '', 'i')");
    });
  });

  describe('clampLimit', () => {
    it('caps values within range and defaults on invalid input', () => {
      expect(clampLimit(10)).toBe(10);
      expect(clampLimit(0)).toBe(1);
      expect(clampLimit(500)).toBe(200);
      expect(clampLimit('not-a-number')).toBe(20);
    });
  });

  describe('clampOffset', () => {
    it('floors values to zero or above and defaults on invalid input', () => {
      expect(clampOffset(15.7)).toBe(15);
      expect(clampOffset(-2)).toBe(0);
      expect(clampOffset('bad')).toBe(0);
    });
  });

  describe('parseSqlDate', () => {
    it('parses ISO strings and millisecond timestamps', () => {
      const iso = '2026-01-01T00:00:00.000Z';
      const ts = Date.parse(iso);
      expect(parseSqlDate(iso)?.toISOString()).toBe(iso);
      expect(parseSqlDate(ts)?.toISOString()).toBe(new Date(ts).toISOString());
    });

    it('returns null for falsy or invalid values', () => {
      expect(parseSqlDate('')).toBeNull();
      expect(parseSqlDate('not-a-date')).toBeNull();
      expect(parseSqlDate(NaN)).toBeNull();
    });
  });

  describe('calculateExpectedElo', () => {
    it('computes expected score and stays within 0..1', () => {
      const expected = calculateExpectedElo(1600, 1500);
      expect(expected).toBeGreaterThan(0);
      expect(expected).toBeLessThan(1);
      expect(expected).toBeCloseTo(0.640, 3);
    });

    it('is symmetric around equal ratings', () => {
      expect(calculateExpectedElo(1500, 1500)).toBeCloseTo(0.5);
      const forward = calculateExpectedElo(1800, 1200);
      const reverse = calculateExpectedElo(1200, 1800);
      expect(forward + reverse).toBeCloseTo(1);
    });
  });

  describe('safeNumeric', () => {
    it('returns numeric values or falls back to default', () => {
      expect(safeNumeric('42')).toBe(42);
      expect(safeNumeric(7.5)).toBe(7.5);
      expect(safeNumeric(undefined, 3)).toBe(3);
      expect(safeNumeric(Number.NaN, -1)).toBe(-1);
    });
  });
});
