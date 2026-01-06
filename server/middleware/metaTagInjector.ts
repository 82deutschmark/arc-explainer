/**
 * Author: Claude Code using Sonnet 4.5 (updated by Sonnet 4)
 * Date: 2025-12-30 (updated 2026-01-05)
 * PURPOSE: Middleware for injecting route-specific meta tags for link unfurling.
 *          Now supports dynamic puzzle routes with OG image generation.
 * SRP/DRY check: Pass - Single responsibility: meta tag injection. No duplication found.
 */

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { ROUTE_META_TAGS, RouteMetaTags } from '../../shared/routes.js';
import { puzzleLoader } from '../services/puzzleLoader.js';
import { logger } from '../utils/logger.js';

// Pattern for matching puzzle routes: /puzzle/:taskId or /puzzle/:taskId/...
const PUZZLE_ROUTE_PATTERN = /^\/puzzle\/([a-f0-9]{8})(?:\/.*)?$/i;

// Base URL for generating absolute URLs
const BASE_URL = process.env.BASE_URL || 'https://arc.markbarney.net';

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
 * Generate meta tags for dynamic puzzle routes
 */
async function generatePuzzleMetaTags(taskId: string): Promise<RouteMetaTags | null> {
  try {
    const metadata = puzzleLoader.getPuzzleMetadata(taskId);
    if (!metadata) {
      return null;
    }

    const puzzleUrl = `${BASE_URL}/puzzle/${taskId}`;
    const ogImageUrl = `${BASE_URL}/api/og-image/${taskId}`;

    return {
      title: `ARC Puzzle ${taskId} - ARC Explainer`,
      description: `Explore ARC puzzle ${taskId}: ${metadata.source} puzzle with ${metadata.testCaseCount} test case(s). Max grid size: ${metadata.maxGridSize}x${metadata.maxGridSize}.`,
      url: puzzleUrl,
      image: ogImageUrl,
      type: 'article',
    };
  } catch (error) {
    logger.error(`Failed to generate puzzle meta tags for ${taskId}: ${error instanceof Error ? error.message : String(error)}`, 'metaTagInjector');
    return null;
  }
}

/**
 * Inject meta tags into HTML for dynamic puzzle routes
 */
function injectDynamicMetaTags(html: string, tags: RouteMetaTags): string {
  const metaTags = generateMetaTags(tags);
  const metaTagRegex = /<!-- META_TAGS_START -->[\s\S]*?<!-- META_TAGS_END -->/;
  return html.replace(metaTagRegex, metaTags);
}

/**
 * Meta tag injection middleware (production only)
 * Supports both static routes (from ROUTE_META_TAGS) and dynamic puzzle routes
 */
export async function metaTagInjector(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip in development mode (Vite handles serving)
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  const requestPath = req.path;

  // First, check for static route meta tags
  let routeMetaTags: RouteMetaTags | null | undefined = ROUTE_META_TAGS[requestPath];

  // If no static route, check for dynamic puzzle route
  if (!routeMetaTags) {
    const puzzleMatch = requestPath.match(PUZZLE_ROUTE_PATTERN);
    if (puzzleMatch) {
      const taskId = puzzleMatch[1].toLowerCase();
      routeMetaTags = await generatePuzzleMetaTags(taskId);
    }
  }

  // Skip if no meta tags to inject
  if (!routeMetaTags) {
    next();
    return;
  }

  // Read the built index.html
  const indexPath = path.join(process.cwd(), 'dist', 'public', 'index.html');

  try {
    let html = fs.readFileSync(indexPath, 'utf-8');

    // Inject meta tags (use dynamic injection for puzzle routes)
    html = injectDynamicMetaTags(html, routeMetaTags);

    // Send the modified HTML
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error(`Error injecting meta tags: ${error instanceof Error ? error.message : String(error)}`, 'metaTagInjector');
    // Fall back to normal behavior
    next();
  }
}

/**
 * Export for testing and documentation
 */
export { generateMetaTags };
