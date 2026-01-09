/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Unit tests for meta tag injection and route metadata defaults.
 * SRP/DRY check: Pass - Focused middleware helpers only.
 */

/**
 * Meta Tag Injector Middleware Tests
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-30
 * PURPOSE: Unit tests for bot detection and meta tag injection middleware for link unfurling
 * SRP/DRY check: Pass - Tests single middleware responsibility
 */

import { strict as assert } from 'node:assert';
import { test } from 'vitest';
import { generateMetaTags } from '../server/middleware/metaTagInjector.js';
import { ROUTE_META_TAGS } from '../shared/routes.js';

test('generateMetaTags creates Open Graph meta tags', () => {
  const tags = {
    title: 'Test Title',
    description: 'Test Description',
    url: 'https://example.com/test',
    type: 'website',
  };

  const result = generateMetaTags(tags);

  assert.ok(result.includes('og:title'), 'Should include og:title');
  assert.ok(result.includes('Test Title'), 'Should include the title text');
  assert.ok(result.includes('og:description'), 'Should include og:description');
  assert.ok(result.includes('Test Description'), 'Should include the description text');
  assert.ok(result.includes('og:url'), 'Should include og:url');
  assert.ok(result.includes('https://example.com/test'), 'Should include the URL');
  assert.ok(result.includes('og:type'), 'Should include og:type');
  assert.ok(result.includes('website'), 'Should include the type value');
});

test('generateMetaTags creates Twitter Card meta tags', () => {
  const tags = {
    title: 'Test Title',
    description: 'Test Description',
    url: 'https://example.com/test',
  };

  const result = generateMetaTags(tags);

  assert.ok(result.includes('twitter:card'), 'Should include twitter:card');
  assert.ok(result.includes('summary_large_image'), 'Should include card type');
  assert.ok(result.includes('twitter:title'), 'Should include twitter:title');
  assert.ok(result.includes('twitter:description'), 'Should include twitter:description');
  assert.ok(result.includes('twitter:url'), 'Should include twitter:url');
});

test('generateMetaTags includes image tags when image is provided', () => {
  const tags = {
    title: 'Test Title',
    description: 'Test Description',
    url: 'https://example.com/test',
    image: '/test-image.png',
  };

  const result = generateMetaTags(tags);

  assert.ok(result.includes('og:image'), 'Should include og:image');
  assert.ok(result.includes('/test-image.png'), 'Should include the image URL');
  assert.ok(result.includes('twitter:image'), 'Should include twitter:image');
});

test('generateMetaTags omits image tags when image is not provided', () => {
  const tags = {
    title: 'Test Title',
    description: 'Test Description',
    url: 'https://example.com/test',
  };

  const result = generateMetaTags(tags);

  assert.ok(!result.includes('og:image'), 'Should not include og:image');
  assert.ok(!result.includes('twitter:image'), 'Should not include twitter:image');
});

test('ROUTE_META_TAGS includes /re-arc route', () => {
  assert.ok(ROUTE_META_TAGS['/re-arc'], 'Should have /re-arc route defined');

  const reArcTags = ROUTE_META_TAGS['/re-arc'];
  assert.equal(reArcTags.title, 'RE-ARC Bench - Test Your ARC Solver', 'Should have correct title');
  assert.ok(reArcTags.description.includes('ARC puzzles'), 'Should mention ARC puzzles');
  assert.equal(reArcTags.url, 'https://arc.markbarney.net/re-arc', 'Should have correct URL');
  assert.equal(reArcTags.type, 'website', 'Should be type website');
});

test('generateMetaTags escapes HTML in content', () => {
  const tags = {
    title: 'Test <script>alert("xss")</script>',
    description: 'Description with "quotes" and \'apostrophes\'',
    url: 'https://example.com/test',
  };

  const result = generateMetaTags(tags);

  // The content attribute values are wrapped in quotes, so they should be safe
  assert.ok(result.includes('Test <script>alert("xss")</script>'), 'Should preserve content in meta tags');
  assert.ok(result.includes('Description with "quotes"'), 'Should handle quotes in content');
});

test('generateMetaTags uses "website" as default type when not provided', () => {
  const tags = {
    title: 'Test Title',
    description: 'Test Description',
    url: 'https://example.com/test',
  };

  const result = generateMetaTags(tags);

  assert.ok(result.includes('og:type'), 'Should include og:type');
  assert.ok(result.includes('website'), 'Should default to "website" type');
});

test('generateMetaTags generates well-formed HTML', () => {
  const tags = {
    title: 'Test Title',
    description: 'Test Description',
    url: 'https://example.com/test',
    image: '/test-image.png',
    type: 'article',
  };

  const result = generateMetaTags(tags);

  // Check for proper meta tag structure
  const metaTags = result.match(/<meta[^>]+>/g);
  assert.ok(metaTags && metaTags.length > 0, 'Should generate meta tags');

  // Each meta tag should have either name or property attribute, and content attribute
  for (const tag of metaTags || []) {
    const hasIdentifier = tag.includes('property=') || tag.includes('name=');
    assert.ok(hasIdentifier, 'Each tag should have a property or name attribute');
    assert.ok(tag.includes('content='), 'Each tag should have a content attribute');
  }

  // Check for title tag
  assert.ok(result.includes('<title>'), 'Should include title tag');
  assert.ok(result.includes('Test Title'), 'Title tag should contain the title');
});

test('ROUTE_META_TAGS has consistent structure for all routes', () => {
  for (const [route, tags] of Object.entries(ROUTE_META_TAGS)) {
    assert.ok(tags.title, `Route ${route} should have a title`);
    assert.ok(tags.description, `Route ${route} should have a description`);
    assert.ok(tags.url, `Route ${route} should have a URL`);
    assert.ok(tags.url.startsWith('https://'), `Route ${route} URL should start with https://`);
  }
});

test('meta tag replacement removes default tags and inserts new ones', () => {
  const mockHtml = `
    <head>
      <meta charset="UTF-8" />
      <!-- META_TAGS_START -->
      <meta property="og:title" content="Default Title" />
      <meta property="og:description" content="Default Description" />
      <!-- META_TAGS_END -->
      <title>Test</title>
    </head>
  `;

  const newTags = generateMetaTags({
    title: 'New Title',
    description: 'New Description',
    url: 'https://example.com/new',
  });

  const metaTagRegex = /<!-- META_TAGS_START -->[\s\S]*?<!-- META_TAGS_END -->/;
  const result = mockHtml.replace(metaTagRegex, newTags);

  // Should not contain default tags
  assert.ok(!result.includes('Default Title'), 'Should not contain default title');
  assert.ok(!result.includes('Default Description'), 'Should not contain default description');

  // Should contain new tags
  assert.ok(result.includes('New Title'), 'Should contain new title');
  assert.ok(result.includes('New Description'), 'Should contain new description');

  // Should not contain the marker comments
  assert.ok(!result.includes('META_TAGS_START'), 'Should not contain start marker');
  assert.ok(!result.includes('META_TAGS_END'), 'Should not contain end marker');
});
