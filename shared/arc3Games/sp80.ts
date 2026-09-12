/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for SP80 (Streaming Purple) with embedded streaming replay
 *          clip. A 2026-09-12 pixel-palette read of the source flagged the liquid as
 *          color 6 and argued for "Pink" over "Purple," but Mark called that rename
 *          out directly from having watched the actual gameplay video -- reverted;
 *          the name stays Streaming Purple. Kept: the containers are yellow, not
 *          white, and "the liquid falls straight down" only holds for 3 of the 6
 *          levels -- the other 3 render the whole screen rotated 180 degrees.
 * SRP/DRY check: Pass - Single responsibility for SP80 game data.
 */

import { Arc3GameMetadata } from './types';

export const sp80: Arc3GameMetadata = {
  gameId: 'sp80',
  officialTitle: 'sp80',
  informalName: 'Streaming Purple',
  description: 'Position platforms to guide a falling purple stream into yellow containers.',
  mechanicsExplanation: 'You must position all platforms perfectly before initiating the stream. Initiating the stream is done with ACTION5 (Interact). Once triggered, the stream flows over several frames automatically -- and in 3 of the 6 levels the whole screen is rendered upside-down, so the same downward flow looks like it\'s rising. If the liquid spills outside the yellow U-shaped containers, the level fails and must be reset; a correctly filled container turns dark red. If all liquid is contained, you pass to the next level.',
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
      content: 'In most levels the liquid falls straight down, but 3 of the 6 flip the entire screen upside-down for display, so the same physics looks like it\'s flowing up. Use diagonal platforms to redirect the flow horizontally into the center of the yellow containers.',
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
    { level: 1, imageUrl: '/arc3-levels/sp80/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/sp80/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/sp80/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/sp80/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/sp80/lvl5.png' },
    { level: 6, imageUrl: '/sp80-lvl6.png', notes: 'Platforms must be set before pressing Action 5.' },
  ],
  tags: ['evaluation-set', 'physics', 'fluid-dynamics'],
  thumbnailUrl: '/sp80.png',
  video: {
    src: '/videos/arc3/sp80-test.mp4',
    caption: 'Streaming Purple capture showing animation when Action 5 triggers flow',
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct source read: the containers are yellow, not white, and "falls straight down" only holds for 3 of the 6 levels, since the other 3 render the screen rotated 180 degrees. A separate rename to "Streaming Pink" was proposed the same day over the liquid\'s exact pixel color, but reverted -- Mark watched the actual gameplay video and confirmed it reads as purple; the name stays Streaming Purple.',
};
