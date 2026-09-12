/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for LS20 (Locksmith), including featured replay video details.
 *          Adversarially re-verified 2026-09-12: every level runs a hidden 42-step
 *          budget with a 3-life game-over system, level 6 has two doors to solve in
 *          sequence, and the final level adds fog-of-war -- none of this was in the
 *          original write-up.
 * SRP/DRY check: Pass - Single responsibility for LS20 game data.
 */

import { Arc3GameMetadata } from './types';

export const ls20: Arc3GameMetadata = {
  gameId: 'ls20',
  officialTitle: 'ls20',
  informalName: 'Locksmith',
  description: 'Transform a key into the required shape, color, and rotation to unlock an exit door, under a hidden step budget and limited lives.',
  mechanicsExplanation: 'The key is represented as a distinct group of pixels, typically located in the bottom-left area at the start of each level. You must move your player avatar over transformation tiles to change the key\'s shape, color, and rotation to match the lock. The door does not require a specific trigger action; simply reaching it with the correct key configuration will finish the level -- though level 6 has two separate doors that both need solving in turn, not just one. Every level also runs on a hidden 42-step move budget; running out resets you to the level\'s start and costs one of only 3 total lives, with a 4th failure ending the game. The final level adds fog-of-war, blacking out everything beyond a short radius around you.',
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
    },
    {
      id: 'ls20-hint-3',
      title: 'Hidden Move Limit',
      content: 'Every level secretly caps you at 42 steps before it resets you and costs a life -- you only get 3 lives total. The final level also blacks out everything beyond a short radius around you.',
      spoilerLevel: 2,
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
    { level: 1, imageUrl: '/arc3-levels/ls20/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/ls20/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/ls20/lvl3.png' },
    { level: 4, imageUrl: '/ls20-lvl4.png' },
    { level: 5, imageUrl: '/ls20-lvl5.png', notes: 'Key starts in bottom left. Door is usually at the top or center.' },
    { level: 6, imageUrl: '/arc3-levels/ls20/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/ls20/lvl7.png' },
  ],
  tags: ['preview-set', 'transformation', 'navigation'],
  thumbnailUrl: '/ls20.png',
  video: {
    src: '/videos/arc3/ls20-fa137e247ce6.mp4',
    caption: 'Locksmith walkthrough replay captured Dec 2025',
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct, adversarially-verified source read: added the hidden 42-step/3-life budget, level 6\'s second door, and the final level\'s fog-of-war, none of which the original write-up mentioned.',
};
