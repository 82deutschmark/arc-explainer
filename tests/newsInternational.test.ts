/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Verify UTC day boundaries and equal story metadata for wiki dispatches.
 * SRP/DRY check: Pass — exercise shared metadata and the actual published store.
 */
import { expect, it } from 'vitest';
import { newsDate, easternDay, dispatchStructuredData, NEWS_NAME } from '../shared/news';
import { socialMetaEntries, SITE_ORIGIN } from '../shared/seo';
import { getNewsIndex } from '../server/services/news/newsStore';
import { resolveNewsMeta, newsSitemapUrls } from '../server/services/news/newsPresentation';
it('uses UTC across the midnight boundary and 24-hour clocks', () => {
  expect(newsDate('2026-11-03T00:15:00Z', true)).toBe('3 November 2026 at 00:15 UTC');
  expect(newsDate('2026-11-02')).toBe('2 November 2026');
  expect(easternDay(Date.parse('2026-11-03T00:15:00Z'))).toBe('2026-11-03');
});
it('gives wiki stories the same canonical dated schema in initial HTML and SPA metadata', () => {
  const story = getNewsIndex().dispatches![0];
  const schema = dispatchStructuredData(story, SITE_ORIGIN);
  const node = (schema['@graph'] as Record<string, any>[])[0];
  expect(resolveNewsMeta('/news/' + story.id)!.tags.jsonLd).toEqual(schema);
  expect(node.datePublished).toBe(story.publishedAt);
  expect(node.dateModified).toBe(story.publishedAt);
  expect(node.citation).toEqual([...new Set(story.sources.map(source => source.url))]);
  expect(node.publisher['@type']).toBe('NewsMediaOrganization');
  expect(node.publisher.masthead).toBe(SITE_ORIGIN + '/news/staff');
  expect(socialMetaEntries(resolveNewsMeta('/news/' + story.id)!.tags)).toContainEqual(['property', 'og:site_name', NEWS_NAME]);
  expect(socialMetaEntries({ title: 'ARC', description: 'ARC', url: SITE_ORIGIN + '/about' })).toContainEqual(['property', 'og:site_name', 'ARC Explainer']);
  expect(newsSitemapUrls()).toContain(SITE_ORIGIN + '/news/tips');
});
