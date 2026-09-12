/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for LF52 (Leapfrog), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). A second, independent adversarial
 *          re-verification pass on 2026-09-12 found the original pass still missed a
 *          permanent red peg (levels 6+), a manually-driven rail cart, and an
 *          undocumented per-level move budget that can lose the game.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for LF52 game data.
 */

import { Arc3GameMetadata } from './types';

export const lf52: Arc3GameMetadata = {
  gameId: 'lf52',
  officialTitle: 'lf52',
  informalName: 'Leapfrog',
  description: 'Click a peg, click its landing spot, hop a neighbor off the board; a rail cart (driven with the arrow keys) links rooms, and moves are limited.',
  mechanicsExplanation: 'Click a piece, click where it lands, and it hops a neighbour off the board — peg solitaire. From level 6 on, one peg is a special red peg that can only be knocked off by another red peg; since each level has just one, it never actually leaves the board (an ordinary peg can still leap over and past it), which is why levels 6 and 7 uniquely let you finish with two pegs left instead of one. A rail cart links rooms so a hop set up in one room can be finished in another, but it only moves when you press the arrow-key actions -- it doesn\'t ferry anything on its own. The cart\'s own click button is not a move-confirm the way it looks; it restarts a level you\'ve broken. You also have a limited number of moves: just 64 on level 1, 320 on levels 2-5, and 640 on levels 6-10 -- run out and you lose.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 10,
  actionMappings: [
    { action: 'ACTION1', description: 'Move rail cart Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move rail cart Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move rail cart Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move rail cart Right', commonName: 'Right' },
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
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/lf52/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/lf52/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/lf52/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/lf52/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/lf52/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/lf52/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/lf52/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/lf52/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/lf52/lvl9.png' },
    { level: 10, imageUrl: '/arc3-levels/lf52/lvl10.png' },
  ],
  tags: ['peg-solitaire', 'linked-rooms', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12: the original "adversarially verified" pass still missed the red peg, the manual rail cart, and the per-level move budget, caught by a second, independent re-verification.',
};
