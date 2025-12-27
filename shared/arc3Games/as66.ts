/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Game metadata for AS66 (Always Sliding).
 * SRP/DRY check: Pass - Single responsibility for AS66 game data.
 */

import { Arc3GameMetadata } from './types';

export const as66: Arc3GameMetadata = {
  gameId: 'as66',
  officialTitle: 'as66',
  informalName: 'Always Sliding',
  description: 'Preview game from ARC-AGI-3; widely regarded as the most fun',
  category: 'preview',
  difficulty: 'easy',
  actionMappings: [],
  hints: [],
  resources: [
    {
      title: 'Zanthous - 415 moves',
      url: 'https://three.arcprize.org/replay/as66-821a4dcad9c2/515e3de3-0b2a-4199-b268-4b1f84d75e10',
      type: 'replay',
      description: 'Grandmaster gameplay by Zanthous - expert playthrough completing all levels in 415 moves',
    },
  ],
  levelScreenshots: [
    {
      level: 3,
      imageUrl: '/as66-lvl3.png',
    },
    {
      level: 4,
      imageUrl: '/as66-lvl4.png',
    },
    {
      level: 5,
      imageUrl: '/as66-lvl5.png',
    },
    {
      level: 6,
      imageUrl: '/as66-lvl6.png',
    },
    {
      level: 6,
      imageUrl: '/as66-lvl6a.png',
      caption: 'Variant A',
      notes: 'Alternative version of level 6'
    },
    {
      level: 7,
      imageUrl: '/as66-lvl7.png',
    },
    {
      level: 8,
      imageUrl: '/as66-lvl8.png',
    },
    {
      level: 9,
      imageUrl: '/as66-lvl9.png',
    },
  ],
  tags: ['preview-set'],
  thumbnailUrl: '/as66.png',
  isFullyDocumented: false,
  notes: 'Part of the original preview set. Mechanics here are missing until someone helps me write some.',
};
