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
  informalName: 'Volume Control',
  description: 'Manage white columns as a liquid system to transport player squares to objectives.',
  mechanicsExplanation: 'The white columns function like liquid or water within a closed system. Clicking red or blue controller squares causes the "liquid" to flow from one contained area to another. Large player squares (yellow, green, purple) cannot be manually selected; instead, they automatically move when the path is cleared. If a player square is sitting on a white column, it will rise or fall with the column height, similar to a person sitting on top of a tube of liquid.',
  category: 'preview',
  difficulty: 'medium',
  actionMappings: [
    { action: 'ACTION6', description: 'Click controller (Red/Blue) to shift liquid/height', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'vc33-hint-1',
      title: 'Hydraulic Logic',
      content: 'Think of the total volume of white pixels as constant. Raising one column usually requires lowering another. Map out which controllers affect which "tubes".',
      spoilerLevel: 2,
    },
    {
      id: 'vc33-hint-2',
      title: 'Automatic Transit',
      content: 'You don\'t need to move the players. Once the gap is high enough, they will move on their own. Focus exclusively on the hydraulics.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'VC33 Replay',
      url: 'https://three.arcprize.org/replay/vc33-6ae7bf49eea5/29409ce8-c164-447e-8810-828b96fa4ceb',
      type: 'replay',
      description: 'Gameplay replay of VC33 (Volume Control)',
    },
  ],
  levelScreenshots: [
    { level: 7, imageUrl: '/vc33-lvl7.png', notes: 'Players sit atop the white hydraulic columns.' },
  ],
  tags: ['preview-set', 'hydraulics', 'physics'],
  thumbnailUrl: '/vc33.png',
  isFullyDocumented: true,
  notes: 'Updated with strategic intel about the closed liquid system.',
};
