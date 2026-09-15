/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12; human replay
 *         detailed by Claude Opus 5, 2026-09-15
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for LP85, including embedded replay video reference.
 *          Adversarially re-verified 2026-09-12: levels 3-4 add a mandatory second,
 *          orange block/target pair the original write-up never mentioned; the
 *          "swap/push/pull button" hint described a mechanic that doesn't exist
 *          anywhere in the code; and the mover/target sprite roles were reversed.
 *          2026-09-15: the thin resources[] entry added in 891dc5a6 for the 2026-09-15
 *          human win was expanded in place with the figures the session API and the
 *          committed NDJSON recording both derive, and its score dropped per the owner.
 * SRP/DRY check: Pass - Single responsibility for LP85 game data.
 */

import { Arc3GameMetadata } from './types';

export const lp85: Arc3GameMetadata = {
  gameId: 'lp85',
  officialTitle: 'lp85',
  informalName: 'Loop and Pull',
  description: 'Rotate a fixed loop of positions with buttons until each large block (yellow, and orange from level 3) sits on its matching small target square.',
  simpleExplanation: 'Buttons step a shared loop of positions forward or backward. Get each colored block to land on its matching small target square.',
  mechanicsExplanation: 'A small target square (or two, from level 3 on, one yellow and one orange) marks where each larger block of the matching color needs to land -- the number of target squares actually ranges from one to three depending on the level, never a fixed four. You control the sequence by pushing red and green buttons, which only ever step the shared loop forward or backward by one position; there is no swap, push, or pull hidden in later levels. LP85 is a one-action game: it declares available_actions = [6] and nothing else, on every frame of a full eight-level recording. ACTION6 is a click carrying x/y coordinates, and the action space exposes no undo -- so RESET, which restarts the current level, is the only recovery primitive the game offers.',
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'easy',
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
      title: 'LP85 Replay (Human, Win, 8/8 Levels)',
      url: 'https://three.arcprize.org/replay/lp85-d265526edbaa/dc3d96aa-762b-4c2e-ac68-6418c8f54c74',
      type: 'replay',
      description: 'Gameplay replay of LP85 (Loop and Pull). Its session is tagged human, not an agent run: a win on all eight levels in 545 actions with 4 resets, published 2026-01-05 against the older lp85-d265526edbaa build, before per-level baselines were published for this game (the session reports none). This is the run the embedded video below shows.',
    },
    {
      title: 'LP85 Human Replay (Win, 8/8 Levels)',
      url: 'https://arcprize.org/replay/129ddf21-d7ba-4ca0-9577-0cea2af042b6',
      type: 'replay',
      description: 'The owner\'s own ARC Prize replay, published 2026-09-15 -- and the second human run listed here, not the first: the other replay above is tagged human too, from January 2026. A win, all eight levels cleared, 415 actions and 6 mid-run resets, split 7/23/26/17/22/103/55/162 across levels 1-8. Honestly read, that is slightly OVER the game\'s own action baseline, not under it: 415 against 388, a ratio of 1.07x. The walls were level 7 (55 actions against a 26 baseline, 2.12x) and level 6 (103 against 60, 1.72x), and the API\'s level_scores agree without being asked -- its two lowest values, 22.3 and 33.9, fall on exactly those two levels. Level 6\'s single reset came straight after a GAME_OVER, so it was forced recovery rather than a choice. Level 8 reads 1.02x by actions (162 against 159), but that understates it: five of the run\'s six resets happened inside level 8, so those 162 actions are 157 clicks spread across six separate attempts. The raw 416-row NDJSON recording is committed at arc3/lp85-305b61c3.129ddf21-d7ba-4ca0-9577-0cea2af042b6.jsonl.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/lp85.png', notes: 'Align the big yellow block with the small yellow square slots.' },
    { level: 2, imageUrl: '/arc3-levels/lp85/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/lp85/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/lp85/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/lp85/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/lp85/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/lp85/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/lp85/lvl8.png' },
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
