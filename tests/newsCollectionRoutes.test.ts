/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-29
 * PURPOSE: Exercise shareable competitor/team pages, linked records, artwork-led social previews and front/back PNG downloads,
 *          missing-card metadata and the crawlable Cabinet through production middleware
 * without exposing source-generation prompts, private paths or held manuscripts.
 * SRP/DRY check: Pass — reuses the production Express route and seeded collection.
 */
import express from 'express';
import type { Server } from 'node:http';
import sharp from 'sharp';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { mountNews } from '../server/routes/news';
import { resolveNewsMeta, newsSitemapEntries } from '../server/services/news/newsPresentation';
import { metaTagInjector } from '../server/middleware/metaTagInjector';
import { SITE_ORIGIN } from '../shared/seo';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { collectionShareAlt, collectionSharePath } from '../shared/newsCollection';
let server: Server;
let origin: string;
beforeAll(async () => {
  const app = express(); mountNews(app);
  app.use(metaTagInjector);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No collection test server');
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
it('serves numbered individual/team cards independently of held article publication', async () => {
  const response = await fetch(`${origin}/api/news/cards`);
  expect(response.status).toBe(200);
  const text = await response.text();
  const data = JSON.parse(text);
  expect(data.cards.filter((card: { kind: string }) => card.kind === 'person').length).toBeGreaterThanOrEqual(65);
  expect(data.cards.filter((card: { kind: string }) => card.kind === 'team').length).toBeGreaterThanOrEqual(16);
  expect(text).not.toMatch(/\/Users\/|toolArguments|nativeToolArguments|feature-draft\.json/);
  expect(data.cards.find((card: { id: string }) => card.id === 'team-domdolus-tolus-2026').honors).toEqual([]);
});
it('provides the exact selected card, a real PNG and a missing-card response', async () => {
  const id = 'team-domdolus-tolus-2026';
  const card = await (await fetch(`${origin}/api/news/cards/${id}`)).json();
  expect(card.id).toBe(id);
  const response = await fetch(`${origin}/api/news/cards/${id}/image.png`);
  expect(response.headers.get('content-type')).toContain('image/png');
  expect(response.headers.get('content-disposition')).toContain(id);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  expect([metadata.width, metadata.height]).toEqual([750, 1050]);
  expect((await fetch(`${origin}/api/news/cards/unknown`)).status).toBe(404);
  expect((await fetch(`${origin}/api/news/cards/unknown/image.png`)).status).toBe(404);
}, 20_000);
it('downloads the competitor reverse separately and rejects unsupported card sides', async () => {
  const id = 'person-mark-barney-2026';
  const response = await fetch(`${origin}/api/news/cards/${id}/image.png?side=back`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('image/png');
  expect(response.headers.get('content-disposition')).toContain(`${id}-back.png`);
  expect(await sharp(Buffer.from(await response.arrayBuffer())).metadata()).toMatchObject({ width: 750, height: 1050 });
  expect((await fetch(`${origin}/api/news/cards/${id}/image.png?side=invalid`)).status).toBe(400);
  expect((await fetch(`${origin}/api/news/cards/unknown/image.png?side=back`)).status).toBe(404);
}, 20_000);
it('publishes the Cabinet in initial HTML and sitemap with complete names and approved artwork', () => {
  const meta = resolveNewsMeta('/news/cards');
  expect(meta?.status).toBe(200);
  expect(meta?.tags.bodyHtml).toContain('ARC Prize');
  expect(meta?.tags.bodyHtml).toContain('復活の混テキスト');
  expect(meta?.tags.bodyHtml).toContain('2026-10-29-domdolus-tolus-avatar-v1-base.webp');
  expect(newsSitemapEntries().some(entry => entry.url.endsWith('/news/cards'))).toBe(true);
});

it('shares a team card with its own canonical page, exact preview and linked players', async () => {
  const id = 'team-domdolus-tolus-2026';
  const card = getNewsCollection().cards.find(item => item.id === id)!;
  const preview = `${SITE_ORIGIN}${collectionSharePath(card)}`;
  const response = await fetch(`${origin}/news/cards/${id}`);
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/news/cards/${id}"`);
  expect(html).toContain(`property="og:image" content="${preview}"`);
  expect(html).toContain(`name="twitter:image" content="${preview}"`);
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain('property="og:image:width" content="1200"');
  expect(html).toContain('property="og:image:height" content="630"');
  expect(html).toContain('Domdolus Tolus — Team card');
  expect(html).toContain('Team card');
  expect(html).toContain('href="/news/cards/person-darren-amadeus-martin-2026"');
  expect(html).toContain('href="/news/cards/person-alwin-theodoric-2026"');
  expect(html).not.toMatch(/<article id="card-team-last-dance-2026"/);
  expect(html).not.toContain('content="noindex');
  expect(newsSitemapEntries().some(entry => entry.url === `${SITE_ORIGIN}/news/cards/${id}`)).toBe(true);
});
it('serves the actual team artwork preview inline at landscape size and refreshes stale versions', async () => {
  const card = getNewsCollection().cards.find(item => item.id === 'team-turducken-2026')!;
  const response = await fetch(`${origin}${collectionSharePath(card)}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('image/png');
  expect(response.headers.get('content-disposition')).toContain('inline');
  expect(response.headers.get('cache-control')).toContain('immutable');
  expect(await sharp(Buffer.from(await response.arrayBuffer())).metadata()).toMatchObject({ width: 1200, height: 630 });
  const stale = await fetch(`${origin}/api/news/cards/${card.id}/share.png?v=old`, { redirect: 'manual' });
  expect(stale.status).toBe(302);
  expect(stale.headers.get('location')).toBe(collectionSharePath(card));
  expect((await fetch(`${origin}/api/news/cards/unknown/share.png`)).status).toBe(404);
}, 20_000);
it('competitor links use that competitor’s portrait preview and sourced career description', async () => {
  const card = getNewsCollection().cards.find(item => item.id === 'person-son-pham-2026')!;
  const response = await fetch(`${origin}${card.cardUrl}`);
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('Son Pham — Kaggle Expert card');
  expect(html).toContain(`property="og:image" content="${SITE_ORIGIN}${collectionSharePath(card)}"`);
  expect(html).toContain(`name="twitter:image" content="${SITE_ORIGIN}${collectionSharePath(card)}"`);
  expect(html).toContain(collectionShareAlt(card).replaceAll('&', '&amp;').replaceAll('"', '&quot;'));
  expect(html).toContain('Competitions Expert');
  const preview = await fetch(`${origin}${collectionSharePath(card)}`);
  expect(await sharp(Buffer.from(await preview.arrayBuffer())).metadata()).toMatchObject({ width: 1200, height: 630 });
}, 20_000);
it('shares competitor history and links current and earlier teams to their cards', async () => {
  const id = 'person-mark-barney-2026';
  const response = await fetch(`${origin}/news/cards/${id}`);
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain('Kaggle competitor card');
  expect(html).toContain('<h3>Teams</h3>');
  expect(html).toContain('Completed Kaggle competitions');
  expect(html).toContain('href="/news/cards/team-turducken-2026"');
  expect(html).toContain('href="/news/cards/team-arc-mutants-2026"');
  const card = getNewsCollection().cards.find(item => item.id === id)!;
  for (const team of card.teamHistory) {
    expect(html).toContain(`href="${team.cardUrl ?? team.profileUrl}"`);
    if (team.status !== 'current') expect(html).toContain('earlier team');
  }
  expect(html).toContain(`property="og:url" content="${SITE_ORIGIN}/news/cards/${id}"`);
});
it('returns an explicit unindexed 404 for an unknown share card', async () => {
  const response = await fetch(`${origin}/news/cards/unknown`);
  expect(response.status).toBe(404);
  expect(response.headers.get('x-robots-tag')).toContain('noindex');
  const html = await response.text();
  expect(html).toContain('Card not found');
  expect(html).toContain('href="/news/cards"');
  expect(resolveNewsMeta('/news/cards/unknown')?.tags.noindex).toBe(true);
});
