/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for SC25 (Sigil Caster), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for SC25 game data.
 */

import { Arc3GameMetadata } from './types';

export const sc25: Arc3GameMetadata = {
  gameId: 'sc25',
  officialTitle: 'sc25',
  informalName: 'Sigil Caster',
  description: 'Draw a lit pattern on a toggle grid to auto-cast one of three spells and reach the exit.',
  mechanicsExplanation: 'You control a small wizard walking a maze of walls, boxes, and crystal obstacles toward a portal tile. A 3x3 grid of clickable dots in the corner toggles on/off, and if the lit pattern exactly matches one of three known sigils, the game auto-casts the matching spell: a teleport/swap, a grow/shrink toggle that lets you squeeze through gaps or bulldoze crystal blocks, or a directional fireball that destroys crystal obstacles ahead of you. Spells are gated per level, and a shared move-and-click budget ends the level in a loss if exhausted.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Toggle a sigil-grid dot', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'SC25 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/14734864-b319-4b44-832f-64b997351be0',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'SC25 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/2e83cea2-946f-4f51-9ce5-d7ca5c8576f3',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['spellcasting', 'pattern-matching', 'maze', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
