/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for DC22 (Deck Control), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for DC22 game data.
 */

import { Arc3GameMetadata } from './types';

export const dc22: Arc3GameMetadata = {
  gameId: 'dc22',
  officialTitle: 'dc22',
  informalName: 'Deck Control',
  description: 'Press panel buttons to reshape platforms into a walkable floor; later a claw rides the panel too.',
  mechanicsExplanation: 'A walker has to reach a goal, but most of the floor doesn\'t exist yet; you press buttons on a side panel that reshape platforms across the board. A wrong press irises the screen to black, rewinds one move, and charges the budget — it never kills you, it just makes mistakes expensive. From the fifth level the panel grows a claw that rides a painted track, moving twice as far as the walker and clamping onto a pillar you then stand on; coloured pads fling you to their twin, and a missing button appears only after you fetch a token on foot.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Press a panel button', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'DC22 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/a3b944b0-1863-4e98-bfb3-6802d327311b',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'DC22 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/eb980b49-c92d-4fdd-b5a0-ff2aa8254cb9',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['platform-building', 'budget', 'panel', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).',
};
