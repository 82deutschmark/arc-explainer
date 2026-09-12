/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for KA59 (Kinetic Assembly), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: level 5's special block has no frame to check at all, and
 *          level 3 has two special blocks, not one.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for KA59 game data.
 */

import { Arc3GameMetadata } from './types';

export const ka59: Arc3GameMetadata = {
  gameId: 'ka59',
  officialTitle: 'ka59',
  informalName: 'Kinetic Assembly',
  description: 'Chain-push boxes until each sits exactly in its outline frame; a bomb-knocked block (sometimes two at once) joins in later levels.',
  mechanicsExplanation: 'Click a box to select it, then push it with the arrow actions. Pushing into another movable object doesn\'t move it instantly -- it takes several turns of continued pushing, with recursive chain-pushing of anything further in line, before the push resolves. Every ordinary box must end up sitting exactly inside its matching outlined frame. A special block -- never directly selectable -- can only be repositioned by being pushed by a box or, in later levels, knocked around by a bomb\'s blast once its fuse burns down; most levels give you one of these blocks with its own frame to land in, but level 3 drops two of them at once outnumbering that level\'s single regular box, and level 5\'s special block has no frame at all, so where it ends up is never checked. A step budget ends the level in a loss if it runs out first.',
  category: 'evaluation',
  difficulty: 'unknown',
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
  ],
  tags: ['sokoban', 'chain-push', 'bombs', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the special block\'s role varies a lot more per level (0, 1, or 2 blocks, with or without a frame) than "one special block" implied.',
};
