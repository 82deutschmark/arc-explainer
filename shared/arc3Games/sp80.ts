/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Game metadata for SP80 (Streaming Purple).
 * SRP/DRY check: Pass - Single responsibility for SP80 game data.
 */

import { Arc3GameMetadata } from './types';

export const sp80: Arc3GameMetadata = {
  gameId: 'sp80',
  officialTitle: 'sp80',
  informalName: 'Streaming Purple',
  description: 'Evaluation game informally known as "Streaming Purple". Mechanics have not been documented here yet.',
  category: 'evaluation',
  difficulty: 'medium',
  actionMappings: [],
  hints: [],
  resources: [
    {
      title: 'SP80 Replay',
      url: 'https://three.arcprize.org/replay/sp80-0605ab9e5b2a/212c541e-db90-40c3-9601-79049867dab2',
      type: 'replay',
      description: 'Gameplay replay of SP80 (Streaming Purple)',
    },
  ],
  tags: ['evaluation-set'],
  thumbnailUrl: '/sp80.png',
  isFullyDocumented: false,
  notes: 'Part of the evaluation set - held back from public preview.',
};
