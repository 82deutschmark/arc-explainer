/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for M0R0 (Mirror Rendezvous), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: trap tiles reset both twins (not just spare blocks), gates are
 *          live buttons confined to the last two levels, and every level has an
 *          unmentioned 150-move budget that can lose the game.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for M0R0 game data.
 */

import { Arc3GameMetadata } from './types';

export const m0r0: Arc3GameMetadata = {
  gameId: 'm0r0',
  officialTitle: 'm0r0',
  informalName: 'Mirror Rendezvous',
  description: 'A mirrored pair moves in lockstep; deliberately desync them off walls until they meet, within a 150-move budget.',
  mechanicsExplanation: 'You steer a mirror-image pair of tokens that always move together: vertical input shifts both by the same amount, horizontal input pushes them toward or away from each other by equal and opposite amounts. Because mirrored motion preserves their relative offset, you can never bring them together by walking through open space -- the puzzle is deliberately driving one twin into a wall or block so only it stops, permanently shifting the gap, repeated until both land on the same tile and merge. In the last two levels, colored gates open and close live depending on which button tile either twin is currently standing on -- they\'re switches, not static walls. Checkerboard trap tiles snap both twins straight back to the level\'s starting position. Each level also gives you a hard cap of 150 moves, shown as a shrinking bar; run out before the twins merge and you lose.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move pair Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move pair Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move pair apart/together', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move pair apart/together', commonName: 'Right' },
    { action: 'ACTION6', description: 'Select/drag a block', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'M0R0 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/d453ad9d-77ac-4228-a0a7-2cad831dd93c',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'M0R0 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/37443746-b7f8-4d5c-9140-b623f00cabe7',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/m0r0/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/m0r0/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/m0r0/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/m0r0/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/m0r0/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/m0r0/lvl6.png' },
  ],
  tags: ['mirrored-movement', 'desync-puzzle', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: traps reset both twins (not just spare blocks), gates are an active switch mechanic in the last 2 levels only, and a 150-move budget that can lose the game was missing entirely.',
};
