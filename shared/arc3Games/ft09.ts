/*
 * Author: Claude
 * Date: 2026-01-04
 * PURPOSE: Game metadata for FT09 (Functional Tiles).
 * SRP/DRY check: Pass - Single responsibility for FT09 game data.
 */

import { Arc3GameMetadata } from './types';

export const ft09: Arc3GameMetadata = {
  gameId: 'ft09',
  officialTitle: 'ft09',
  informalName: 'Functional Tiles',
  description: 'Align the grid tiles to match a static reference configuration shown in the top-right.',
  mechanicsExplanation: 'The top-right corner displays the target configuration. This reference area is static and does not change during the level. Colors have a ranking/precedence: the top color is dominant, and second or third colors are ranked below it. In cases of overlapping or competing requirements, the dominant color\'s preference takes precedent. Clicking a tile will either toggle it back to its original color or cycle through available colors if multiple are possible.',
  category: 'preview',
  difficulty: 'medium',
  actionMappings: [
    { action: 'ACTION6', description: 'Click to change tile/color', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'ft09-hint-1',
      title: 'Top-Right Dominance',
      content: 'Identify which color is shown at the very top of the reference area; this color will overwrite others in "conflict" zones.',
      spoilerLevel: 2,
    },
    {
      id: 'ft09-hint-2',
      title: 'Color Cycling',
      content: 'If clicking once doesn\'t give the result you want, click again. The tile will cycle through its valid states or toggle back.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'FT09 Replay',
      url: 'https://three.arcprize.org/replay/ft09-b8377d4b7815/39b51ef3-b565-43fe-b3a8-7374ca4c5058',
      type: 'replay',
      description: 'Gameplay replay of FT09 (Functional Tiles)',
    },
  ],
  levelScreenshots: [
    {
      level: 8,
      imageUrl: '/ft09-lvl8.png',
      notes: 'Focus on the static reference in the top right corner.',
    },
    {
      level: 9,
      imageUrl: '/ft09-lvl9.png',
    },
  ],
  tags: ['preview-set', 'pattern-matching', 'logic'],
  thumbnailUrl: '/ft09.png',
  isFullyDocumented: true,
  notes: 'Updated with strategic intel about color precedence.',
};
