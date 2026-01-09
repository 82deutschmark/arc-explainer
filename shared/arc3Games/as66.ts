/*
 * Author: Claude
 * Date: 2026-01-04
 * PURPOSE: Game metadata for AS66 (Always Sliding).
 * SRP/DRY check: Pass - Single responsibility for AS66 game data.
 */

import { Arc3GameMetadata } from './types';

export const as66: Arc3GameMetadata = {
  gameId: 'as66',
  officialTitle: 'as66',
  informalName: 'Always Sliding',
  description: 'Navigate a sliding block to the exit while matching required colors and avoiding enemies.',
  mechanicsExplanation: 'The player block always slides in the chosen direction until it hits an obstacle. Collision with orange or red enemies results in instant death and level failure. To exit, you must match the color expected by the door area, which is typically marked as a white U-shaped area. Special objects in the field can change your block\'s color.',
  category: 'preview',
  difficulty: 'easy',
  actionMappings: [
    { action: 'ACTION1', description: 'Slide Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Slide Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Slide Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Slide Right', commonName: 'Right' },
  ],
  hints: [
    {
      id: 'as66-hint-1',
      title: 'Level 1 Shortcut',
      content: 'Quickest path: DOWN, LEFT, DOWN.',
      spoilerLevel: 3,
    },
    {
      id: 'as66-hint-2',
      title: 'Color Matching',
      content: 'If the exit zone is white, it actually requires you to be a specific color (often yellow) to register the "WIN" state. Use the color-changing tiles strategically.',
      spoilerLevel: 2,
    }
  ],
  resources: [
    {
      title: 'AS66 Replay',
      url: 'https://three.arcprize.org/replay/as66-821a4dcad9c2/db85123a-891c-4fde-8bd3-b85c6702575d',
      type: 'replay',
      description: 'Gameplay replay of AS66 (Always Sliding)',
    },
  ],
  levelScreenshots: [
    { level: 3, imageUrl: '/as66-lvl3.png' },
    { level: 4, imageUrl: '/as66-lvl4.png' },
    { level: 5, imageUrl: '/as66-lvl5.png' },
    { level: 6, imageUrl: '/as66-lvl6.png' },
    { level: 7, imageUrl: '/as66-lvl7.png' },
    { level: 8, imageUrl: '/as66-lvl8.png', notes: 'Watch out for red enemies here.' },
    { level: 9, imageUrl: '/as66-lvl9.png' },
  ],
  tags: ['preview-set', 'movement', 'sliding'],
  thumbnailUrl: '/as66.png',
  isFullyDocumented: true,
  notes: 'Updated with strategic intel about enemy lethality and exit conditions.',
};
