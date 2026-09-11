/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for SK48 (Skewer Kebabs), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for SK48 game data.
 */

import { Arc3GameMetadata } from './types';

export const sk48: Arc3GameMetadata = {
  gameId: 'sk48',
  officialTitle: 'sk48',
  informalName: 'Skewer Kebabs',
  description: 'Extend a skewer through scattered colored items, threading them on in sequence, then get the threaded colors to line up correctly.',
  mechanicsExplanation: 'You extend, retract, or slide a skewer piece along a fixed axis; as it extends it threads through scattered colored items in its path. A step budget and an undo (restoring prior positions) bound each attempt. This is a short, single-pass read of the source -- the exact win-condition rule (how many skewers a level has, and precisely what their threaded sequences must satisfy) needs a fuller pass before this counts as a complete spoiler.',
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
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
