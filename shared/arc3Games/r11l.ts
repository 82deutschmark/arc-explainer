/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for R11L (Rearrange Layout), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the "shadow" marker is explicitly visible, not invisible; the
 *          hazard-zone mistake mechanic only exists in 3 of 6 levels while the wall
 *          obstacle in every level behaves totally differently; and the keyhole
 *          markers are required a level earlier than claimed, not "mostly cosmetic."
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for R11L game data.
 */

import { Arc3GameMetadata } from './types';

export const r11l: Arc3GameMetadata = {
  gameId: 'r11l',
  officialTitle: 'r11l',
  informalName: 'Rearrange Layout',
  description: 'Click-relocate shape groups until each group\'s visible marker overlaps its fixed outline target.',
  mechanicsExplanation: 'A click-only puzzle: clicking a highlighted piece selects it, clicking an empty cell instantly relocates it. Every group of pieces has a visible marker sprite (drawn in solid color, not hidden) that re-centers to the group\'s average position after each move, and a level clears once every group\'s marker overlaps its own fixed outline target elsewhere on the grid. Walls silently block a click with no penalty, but 3 of the 6 levels also place a separate hazard zone that snaps a piece back and counts a mistake if its marker lands there; five mistakes or running out of a per-level click budget ends the level in a loss. Colored keyhole markers are not cosmetic -- from level 5 on, some target shapes have no marker of their own and must instead borrow color absorbed from a keyhole along the way to pass the win-check.',
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
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/r11l/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/r11l/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/r11l/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/r11l/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/r11l/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/r11l/lvl6.png' },
  ],
  tags: ['click-puzzle', 'shape-matching', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the marker sprite is visible not invisible, the hazard/mistake mechanic is level-scoped, and the keyhole markers matter a level earlier than claimed.',
};
