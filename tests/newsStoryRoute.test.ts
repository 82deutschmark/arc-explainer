/**
 * Author: GPT-6.1 Terra / Codex (reasoning effort not exposed); GPT-6 / Codex; GPT-6.1 Sol / Codex; Claude Opus 5.5
 * Date: 14-Nov-2026; 03-November-2026
 * 14-Nov-2026 (Claude Opus 5.5, archive-collection): a found story is now cached publicly for a minute.
 * PURPOSE: Verify direct story lookup serves both publication types and never caches misses.
 * SRP/DRY check: Pass — real routes and committed archive, no duplicate resolver.
 */
import express from 'express';
import { once } from 'node:events';
import { afterAll, beforeAll, vi } from 'vitest';
import * as newsStore from '../server/services/news/newsStore';
import { expect, it } from 'vitest';
import { mountNews } from '../server/routes/news';
import { getNewsIndex } from '../server/services/news/newsStore';
const app = express(); mountNews(app);
const server = app.listen(0, '127.0.0.1');
beforeAll(async () => { if (!server.listening) await once(server, 'listening'); });
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
const request = (_app: typeof app) => ({ get: (path: string) => ({ expect: async (status: number) => {
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Missing test server');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  expect(response.status).toBe(status);
  return { headers: Object.fromEntries(response.headers), body: await response.json() };
} }) });
it('serves the morning edition and the previously broken special at permanent IDs', async () => {
  for (const id of ['2026-11-02-evening-arc-2', '2026-11-02-morning-arc-3', '2026-10-31-saturday-nvbanana-grandmasters']) {
    const result = await request(app).get(`/api/news/stories/${id}`).expect(200);
    expect(result.headers['cache-control']).toBe('public, max-age=60');
    expect([...result.body.articles, ...result.body.dispatches].some(story => story.id === id)).toBe(true);
  }
});
it('returns an uncached 404 for an actually absent ID', async () => {
  const result = await request(app).get('/api/news/stories/does-not-exist').expect(404);
  expect(result.headers['cache-control']).toBe('no-store');
});
it('keeps a reserved feature with its edition', async () => {
  const edition = getNewsIndex().articles.find(item => item.frontPageFeatureId);
  expect(edition).toBeDefined();
  const result = await request(app).get(`/api/news/stories/${edition!.id}`).expect(200);
  expect(result.body.dispatches.some((item: { id: string }) => item.id === edition!.frontPageFeatureId)).toBe(true);
});

it('reports a rejected publication as a loading failure rather than an unpublished story', async () => {
  const archive = newsStore.loadNewsArchive();
  const spy = vi.spyOn(newsStore, 'loadNewsArchive').mockReturnValueOnce({ ...archive, skipped: [{ file: 'articles/broken-story.json', reason: 'invalid publication' }] });
  try {
    const result = await request(app).get('/api/news/stories/broken-story').expect(503);
    expect(result.body.code).toBe('story-load-failed');
  } finally { spy.mockRestore(); }
});
