/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for TN36 (Toggle Navigator), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the two panels' roles were swapped (the "sandbox" panel is
 *          actually locked from manual clicks; the winning panel is the one you
 *          freely toggle), switches split into several independent instruction banks
 *          rather than one shared number, and the final level adds an unmentioned
 *          freeze hazard.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for TN36 game data.
 */

import { Arc3GameMetadata } from './types';

export const tn36: Arc3GameMetadata = {
  gameId: 'tn36',
  officialTitle: 'tn36',
  informalName: 'Toggle Navigator',
  description: 'Freely toggle switches on the right-hand panel to chain move/rotate/scale/recolor instructions onto its token, matching a target; the left panel only runs preset programs.',
  mechanicsExplanation: 'You\'re looking at two side-by-side circuit panels, each holding a token, one or more independent banks of binary toggle switches, and a target marker. Only the right-hand panel counts toward winning -- position, rotation, scale, and color must all match its target at once -- and it\'s also the one whose switches you actually click yourself: each bank of switches forms its own separate number, looked up in a fixed instruction set (move, rotate, grow/shrink, or recolor), and running the panel fires each bank\'s instruction in sequence, one after another (by the last level, that\'s a chain of six). The left-hand panel\'s switches can never be clicked by hand at all; it only runs preset programs for you to reverse-engineer what a given combination does. Every click also scrolls a background strip toward a cutoff line; reaching it before solving the right panel is a loss. The final level also adds blockers that cycle in and out along the token\'s path -- running into one mid-program freezes the token until the run resets.',
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
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/tn36/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/tn36/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/tn36/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/tn36/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/tn36/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/tn36/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/tn36/lvl7.png' },
  ],
  tags: ['binary-logic', 'opcode-deduction', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the panels\' clickable/locked roles were backwards, the single-shared-number framing was wrong, and the final level\'s freeze hazard was missing.',
};
