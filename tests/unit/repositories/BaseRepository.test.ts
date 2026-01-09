/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Verify BaseRepository delegates to CommonUtilities for JSON handling,
 *          confidence normalization, hints processing, and grid sanitization.
 * SRP/DRY check: Pass - Focused tests for BaseRepository behavior only.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseRepository } from '../../../server/repositories/base/BaseRepository.js';

// Create a concrete test class extending BaseRepository
class TestRepository extends BaseRepository {
  async testQuery(sql: string, params?: any[]) {
    return this.query(sql, params);
  }

  async testTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    return this.transaction(callback);
  }

  testSafeJsonParse<T>(value: any, fieldName?: string, fallback: T | null = null): T | null {
    return this.safeJsonParse<T>(value, fieldName, fallback);
  }

  testSafeJsonStringify(value: any): string | null {
    return this.safeJsonStringify(value);
  }

  testNormalizeConfidence(confidence: any): number {
    return this.normalizeConfidence(confidence);
  }

  testProcessHints(hints: any): string[] {
    return this.processHints(hints);
  }

  testSanitizeGridData(gridData: any): number[][] | null {
    return this.sanitizeGridData(gridData);
  }

  testSanitizeMultipleGrids(multiGridData: any): number[][][] | null {
    return this.sanitizeMultipleGrids(multiGridData);
  }
}

