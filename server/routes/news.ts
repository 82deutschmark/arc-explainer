/**
 * Author: GPT-6 / Codex; GPT-6.1 Sol / Codex; Claude Opus 5.5 (Bubba); Claude Sonnet 5.5; Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 02-November-2026 (GPT-6 / Codex: publication and loading states; earlier GPT-6.1 Sol lookup)
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
 *          14-Nov-2026 (Claude Opus 5.5): GET /api/news/wire/:id, one wire story for its permanent page, whatever its age.
 *          14-Nov-2026 (Claude Opus 5.5, card faces): card share and thumbnail versions are computed with the collection
 *          (teammates, shared art, set tier counts, stamp phase), the same key the renderer's memo caches use.
 *          14-Nov-2026 (Claude Opus 5.5, card resilience): share cards answer 503 + no-store when rendering fails (404 only for
 *          a missing article), and an article card with a missing or stale ?v redirects to articleCardPath.
 *          14-Nov-2026 (Claude Opus 5.5, archive-collection): /api/news/health also reports Card Cabinet cards left out, a
 *          failed Cabinet build and a failed board read (status "degraded"); a found story is cached publicly for a
 *          minute, a miss stays no-store.
 * SRP/DRY check: Pass — all publication is via reviewed git data; no public write API.
 */
import { mountNewsHost } from '../services/news/newsHost';
import { mountNewsFonts } from '../services/news/newsFonts';
import type { Express, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getNewsIndex, loadNewsArchive, loadWireStory, NEWS_DIRECTORY, WIRE_ID } from '../services/news/newsStore';
import { newsRss } from '../services/news/newsPresentation';
import { buildArticleCard, buildSectionCard } from '../services/news/newsCardImage';
import { marketsResponse } from '../services/news/newsMarkets';
import { getNewsCollection, newsCollectionHealth } from '../services/news/newsCollection';
import { buildCollectionCardImage, buildCollectionCardThumb } from '../services/news/newsCollectionImage';
import { buildCollectionShareImage } from '../services/news/newsCollectionShareImage';
import { THUMB_MIN_WIDTH, THUMB_MAX_WIDTH } from '../services/news/cardFace';
import { collectionSharePath, collectionShareVersion } from '../../shared/newsCollection';
import { articleCardPath, articleCardVersion } from '../../shared/news';
/** A rendered share card, or a 503 that nobody caches when rendering failed (the card exists; drawing it did not work). */
const sendCard = (res: Response, card: Buffer | null, cacheControl: string) => card
  ? res.type('image/png').set('Cache-Control', cacheControl).send(card)
  : res.status(503).set('Cache-Control', 'no-store').json({ error: 'Preview image could not be rendered' });
export function mountNews(app: Express) {
  mountNewsFonts(app);
  mountNewsHost(app);
  app.get('/api/news/cards', (_req, res, next) => {
    try { res.set('Cache-Control', 'public, max-age=60').json(getNewsCollection()); } catch (error) { next(error); }
  });
  app.get('/api/news/cards/:id/share.png', async (req, res, next) => {
    try {
      const collection = getNewsCollection();
      const card = collection.cards.find(item => item.id === req.params.id);
      if (!card) return res.status(404).set('Cache-Control', 'no-store').json({ error: 'Collection share image not found' });
      const version = collectionShareVersion(card, collection);
      if (req.query.v && req.query.v !== version) return res.set('Cache-Control', 'no-store').redirect(302, collectionSharePath(card, collection));
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
      const version = collectionShareVersion(card, collection);
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
  // Permanent links resolve both editions and specials directly, independently of the
  // browser's cached front page. A miss is never cached across a deployment.
  app.get('/api/news/stories/:id', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      const { index, skipped } = loadNewsArchive();
      const article = index.articles.find(item => item.id === req.params.id);
      const dispatch = index.dispatches?.find(item => item.id === req.params.id);
      if (!article && !dispatch) {
        // A rejected publication exists: report a service failure, never call it unpublished.
        const rejected = skipped.some(item => ['articles', 'dispatches'].some(folder => item.file === `${folder}/${req.params.id}.json`));
        return rejected
          ? res.status(503).json({ code: 'story-load-failed', error: 'The published story could not be loaded' })
          : res.status(404).json({ code: 'story-not-published', error: 'No story has been published at this address' });
      }
      const related = index.articles.filter(item => item.id !== article?.id)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8);
      // A published story changes only by a revision; a minute of public caching spares the archive read.
      return res.set('Cache-Control', 'public, max-age=60').json({
        articles: article ? [article, ...related] : related,
        dispatches: (index.dispatches ?? []).filter(item => item.id === dispatch?.id || item.id === article?.frontPageFeatureId),
        competitors: index.competitors.filter(item => article?.competition === item.competition && article.teamIds.includes(item.teamId)),
        people: index.people ?? [],
      });
    } catch (error) { next(error); }
  });
  // What the site is leaving out right now. The Mac Mini's desk watchdog
  // (bubba-workspace/tools/arc_daily_announce.py) reads this and raises it in Discord.
  app.get('/api/news/health', (_req, res, next) => {
    try {
      const { index, skipped: archiveSkipped } = loadNewsArchive();
      // The Card Cabinet is built from the same files: cards it left out join the list, and a failed build or
      // board read is a problem of its own. Any of them makes the paper "degraded".
      const cards = newsCollectionHealth();
      const skipped = [...archiveSkipped, ...cards.skipped];
      const problems = [cards.error, cards.boards].filter((problem): problem is string => !!problem);
      res.set('Cache-Control', 'no-store').json({
        status: skipped.length || problems.length ? 'degraded' : 'ok', checkedAt: new Date().toISOString(), skipped, problems,
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
  // 404 only for an article that does not exist; a missing or stale ?v goes to the current address (as share.png does),
  // so only a matching version is ever served as immutable.
  app.get('/api/news/og-image/:id.png', async (req, res, next) => {
    try {
      const article = getNewsIndex().articles.find(item => item.id === req.params.id);
      if (!article) return res.status(404).set('Cache-Control', 'no-store').json({ error: 'Article not found' });
      if (req.query.v !== articleCardVersion(article)) return res.set('Cache-Control', 'no-store').redirect(302, articleCardPath(article));
      return sendCard(res, await buildArticleCard(article), 'public, max-age=31536000, immutable');
    } catch (error) { next(error); }
  });
  app.get('/api/news/:id/evidence', (req, res, next) => {
    try {
      if (!getNewsIndex().articles.some(article => article.id === req.params.id)) return res.status(404).json({ error: 'Article not found' });
      const file = path.join(NEWS_DIRECTORY, 'evidence', `${req.params.id}.json`);
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Reporting evidence not found' });
      res.set('Cache-Control', 'public, max-age=3600').type('json').send(fs.readFileSync(file, 'utf8'));
    } catch (error) { next(error); }
  });
  // A wire story's permanent page reads it here, so links keep working after it leaves the index's week.
  // The payload is NewsIndex-shaped (the story plus the people and teams it names) for WireStory.
  app.get('/api/news/wire/:id', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      const { story, rejected } = loadWireStory(String(req.params.id));
      if (!story) return rejected
        ? res.status(503).json({ code: 'story-load-failed', error: 'The published wire story could not be loaded' })
        : res.status(404).json({ code: 'story-not-published', error: 'No wire story has been published at this address' });
      const index = getNewsIndex();
      return res.json({
        articles: [], wire: [story],
        competitors: index.competitors.filter(record => record.competition === story.competition && story.teamIds.includes(record.teamId)),
        people: (index.people ?? []).filter(person => story.personIds.includes(person.id)),
      });
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
