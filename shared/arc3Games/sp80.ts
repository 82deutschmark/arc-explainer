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
  informalName: 'Streaming Purple',
  description: 'Position platforms to guide a falling purple stream into white containers.',
  mechanicsExplanation: 'You must position all platforms perfectly before initiating the stream. Initiating the stream is done with ACTION5 (Interact). Once triggered, the stream flows over several frames automatically. If the liquid spills outside the white U-shaped containers, the level fails and must be reset. If all liquid is contained, you pass to the next level.',
  category: 'evaluation',
  difficulty: 'medium',
  actionMappings: [
    { action: 'ACTION5', description: 'Start the liquid stream', commonName: 'Interact/Execute' },
    { action: 'ACTION6', description: 'Place or move platforms', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'sp80-hint-1',
      title: 'Pre-Flight Check',
      content: 'Do not start the stream until you are 100% sure the path is complete. The stream logic triggers a multi-frame animation that you cannot interrupt.',
      spoilerLevel: 2,
    },
    {
      id: 'sp80-hint-2',
      title: 'U-Shape Targeting',
      content: 'The liquid falls straight down. Use diagonal platforms to redirect the flow horizontally into the center of the white containers.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'SP80 Replay',
      url: 'https://three.arcprize.org/replay/sp80-0605ab9e5b2a/212c541e-db90-40c3-9601-79049867dab2',
      type: 'replay',
      description: 'Gameplay replay of SP80 (Streaming Purple)',
    },
  ],
  levelScreenshots: [
    { level: 6, imageUrl: '/sp80-lvl6.png', notes: 'Platforms must be set before pressing Action 5.' },
  ],
  tags: ['evaluation-set', 'physics', 'fluid-dynamics'],
  thumbnailUrl: '/sp80.png',
  isFullyDocumented: true,
  notes: 'Updated with strategic intel about the Action 5 flow trigger.',
};
