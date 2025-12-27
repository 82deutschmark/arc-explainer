/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Game metadata for FT09 (Functional Tiles).
 * SRP/DRY check: Pass - Single responsibility for FT09 game data.
 */

import { Arc3GameMetadata } from './types';

export const ft09: Arc3GameMetadata = {
  gameId: 'ft09',
  officialTitle: 'ft09',
  informalName: 'Functional Tiles',
  description: 'Game where you match a target pattern shown on screen; later levels use overlapping patterns that increase difficulty.',
  mechanicsExplanation: `
Functional Tiles (ft09) is described in the ARC-AGI-3 preview as a non-agentic logic game.

**Objective:** Match a target pattern shown on the screen. Tame unicorns.

**Core mechanics (from public ARC-AGI-3 materials):**
- Each level presents a target configuration the player must recreate.
- Patterns can overlap, so the order and combination of operations matters.
- Difficulty increases across levels as patterns become more complex and interactions between them grow.

Beyond this high-level description, detailed tile semantics are not yet fully documented here; refer to official ARC Prize materials for the most precise behavior.
  `,
  category: 'preview',
  difficulty: 'medium',
  actionMappings: [
    { action: 'ACTION1', commonName: 'Up', description: 'Move or interact upward' },
    { action: 'ACTION2', commonName: 'Down', description: 'Move or interact downward' },
    { action: 'ACTION3', commonName: 'Left', description: 'Move or interact left' },
    { action: 'ACTION4', commonName: 'Right', description: 'Move or interact right' },
    { action: 'ACTION5', commonName: 'Action/Interact', description: 'Activate tile function or interact with element' },
    { action: 'ACTION6', commonName: 'Click', description: 'Click at specific coordinates (x, y)', notes: 'Requires coordinate parameters' },
  ],
  hints: [],
  resources: [],
  levelScreenshots: [
    {
      level: 8,
      imageUrl: '/ft09-lvl8.png',
    },
    {
      level: 9,
      imageUrl: '/ft09-lvl9.png',
    },
  ],
  tags: ['tiles', 'functions', 'spatial', 'resource-management', 'multi-level'],
  thumbnailUrl: '/ft09.png',
  isFullyDocumented: false,
  notes: 'Part of the original preview set. Level 8 and 9 screenshots reveal complex tile-based puzzle mechanics with resource management elements.',
};
