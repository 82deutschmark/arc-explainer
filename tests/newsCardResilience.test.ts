/**
 * Author: Claude Opus 5.5
 * Date: 14-Nov-2026
 * PURPOSE: Share-card failure handling for The Loose Goose (server/routes/news.ts og-image routes and
 *          server/services/news/newsCardImage.ts): a render failure answers 503 + no-store instead of a
 *          404, an article card with a missing or stale ?v redirects to articleCardPath, storing a new
 *          version of an article's card evicts the older one, and a front-page card drawn without its
 *          puzzle because puzzle loading failed is not cached. satori is wrapped (real renderer, counted
 *          calls, switchable failure) and the puzzle loader can be made to throw; everything else is the
 *          production store, routes and renderer.
 * SRP/DRY check: Pass — reuses mountNews, getNewsIndex and articleCardPath; no duplicate card logic.
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const control = vi.hoisted(() => ({ renders: 0, failRender: false, failPuzzle: false }));

vi.mock('satori', async importOriginal => {
  const actual = await importOriginal<typeof import('satori')>();
  return {
    default: (...args: Parameters<typeof actual.default>) => {
      control.renders++;
      return control.failRender ? Promise.reject(new Error('simulated renderer failure')) : actual.default(...args);
    },
  };
});
vi.mock('../server/services/puzzleLoader', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/services/puzzleLoader')>();
  const loader = actual.puzzleLoader;
  return {
    ...actual,
    puzzleLoader: new Proxy(loader, {
      get(target, property, receiver) {
        if (property === 'getPuzzleList' && control.failPuzzle) return () => { throw new Error('simulated puzzle load failure'); };
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
  };
});

import { mountNews } from '../server/routes/news';
import { getNewsIndex } from '../server/services/news/newsStore';
import { buildArticleCard, buildSectionCard } from '../server/services/news/newsCardImage';
import { articleCardPath, articleCardVersion } from '../shared/news';

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  mountNews(app);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Missing listener');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => { control.renders = 0; control.failRender = false; control.failPuzzle = false; });

const articles = () => getNewsIndex().articles;

it('answers 503 + no-store, not 404, when an existing card fails to render, and 404 only for a missing article', async () => {
  control.failRender = true;
  const article = articles()[articles().length - 1];
  const failed = await fetch(`${base}${articleCardPath(article)}`);
  expect(failed.status).toBe(503);
  expect(failed.headers.get('cache-control')).toBe('no-store');
  const section = await fetch(`${base}/api/news/og-image.png`);
  expect(section.status).toBe(503);
  expect(section.headers.get('cache-control')).toBe('no-store');
  expect((await fetch(`${base}/api/news/og-image/not-an-issue.png`)).status).toBe(404);
  // A failed render is never stored: the next request draws and serves the card.
  control.failRender = false;
  const recovered = await fetch(`${base}${articleCardPath(article)}`);
  expect(recovered.status).toBe(200);
  expect(recovered.headers.get('cache-control')).toContain('immutable');
}, 60_000);

it("redirects a missing or stale ?v to the article card's current address without caching the redirect", async () => {
  const article = articles()[0];
  for (const query of ['', '?v=stale']) {
    const response = await fetch(`${base}/api/news/og-image/${article.id}.png${query}`, { redirect: 'manual' });
    expect(response.status, query).toBe(302);
    expect(response.headers.get('location'), query).toBe(articleCardPath(article));
    expect(response.headers.get('cache-control'), query).toBe('no-store');
  }
});

it('keeps one cached version per article: storing a newer version evicts the older one', async () => {
  const original = articles()[1];
  const edited = { ...original, headline: `${original.headline} (corrected)` };
  expect(articleCardVersion(edited)).not.toBe(articleCardVersion(original));
  await buildArticleCard(original);
  const afterFirst = control.renders;
  await buildArticleCard(original);
  expect(control.renders).toBe(afterFirst); // a hit
  await buildArticleCard(edited);
  expect(control.renders).toBe(afterFirst + 1);
  await buildArticleCard(original); // evicted when the edited version was stored, so drawn again
  expect(control.renders).toBe(afterFirst + 2);
}, 60_000);

it('does not cache a front-page card drawn without its puzzle because the puzzle failed to load', async () => {
  const now = Date.parse('2031-03-03T12:00:00Z');
  control.failPuzzle = true;
  expect(await buildSectionCard(now)).not.toBeNull();
  expect(await buildSectionCard(now)).not.toBeNull();
  expect(control.renders).toBe(2); // neither puzzle-less card was kept
  control.failPuzzle = false;
  await buildSectionCard(now);
  await buildSectionCard(now);
  expect(control.renders).toBe(3); // the complete card is drawn once and then served from memory
}, 60_000);
