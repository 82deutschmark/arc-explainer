/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Preview the real newspaper and its prepared Goose masthead locally,
 * without starting application maintenance or other background services. The
 * proof route exists only in this explicit loopback preview, never production.
 * Vite's growing cache stays on T4. Stop with Ctrl-C after review.
 * SRP/DRY check: Pass — mount the real news APIs and render the existing components.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { mountNews } from '../server/routes/news';
import { getNewsIndex } from '../server/services/news/newsStore';
import { getNewsCollection } from '../server/services/news/newsCollection';
import preparedBrand from '../shared/newsBrand.json';

const root = process.cwd(), t4 = '/Volumes/Team 4TB';
if (!fs.existsSync(t4) || fs.statSync(t4).dev === fs.statSync('/Volumes').dev) throw Error('Mount T4 before running the newspaper preview');
const app = express(), server = createServer(app), port = Number(process.env.NEWS_PREVIEW_PORT ?? 5058);
mountNews(app);
const vite = await createViteServer({ configFile: path.join(root, 'vite.config.ts'),
  cacheDir: path.join(t4, 'loose-goose/vite-cache'), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
app.get('/__goose-layout', async (_req, res, next) => {
  try {
    const { NewsPaper, StoryPreview } = await vite.ssrLoadModule('/src/components/news/NewsDesk.tsx');
    const index = getNewsIndex(), cardData = getNewsCollection(), article = index.articles[0];
    if (!article) throw Error('A real published article is required for the layout proof');
    const query = new QueryClient(); query.setQueryData(['/api/news/cards'], cardData);
    const body = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: query },
      React.createElement(Router, { ssrPath: '/news', children: React.createElement(NewsPaper, {
        frontPage: true, date: article.date, brand: { name: preparedBrand.name, logo: preparedBrand.logo,
          tagline: preparedBrand.tagline, goose: true },
        children: React.createElement(React.Fragment, null,
          React.createElement('p', { className: 'news-muted' }, 'Local layout proof of the prepared masthead. The public rebrand remains disabled until its release checks pass.'),
          React.createElement(StoryPreview, { article, lead: true, sections: article.sections.length, people: index.people ?? [] })),
      }) })));
    res.type('html').send(await vite.transformIndexHtml('/__goose-layout', `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local Goose layout proof</title><link rel="stylesheet" href="/src/components/news/news.css"></head><body>${body}</body></html>`));
  } catch (error) { next(error); }
});
app.use(vite.middlewares);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'This preview serves newspaper APIs only' }); });
app.get('*', async (req, res, next) => {
  try {
    const template = fs.readFileSync(path.join(root, 'client/index.html'), 'utf8');
    res.type('html').send(await vite.transformIndexHtml(req.originalUrl, template));
  } catch (error) { next(error); }
});
server.listen(port, '127.0.0.1', () => console.log(`Newspaper preview: http://127.0.0.1:${port}/news · masthead proof: /__goose-layout`));
process.once('SIGINT', async () => { await vite.close(); server.close(() => process.exit(0)); });
