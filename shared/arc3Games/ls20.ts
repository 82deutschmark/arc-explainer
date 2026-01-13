/*
 * Author: Cascade (ChatGPT)
 * Date: 2026-01-09
 * PURPOSE: Game metadata for LS20 (Locksmith), including featured replay video details.
 * SRP/DRY check: Pass - Single responsibility for LS20 game data.
 */

import { Arc3GameMetadata } from './types';

export const ls20: Arc3GameMetadata = {
  gameId: 'ls20',
  officialTitle: 'ls20',
  informalName: 'Locksmith',
  description: 'Transform a key into the required shape, color, and rotation to unlock an exit door.',
  mechanicsExplanation: 'The key is represented as a distinct group of pixels, typically located in the bottom-left area at the start of each level. You must move your player avatar over transformation tiles to change the key\'s shape, color, and rotation to match the lock. The door does not require a specific trigger action; simply reaching it with the correct key configuration will finish the level.',
  category: 'preview',
  difficulty: 'hard',
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
  ],
  hints: [
    {
      id: 'ls20-hint-1',
      title: 'Key Transformation',
      content: 'Identify the "recipe" for tiles. Some tiles might rotate the key by 90 degrees, while others change its color or append a new block to its shape.',
      spoilerLevel: 2,
    },
    {
      id: 'ls20-hint-2',
      title: 'Exit Requirement',
      content: 'The door area often shows a hint of the "target" key. Ensure your key matches that ghost image perfectly before approaching.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'LS20 Replay',
      url: 'https://three.arcprize.org/replay/ls20-fa137e247ce6/7405808f-ec5b-4949-a252-a1451b946bae',
      type: 'replay',
      description: 'Gameplay replay of LS20 (Locksmith)',
    },
  ],
  levelScreenshots: [
    { level: 4, imageUrl: '/ls20-lvl4.png' },
    { level: 5, imageUrl: '/ls20-lvl5.png', notes: 'Key starts in bottom left. Door is usually at the top or center.' },
  ],
  tags: ['preview-set', 'transformation', 'navigation'],
  thumbnailUrl: '/ls20.png',
  video: {
    src: '/videos/arc3/ls20-fa137e247ce6.mp4',
    caption: 'Locksmith walkthrough replay captured Dec 2025',
  },
  isFullyDocumented: true,
  notes: 'Updated with strategic intel from manual game mastery.',
};
