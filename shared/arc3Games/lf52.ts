/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for LF52 (Leapfrog), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for LF52 game data.
 */

import { Arc3GameMetadata } from './types';

export const lf52: Arc3GameMetadata = {
  gameId: 'lf52',
  officialTitle: 'lf52',
  informalName: 'Leapfrog',
  description: 'Click a peg, click its landing spot, hop a neighbor off the board; a rail cart links rooms.',
  mechanicsExplanation: 'Click a piece, click where it lands, and it hops a neighbour off the board — peg solitaire. A rail cart ferries a piece between linked rooms, so a hop set up in one room can be finished in another. The cart\'s own button is not a move-confirm the way it looks; it restarts a level you\'ve broken.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 10,
  actionMappings: [
    { action: 'ACTION6', description: 'Select/place a peg', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo', commonName: 'Undo' },
  ],
  hints: [],
  resources: [
    {
      title: 'LF52 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/0beb41f9-31a2-499f-9d5a-64f187ae1edd',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'LF52 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/248b7fbd-5f82-40bd-af6d-ff811283526a',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['peg-solitaire', 'linked-rooms', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics verified by an adversarial two-reader pass (a second agent tried to refute the first reading).',
};
