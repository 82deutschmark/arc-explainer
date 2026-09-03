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
      'Interactive reasoning tasks that explain nothing. Easy for a person, very hard for '
      + 'the best AI. Pick one and work out what it does.',
    url: 'https://arc.markbarney.net/arc3/gallery',
    // OUR game, not an official one. This was ls20-9607627b -- an ARC Prize Foundation
    // task -- so every share of this site led with somebody else's work as the picture.
    // g012 is from the reviewed set and has the busiest opening frame of the fifty
    // (10 colours) which is what survives being shrunk to a share-card thumbnail.
    image: 'https://arc.markbarney.net/api/arc3-mirror/games/g012/thumbnail?size=512',
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
 * Meta for "/" by host. Both hosts render the same landing page now, so the copy is
 * shared; only the canonical url differs, which is the whole reason this is still keyed
 * by host rather than folded into ROUTE_META_TAGS.
 */
const ROOT_META: Omit<RouteMetaTags, 'url'> = {
  // Matches the page's H1, and carries no score for the same reason it does not: this
  // string is the Slack unfurl, the search result and the share card, so a number in it
  // is the stalest copy on the site and the hardest to notice has gone stale.
  title: 'Easy for you. Very hard for the best AI in the world.',
  description:
    'Synthetic ARC-AGI-3 tasks: little games that explain nothing. No instructions, no '
    + 'goal, no controls listed — work it out. Five minutes, no account.',
  // See the note on /arc3/gallery above: ours, not the Foundation's.
  image: 'https://arc.markbarney.net/api/arc3-mirror/games/g012/thumbnail?size=512',
  type: 'website',
};

export const ROOT_META_BY_HOST: Record<string, RouteMetaTags> = {
  'arc3.markbarney.net': { ...ROOT_META, url: 'https://arc3.markbarney.net/' },
  'arc.markbarney.net': { ...ROOT_META, url: 'https://arc.markbarney.net/' },
};
