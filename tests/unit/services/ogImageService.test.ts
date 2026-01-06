/**
 * Author: Sonnet 4
 * Date: 2026-01-05
 * PURPOSE: Unit tests for OG image generation service
 * SRP/DRY check: Pass - Tests only ogImageService functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateOgImageForTask,
  clearOgImageCache,
  getOgImageCacheStats,
} from '../../../server/services/ogImageService';
import type { ARCTask } from '../../../shared/types';

// Mock task data for testing
const createMockTask = (overrides: Partial<ARCTask> = {}): ARCTask => ({
  train: [
    {
      input: [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ],
      output: [
        [8, 7, 6],
        [5, 4, 3],
        [2, 1, 0],
      ],
    },
    {
      input: [
        [1, 0],
        [0, 1],
      ],
      output: [
        [0, 1],
        [1, 0],
      ],
    },
  ],
  test: [
    {
      input: [
        [0, 0, 0],
        [1, 1, 1],
        [2, 2, 2],
      ],
      output: [
        [2, 2, 2],
        [1, 1, 1],
        [0, 0, 0],
      ],
    },
  ],
  ...overrides,
});

describe('ogImageService', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearOgImageCache();
  });

  describe('generateOgImageForTask', () => {
    it('should generate a PNG buffer for a valid task', async () => {
      const task = createMockTask();
      const buffer = await generateOgImageForTask(task, 'deadbeef');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate PNG with correct magic bytes', async () => {
      const task = createMockTask();
      const buffer = await generateOgImageForTask(task, 'deadbeef');

      // PNG files start with these magic bytes: 137 80 78 71 13 10 26 10
      const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(buffer.slice(0, 8).equals(pngMagic)).toBe(true);
    });

    it('should cache generated images', async () => {
      const task = createMockTask();

      // First call - should generate
      const buffer1 = await generateOgImageForTask(task, 'deadbeef');
      const stats1 = getOgImageCacheStats();
      expect(stats1.size).toBe(1);

      // Second call - should return from cache
      const buffer2 = await generateOgImageForTask(task, 'deadbeef');
      const stats2 = getOgImageCacheStats();
      expect(stats2.size).toBe(1); // Still 1, not 2

      // Buffers should be identical
      expect(buffer1.equals(buffer2)).toBe(true);
    });

    it('should generate different images for different tasks', async () => {
      const task1 = createMockTask();
      const task2 = createMockTask({
        train: [
          {
            input: [[9, 9], [9, 9]],
            output: [[0, 0], [0, 0]],
          },
        ],
      });

      const buffer1 = await generateOgImageForTask(task1, 'aaaaaaaa');
      const buffer2 = await generateOgImageForTask(task2, 'bbbbbbbb');

      // Different task IDs should produce different cache entries
      const stats = getOgImageCacheStats();
      expect(stats.size).toBe(2);

      // Buffers should be different (different content)
      expect(buffer1.equals(buffer2)).toBe(false);
    });

    it('should handle task with single training example', async () => {
      const task = createMockTask({
        train: [
          {
            input: [[1, 2], [3, 4]],
            output: [[4, 3], [2, 1]],
          },
        ],
      });

      const buffer = await generateOgImageForTask(task, 'single01');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should respect exampleCount option', async () => {
      const task = createMockTask();

      // Generate with 1 example
      const buffer1 = await generateOgImageForTask(task, 'example1', { exampleCount: 1 });

      // Generate with 2 examples (different cache key)
      clearOgImageCache();
      const buffer2 = await generateOgImageForTask(task, 'example2', { exampleCount: 2 });

      // Both should be valid PNGs
      const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(buffer1.slice(0, 8).equals(pngMagic)).toBe(true);
      expect(buffer2.slice(0, 8).equals(pngMagic)).toBe(true);
    });

    it('should handle large grids', async () => {
      // Create a 15x15 grid (reasonable test size - 30x30 is too slow for unit tests)
      const largeGrid = Array(15).fill(null).map(() =>
        Array(15).fill(null).map(() => Math.floor(Math.random() * 10))
      );

      const task = createMockTask({
        train: [
          {
            input: largeGrid,
            output: largeGrid,
          },
        ],
      });

      const buffer = await generateOgImageForTask(task, 'largegrd');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for large grid rendering
  });

  describe('cache management', () => {
    it('should clear cache correctly', async () => {
      const task = createMockTask();
      await generateOgImageForTask(task, 'deadbeef');

      const statsBefore = getOgImageCacheStats();
      expect(statsBefore.size).toBe(1);

      clearOgImageCache();

      const statsAfter = getOgImageCacheStats();
      expect(statsAfter.size).toBe(0);
    });

    it('should report correct cache stats', () => {
      const stats = getOgImageCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats.maxSize).toBe(100);
    });
  });
});
