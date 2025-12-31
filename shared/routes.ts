/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-30
 * PURPOSE: Centralized route meta tags configuration for social media link unfurling.
 *          Imported by server middleware for meta tag injection.
 * SRP/DRY check: Pass - Single source of truth for route meta tags
 */

export interface RouteMetaTags {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
}

/**
 * Route meta tags for link unfurling (Discord, Twitter, Slack, etc.)
 * Organized by feature area - add new routes near related routes
 */
export const ROUTE_META_TAGS: Record<string, RouteMetaTags> = {
  // ==================== RE-ARC Benchmark ====================
  '/re-arc': {
    title: 'RE-ARC Bench - Test Your ARC Solver',
    description: 'Generate fresh ARC puzzles and evaluate your solver with verifiable results',
    url: 'https://arc.markbarney.net/re-arc',
    type: 'website',
  },

  '/re-arc/leaderboard': {
    title: 'RE-ARC Bench Leaderboard',
    description: 'Generate fresh ARC puzzles and evaluate your solver with verifiable results',
    url: 'https://arc.markbarney.net/re-arc/leaderboard',
    type: 'website',
  },

  // ==================== Future Routes ====================
  // '/puzzle/:id': dynamic meta tags based on puzzle data
  // '/debate/:id': dynamic meta tags based on debate data
  // '/worm-arena/live/:id': dynamic meta tags for live matches
  // '/analytics': analytics dashboard meta tags
};