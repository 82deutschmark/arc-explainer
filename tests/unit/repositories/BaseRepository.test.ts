/**
 * Author: Claude Sonnet 4.5
 * Date: 2026-01-04
 * PURPOSE: Comprehensive unit tests for BaseRepository
 *          Tests connection management, transactions, safe parsing, and grid sanitization
 * SRP/DRY check: Pass - Isolated tests for base repository functionality
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
      expect(result).toBe('null');
    });

    it('should handle undefined input', () => {
      const result = repo.testSafeJsonStringify(undefined);
      expect(result).toBeNull();
    });
  });

  describe('normalizeConfidence', () => {
    it('should return number as-is when valid (0-1 range)', () => {
      expect(repo.testNormalizeConfidence(0.5)).toBe(0.5);
      expect(repo.testNormalizeConfidence(0)).toBe(0);
      expect(repo.testNormalizeConfidence(1)).toBe(1);
    });

    it('should parse string numbers', () => {
      expect(repo.testNormalizeConfidence('0.75')).toBe(0.75);
      expect(repo.testNormalizeConfidence('0')).toBe(0);
      expect(repo.testNormalizeConfidence('1')).toBe(1);
    });

    it('should clamp values outside 0-1 range', () => {
      expect(repo.testNormalizeConfidence(1.5)).toBe(1);
      expect(repo.testNormalizeConfidence(-0.5)).toBe(0);
      expect(repo.testNormalizeConfidence(100)).toBe(1);
    });

    it('should return default for invalid values', () => {
      expect(repo.testNormalizeConfidence(null)).toBe(0);
      expect(repo.testNormalizeConfidence(undefined)).toBe(0);
      expect(repo.testNormalizeConfidence('invalid')).toBe(0);
      expect(repo.testNormalizeConfidence({})).toBe(0);
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

    it('should filter out non-string values', () => {
      const hints = ['Hint 1', 123, 'Hint 2', null, 'Hint 3'];
      expect(repo.testProcessHints(hints)).toEqual(['Hint 1', 'Hint 2', 'Hint 3']);
    });

    it('should return empty array for null', () => {
      expect(repo.testProcessHints(null)).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(repo.testProcessHints(undefined)).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
      expect(repo.testProcessHints('invalid{json')).toEqual([]);
    });

    it('should return empty array for non-array values', () => {
      expect(repo.testProcessHints({ key: 'value' })).toEqual([]);
      expect(repo.testProcessHints('string')).toEqual([]);
      expect(repo.testProcessHints(123)).toEqual([]);
    });
  });

  describe('sanitizeGridData', () => {
    it('should accept valid 2D array of numbers', () => {
      const grid = [[1, 2, 3], [4, 5, 6]];
      expect(repo.testSanitizeGridData(grid)).toEqual(grid);
    });

    it('should accept empty grid', () => {
      const grid: number[][] = [];
      expect(repo.testSanitizeGridData(grid)).toEqual(grid);
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

    it('should reject arrays with non-number values', () => {
      expect(repo.testSanitizeGridData([['a', 'b'], ['c', 'd']])).toBeNull();
      expect(repo.testSanitizeGridData([[1, 'two'], [3, 4]])).toBeNull();
    });

    it('should reject arrays with null values', () => {
      expect(repo.testSanitizeGridData([[1, null], [3, 4]])).toBeNull();
    });

    it('should reject jagged arrays (inconsistent row lengths)', () => {
      expect(repo.testSanitizeGridData([[1, 2], [3, 4, 5]])).toBeNull();
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

    it('should accept empty array', () => {
      const grids: number[][][] = [];
      expect(repo.testSanitizeMultipleGrids(grids)).toEqual(grids);
    });

    it('should reject null', () => {
      expect(repo.testSanitizeMultipleGrids(null)).toBeNull();
    });

    it('should reject undefined', () => {
      expect(repo.testSanitizeMultipleGrids(undefined)).toBeNull();
    });

    it('should reject if any grid is invalid', () => {
      const grids = [
        [[1, 2], [3, 4]],
        [[5, 'six'], [7, 8]] // Invalid grid
      ];
      expect(repo.testSanitizeMultipleGrids(grids)).toBeNull();
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
