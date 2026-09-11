/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for CN04 (Coded Notches), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for CN04 game data.
 */

import { Arc3GameMetadata } from './types';

export const cn04: Arc3GameMetadata = {
  gameId: 'cn04',
  officialTitle: 'cn04',
  informalName: 'Coded Notches',
  description: 'Slide, turn, and stretch loose parts until every printed mark meets its match on another part.',
  mechanicsExplanation: 'Three to five loose parts, each printed with marks; you hold one part at a time and slide, turn, or stretch it until every mark meets a matching mark on another part. A mark goes dark the instant it is satisfied. In most levels only the part currently in your hand shows its marks at all, so tracking what still needs to line up means remembering what you\'ve already seen.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Slide/turn held part', commonName: 'Up' },
    { action: 'ACTION2', description: 'Slide/turn held part', commonName: 'Down' },
    { action: 'ACTION3', description: 'Slide/turn held part', commonName: 'Left' },
    { action: 'ACTION4', description: 'Slide/turn held part', commonName: 'Right' },
    { action: 'ACTION5', description: 'Stretch held part', commonName: 'Interact' },
    { action: 'ACTION6', description: 'Select a part', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'CN04 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/3cd20b12-b1c0-47e2-a3a1-406b6e4f75a7',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'CN04 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/f6296e32-d4b0-4068-9bb0-3be64b8afef5',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['matching', 'manipulation', 'memory', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).',
};
