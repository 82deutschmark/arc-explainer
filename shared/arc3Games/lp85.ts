/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for LP85, including embedded replay video reference.
 *          Adversarially re-verified 2026-09-12: levels 3-4 add a mandatory second,
 *          orange block/target pair the original write-up never mentioned; the
 *          "swap/push/pull button" hint described a mechanic that doesn't exist
 *          anywhere in the code; and the mover/target sprite roles were reversed.
 * SRP/DRY check: Pass - Single responsibility for LP85 game data.
 */

import { Arc3GameMetadata } from './types';

export const lp85: Arc3GameMetadata = {
  gameId: 'lp85',
  officialTitle: 'lp85',
  informalName: 'Loop and Pull',
  description: 'Rotate a fixed loop of positions with buttons until each large block (yellow, and orange from level 3) sits on its matching small target square.',
  mechanicsExplanation: 'A small target square (or two, from level 3 on, one yellow and one orange) marks where each larger block of the matching color needs to land -- the number of target squares actually ranges from one to three depending on the level, never a fixed four. You control the sequence by pushing red and green buttons, which only ever step the shared loop forward or backward by one position; there is no swap, push, or pull hidden in later levels.',
  category: 'evaluation',
  difficulty: 'hard',
  actionMappings: [
    { action: 'ACTION6', description: 'Click Red/Green button to shift blocks', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'lp85-hint-1',
      title: 'Indicator Targets',
      content: 'The small squares are not decorations; they are the exact slots for the larger blocks of the same color. Levels 3-4 add a second, orange pair alongside the yellow one -- match every color\'s target, not just yellow.',
      spoilerLevel: 1,
    },
    {
      id: 'lp85-hint-2',
      title: 'Two Buttons, One Loop',
      content: 'Red and green only ever step the shared loop forward or backward by one position each press -- there is no swap or push mechanic hiding in later levels. Watch which blocks share a loop and count how many steps apart they need to end up.',
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
  notes: 'Corrected 2026-09-12 after a direct, adversarially-verified source read: levels 3-4 add a second, orange block/target pair the write-up never mentioned; the "swap/push/pull button" claim described a mechanic that doesn\'t exist in the code; and the mover/target sprite roles were reversed.',
};
