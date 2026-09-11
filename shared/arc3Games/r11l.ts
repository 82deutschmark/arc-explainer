/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for R11L (Rearrange Layout), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for R11L game data.
 */

import { Arc3GameMetadata } from './types';

export const r11l: Arc3GameMetadata = {
  gameId: 'r11l',
  officialTitle: 'r11l',
  informalName: 'Rearrange Layout',
  description: 'Click-relocate shape groups until each group\'s shadow overlaps its fixed outline target.',
  mechanicsExplanation: 'A click-only puzzle: clicking a highlighted piece selects it, clicking an empty cell instantly relocates it. Every group of pieces has an invisible shadow that re-centers to the group\'s average position after each move, and a level clears once every group\'s shadow overlaps its own fixed outline target elsewhere on the grid. Hidden hazard zones snap a piece back and count a mistake if its shadow lands on one; five mistakes or running out of a per-level click budget ends the level in a loss. Colored keyhole markers turn out to be mostly cosmetic -- the win-check explicitly skips them, except on the final level.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION6', description: 'Select / relocate a piece', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'R11L Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/e026fd52-5b68-477f-8388-72fdfd8c56cf',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'R11L Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/932837ac-8800-414f-9d7c-46537ebea3a3',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['click-puzzle', 'shape-matching', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
