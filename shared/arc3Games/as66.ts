/*
 * Author: Claude
 * Date: 2026-01-04
 * PURPOSE: Game metadata for AS66 (Always Sliding).
 * SRP/DRY check: Pass - Single responsibility for AS66 game data.
 */

import { Arc3GameMetadata } from './types';

export const as66: Arc3GameMetadata = {
  gameId: 'as66',
  officialTitle: 'as66',
  informalName: 'Always Sliding',
  description: 'Preview game from ARC-AGI-3.',
  category: 'preview',
  difficulty: 'easy',
  actionMappings: [],
  hints: [],
  resources: [
    {
      title: 'AS66 Replay',
      url: 'https://three.arcprize.org/replay/as66-821a4dcad9c2/db85123a-891c-4fde-8bd3-b85c6702575d',
      type: 'replay',
      description: 'Gameplay replay of AS66 (Always Sliding)',
    },
  ],
  levelScreenshots: [
    { level: 3, imageUrl: '/as66-lvl3.png' },
    { level: 4, imageUrl: '/as66-lvl4.png' },
    { level: 5, imageUrl: '/as66-lvl5.png' },
    { level: 6, imageUrl: '/as66-lvl6.png' },
    { level: 7, imageUrl: '/as66-lvl7.png' },
    { level: 8, imageUrl: '/as66-lvl8.png' },
    { level: 9, imageUrl: '/as66-lvl9.png' },
  ],
  tags: ['preview-set'],
  thumbnailUrl: '/as66.png',
  isFullyDocumented: false,
  notes: 'Part of the original preview set.',
};
