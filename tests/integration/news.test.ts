/**
 * Author: GPT-6.1 Sol / Codex; Claude Opus 5.5 (Bubba)
 * Date: 2026-10-07; 08-October-2026
 * PURPOSE: Verify public news delivery, search-readable articles, evidence and rejection
 *          of missing identities and invalid citations using the committed launch issues.
 *          08-Oct-2026: share cards (size, real drawn content, cache headers, 404s), the
 *          per-article og/twitter/JSON-LD image, CollectionPage, lastmod and RSS additions.
 * SRP/DRY check: Pass — exercises production store, routes and metadata middleware.
 */
import { beforeAll, afterAll, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { mountNews } from '../../server/routes/news';
import { getNewsIndex, newsArticleSchema, competitorSchema } from '../../server/services/news/newsStore';
import { metaTagInjector, seoRouting } from '../../server/middleware/metaTagInjector';
import { SITE_ORIGIN, escapeHtml } from '../../shared/seo';
import sharp from 'sharp';
import { articleCardPath, articleTitle, NEWS_SECTION_CARD_PATH, TITLE_BUDGET } from '../../shared/news';
import { articleCardSvg, cardText, renderArticleCard } from '../../server/services/news/newsCardImage';
const metaContent = (html: string, key: string) => html.match(new RegExp(`(?:property|name)="${key}" content="([^"]*)"`))?.[1];
const unescape = (value = '') => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
/** A blank or flat image passes a size check; a drawn card has many distinct shades. */
async function expectDrawnCard(png: Buffer) {
  const image = sharp(png);
  const meta = await image.metadata();
  expect([meta.width, meta.height]).toEqual([1200, 630]);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const shades = new Set<number>();
  let ink = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    shades.add((data[index] << 16) | (data[index + 1] << 8) | data[index + 2]);
    if (data[index] < 80 && data[index + 1] < 80 && data[index + 2] < 80) ink++;
  }
  expect(shades.size).toBeGreaterThan(50);
  expect(ink / (data.length / info.channels)).toBeGreaterThan(0.02);
}
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
    expect(story.citation).toEqual([...new Set(article.sources.map(source => source.url))]);
    const card = `${SITE_ORIGIN}${articleCardPath(article)}`;
    expect(story.image[0]).toMatchObject({ url: card, width: 1200, height: 630 });
    expect(story.publisher.logo.url).toBe(`${SITE_ORIGIN}/android-chrome-512x512.png`);
    expect(unescape(metaContent(html, 'og:image'))).toBe(card);
    expect(unescape(metaContent(html, 'twitter:image'))).toBe(card);
    expect(metaContent(html, 'og:image:width')).toBe('1200');
    expect(metaContent(html, 'article:published_time')).toBe(article.publishedAt);
    expect(metaContent(html, 'og:image:alt')).toContain(escapeHtml(article.headline));
    expect(html.match(/<title>([^<]*)<\/title>/)![1].length).toBeLessThanOrEqual(Math.max(TITLE_BUDGET, escapeHtml(article.headline).length));
    expect(articleTitle(article).length).toBeLessThanOrEqual(Math.max(TITLE_BUDGET, article.headline.length));
    expect(metaContent(html, 'description')!.length).toBeLessThanOrEqual(Math.max(160, escapeHtml(article.dek).length));
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
    expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/news/${article.id}</loc><lastmod>${article.publishedAt}</lastmod>`);
    expect(xml).toContain(escapeHtml(`${SITE_ORIGIN}${articleCardPath(article)}`));
  }
  expect(xml).toContain(`<atom:link href="${SITE_ORIGIN}/news/feed.xml" rel="self"`);
  expect(xml).toContain('<lastBuildDate>');
  for (const record of index.competitors) {
    expect(sitemap).toContain(`/news/competitors/${record.id}`);
    const response = await fetch(`${base}/news/competitors/${record.id}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(escapeHtml(record.name));
  }
});
it('returns real 404s for unknown articles, competitors and evidence', async () => {
  for (const path of ['/news/not-an-issue', '/news/competitors/arc-3-0', '/api/news/not-an-issue/evidence', '/api/news/og-image/not-an-issue.png']) {
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
it('serves a drawn 1200x630 card for every article and the front page', async () => {
  for (const article of getNewsIndex().articles) {
    const response = await fetch(`${base}${articleCardPath(article)}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('immutable');
    await expectDrawnCard(Buffer.from(await response.arrayBuffer()));
  }
  const section = await fetch(`${base}${NEWS_SECTION_CARD_PATH}`);
  expect(section.status).toBe(200);
  expect(section.headers.get('cache-control')).not.toContain('immutable');
  await expectDrawnCard(Buffer.from(await section.arrayBuffer()));
});
it('gives the front page and notebook the newspaper card and list structured data', async () => {
  for (const [path, type] of [['/news', 'CollectionPage'], ['/news/competitors', 'CollectionPage']]) {
    const html = await (await fetch(`${base}${path}`)).text();
    expect(metaContent(html, 'og:image')).toBe(`${SITE_ORIGIN}${NEWS_SECTION_CARD_PATH}`);
    const schema = JSON.parse(html.match(/id="page-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const page = schema['@graph'].find((node: Record<string, unknown>) => node['@type'] === type);
    expect(page.mainEntity.itemListElement.length).toBeGreaterThan(0);
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  }
});
it('draws card text as paths, so the container needs no system fonts', async () => {
  const svg = await articleCardSvg(getNewsIndex().articles[0]);
  expect(svg).not.toMatch(/<text|font-family/);
  expect((svg.match(/<path/g) ?? []).length).toBeGreaterThan(10);
});
it('keeps cards drawable for names and headlines outside the card fonts', async () => {
  expect(cardText('the last dance 🕺')).toBe('the last dance');
  expect(cardText('復活の混テキスト')).toBe('');
  const article = structuredClone(getNewsIndex().articles[0]);
  article.headline = `${'A very long headline about the ARC-AGI-3 race '.repeat(5)}🎉`;
  article.stats = [{ teamId: '1', name: '復活の混テキスト', rank: 1, score: 1, rankChange: null, scoreChange: null }];
  await expectDrawnCard(await renderArticleCard(article));
});
