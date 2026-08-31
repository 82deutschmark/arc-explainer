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
  // ==================== ARC-AGI-3 ====================
  // Keyed by host for "/" because the root differs per host: arc3.markbarney.net is the
  // synthetic-programme landing, arc.markbarney.net leads with the task gallery.
  '/arc3/gallery': {
    title: 'ARC-AGI-3 Tasks — play one, no instructions',
    description:
      'Interactive reasoning tasks that explain nothing. Humans solve these; the best AI '
      + 'scores 0.50%. Pick one and work out what it does.',
    url: 'https://arc.markbarney.net/arc3/gallery',
    image: 'https://arc.markbarney.net/api/arc3-mirror/games/ls20-9607627b/thumbnail?size=512',
    type: 'website',
  },

  '/arc3/upload': {
    title: 'Submit an ARC-AGI-3 task',
    description:
      'Contribute a task to the community set: one Python file on the official ARCEngine, '
      + 'reviewed before it goes live.',
    url: 'https://arc.markbarney.net/arc3/upload',
    type: 'website',
  },

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
  // Dynamic per-task meta (/arc3/play/:gameId) is generated in the injector so each
  // task unfurls with its own opening frame.
  // '/puzzle/:id': dynamic meta tags based on puzzle data
  // '/debate/:id': dynamic meta tags based on debate data
  // '/worm-arena/live/:id': dynamic meta tags for live matches
  // '/analytics': analytics dashboard meta tags
};
/**
 * Meta for "/" by host. The root renders a different page per host, so one entry in
 * ROUTE_META_TAGS cannot describe it: sharing arc3.markbarney.net must not unfurl as the
 * gallery, and vice versa.
 */
export const ROOT_META_BY_HOST: Record<string, RouteMetaTags> = {
  'arc3.markbarney.net': {
    title: 'Humans solve these. The best AI scores half a percent.',
    description:
      'Synthetic ARC-AGI-3 tasks: little games that explain nothing. No instructions, no '
      + 'goal, no controls listed — work it out. Five minutes, no account.',
    url: 'https://arc3.markbarney.net/',
    image: 'https://arc.markbarney.net/api/arc3-mirror/games/ls20-9607627b/thumbnail?size=512',
    type: 'website',
  },
};
