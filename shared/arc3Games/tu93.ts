/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for TU93 (Trail Unwind), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the signature trail-replay hazard doesn't exist until level 7
 *          of 9, there's a third lose condition (your token worn down to nothing),
 *          and the hazard's first moves on waking aren't actually a player replay yet.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for TU93 game data.
 */

import { Arc3GameMetadata } from './types';

export const tu93: Arc3GameMetadata = {
  gameId: 'tu93',
  officialTitle: 'tu93',
  informalName: 'Trail Unwind',
  description: 'From level 7 on, hazards wake and replay your own past moves against you as your move budget unwinds.',
  mechanicsExplanation: 'You steer a token along the printed wires of a circuit-board style grid, hopping between connected segments. Some blocks are breakable walls that shatter when walked into, but wake and lunge toward you if you stop in front of one without destroying it. A third kind slides back and forth on its own wire every turn regardless of your actions. Starting at level 7 of 9, a fourth kind stays dormant until you pass within two cells, then wakes -- its first couple of moves are just its own preset facing repeated, and only after that does it settle into replaying your own past moves one turn behind, retracing your path toward you. A shrinking move budget, your token being worn down to nothing by repeated hazard contact, and reaching a marked exit tile are the three ways a level ends.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
  ],
  hints: [],
  resources: [
    {
      title: 'TU93 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/4cdfd8b4-111e-4f56-a0fd-7ad8be6b9bf2',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'TU93 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/7c54faff-3875-43f3-8a06-ca25720b32c8',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/tu93/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/tu93/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/tu93/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/tu93/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/tu93/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/tu93/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/tu93/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/tu93/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/tu93/lvl9.png' },
  ],
  tags: ['chase', 'trail-replay', 'circuit-board', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the signature hazard is level-7+-only, not a whole-game feature, and a third lose condition and the hazard\'s non-replay opening moves were both missing.',
};
