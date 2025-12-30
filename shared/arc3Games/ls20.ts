/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Game metadata for LS20 (Locksmith).
 * SRP/DRY check: Pass - Single responsibility for LS20 game data.
 */

import { Arc3GameMetadata } from './types';

export const ls20: Arc3GameMetadata = {
  gameId: 'ls20',
  officialTitle: 'ls20',
  informalName: 'Locksmith',
  description: 'Agentic navigation game where you carry a key-like symbol through a map, use rotators to change its shape, and reach a matching door before running out of health.',
  mechanicsExplanation: `
Locksmith (ls20) is an agentic, map-based game played on a 2D grid.

**Objective:** Carry a key-shaped symbol through the map so that, by the time you reach the door, the key's shape matches the door's shape while using as few actions as possible.

**Core mechanics (from public ARC-AGI-3 preview docs):**
- You move a token around the grid using simple directional actions.
- Certain tiles act as "rotators" that cycle the key through different shapes.
- A door opens only if you arrive with a key shape that matches the door shape.
- Every movement costs health; running out of health ends the level.

The implicit goal is to discover a route and sequence of transformations that both opens the door and preserves as much health as possible (high action efficiency).
  `,
  category: 'preview',
  difficulty: 'hard',
  actionMappings: [
    { action: 'ACTION1', commonName: 'Up', description: 'Move character up one cell' },
    { action: 'ACTION2', commonName: 'Down', description: 'Move character down one cell' },
    { action: 'ACTION3', commonName: 'Left', description: 'Move character left one cell' },
    { action: 'ACTION4', commonName: 'Right', description: 'Move character right one cell' },
    { action: 'ACTION5', commonName: 'Space/Action', description: 'Interact with environment (pick up key, unlock door)' },
    { action: 'ACTION6', commonName: 'Click', description: 'Click at specific coordinates (x, y)', notes: 'Requires coordinate parameters' },
  ],
  hints: [],
  resources: [
    {
      title: 'ARC-AGI-3 Preview: 30-Day Learnings',
      url: 'https://arcprize.org/blog/arc-agi-3-preview-30-day-learnings',
      type: 'article',
      description: 'Official blog post with insights from the preview competition',
    },
    {
      title: 'StochasticGoose 1st Place Solution',
      url: 'https://medium.com/@dries.epos/1st-place-in-the-arc-agi-3-agent-preview-competition-49263f6287db',
      type: 'article',
      description: 'Dries Smit\'s writeup on winning the preview competition',
    },
    {
      title: 'LS20 Game Analysis',
      url: 'https://github.com/anthropics/arc-explainer/blob/main/docs/arc3-game-analysis/ls20-analysis.md',
      type: 'article',
      description: 'Detailed frame-by-frame analysis of LS20 grid patterns, color mappings, and action effects',
    },
  ],
  levelScreenshots: [
    {
      level: 4,
      imageUrl: '/ls20-lvl4.png',
    },
    {
      level: 5,
      imageUrl: '/ls20-lvl5.png',
    },
  ],
  tags: ['puzzle', 'navigation', 'keys-and-doors', 'exploration', 'multi-level'],
  thumbnailUrl: '/ls20.png',
  isFullyDocumented: true,
  notes: 'This was one of the most studied games during the preview period.',
};
