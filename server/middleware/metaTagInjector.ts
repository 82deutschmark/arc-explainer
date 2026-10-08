/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Serve canonical URLs, generated sitemap, accurate HTTP status and initial
 *          HTML metadata/content for the SPA. Uses the same policy as client navigation.
 *          08-Oct-2026 (Claude Opus 5.5): social tags come from shared socialMetaEntries().
 * SRP/DRY check: Pass — page content and shared SEO policy live in their own modules.
 */
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RouteMetaTags } from '../../shared/routes';
import { breadcrumbsHtml, completeMeta, discoveryHtml, escapeHtml as esc, INDEX_ROBOTS, normalizePath, redirectPath, socialMetaEntries, structuredData } from '../../shared/seo';
import { generateSitemap, resolvePageMeta } from '../services/seo/pageContent';

export function generateMetaTags(input: RouteMetaTags): string {
  const tags = completeMeta(input);
  const meta = (name: string, content: string, property = false) => `<meta ${property ? 'property' : 'name'}="${name}" content="${esc(content)}" />`;
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  // The bootstrap contains metadata only, never a duplicate of the full page HTML.
  const { bodyHtml, ...bootstrap } = tags;
  return [
    `<title>${esc(tags.title)}</title>`, meta('description', tags.description),
    `<link rel="canonical" href="${esc(tags.url)}" />`,
    meta('robots', tags.noindex ? 'noindex,follow' : INDEX_ROBOTS),
    ...socialMetaEntries(tags).map(([attribute, name, content]) => meta(name, content, attribute === 'property')),
    `<script id="page-structured-data" type="application/ld+json">${json(structuredData(tags))}</script>`,
    `<script id="page-meta" type="application/json">${json(bootstrap)}</script>`,
  ].join('\n    ');
}
export function injectPageHtml(html: string, tags: RouteMetaTags): string {
  const body = tags.bodyHtml || `<main><h1>${esc(tags.title.replace(/ \| ARC Explainer$/, ''))}</h1><p>${esc(tags.description)}</p></main>`;
  return html.replace(/<!-- META_TAGS_START -->[\s\S]*?<!-- META_TAGS_END -->/, () => generateMetaTags(tags))
    .replace('<div id="root"></div>', () => `<div id="root">${breadcrumbsHtml(tags)}${body}${discoveryHtml()}</div>`);
}
export function injectMetaTagsIntoHtml(html: string, requestPath: string): string {
  return injectPageHtml(html, resolvePageMeta(redirectPath(requestPath) || normalizePath(requestPath)).tags);
}
/** Must run before express.static: aliases and sitemap cannot be shadowed by old files. */
export function seoRouting(req: Request, res: Response, next: NextFunction): void {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  const route = normalizePath(req.path);
  if (route === '/sitemap.xml') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(generateSitemap());
    return;
  }
  if (req.path.startsWith('/api/') || req.path.startsWith('/human-arc')) return next();
  const target = redirectPath(route);
  if (target || (route !== req.path && !path.extname(route))) {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(308, `${target || route}${query}`);
    return;
  }
  next();
}
export async function metaTagInjector(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!['GET', 'HEAD'].includes(req.method) || req.path === '/api' || req.path.startsWith('/api/')) return next();
  try {
  const { tags, status } = resolvePageMeta(normalizePath(req.path));
  // Match registered routes first: session/game identifiers may legitimately contain dots.
  // Missing scripts/images must never be answered with a successful HTML shell.
  if (status === 404 && /\.[a-z0-9]+$/i.test(req.path)) {
    res.status(404).set('X-Robots-Tag', 'noindex').type('text').send('Resource not found');
    return;
  }
    const html = await fs.readFile(path.join(process.cwd(), 'dist/public/index.html'), 'utf8');
    res.status(status).set('Cache-Control', 'no-cache');
    if (tags.noindex) res.set('X-Robots-Tag', 'noindex, follow');
    res.type('html').send(injectPageHtml(html, tags));
  } catch (error) {
    // A broken build is a server error, not a generic successful page.
    next(error);
  }
}
