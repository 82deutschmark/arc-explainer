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
import { Router, Route } from 'wouter';
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
app.get(['/__goose-layout', '/news/:articleId'], async (req, res, next) => {
  try {
    const { NewsPaper, StoryPreview, NewsBrandContext } = await vite.ssrLoadModule('/src/components/news/NewsDesk.tsx');
    const index = getNewsIndex(), cardData = getNewsCollection();
    const filings = ['arc-3', 'arc-2'].map(contest => JSON.parse(fs.readFileSync(path.join(root, 'docs/newsroom/2026-11-02-late-edition-filing', `${contest}-article.json`), 'utf8')));
    const article = req.params.articleId ? filings.find(story => story.id === req.params.articleId) : filings[0];
    if (!article) return next();
    const query = new QueryClient(); query.setQueryData(['/api/news/cards'], cardData);
    const previewIndex = { ...index, articles: [...filings, ...index.articles] };
    query.setQueryData(['/api/news'], previewIndex);
    filings.forEach(story => query.setQueryData(['/api/news/stories', story.id], previewIndex));
    const { default: ArticlePage } = await vite.ssrLoadModule('/src/pages/NewsArticle.tsx');
    const brand = { name: preparedBrand.name, logo: preparedBrand.logo, banner: preparedBrand.banner, tagline: preparedBrand.tagline, goose: true };
    const front = React.createElement(NewsPaper, { frontPage: true, date: article.date, brand,
      children: React.createElement(React.Fragment, null,
        ...filings.map((story, position) => React.createElement(StoryPreview, { key: story.id, article: story, lead: position === 0, sections: 1, people: index.people ?? [] }))) });
    const page = req.params.articleId ? React.createElement(Route, { path: '/news/:articleId', component: ArticlePage }) : front;
    const body = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: query },
      React.createElement(Router, { ssrPath: req.path, children: React.createElement(NewsBrandContext.Provider, { value: brand, children: page }) })));
    res.type('html').send(await vite.transformIndexHtml('/__goose-layout', `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Loose Goose</title><link rel="stylesheet" href="/src/components/news/news.css"></head><body>${body}</body></html>`));
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
