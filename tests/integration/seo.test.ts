/**
 * Author: GPT-6.1 Sol / Codex; Codex
 * Date: 2026-10-08
 * PURPOSE: Exercise real production HTML delivery, redirects, sitemap and route coverage
 *          against local registries and the built shell, without external services.
 *          Covers retired rankings returning 410 and disappearing from public discovery.
 *          2026-10-09 (Claude Opus 5.5): /feedback check follows the page's current attempt example.
 * SRP/DRY check: Pass — uses production middleware and actual game/puzzle content.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import { ROUTE_META_TAGS } from '../../shared/routes';
import { REDIRECTS, SITE_ORIGIN, structuredData } from '../../shared/seo';
import { getAllGames } from '../../shared/arc3Games';
import { puzzleLoader } from '../../server/services/puzzleLoader';
import { generateSitemap, resolvePageMeta, sitemapUrls } from '../../server/services/seo/pageContent';
import { generateMetaTags, injectPageHtml, metaTagInjector, seoRouting } from '../../server/middleware/metaTagInjector';

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(seoRouting);
  app.use(express.static('dist/public', { index: false }));
  app.use(metaTagInjector);
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected local TCP listener');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

function assertHead(html: string) {
  expect(html.match(/<title>/g)).toHaveLength(1);
  expect(html.match(/name="description"/g)).toHaveLength(1);
  expect(html.match(/rel="canonical"/g)).toHaveLength(1);
  expect(html.match(/name="robots"/g)).toHaveLength(1);
  expect(html).not.toContain('SearchAction');
  expect(html).toMatch(/property="og:image" content="https:\/\//);
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) expect(() => JSON.parse(match[1])).not.toThrow();
}
describe('SEO delivery', () => {
  it('covers every literal production SPA route with metadata or a permanent alias', () => {
    const app = fs.readFileSync('client/src/App.tsx', 'utf8');
    for (const match of app.matchAll(/<Route path="([^"]+)"/g)) {
      const route = match[1];
      if (route.includes(':') || route.startsWith('/dev/')) continue;
      expect(Object.hasOwn(ROUTE_META_TAGS, route) || Object.hasOwn(REDIRECTS, route), route).toBe(true);
    }
  });
  it('serves unique, crawlable initial HTML for every public SPA hub', async () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const [route, tags] of Object.entries(ROUTE_META_TAGS).filter(([route, tags]) => !tags.noindex && route !== '/feedback')) {
      const response = await fetch(`${base}${route}?utm_source=test`);
      expect(response.status, route).toBe(200);
      const html = await response.text();
      assertHead(html);
      expect(html.match(/<h1[ >]/g), route).toHaveLength(1);
      expect(html, route).toContain(`href="${SITE_ORIGIN}${route}"`);
      expect(html, route).toContain('href="/arc3/games"');
      expect(html, route).not.toContain('content="noindex');
      expect(titles.has(tags.title), route).toBe(false);
      expect(descriptions.has(tags.description), route).toBe(false);
      titles.add(tags.title); descriptions.add(tags.description);
    }
  });
  it('renders all official guides from actual level content, including historical as66', async () => {
    for (const game of getAllGames()) {
      const response = await fetch(`${base}/arc3/games/${game.gameId}`);
      const html = await response.text();
      expect(response.status).toBe(200);
      assertHead(html);
      expect(html).toContain('Level 1');
      expect(html).toContain(game.gameId);
      expect(html).toContain('All official game guides');
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    }
    expect(resolvePageMeta('/arc3/games/as66').tags.bodyHtml).toContain('withdrawn preview');
  });
  it('returns true 404s and noindex for unknown pages, games, puzzles and assets', async () => {
    for (const route of ['/not-a-real-page', '/arc3/upload', '/arc3/games/not-real', '/arc3/games/constructor', '/puzzle/ffffffff', '/missing-file.js']) {
      const response = await fetch(`${base}${route}`);
      expect(response.status, route).toBe(404);
      expect(response.headers.get('x-robots-tag'), route).toContain('noindex');
    }
    expect((await fetch(`${base}/api/does-not-exist`)).status).toBe(404);
  });
  it('retires model rankings for old bookmarks and crawlers while keeping current results available', async () => {
    for (const method of ['GET', 'HEAD']) {
      for (const path of ['/leaderboards', '/leaderboards/?tab=trustworthiness']) {
        const response = await fetch(`${base}${path}`, { method });
        expect(response.status).toBe(410);
        expect(response.headers.get('x-robots-tag')).toContain('noindex');
        if (method === 'GET') {
          const html = await response.text();
          expect(html).toContain('Model rankings retired');
          expect(html).toContain('content="noindex,follow"');
          expect(html).not.toContain('Avg trustworthiness');
        }
      }
    }
    expect(sitemapUrls()).not.toContain(`${SITE_ORIGIN}/leaderboards`);
    for (const path of ['/home', '/analytics']) {
      const html = await (await fetch(`${base}${path}`)).text();
      expect(html).not.toContain('href="/leaderboards"');
    }
    for (const path of ['/kaggle-leaderboard', '/kaggle-leaderboard/arc-2', '/analytics']) {
      expect((await fetch(`${base}${path}`)).status).toBe(200);
    }
  });
  it('excludes tools from indexing in raw HTML and headers, while keeping them usable', async () => {
    for (const route of ['/admin', '/admin/models', '/arc3/mechanics', '/worm-arena/live/session-123', '/worm-arena/live/session.v2', '/puzzle/saturn/007bbfb7']) {
      const response = await fetch(`${base}${route}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-robots-tag')).toContain('noindex');
      const html = await response.text();
      assertHead(html);
      expect(html).toContain('content="noindex,follow"');
    }
  });
  it('serves the audit at /feedback with working downloads and redirects old bookmarks', async () => {
    const old = '/reports/arc-prize-audit-2026-10-08/audit.html';
    expect((await fetch(`${base}/explanation-feedback`)).status).toBe(200);
    expect(ROUTE_META_TAGS['/feedback'].title).toContain('ARC Prize');
    expect(sitemapUrls()).toContain(`${SITE_ORIGIN}/feedback`);
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${base}/feedback`, { method });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      if (method === 'GET') {
        const html = await response.text();
        expect(html).toContain(`rel="canonical" href="${SITE_ORIGIN}/feedback"`);
        expect(html).toContain('highlight=73845');
        const downloads = [...html.matchAll(/href="(\/reports\/[^"]+\.(?:json|txt|csv))"/g)];
        expect(downloads.length).toBeGreaterThan(0);
        for (const url of new Set(downloads.map(match => match[1]))) {
          expect((await fetch(`${base}${url}`)).status, url).toBe(200);
        }
      }
      for (const from of [old, '/feedback/']) {
        const redirect = await fetch(`${base}${from}?ref=matt`, { method, redirect: 'manual' });
        expect(redirect.status).toBe(308);
        expect(redirect.headers.get('location')).toBe('/feedback?ref=matt');
      }
    }
  });
  it('normalizes aliases and trailing slashes in one hop while preserving query strings', async () => {
    for (const [from, to] of [['/synthetic/', '/'], ['/arc3/archive/games/LS20/', '/arc3/games/ls20'], ['/arc3/games/', '/arc3/games'], ['/examine/007bbfb7', '/puzzle/007bbfb7'], ['/index.html', '/']]) {
      const response = await fetch(`${base}${from}?ref=test`, { redirect: 'manual' });
      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(`${to}?ref=test`);
    }
  });
  it('generates only unique, canonical, existing sitemap URLs, dated only where a real change time exists', async () => {
    const response = await fetch(`${base}/sitemap.xml`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('xml');
    expect(await response.text()).toBe(generateSitemap());
    const urls = sitemapUrls();
    expect(urls.length).toBe(new Set(urls).size);
    expect(urls).toContain(`${SITE_ORIGIN}/arc3/slippery-seven`);
    expect(urls).toContain(`${SITE_ORIGIN}/kaggle-leaderboard/arc-2`);
    expect(urls).not.toContain(`${SITE_ORIGIN}/arc3/mechanics`);
    for (const url of urls) {
      const route = new URL(url).pathname;
      if (route === '/human-arc/' || route === '/human-records.html') continue;
      const { tags, status } = resolvePageMeta(route);
      expect(status, route).toBe(200);
      expect(tags.noindex, route).not.toBe(true);
    }
    // Only ARC Daily URLs carry lastmod, taken from recorded publication / check times.
    const dated = [...generateSitemap().matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
    expect(dated.length).toBeGreaterThan(0);
    for (const [, url, lastmod] of dated) {
      expect(new URL(url).pathname.startsWith('/news'), url).toBe(true);
      expect(Number.isFinite(Date.parse(lastmod)), url).toBe(true);
    }
    const id = puzzleLoader.getAvailablePuzzleIds()[0];
    expect(id).toBeTruthy();
    expect((await fetch(`${base}/puzzle/${id}`)).status).toBe(200);
  });
  it('escapes prose, URLs and script data without breaking the HTML shell', () => {
    const tags = { title: 'A "quote" & <tag>', description: '</script><img src=x>', url: `${SITE_ORIGIN}/?a=1&b=2` };
    const head = generateMetaTags(tags);
    expect(head).toContain('A &quot;quote&quot; &amp; &lt;tag&gt;');
    expect(head).not.toContain('</script><img');
    expect(head).toContain('\\u003c/script>');
    const html = injectPageHtml('<!-- META_TAGS_START --><!-- META_TAGS_END --><div id="root"></div>', tags);
    expect(html).not.toContain('<tag>');
    expect(structuredData(tags)).not.toHaveProperty('potentialAction');
  });
  it('serves llms text and a real PNG social card', async () => {
    const text = await fetch(`${base}/llms.txt`);
    expect(text.headers.get('content-type')).toContain('text/plain');
    expect(await text.text()).toContain('# ARC Explainer');
    const image = await fetch(`${base}/og-preview.png`);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toContain('image/png');
  });
});
