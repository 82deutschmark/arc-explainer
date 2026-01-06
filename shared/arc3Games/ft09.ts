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
  description: 'Preview game from ARC-AGI-3.',
  category: 'preview',
  difficulty: 'medium',
  actionMappings: [],
  hints: [],
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
    },
    {
      level: 9,
      imageUrl: '/ft09-lvl9.png',
    },
  ],
  tags: ['preview-set'],
  thumbnailUrl: '/ft09.png',
  isFullyDocumented: false,
  notes: 'Part of the original preview set.',
};
