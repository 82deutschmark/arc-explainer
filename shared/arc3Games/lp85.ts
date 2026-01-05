/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Game metadata for LP85 (Loop & Pull).
 * SRP/DRY check: Pass - Single responsibility for LP85 game data.
 */

import { Arc3GameMetadata } from './types';

export const lp85: Arc3GameMetadata = {
  gameId: 'lp85',
  officialTitle: 'lp85',
  informalName: 'Loop & Pull',
  description: 'Evaluation game from the ARC-AGI-3 preview. Detailed mechanics are not yet publicly documented; this entry currently exposes only high-level metadata and assets.',
  category: 'evaluation',
  difficulty: 'hard',
  actionMappings: [],
  hints: [],
  resources: [
    {
      title: 'Zanthous - 92 moves',
      url: 'https://three.arcprize.org/replay/lp85-d265526edbaa/dcae645c-3fec-4388-b805-7427f8cdb318',
      type: 'replay',
      description: 'Grandmaster gameplay by Zanthous - expert playthrough completing all levels in 92 moves',
    },
    {
      title: 'LP85 Replay',
      url: 'https://three.arcprize.org/replay/lp85-d265526edbaa/dc3d96aa-762b-4c2e-ac68-6418c8f54c74',
      type: 'replay',
      description: 'Gameplay replay of LP85 (Loop & Pull)',
    },
  ],
  tags: ['evaluation-set'],
  thumbnailUrl: '/lp85.png',
  isFullyDocumented: false,
  notes: 'Part of the evaluation set used as a private holdout during the preview; documentation here is intentionally minimal until more official detail is available.',
};
