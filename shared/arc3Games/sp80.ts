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
  resources: [],
  tags: ['evaluation-set'],
  thumbnailUrl: '/sp80.png',
  isFullyDocumented: false,
  notes: 'Part of the evaluation set - held back from public preview.',
};
