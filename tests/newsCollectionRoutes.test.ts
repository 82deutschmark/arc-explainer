/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: Exercise the real public collection routes, download and crawlable Cabinet
 * without exposing source-generation prompts, private paths or held manuscripts.
 * SRP/DRY check: Pass — reuses the production Express route and seeded collection.
 */
import express from 'express';
import type { Server } from 'node:http';
import sharp from 'sharp';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { mountNews } from '../server/routes/news';
import { resolveNewsMeta, newsSitemapEntries } from '../server/services/news/newsPresentation';
let server: Server;
let origin: string;
beforeAll(async () => {
  const app = express(); mountNews(app);
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
