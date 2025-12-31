/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-30
 * PURPOSE: Middleware for injecting route-specific meta tags for link unfurling
 * SRP/DRY check: Pass - Single responsibility: meta tag injection. No duplication found.
 */

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { ROUTE_META_TAGS, RouteMetaTags } from '../../shared/routes.js';

/**
 * Generate meta description, title, Open Graph and Twitter Card meta tags HTML
 */
function generateMetaTags(tags: RouteMetaTags): string {
  return `
    <meta name="description" content="${tags.description}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${tags.type || 'website'}" />
    <meta property="og:url" content="${tags.url}" />
    <meta property="og:title" content="${tags.title}" />
    <meta property="og:description" content="${tags.description}" />
    ${tags.image ? `<meta property="og:image" content="${tags.image}" />` : ''}

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${tags.url}" />
    <meta property="twitter:title" content="${tags.title}" />
    <meta property="twitter:description" content="${tags.description}" />
    ${tags.image ? `<meta property="twitter:image" content="${tags.image}" />` : ''}

    <title>${tags.title}</title>
  `.trim();
}

/**
 * Inject meta tags into HTML string based on request path
 */
export function injectMetaTagsIntoHtml(html: string, requestPath: string): string {
  // Check if this route has custom meta tags
  const routeMetaTags = ROUTE_META_TAGS[requestPath];

  // Return unchanged if no custom meta tags for this route
  if (!routeMetaTags) {
    return html;
  }

  // Generate and inject meta tags, replacing the entire default section
  const metaTags = generateMetaTags(routeMetaTags);
  const metaTagRegex = /<!-- META_TAGS_START -->[\s\S]*?<!-- META_TAGS_END -->/;
  return html.replace(metaTagRegex, metaTags);
}

/**
 * Meta tag injection middleware (production only)
 */
export function metaTagInjector(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip in development mode (Vite handles serving)
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  // Check if this route has custom meta tags
  const requestPath = req.path;
  const routeMetaTags = ROUTE_META_TAGS[requestPath];

  // Skip if no custom meta tags for this route
  if (!routeMetaTags) {
    next();
    return;
  }

  // Read the built index.html
  const indexPath = path.join(process.cwd(), 'dist', 'public', 'index.html');

  try {
    let html = fs.readFileSync(indexPath, 'utf-8');

    // Inject meta tags using shared function
    html = injectMetaTagsIntoHtml(html, requestPath);

    // Send the modified HTML
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error injecting meta tags:', error);
    // Fall back to normal behavior
    next();
  }
}

/**
 * Export for testing and documentation
 */
export { generateMetaTags };
