/*
 * Author: Claude
 * Date: 2026-01-04
 * PURPOSE: Game metadata for LS20 (Locksmith).
 * SRP/DRY check: Pass - Single responsibility for LS20 game data.
 */

import { Arc3GameMetadata } from './types';

export const ls20: Arc3GameMetadata = {
  gameId: 'ls20',
  officialTitle: 'ls20',
  informalName: 'Locksmith',
  description: 'Preview game from ARC-AGI-3.',
  category: 'preview',
  difficulty: 'hard',
  actionMappings: [],
  hints: [],
  resources: [
    {
      title: 'LS20 Replay',
      url: 'https://three.arcprize.org/replay/ls20-fa137e247ce6/7405808f-ec5b-4949-a252-a1451b946bae',
      type: 'replay',
      description: 'Gameplay replay of LS20 (Locksmith)',
    },
  ],
  levelScreenshots: [
    { level: 4, imageUrl: '/ls20-lvl4.png' },
    { level: 5, imageUrl: '/ls20-lvl5.png' },
  ],
  tags: ['preview-set'],
  thumbnailUrl: '/ls20.png',
  isFullyDocumented: false,
  notes: 'Part of the original preview set.',
};
