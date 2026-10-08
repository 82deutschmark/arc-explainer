/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Verify public news delivery, search-readable articles, evidence and rejection
 *          of missing identities and invalid citations using the committed launch issues.
 * SRP/DRY check: Pass — exercises production store, routes and metadata middleware.
 */
import { beforeAll, afterAll, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { mountNews } from '../../server/routes/news';
import { getNewsIndex, newsArticleSchema, competitorSchema } from '../../server/services/news/newsStore';
import { metaTagInjector, seoRouting } from '../../server/middleware/metaTagInjector';
import { SITE_ORIGIN, escapeHtml } from '../../shared/seo';
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  mountNews(app);
  app.use(seoRouting);
  app.use(metaTagInjector);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Missing listener');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
it('publishes full article text and real NewsArticle schema before JavaScript runs', async () => {
  const index = getNewsIndex();
  expect(index.articles.length).toBeGreaterThanOrEqual(2);
  expect(await (await fetch(`${base}/api/news`)).json()).toEqual(index);
  for (const article of index.articles) {
    const response = await fetch(`${base}/news/${article.id}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(escapeHtml(article.headline));
    expect(html).toContain(escapeHtml(article.sections[0].text.split(/\n\n+/)[0]));
    expect(html).toContain(`href="${SITE_ORIGIN}/news/${article.id}"`);
    expect(html).not.toContain('content="noindex');
    const schema = JSON.parse(html.match(/id="page-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const story = schema['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'NewsArticle');
    expect(story.headline).toBe(article.headline);
    expect(story.datePublished).toBe(article.publishedAt);
    expect(story.citation).toEqual(article.sources.map(source => source.url));
    const evidence = await fetch(`${base}/api/news/${article.id}/evidence`);
    expect(evidence.status).toBe(200);
    expect(evidence.headers.get('content-type')).toContain('json');
  }
});
it('discovers articles and separate competitor identities through sitemap and RSS', async () => {
  const index = getNewsIndex();
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  const rss = await fetch(`${base}/news/feed.xml`);
  expect(rss.headers.get('content-type')).toContain('application/rss+xml');
  const xml = await rss.text();
  for (const article of index.articles) {
    expect(sitemap).toContain(`${SITE_ORIGIN}/news/${article.id}`);
    expect(xml).toContain(escapeHtml(article.headline));
  }
  for (const record of index.competitors) {
    expect(sitemap).toContain(`/news/competitors/${record.id}`);
    const response = await fetch(`${base}/news/competitors/${record.id}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(escapeHtml(record.name));
  }
});
it('returns real 404s for unknown articles, competitors and evidence', async () => {
  for (const path of ['/news/not-an-issue', '/news/competitors/arc-3-0', '/api/news/not-an-issue/evidence']) {
    expect((await fetch(`${base}${path}`)).status).toBe(404);
  }
});
it('rejects invented citation IDs and competitors assigned to the wrong competition', () => {
  const article = structuredClone(getNewsIndex().articles[0]);
  article.sections[0].sourceIds = ['invented'];
  expect(newsArticleSchema.safeParse(article).success).toBe(false);
  const record = structuredClone(getNewsIndex().competitors[0]);
  record.id = `arc-9-${record.teamId}`;
  expect(competitorSchema.safeParse(record).success).toBe(false);
});
