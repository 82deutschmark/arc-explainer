/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for TN36 (Toggle Navigator), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for TN36 game data.
 */

import { Arc3GameMetadata } from './types';

export const tn36: Arc3GameMetadata = {
  gameId: 'tn36',
  officialTitle: 'tn36',
  informalName: 'Toggle Navigator',
  description: 'Toggle binary switches to compose an opcode that moves/rotates/scales a token onto target.',
  mechanicsExplanation: 'You\'re looking at two side-by-side circuit panels, each holding a token, a bank of binary toggle switches, and a target marker. Clicking a switch flips a bit; the combined bits form a number looked up in a fixed instruction set (move, rotate, grow/shrink, or recolor), and clicking the panel runs that program on its token. Only the right-hand panel counts toward winning -- position, rotation, scale, and color must all match its target at once -- while the left panel is a free-play sandbox with preset programs for reverse-engineering what a switch combination does. Every click also scrolls a background strip toward a cutoff line; reaching it before solving the right panel is a loss.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 7,
  actionMappings: [
    { action: 'ACTION6', description: 'Toggle a switch / run a panel', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'TN36 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/f8c61b63-9b3c-4ad0-80ef-a5f9fcb5c330',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'TN36 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/6f5dd73e-fdf4-4b30-a87a-22e4557d8189',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['binary-logic', 'opcode-deduction', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
