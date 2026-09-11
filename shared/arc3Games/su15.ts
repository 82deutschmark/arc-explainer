/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for SU15 (Sorting Urn), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for SU15 game data.
 */

import { Arc3GameMetadata } from './types';

export const su15: Arc3GameMetadata = {
  gameId: 'su15',
  officialTitle: 'su15',
  informalName: 'Sorting Urn',
  description: 'Pull and merge numbered blocks until an exact tiered mix of blocks/critters fills the zone.',
  mechanicsExplanation: 'You pull numbered blocks around the board with a magnetic click: tapping the play area drags every nearby block toward that point. Blocks come in nine size tiers; two of the same tier that touch fuse into the next tier up, Suika-style, and merging the top tier destroys the pair. Diamond hazard critters roam the same field and merge among themselves the same way, but a block that touches one instead recoils and is knocked down a tier. Each level\'s win condition is an exact count -- not a minimum -- of specific block and/or critter tiers sitting in a marked zone at once, within a shrinking step budget; undo is available but costs progressively more steps each use.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION6', description: 'Pull nearby blocks toward a point', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo (escalating cost)', commonName: 'Undo' },
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
  tags: ['merging', 'sorting', 'exact-count', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
