/**
 * Author: Codex
 * Date: 2026-10-07
 * PURPOSE: Build and serve the independently maintained Human ARC frontend under /human-arc/.
 * SRP/DRY check: Pass — separate build and middleware reuse the existing deployment and navigation.
 */
import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';

/** Mount before the host SPA so both applications keep their own route fallbacks. */
export function mountHumanArc(app: Express, directory = path.resolve('dist/human-arc')) {
  const index = path.join(directory, 'index.html');
  app.get('/human-arc', (req, res, next) => {
    if (req.path.endsWith('/')) return next();
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(308, `/human-arc/${query}`);
  });
  app.use('/human-arc', express.static(directory, {
    index: false,
    setHeaders(res, filename) {
      res.setHeader('Cache-Control', filename.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }));
  app.use('/human-arc', (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/assets/') || path.extname(req.path)) {
      return res.status(404).type('text').send('Human ARC resource not found');
    }
    if (!fs.existsSync(index)) return res.status(503).type('text').send('Human ARC has not been built');
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(index);
  });
}
