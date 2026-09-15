/*
 * Author: Claude Sonnet 5; human replay added by Claude Opus 5, 2026-09-15
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for KA59 (Kinetic Assembly), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: level 5's special block has no frame to check at all, and
 *          level 3 has two special blocks, not one.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-15: a human win was added to resources[] -- the first non-agent
 *          replay on this game -- and its raw NDJSON recording committed under arc3/.
 * SRP/DRY check: Pass - Single responsibility for KA59 game data.
 */

import { Arc3GameMetadata } from './types';

export const ka59: Arc3GameMetadata = {
  gameId: 'ka59',
  officialTitle: 'ka59',
  informalName: 'Kinetic Assembly',
  description: 'Chain-push boxes until each sits exactly in its outline frame; a bomb-knocked block (sometimes two at once) joins in later levels.',
  simpleExplanation: 'You push boxes until each one sits exactly in its matching outline. Pushing into another box takes a few turns to move it along, and a special block can only be moved by being pushed or knocked into place.',
  mechanicsExplanation: 'Click a box to select it, then push it with the arrow actions. Pushing into another movable object doesn\'t move it instantly -- it takes several turns of continued pushing, with recursive chain-pushing of anything further in line, before the push resolves. Every ordinary box must end up sitting exactly inside its matching outlined frame. A special block -- never directly selectable -- can only be repositioned by being pushed by a box or, in later levels, knocked around by a bomb\'s blast once its fuse burns down; most levels give you one of these blocks with its own frame to land in, but level 3 drops two of them at once outnumbering that level\'s single regular box, and level 5\'s special block has no frame at all, so where it ends up is never checked. A step budget ends the level in a loss if it runs out first.',
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'medium',
  levelCount: 7,
  actionMappings: [
    { action: 'ACTION1', description: 'Push selected box Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Push selected box Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Push selected box Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Push selected box Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Select a box', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'KA59 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/36989e6c-72fc-4b22-a48b-1e7988df6477',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'KA59 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/a20bebda-f97c-4a72-940f-de03dae1833b',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'KA59 Human Replay (Win, 7/7 Levels)',
      url: 'https://arcprize.org/replay/1333b2ee-cf42-40dc-8994-cff1a5a9c55d',
      type: 'replay',
      description: 'A human playthrough, not an agent run -- the other two replays listed here are GPT-6 Astra. Published 2026-09-15: a win, all seven levels cleared, 598 actions and 2 mid-run resets, split 22/102/55/43/59/174/143 across levels 1-7. Under the game\'s own action baseline overall (730), but over it on three levels -- marginally on level 3 (55 against 51), and heavily on the two that were clearly the hard ones: level 5 at 59 against 33 and level 6 at 174 against 132, where one of the run\'s two resets happened (the other was eight actions into level 1). Level 7 ran 143 against a 326 baseline. The raw 599-row NDJSON recording is committed at arc3/ka59-38d34dbb.1333b2ee-cf42-40dc-8994-cff1a5a9c55d.jsonl.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/ka59/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/ka59/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/ka59/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/ka59/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/ka59/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/ka59/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/ka59/lvl7.png' },
  ],
  tags: ['sokoban', 'chain-push', 'bombs', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the three replay links in resources[] -- two ARC Prize published with the GPT-6 Astra results, plus a human win published 2026-09-15 (7/7 levels, 598 actions, 2 mid-run resets), whose raw recording is committed under arc3/. Corrected 2026-09-12 after an adversarially-verified direct source read: the special block\'s role varies a lot more per level (0, 1, or 2 blocks, with or without a frame) than "one special block" implied.',
};
