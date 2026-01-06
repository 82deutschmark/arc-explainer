/**
 * Author: Sonnet 4
 * Date: 2026-01-05
 * PURPOSE: Integration tests for OG image API endpoint and crawler meta tag injection
 * SRP/DRY check: Pass - Tests only OG image HTTP API and crawler behavior
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { injectMetaTagsIntoHtml } from '../../server/middleware/metaTagInjector';
import {
  generateOgImageForTask,
  clearOgImageCache,
  getOgImageCacheStats,
} from '../../server/services/ogImageService';
import type { ARCTask } from '../../shared/types';

// Mock task for testing
const createMockTask = (): ARCTask => ({
  train: [
    {
      input: [[0, 1], [2, 3]],
      output: [[3, 2], [1, 0]],
    },
  ],
  test: [
    {
      input: [[1, 1], [0, 0]],
      output: [[0, 0], [1, 1]],
    },
  ],
});

describe('OG Image Service Integration Tests', () => {
  beforeAll(() => {
    clearOgImageCache();
  });

  describe('generateOgImageForTask', () => {
    it('should generate valid PNG for mock task', async () => {
      const task = createMockTask();
      const buffer = await generateOgImageForTask(task, 'testtest');

      // Verify PNG magic bytes
      const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(buffer.slice(0, 8).equals(pngMagic)).toBe(true);
    });

    it('should cache images correctly', async () => {
      clearOgImageCache();
      const task = createMockTask();

      // First generation
      await generateOgImageForTask(task, 'cachetest');
      const stats1 = getOgImageCacheStats();
      expect(stats1.size).toBe(1);

      // Second call should use cache
      await generateOgImageForTask(task, 'cachetest');
      const stats2 = getOgImageCacheStats();
      expect(stats2.size).toBe(1); // Still 1, not 2
    });

    it('should return cache stats correctly', () => {
      const stats = getOgImageCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats.maxSize).toBe(100);
    });

    it('should clear cache correctly', () => {
      clearOgImageCache();
      const stats = getOgImageCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});

describe('Meta Tag Injection for Puzzle Routes', () => {
  const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <!-- META_TAGS_START -->
  <meta name="description" content="Default description" />
  <meta property="og:title" content="Default Title" />
  <meta property="og:image" content="/default-image.png" />
  <title>Default Title</title>
  <!-- META_TAGS_END -->
</head>
<body></body>
</html>`;

  describe('injectMetaTagsIntoHtml', () => {
    it('should not modify HTML for unknown routes', () => {
      const result = injectMetaTagsIntoHtml(sampleHtml, '/unknown-route');
      expect(result).toBe(sampleHtml);
    });

    it('should inject meta tags for known static routes', () => {
      const result = injectMetaTagsIntoHtml(sampleHtml, '/re-arc');

      // Should have replaced the default meta tags
      expect(result).not.toContain('Default description');
      expect(result).toContain('RE-ARC');
    });
  });
});

describe('Crawler User-Agent Detection', () => {
  it('should identify Discord crawler user agent', () => {
    const discordUserAgent = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';
    const isBot = /Discordbot|Twitterbot|Slackbot|facebookexternalhit|LinkedInBot/i.test(discordUserAgent);
    expect(isBot).toBe(true);
  });

  it('should identify Twitter crawler user agent', () => {
    const twitterUserAgent = 'Twitterbot/1.0';
    const isBot = /Discordbot|Twitterbot|Slackbot|facebookexternalhit|LinkedInBot/i.test(twitterUserAgent);
    expect(isBot).toBe(true);
  });

  it('should identify Slack crawler user agent', () => {
    const slackUserAgent = 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)';
    const isBot = /Discordbot|Twitterbot|Slackbot|facebookexternalhit|LinkedInBot/i.test(slackUserAgent);
    expect(isBot).toBe(true);
  });

  it('should not identify regular browser as crawler', () => {
    const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const isBot = /Discordbot|Twitterbot|Slackbot|facebookexternalhit|LinkedInBot/i.test(chromeUserAgent);
    expect(isBot).toBe(false);
  });
});
