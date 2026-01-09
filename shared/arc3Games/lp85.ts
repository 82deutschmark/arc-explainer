/*
 * Author: Cascade (ChatGPT)
 * Date: 2026-01-09
 * PURPOSE: Game metadata for LP85, including embedded replay video reference.
 * SRP/DRY check: Pass - Single responsibility for LP85 game data.
 */

import { Arc3GameMetadata } from './types';

export const lp85: Arc3GameMetadata = {
  gameId: 'lp85',
  officialTitle: 'lp85',
  informalName: 'Loop and Pull',
  description: 'Align large yellow blocks with indicated positions by toggling loop controls.',
  mechanicsExplanation: 'Four small yellow squares indicate the target positions where the larger yellow blocks need to be aligned. You control the sequence by pushing red and green buttons which advance or reverse the loop. In advanced levels, buttons may perform more complex actions like swapping positions, pushing, or pulling blocks instead of just looping.',
  category: 'evaluation',
  difficulty: 'hard',
  actionMappings: [
    { action: 'ACTION6', description: 'Click Red/Green button to shift blocks', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'lp85-hint-1',
      title: 'Indicator Targets',
      content: 'The small yellow squares are not decorations; they are the exact slots for the large yellow blocks. Match them precisely.',
      spoilerLevel: 1,
    },
    {
      id: 'lp85-hint-2',
      title: 'Advanced Buttons',
      content: 'When a loop doesn\'t behave normally, test the buttons. One might be a "Swap" or a "Push" that changes the relative order of blocks in the loop.',
      spoilerLevel: 2,
    }
  ],
  resources: [
    {
      title: 'LP85 Replay',
      url: 'https://three.arcprize.org/replay/lp85-d265526edbaa/dc3d96aa-762b-4c2e-ac68-6418c8f54c74',
      type: 'replay',
      description: 'Gameplay replay of LP85 (Loop and Pull)',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/lp85.png', notes: 'Align the big yellow block with the small yellow square slots.' },
  ],
  tags: ['evaluation-set', 'looping', 'sequencing'],
  thumbnailUrl: '/lp85.png',
  video: {
    src: '/videos/arc3/lp85-d265526edbaa.mp4',
    caption: 'Loop and Pull expert run showing button sequencing',
  },
  isFullyDocumented: true,
  notes: 'Updated with strategic intel about target indicators and button complexity.',
};
