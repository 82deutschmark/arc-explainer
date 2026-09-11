/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for TR87 (Tongue Runes), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for TR87 game data.
 */

import { Arc3GameMetadata } from './types';

export const tr87: Arc3GameMetadata = {
  gameId: 'tr87',
  officialTitle: 'tr87',
  informalName: 'Tongue Runes',
  description: 'Translate a phrase into a second alphabet by looking it up against a wall of paired runes.',
  mechanicsExplanation: 'A phrase appears in one alphabet, and a wall of paired runes is the only dictionary; you spell the phrase out in a second alphabet by matching each rune to its pair. The angles of paired runes are random and mean nothing, so a symbol can only be looked up, never derived from its shape. Late levels route the phrase through a third alphabet that appears only in the dictionary and never in the phrase itself, then freeze the phrase and hand you the dictionary to repair instead.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
  ],
  hints: [],
  resources: [
    {
      title: 'TR87 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/28185f71-d397-4228-819d-523b195190da',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'TR87 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/5c144b64-fd15-4913-bdc4-28feac5046ee',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['translation', 'lookup-table', 'alphabet', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).',
};
