/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for G50T (Ghost Timer), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: patrols only exist in the last 2 of 7 levels, you can never
 *          have more than 1-2 ghosts at once (never a "handful"), and 3 levels add an
 *          unmentioned paired-tile teleport mechanic.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for G50T game data.
 */

import { Arc3GameMetadata } from './types';

export const g50t: Arc3GameMetadata = {
  gameId: 'g50t',
  officialTitle: 'g50t',
  informalName: 'Ghost Timer',
  description: 'Rewinding freezes a replaying ghost of your last run; hold plates, dodge late-game patrols, and race a draining timer to reach the chest.',
  mechanicsExplanation: 'You control a small avatar navigating a dungeon-style room toward a goal chest. A fifth action doesn\'t move you -- it rewinds you to the start and freezes your just-completed run of moves into a silent ghost that replays those exact steps on every future attempt, while you get a fresh body to try something different. Every ghost gets wiped on your next-to-last rewind, so you never have more than one echo on screen in level 1, or more than two in any later level. The core puzzle is using that one or two echoes to hold pressure plates long enough for the real you to reach the chest, all before a slowly draining timer bar runs out. The last two levels add roaming patrols that kill on contact, and three middle levels add paired tiles that teleport whatever is standing on one to its linked partner.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 7,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION5', description: 'Rewind (spawn a ghost)', commonName: 'Rewind' },
  ],
  hints: [],
  resources: [
    {
      title: 'G50T Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/86b31ba0-245b-44c1-8587-bf7782bc27f2',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'G50T Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/b93ce848-16a9-4930-994b-871dd64ed93d',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/g50t/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/g50t/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/g50t/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/g50t/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/g50t/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/g50t/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/g50t/lvl7.png' },
  ],
  tags: ['time-loop', 'ghost-replay', 'timer', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: "dodge patrols" and "a handful of ghosts" both overstated what most levels actually contain, and a teleport-tile mechanic in 3 levels was missing entirely.',
};
