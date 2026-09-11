/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for G50T (Ghost Timer), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for G50T game data.
 */

import { Arc3GameMetadata } from './types';

export const g50t: Arc3GameMetadata = {
  gameId: 'g50t',
  officialTitle: 'g50t',
  informalName: 'Ghost Timer',
  description: 'Rewinding freezes a replaying ghost of your last run; race a draining timer to reach the chest.',
  mechanicsExplanation: 'You control a small avatar navigating a dungeon-style room toward a goal chest. A fifth action doesn\'t move you -- it rewinds you to the start and freezes your just-completed run of moves into a silent ghost that replays those exact steps on every future attempt, while you get a fresh body to try something different. You only get 2-3 rewinds per level before every ghost is wiped, so the puzzle is using a handful of loop-echoes of yourself to hold plates and dodge patrols long enough for the real you to reach the chest, all before a slowly draining timer bar runs out.',
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
  tags: ['time-loop', 'ghost-replay', 'timer', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
