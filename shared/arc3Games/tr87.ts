/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for TR87 (Tongue Runes), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). A second, independent adversarial
 *          re-verification pass on 2026-09-12 found the original pass still missed
 *          that levels 5-6 invert the puzzle (the answer is pre-solved and you repair
 *          the dictionary instead), misattributed which element "freezes," and left
 *          out a move budget that can lose the level.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for TR87 game data.
 */

import { Arc3GameMetadata } from './types';

export const tr87: Arc3GameMetadata = {
  gameId: 'tr87',
  officialTitle: 'tr87',
  informalName: 'Tongue Runes',
  description: 'Translate a phrase into a second alphabet using a wall of paired runes as your only dictionary -- in the last two levels, the answer is already right and you repair the dictionary instead.',
  mechanicsExplanation: 'A phrase appears in one alphabet, and a wall of paired runes is the only dictionary; in levels 1-4, you spell the phrase out in a second alphabet by matching each rune to its pair. The angles of paired runes are random and mean nothing, so a symbol can only be looked up, never derived from its shape. The phrase row itself is never editable, in any level. In levels 5-6, the answer row is already correct and left untouched -- instead the dictionary wall gets scrambled, and the controls that used to edit your answer now rotate the dictionary\'s glyphs, so you\'re repairing the lookup table rather than translating anything. A move budget (128 actions in levels 1-5, 256 in level 6) ticks down on every action, including a bare cursor move; run out and you lose.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
  ],
  hints: [],
  resources: [
    {
      title: 'TR87 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/28185f71-d397-4228-819d-523b195190da',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'TR87 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/5c144b64-fd15-4913-bdc4-28feac5046ee',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/tr87/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/tr87/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/tr87/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/tr87/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/tr87/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/tr87/lvl6.png' },
  ],
  tags: ['translation', 'lookup-table', 'alphabet', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12: the original "adversarially verified" pass still missed that levels 5-6 invert the puzzle, caught by a second, independent re-verification.',
};
