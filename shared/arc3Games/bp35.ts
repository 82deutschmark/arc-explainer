/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for BP35 (Buoyant Pursuit), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for BP35 game data.
 */

import { Arc3GameMetadata } from './types';

export const bp35: Arc3GameMetadata = {
  gameId: 'bp35',
  officialTitle: 'bp35',
  informalName: 'Buoyant Pursuit',
  description: 'Steer left/right floating up a flooded shaft; a chaser below gains only when you fail to rise.',
  mechanicsExplanation: 'You steer only left and right; height is always a consequence of your moves, never a direct command, which is why it reads as floating up a flooded shaft. Something rises from below and only gains ground on you during moves where you failed to rise yourself, so thinking is free and flailing is costly. Later, decorative see-through shapes you had been swimming through turn out to be clickable controls, and a decorative band flips which way is down.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Click a control shape', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo', commonName: 'Undo' },
  ],
  hints: [],
  resources: [
    {
      title: 'BP35 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/084397eb-e736-4cfa-bd64-0f73cc198e50',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'BP35 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/b02b9920-372b-43c9-8eef-58b76704664f',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['vertical-scroller', 'chase', 'physics', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).',
};
