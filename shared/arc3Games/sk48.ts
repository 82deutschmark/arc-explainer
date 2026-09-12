/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for SK48 (Skewer Kebabs), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the skewer actively pushes beads ahead of its tip (and can be
 *          blocked from extending at all), and level 5+ adds solid walls the skewer
 *          can't push through. Win-condition specifics still need a fuller pass.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for SK48 game data.
 */

import { Arc3GameMetadata } from './types';

export const sk48: Arc3GameMetadata = {
  gameId: 'sk48',
  officialTitle: 'sk48',
  informalName: 'Skewer Kebabs',
  description: 'Extend a skewer that pushes scattered colored items ahead of its tip, then get the threaded colors to line up correctly.',
  mechanicsExplanation: 'You extend, retract, or slide a skewer piece along a fixed axis. Extending it doesn\'t pass through the colored items in its path -- it shoves each one ahead of the tip, and if a piece has nowhere to go, the whole extension is blocked that turn. From level 5 on, solid wall tiles also appear that stop the skewer outright, unlike beads, which just get pushed. A step budget and an undo (restoring prior positions, beads included) bound each attempt. This is still a single-pass read of the source -- the exact win-condition rule (how many skewers a level has, and precisely what their threaded sequences must satisfy) needs a fuller pass before this counts as a complete spoiler.',
  category: 'evaluation',
  difficulty: 'unknown',
  actionMappings: [
    { action: 'ACTION1', description: 'Extend/retract Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Extend/retract Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Extend/retract Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Extend/retract Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Select a skewer', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo', commonName: 'Undo' },
  ],
  hints: [],
  resources: [
    {
      title: 'SK48 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/549f92a6-c1d5-4990-a3c4-91323c1fc8e8',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'SK48 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/ec8d80f4-250f-47c4-948f-6e5d51379cb5',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['skewer', 'threading', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12: adversarial re-verification confirmed the skewer pushes beads rather than passing through them, and added the level-5+ solid walls; the win-condition specifics are still an open gap.',
};
