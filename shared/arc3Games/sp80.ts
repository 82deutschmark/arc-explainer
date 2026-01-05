/*
 * Author: Claude
 * Date: 2026-01-04
 * PURPOSE: Game metadata for SP80.
 * SRP/DRY check: Pass - Single responsibility for SP80 game data.
 */

import { Arc3GameMetadata } from './types';

export const sp80: Arc3GameMetadata = {
  gameId: 'sp80',
  officialTitle: 'sp80',
  informalName: undefined,
  description: 'Evaluation game from ARC-AGI-3.',
  category: 'evaluation',
  difficulty: 'medium',
  actionMappings: [],
  hints: [],
  resources: [
    {
      title: 'SP80 Replay',
      url: 'https://three.arcprize.org/replay/sp80-0605ab9e5b2a/212c541e-db90-40c3-9601-79049867dab2',
      type: 'replay',
      description: 'Gameplay replay of SP80',
    },
  ],
  tags: ['evaluation-set'],
  thumbnailUrl: '/sp80.png',
  isFullyDocumented: false,
  notes: 'Part of the evaluation set - held back from public preview.',
};