describe('BaseRepository', () => {
  let repo: TestRepository;

  beforeEach(() => {
    repo = new TestRepository();
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON string', () => {
      const json = '{"key": "value", "number": 42}';
      const result = repo.testSafeJsonParse(json);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should parse valid JSON object (already parsed)', () => {
      const obj = { key: 'value', number: 42 };
      const result = repo.testSafeJsonParse(obj);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should return fallback for invalid JSON string', () => {
      const invalid = 'invalid{json}string';
      const fallback = { default: true };
      const result = repo.testSafeJsonParse(invalid, 'testField', fallback);

      expect(result).toEqual(fallback);
    });

    it('should return fallback for null value', () => {
      const fallback = { default: true };
      const result = repo.testSafeJsonParse(null, 'testField', fallback);

      expect(result).toEqual(fallback);
    });

    it('should return fallback for undefined value', () => {
      const fallback = { default: true };
      const result = repo.testSafeJsonParse(undefined, 'testField', fallback);

      expect(result).toEqual(fallback);
    });

    it('should handle empty string', () => {
      const result = repo.testSafeJsonParse('', 'testField', null);
      expect(result).toBeNull();
    });

    it('should handle complex nested JSON', () => {
      const complex = {
        user: {
          name: 'Test',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        items: [1, 2, 3]
      };

      const result = repo.testSafeJsonParse(JSON.stringify(complex));
      expect(result).toEqual(complex);
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify valid object', () => {
      const obj = { key: 'value', number: 42 };
      const result = repo.testSafeJsonStringify(obj);

      expect(result).toBe('{"key":"value","number":42}');
    });

    it('should stringify array', () => {
      const arr = [1, 2, 3];
      const result = repo.testSafeJsonStringify(arr);

      expect(result).toBe('[1,2,3]');
    });

    it('should return null for circular reference', () => {
      const obj: any = { key: 'value' };
      obj.self = obj; // Create circular reference

      const result = repo.testSafeJsonStringify(obj);
      expect(result).toBeNull();
    });

    it('should handle null input', () => {
      const result = repo.testSafeJsonStringify(null);
      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      const result = repo.testSafeJsonStringify(undefined);
      expect(result).toBeNull();
    });
  });

  describe('normalizeConfidence', () => {
    it('should normalize numeric fractions to percent (0-100)', () => {
      expect(repo.testNormalizeConfidence(0.5)).toBe(50);
      expect(repo.testNormalizeConfidence(0)).toBe(0);
      expect(repo.testNormalizeConfidence(1)).toBe(100);
    });

    it('should parse string numbers and normalize to percent', () => {
      expect(repo.testNormalizeConfidence('0.75')).toBe(75);
      expect(repo.testNormalizeConfidence('0')).toBe(0);
      expect(repo.testNormalizeConfidence('1')).toBe(100);
    });

    it('should clamp values outside 0-100 range', () => {
      expect(repo.testNormalizeConfidence(150)).toBe(100);
      expect(repo.testNormalizeConfidence(-5)).toBe(0);
      expect(repo.testNormalizeConfidence(1000)).toBe(100);
    });

    it('should return default for invalid values', () => {
      expect(repo.testNormalizeConfidence(null)).toBe(50);
      expect(repo.testNormalizeConfidence(undefined)).toBe(50);
      expect(repo.testNormalizeConfidence('invalid')).toBe(50);
      expect(repo.testNormalizeConfidence({})).toBe(50);
    });
  });

  describe('processHints', () => {
    it('should return array as-is when valid', () => {
      const hints = ['Hint 1', 'Hint 2', 'Hint 3'];
      expect(repo.testProcessHints(hints)).toEqual(hints);
    });

    it('should parse JSON string array', () => {
      const hints = '["Hint 1", "Hint 2"]';
      expect(repo.testProcessHints(hints)).toEqual(['Hint 1', 'Hint 2']);
    });

    it('should coerce non-string values to strings and drop empty entries', () => {
      const hints = ['Hint 1', 123, 'Hint 2', null, 'Hint 3'];
      expect(repo.testProcessHints(hints)).toEqual(['Hint 1', '123', 'Hint 2', 'Hint 3']);
    });

    it('should return empty array for null', () => {
      expect(repo.testProcessHints(null)).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(repo.testProcessHints(undefined)).toEqual([]);
    });

    it('should treat invalid JSON strings as a single hint', () => {
      expect(repo.testProcessHints('invalid{json')).toEqual(['invalid{json']);
    });

    it('should stringify non-array values into hints', () => {
      expect(repo.testProcessHints({ key: 'value' })).toEqual(['{"key":"value"}']);
      expect(repo.testProcessHints('string')).toEqual(['string']);
      expect(repo.testProcessHints(123)).toEqual(['123']);
    });
  });

  describe('sanitizeGridData', () => {
    it('should accept valid 2D array of numbers', () => {
      const grid = [[1, 2, 3], [4, 5, 6]];
      expect(repo.testSanitizeGridData(grid)).toEqual(grid);
    });

    it('should return null for empty grid', () => {
      const grid: number[][] = [];
      expect(repo.testSanitizeGridData(grid)).toBeNull();
    });

    it('should accept grid with zeros', () => {
      const grid = [[0, 0], [0, 0]];
      expect(repo.testSanitizeGridData(grid)).toEqual(grid);
    });

    it('should reject null', () => {
      expect(repo.testSanitizeGridData(null)).toBeNull();
    });

    it('should reject undefined', () => {
      expect(repo.testSanitizeGridData(undefined)).toBeNull();
    });

    it('should reject non-array values', () => {
      expect(repo.testSanitizeGridData('not-an-array')).toBeNull();
      expect(repo.testSanitizeGridData(123)).toBeNull();
      expect(repo.testSanitizeGridData({ key: 'value' })).toBeNull();
    });

    it('should reject 1D arrays', () => {
      expect(repo.testSanitizeGridData([1, 2, 3])).toBeNull();
    });

    it('should coerce invalid cell values to 0', () => {
      expect(repo.testSanitizeGridData([['a', 'b'], ['c', 'd']])).toEqual([[0, 0], [0, 0]]);
      expect(repo.testSanitizeGridData([[1, 'two'], [3, 4]])).toEqual([[1, 0], [3, 4]]);
    });

    it('should coerce null cell values to 0', () => {
      expect(repo.testSanitizeGridData([[1, null], [3, 4]])).toEqual([[1, 0], [3, 4]]);
    });

    it('should preserve jagged arrays after sanitization', () => {
      expect(repo.testSanitizeGridData([[1, 2], [3, 4, 5]])).toEqual([[1, 2], [3, 4, 5]]);
    });

    it('should parse JSON string grid', () => {
      const grid = '[[1, 2], [3, 4]]';
      expect(repo.testSanitizeGridData(grid)).toEqual([[1, 2], [3, 4]]);
    });

    it('should reject invalid JSON string', () => {
      expect(repo.testSanitizeGridData('invalid{json')).toBeNull();
    });
  });

  describe('sanitizeMultipleGrids', () => {
    it('should accept valid 3D array of numbers', () => {
      const grids = [
        [[1, 2], [3, 4]],
        [[5, 6], [7, 8]]
      ];
      expect(repo.testSanitizeMultipleGrids(grids)).toEqual(grids);
    });

    it('should return null for empty array', () => {
      const grids: number[][][] = [];
      expect(repo.testSanitizeMultipleGrids(grids)).toBeNull();
    });

    it('should reject null', () => {
      expect(repo.testSanitizeMultipleGrids(null)).toBeNull();
    });

    it('should reject undefined', () => {
      expect(repo.testSanitizeMultipleGrids(undefined)).toBeNull();
    });

    it('should sanitize each grid even when inputs are noisy', () => {
      const grids = [
        [[1, 2], [3, 4]],
        [[5, 'six'], [7, 8]] // Invalid grid
      ];
      expect(repo.testSanitizeMultipleGrids(grids)).toEqual([
        [[1, 2], [3, 4]],
        [[5, 0], [7, 8]]
      ]);
    });

    it('should reject 2D arrays (not 3D)', () => {
      expect(repo.testSanitizeMultipleGrids([[1, 2], [3, 4]])).toBeNull();
    });

    it('should parse JSON string multiple grids', () => {
      const grids = '[[[1, 2]], [[3, 4]]]';
      expect(repo.testSanitizeMultipleGrids(grids)).toEqual([[[1, 2]], [[3, 4]]]);
    });

    it('should reject invalid JSON string', () => {
      expect(repo.testSanitizeMultipleGrids('invalid{json')).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('should return boolean indicating connection status', () => {
      const result = repo['isConnected']();
      expect(typeof result).toBe('boolean');
    });
  });
});
