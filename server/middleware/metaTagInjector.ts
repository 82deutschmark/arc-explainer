/**
 * Author: Codex (GPT-6), with existing contributors
 * Date: 2026-09-12
 * PURPOSE: Middleware for injecting route-specific meta tags for link unfurling.
 *          Now supports dynamic puzzle routes with OG image generation.
 * SRP/DRY check: Pass - Single responsibility: meta tag injection. No duplication found.
 */

import { Request, Response, NextFunction } from 'express';
import { publicGameId } from '../../shared/arc3PublicIds.js';
import fs from 'fs';
import path from 'path';
import { ROUTE_META_TAGS, ROOT_META_BY_HOST, RouteMetaTags } from '../../shared/routes.js';
import { getGameById } from '../../shared/arc3Games/index.js';
import { puzzleLoader } from '../services/puzzleLoader.js';
import { logger } from '../utils/logger.js';

// Pattern for matching puzzle routes: /puzzle/:taskId or /puzzle/:taskId/...
const PUZZLE_ROUTE_PATTERN = /^\/puzzle\/([a-f0-9]{8})(?:\/.*)?$/i;

// ARC-AGI-3 community task pages: /arc3/play/:gameId
const ARC3_PLAY_PATTERN = /^\/arc3\/play\/([A-Za-z0-9_.-]{1,64})$/;

// Official-game explainer pages: /arc3/games/:gameId. Note this is the OPPOSITE surface to
// /arc3/play above -- that one unfurls a task to be met blind and says nothing about it,
// this one is the write-up and is meant to advertise exactly what the game is.
const ARC3_GAME_PAGE_PATTERN = /^\/arc3\/games\/([A-Za-z0-9_-]{2,16})$/;

// Base URL for generating absolute URLs
const BASE_URL = process.env.BASE_URL || 'https://arc.markbarney.net';

/**
 * Escape a value going into a double-quoted HTML attribute.
 *
 * Applied to the ARC3 game strings below because they come from the shared registry and
 * are written as prose -- a description with a quotation mark in it would otherwise close
 * the attribute early and drop the rest of the tag. Deliberately NOT applied inside
 * generateMetaTags: the hand-written entries in shared/routes.ts may already contain
 * entities, and escaping those again would render a literal `&amp;` to readers.
 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  const host = (req.hostname || '').toLowerCase();

  // "/" renders a different page per host, so it cannot be described by a single entry:
  // arc3.markbarney.net is the synthetic-programme landing, arc.markbarney.net leads
  // with the task gallery. Without this, sharing either host unfurled as the other.
  let routeMetaTags: RouteMetaTags | null | undefined =
    requestPath === '/' ? ROOT_META_BY_HOST[host] : undefined;

  // Then static route meta tags
  if (!routeMetaTags) routeMetaTags = ROUTE_META_TAGS[requestPath];

  // Then a community task, which unfurls with its own opening frame.
  if (!routeMetaTags) {
    const playMatch = requestPath.match(ARC3_PLAY_PATTERN);
    if (playMatch) {
      const gameId = publicGameId(playMatch[1]);
      routeMetaTags = {
        title: `${gameId.toUpperCase()} — an ARC-AGI-3 task`,
        description:
          // No score AND no claim about AI here on purpose -- see ROOT_META_BY_HOST in
          // shared/routes.ts. Meta strings are the stalest copy on the site: nobody reads
          // them in review, so a frontier number is wrong within weeks and a claim about
          // what AI can't do is wrong within months. This one said "very hard for the best
          // AI" until 07-Sep-2026, well after the landing page dropped the same sentence.
          'Explore an interactive ARC-AGI-3 puzzle. '
          + 'Five minutes, no account.',
        url: `https://${host || 'arc.markbarney.net'}/arc3/play/${gameId}`,
        image: `${BASE_URL}/api/arc3-mirror/games/${encodeURIComponent(gameId)}/thumbnail?size=512`,
        type: 'article',
      };
    }
  }

  // Then an official game's write-up, which unfurls with a frame from the game itself.
  if (!routeMetaTags) {
    const gamePageMatch = requestPath.match(ARC3_GAME_PAGE_PATTERN);
    if (gamePageMatch) {
      const gameId = gamePageMatch[1].toLowerCase();
      const game = getGameById(gameId);
      // An unknown id falls through to the site default rather than unfurling a page that
      // renders "game not found".
      if (game) {
        const name = game.informalName || game.gameId;
        routeMetaTags = {
          title: escapeAttribute(`${name} (${game.gameId}) - ARC-AGI-3 game mechanics`),
          description: escapeAttribute(game.description),
          url: `https://${host || 'arc.markbarney.net'}/arc3/games/${gameId}`,
          // The game's own level-1 frame, framed to 1200x630 -- see
          // server/services/arc3/arc3GameOgImageService.ts. The raw 256px PNG would unfurl
          // as a thumbnail.
          image: `${BASE_URL}/api/arc3/og-image/${gameId}`,
          type: 'article',
        };
      }
    }
  }

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
