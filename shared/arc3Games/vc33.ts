/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Game metadata for VC33 (Volume Control).
 * SRP/DRY check: Pass - Single responsibility for VC33 game data.
 */

import { Arc3GameMetadata } from './types';

export const vc33: Arc3GameMetadata = {
  gameId: 'vc33',
  officialTitle: 'vc33',
  informalName: 'Volume Control',
  description: 'Orchestration-style game where you adjust the height or "volume" of multiple objects to match target states.',
  category: 'evaluation',
  difficulty: 'easy',
  actionMappings: [],
  hints: [],
  resources: [],
  tags: ['evaluation-set', 'orchestration', 'volume'],
  thumbnailUrl: '/vc33.png',
  isFullyDocumented: false,
  notes: 'Part of the evaluation set - held back from public preview.',
};
