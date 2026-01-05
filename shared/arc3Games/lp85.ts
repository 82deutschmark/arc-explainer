/*
 * Author: Claude
 * Date: 2026-01-04
 * PURPOSE: Game metadata for LP85.
 * SRP/DRY check: Pass - Single responsibility for LP85 game data.
 */

import { Arc3GameMetadata } from './types';

export const lp85: Arc3GameMetadata = {
  gameId: 'lp85',
  officialTitle: 'lp85',
  informalName: undefined,
  description: 'Evaluation game from ARC-AGI-3.',
  category: 'evaluation',
  difficulty: 'hard',
  actionMappings: [],
  hints: [],
  resources: [
    {
      title: 'LP85 Replay',
      url: 'https://three.arcprize.org/replay/lp85-d265526edbaa/dc3d96aa-762b-4c2e-ac68-6418c8f54c74',
      type: 'replay',
      description: 'Gameplay replay of LP85',
    },
  ],
  tags: ['evaluation-set'],
  thumbnailUrl: '/lp85.png',
  isFullyDocumented: false,
  notes: 'Part of the evaluation set - held back from public preview.',
};
