/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for M0R0 (Mirror Rendezvous), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for M0R0 game data.
 */

import { Arc3GameMetadata } from './types';

export const m0r0: Arc3GameMetadata = {
  gameId: 'm0r0',
  officialTitle: 'm0r0',
  informalName: 'Mirror Rendezvous',
  description: 'A mirrored pair moves in lockstep; deliberately desync them off walls until they meet.',
  mechanicsExplanation: 'You steer a mirror-image pair of tokens that always move together: vertical input shifts both by the same amount, horizontal input pushes them toward or away from each other by equal and opposite amounts. Because mirrored motion preserves their relative offset, you can never bring them together by walking through open space -- the puzzle is deliberately driving one twin into a wall, block, or shut gate so only it stops, permanently shifting the gap, repeated until both land on the same tile and merge. Checkerboard trap tiles reset every draggable piece back to its level-start position.',
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
  tags: ['mirrored-movement', 'desync-puzzle', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
