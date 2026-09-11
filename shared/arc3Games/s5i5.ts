/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for S5I5 (Sliding Indicator), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for S5I5 game data.
 */

import { Arc3GameMetadata } from './types';

export const s5i5: Arc3GameMetadata = {
  gameId: 's5i5',
  officialTitle: 's5i5',
  informalName: 'Sliding Indicator',
  description: 'Extend/rotate telescoping rods to walk a tip-mounted marker onto every fixed pin.',
  mechanicsExplanation: 'You steer a set of color-coded telescoping rods, each pinned at a fixed anchor point. Clicking the correct half of a two-headed slider handle extends or retracts the rod anchored there; clicking a small color-matched diamond icon pivots every rod of that color 90 degrees around its anchor. Rods are chained together, so moving a base rod drags everything welded to it, and any move that would overlap two rods is silently undone. The goal is walking a marker riding a rod-tip onto a fixed pin, for every pin, before a shrinking click budget runs out.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION6', description: 'Extend/retract or pivot a rod', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'S5I5 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/39d9f100-328a-4121-ad81-ce298e1f9626',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'S5I5 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/7609fe46-64be-4d12-b100-81733da7c768',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['rods', 'point-and-click', 'chained-pieces', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
