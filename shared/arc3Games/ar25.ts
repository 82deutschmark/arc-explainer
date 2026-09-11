/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for AR25 (Axis Reflectors), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for AR25 game data.
 */

import { Arc3GameMetadata } from './types';

export const ar25: Arc3GameMetadata = {
  gameId: 'ar25',
  officialTitle: 'ar25',
  informalName: 'Axis Reflectors',
  description: 'Move a piece and axis-aligned mirrors; live reflections must cover every target dot.',
  mechanicsExplanation: 'You control a small colored puzzle piece, and in most levels one or two straight mirror-lines you can also select and slide, on a 21x21 board scattered with single-pixel target dots. Every move is mirrored live: any cell touched directly by a piece, or by that piece\'s reflection bounced across the mirror-line(s), counts as filled, so shifting a mirror re-reflects the whole board instantly. The level ends the moment every target dot is covered by a piece or one of its live reflections -- many puzzles are solved by repositioning the mirror rather than the piece itself. A shrinking step budget and a positions-only undo (it never refunds spent steps) keep you from brute-forcing the symmetry.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION1', description: 'Move piece/mirror Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move piece/mirror Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move piece/mirror Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move piece/mirror Right', commonName: 'Right' },
    { action: 'ACTION5', description: 'Cycle selection', commonName: 'Cycle' },
    { action: 'ACTION6', description: 'Click a piece or mirror to select it', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo', commonName: 'Undo' },
  ],
  hints: [],
  resources: [
    {
      title: 'AR25 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/c28b4a3f-69b3-416e-8137-3890497bc089',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'AR25 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/ed09362c-eb47-41b8-bf46-2d275090be02',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['mirrors', 'reflection', 'step-budget', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
