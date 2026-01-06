/*
 * Author: Claude
 * Date: 2026-01-04
 * PURPOSE: Game metadata for VC33.
 * SRP/DRY check: Pass - Single responsibility for VC33 game data.
 */

import { Arc3GameMetadata } from './types';

export const vc33: Arc3GameMetadata = {
  gameId: 'vc33',
  officialTitle: 'vc33',
  informalName: undefined,
  description: 'Evaluation game from ARC-AGI-3.',
  category: 'evaluation',
  difficulty: 'easy',
  actionMappings: [],
  hints: [],
  resources: [
    {
      title: 'VC33 Replay',
      url: 'https://three.arcprize.org/replay/vc33-6ae7bf49eea5/29409ce8-c164-447e-8810-828b96fa4ceb',
      type: 'replay',
      description: 'Gameplay replay of VC33',
    },
  ],
  tags: ['evaluation-set'],
  thumbnailUrl: '/vc33.png',
  isFullyDocumented: false,
  notes: 'Part of the evaluation set - held back from public preview.',
};
