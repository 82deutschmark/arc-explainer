/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for SU15 (Sorting Urn), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: Undo is actually free (the escalating cost is charged for
 *          colliding different-tier blocks, not Undo), critters are absent from the
 *          first 3 of 9 levels, and the smallest tier is destroyed outright on
 *          critter contact rather than demoted.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for SU15 game data.
 */

import { Arc3GameMetadata } from './types';

export const su15: Arc3GameMetadata = {
  gameId: 'su15',
  officialTitle: 'su15',
  informalName: 'Sorting Urn',
  description: 'Pull and merge numbered blocks until an exact tiered mix of blocks (and, from level 4, hazard critters) fills the zone.',
  mechanicsExplanation: 'You pull numbered blocks around the board with a magnetic click: tapping the play area drags every nearby block toward that point. Blocks come in nine size tiers; two of the same tier that touch fuse into the next tier up, Suika-style, and merging the top tier destroys the pair. From level 4 onward, diamond hazard critters also roam the field and merge among themselves the same way; a block that touches one recoils and drops a tier, except the smallest tier, which is destroyed outright on contact instead of dropping further. Each level\'s win condition is an exact count -- not a minimum -- of specific block and/or critter tiers sitting in a marked zone at once, within a shrinking step budget. Undo is free and simply restores your last position; the cost that escalates each use is instead charged for shoving two different-tier blocks or critters into each other.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION6', description: 'Pull nearby blocks toward a point', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo (free)', commonName: 'Undo' },
  ],
  hints: [],
  resources: [
    {
      title: 'SU15 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/68e24873-d70f-4115-8617-711e48454c15',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'SU15 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/2e3994e1-8760-4e47-89f3-7ec096fce420',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/su15/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/su15/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/su15/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/su15/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/su15/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/su15/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/su15/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/su15/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/su15/lvl9.png' },
  ],
  tags: ['merging', 'sorting', 'exact-count', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: Undo\'s cost claim was backwards, and the critter mechanic\'s scope and smallest-tier outcome were both wrong.',
};
