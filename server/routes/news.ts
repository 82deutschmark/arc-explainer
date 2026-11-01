/**
 * Author: GPT-6 / Codex; GPT-6.1 Sol / Codex; Claude Opus 5.5 (Bubba); Claude Sonnet 5.5
 * Date: 2026-10-30 (2026-10-29; 08-October-2026; 10-October-2026 earlier)
 * PURPOSE: Read-only Card Cabinet, landscape link previews, downloadable front/back collectibles,
 *          public archive and immutable reporting evidence for ARC Daily.
 *          08-Oct-2026: serves the newspaper's share cards (newsCardImage.ts). Article
 *          card URLs carry a content version (shared/news.ts articleCardPath), so they are
 *          cached as immutable; the section card follows the day and the latest editions, so
 *          it is not (pages advertise it under a version that changes with them).
 *          09-Oct-2026 (Claude Opus 5.5): GET /api/news/markets, the live market digest of both
 *          boards for the front page and the wire desk (services/news/newsMarkets.ts), and each
 *          wire story's immutable evidence at /api/news/wire/:id/evidence.
 *          15-Oct-2026 (Claude Opus 5.5 Max): GET /api/news/health lists any news file or ledger
 *          record the store left out, for the desk watchdog's Discord alert.
 *          30-Oct-2026 (Claude Sonnet 5.5 Low): card image, thumbnail and share routes pass the collection to the new cardFace pipeline.
 *          30-Oct-2026 (Claude Sonnet 5.5 Medium): the thumbnail route takes its width limits from the renderer instead of repeating them.
 * SRP/DRY check: Pass — all publication is via reviewed git data; no public write API.
 */
import type { Express, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getNewsIndex, loadNewsArchive, NEWS_DIRECTORY, WIRE_ID } from '../services/news/newsStore';
import { newsRss } from '../services/news/newsPresentation';
import { buildArticleCard, buildSectionCard } from '../services/news/newsCardImage';
import { marketsResponse } from '../services/news/newsMarkets';
import { getNewsCollection } from '../services/news/newsCollection';
import { buildCollectionCardImage, buildCollectionCardThumb } from '../services/news/newsCollectionImage';
import { buildCollectionShareImage } from '../services/news/newsCollectionShareImage';
import { THUMB_MIN_WIDTH, THUMB_MAX_WIDTH } from '../services/news/cardFace';
import { collectionSharePath, collectionShareVersion } from '../../shared/newsCollection';
const sendCard = (res: Response, card: Buffer | null, cacheControl: string) => card
  ? res.type('image/png').set('Cache-Control', cacheControl).send(card)
  : res.status(404).set('Cache-Control', 'no-store').json({ error: 'Preview image not found' });
export function mountNews(app: Express) {
  app.get('/api/news/cards', (_req, res, next) => {
    try { res.set('Cache-Control', 'public, max-age=60').json(getNewsCollection()); } catch (error) { next(error); }
  });
  app.get('/api/news/cards/:id/share.png', async (req, res, next) => {
    try {
      const collection = getNewsCollection();
      const card = collection.cards.find(item => item.id === req.params.id);
      if (!card) return res.status(404).set('Cache-Control', 'no-store').json({ error: 'Collection share image not found' });
      const version = collectionShareVersion(card);
      if (req.query.v && req.query.v !== version) return res.set('Cache-Control', 'no-store').redirect(302, collectionSharePath(card));
      return res.type('image/png').set('Content-Disposition', `inline; filename="${card.id}-share.png"`)
        .set('Cache-Control', req.query.v === version ? 'public, max-age=31536000, immutable' : 'public, max-age=60')
        .send(await buildCollectionShareImage(card, collection));
    } catch (error) { next(error); }
  });
  app.get('/api/news/cards/:id/image.png', async (req, res, next) => {
    try {
      const side = req.query.side ?? 'front';
      if (side !== 'front' && side !== 'back') return res.status(400).json({ error: 'Card side must be front or back' });
      const collection = getNewsCollection();
      const card = collection.cards.find(item => item.id === req.params.id);
      if (!card) return res.status(404).json({ error: 'Collection card not found' });
      return res.type('image/png').set('Cache-Control', 'public, max-age=60')
        .set('Content-Disposition', `attachment; filename="${card.id}${side === 'back' ? '-back' : ''}.png"`).send(await buildCollectionCardImage(card, collection, side));
    } catch (error) { next(error); }
  });
  // Small WebP of a card face for the Cabinet grid. The address carries the card's content version, so a
  // matching version is cached as immutable and a stale one is sent to the current address.
  app.get('/api/news/cards/:id/thumb.webp', async (req, res, next) => {
    try {
      const side = req.query.side ?? 'front';
      if (side !== 'front' && side !== 'back') return res.status(400).json({ error: 'Card side must be front or back' });
      const width = Math.min(THUMB_MAX_WIDTH, Math.max(THUMB_MIN_WIDTH, Number.parseInt(String(req.query.w ?? '360'), 10) || 360));
      const collection = getNewsCollection();
      const card = collection.cards.find(item => item.id === req.params.id);
      if (!card) return res.status(404).json({ error: 'Collection card not found' });
      const version = collectionShareVersion(card);
      const fresh = req.query.v === version;
      return res.type('image/webp').set('Cache-Control', fresh ? 'public, max-age=31536000, immutable' : 'public, max-age=60')
        .send(await buildCollectionCardThumb(card, collection, side, width, version));
    } catch (error) { next(error); }
  });
  app.get('/api/news/cards/:id', (req, res, next) => {
    try {
      const card = getNewsCollection().cards.find(item => item.id === req.params.id);
      return card ? res.set('Cache-Control', 'public, max-age=60').json(card) : res.status(404).json({ error: 'Collection card not found' });
    } catch (error) { next(error); }
  });
  app.get('/api/news', (_req, res, next) => {
    try { res.set('Cache-Control', 'public, max-age=60').json(getNewsIndex()); } catch (error) { next(error); }
  });
  // What the site is leaving out right now. The Mac Mini's desk watchdog
  // (bubba-workspace/tools/arc_daily_announce.py) reads this and raises it in Discord.
  app.get('/api/news/health', (_req, res, next) => {
    try {
      const { index, skipped } = loadNewsArchive();
      res.set('Cache-Control', 'no-store').json({
        status: skipped.length ? 'degraded' : 'ok', checkedAt: new Date().toISOString(), skipped,
        counts: { articles: index.articles.length, dispatches: index.dispatches?.length ?? 0, wire: index.wire?.length ?? 0, people: index.people?.length ?? 0 },
      });
    } catch (error) { next(error); }
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
