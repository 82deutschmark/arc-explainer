/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Read-only public archive and immutable reporting evidence for ARC Daily.
 * SRP/DRY check: Pass — all publication is via reviewed git data; no public write API.
 */
import type { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getNewsIndex, NEWS_DIRECTORY } from '../services/news/newsStore';
import { newsRss } from '../services/news/newsPresentation';
export function mountNews(app: Express) {
  app.get('/api/news', (_req, res, next) => {
    try { res.set('Cache-Control', 'public, max-age=60').json(getNewsIndex()); } catch (error) { next(error); }
  });
  app.get('/api/news/:id/evidence', (req, res, next) => {
    try {
      if (!getNewsIndex().articles.some(article => article.id === req.params.id)) return res.status(404).json({ error: 'Article not found' });
      const file = path.join(NEWS_DIRECTORY, 'evidence', `${req.params.id}.json`);
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Reporting evidence not found' });
      res.set('Cache-Control', 'public, max-age=3600').type('json').send(fs.readFileSync(file, 'utf8'));
    } catch (error) { next(error); }
  });
  app.get('/news/feed.xml', (_req, res, next) => {
    try { res.set('Cache-Control', 'public, max-age=300').type('application/rss+xml').send(newsRss()); } catch (error) { next(error); }
  });
}
