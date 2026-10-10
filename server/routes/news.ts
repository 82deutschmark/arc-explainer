/**
 * Author: GPT-6.1 Sol / Codex; Claude Opus 5.5 (Bubba)
 * Date: 2026-10-07; 08-October-2026; 10-October-2026
 * PURPOSE: Read-only public archive and immutable reporting evidence for ARC Daily.
 *          08-Oct-2026: serves the newspaper's share cards (newsCardImage.ts). Article
 *          card URLs carry a content version (shared/news.ts articleCardPath), so they are
 *          cached as immutable; the section card follows the day and the latest editions, so
 *          it is not (pages advertise it under a version that changes with them).
 *          09-Oct-2026 (Claude Opus 5.5): GET /api/news/markets, the live market digest of both
 *          boards for the front page and the wire desk (services/news/newsMarkets.ts), and each
 *          wire story's immutable evidence at /api/news/wire/:id/evidence.
 * SRP/DRY check: Pass — all publication is via reviewed git data; no public write API.
 */
import type { Express, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getNewsIndex, NEWS_DIRECTORY, WIRE_ID } from '../services/news/newsStore';
import { newsRss } from '../services/news/newsPresentation';
import { buildArticleCard, buildSectionCard } from '../services/news/newsCardImage';
import { marketsResponse } from '../services/news/newsMarkets';
const sendCard = (res: Response, card: Buffer | null, cacheControl: string) => card
  ? res.type('image/png').set('Cache-Control', cacheControl).send(card)
  : res.status(404).set('Cache-Control', 'no-store').json({ error: 'Preview image not found' });
export function mountNews(app: Express) {
  app.get('/api/news', (_req, res, next) => {
    try { res.set('Cache-Control', 'public, max-age=60').json(getNewsIndex()); } catch (error) { next(error); }
  });
  // Live market digest for the front page and the wire desk; a board that was never pushed is left out.
  app.get('/api/news/markets', async (req, res, next) => {
    try {
      const payload = await marketsResponse();
      res.set('Cache-Control', 'public, max-age=120').set('Vary', 'Accept-Encoding').type('application/json; charset=utf-8');
      if (/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) return res.set('Content-Encoding', 'gzip').send(payload.gzip);
      return res.send(payload.raw);
    } catch (error) { next(error); }
  });
  app.get('/api/news/og-image.png', async (_req, res, next) => {
    try { sendCard(res, await buildSectionCard(), 'public, max-age=3600'); } catch (error) { next(error); }
  });
  app.get('/api/news/og-image/:id.png', async (req, res, next) => {
    try { sendCard(res, await buildArticleCard(req.params.id), 'public, max-age=31536000, immutable'); } catch (error) { next(error); }
  });
  app.get('/api/news/:id/evidence', (req, res, next) => {
    try {
      if (!getNewsIndex().articles.some(article => article.id === req.params.id)) return res.status(404).json({ error: 'Article not found' });
      const file = path.join(NEWS_DIRECTORY, 'evidence', `${req.params.id}.json`);
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Reporting evidence not found' });
      res.set('Cache-Control', 'public, max-age=3600').type('json').send(fs.readFileSync(file, 'utf8'));
    } catch (error) { next(error); }
  });
  app.get('/api/news/wire/:id/evidence', (req, res, next) => {
    try {
      // Every published story keeps its evidence, including stories older than the index's week.
      const id = String(req.params.id);
      if (!WIRE_ID.test(id) || !fs.existsSync(path.join(NEWS_DIRECTORY, 'wire', `${id}.json`))) return res.status(404).json({ error: 'Wire story not found' });
      const file = path.join(NEWS_DIRECTORY, 'wire-evidence', `${id}.json`);
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Reporting evidence not found' });
      res.set('Cache-Control', 'public, max-age=3600').type('json').send(fs.readFileSync(file, 'utf8'));
    } catch (error) { next(error); }
  });
  app.get('/news/feed.xml', (_req, res, next) => {
    try { res.set('Cache-Control', 'public, max-age=300').type('application/rss+xml').send(newsRss()); } catch (error) { next(error); }
  });
}
