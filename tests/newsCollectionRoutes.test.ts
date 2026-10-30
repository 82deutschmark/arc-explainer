/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-29
 * PURPOSE: Exercise shareable player/team pages, linked records, exact PNG previews,
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
it('publishes the Cabinet in initial HTML and sitemap with complete names and approved artwork', () => {
  const meta = resolveNewsMeta('/news/cards');
  expect(meta?.status).toBe(200);
  expect(meta?.tags.bodyHtml).toContain('Card Cabinet');
  expect(meta?.tags.bodyHtml).toContain('復活の混テキスト');
  expect(meta?.tags.bodyHtml).toContain('2026-10-29-domdolus-tolus-avatar-v1-base.webp');
  expect(newsSitemapEntries().some(entry => entry.url.endsWith('/news/cards'))).toBe(true);
});

it('shares a team card with its own canonical page, exact preview and linked players', async () => {
  const id = 'team-domdolus-tolus-2026';
  const response = await fetch(`${origin}/news/cards/${id}`);
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/news/cards/${id}"`);
  expect(html).toContain(`property="og:image" content="${SITE_ORIGIN}/api/news/cards/${id}/image.png"`);
  expect(html).toContain('property="og:image:width" content="750"');
  expect(html).toContain('property="og:image:height" content="1050"');
  expect(html).toContain('Team card');
  expect(html).toContain('href="/news/cards/person-darren-amadeus-martin-2026"');
  expect(html).toContain('href="/news/cards/person-alwin-theodoric-2026"');
  expect(html).not.toMatch(/<article id="card-team-last-dance-2026"/);
  expect(html).not.toContain('content="noindex');
  expect(newsSitemapEntries().some(entry => entry.url === `${SITE_ORIGIN}/news/cards/${id}`)).toBe(true);
});
it('shares player history and links current and earlier teams to their cards', async () => {
  const id = 'person-mark-barney-2026';
  const response = await fetch(`${origin}/news/cards/${id}`);
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain('Player card');
  expect(html).toContain('Team history');
  expect(html).toContain('Kaggle career &amp; highlights');
  expect(html).toContain('href="/news/cards/team-turducken-2026"');
  expect(html).toContain('href="/news/cards/team-arc-mutants-2026"');
  const card = getNewsCollection().cards.find(item => item.id === id)!;
  for (const team of card.teamHistory) {
    expect(html).toContain(`href="${team.cardUrl ?? team.profileUrl}"`);
    expect(html).toContain(team.status === 'current' ? 'Current team' : team.status === 'previous' ? 'Previous team' : 'Last observed team');
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
