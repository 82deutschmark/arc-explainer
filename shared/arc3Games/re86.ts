/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for RE86 (Reach Emblems), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the target dots are visible from frame one, not hidden, and
 *          the wall/elastic collision rule doesn't exist anywhere in the first 5 of
 *          8 levels.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for RE86 game data.
 */

import { Arc3GameMetadata } from './types';

export const re86: Arc3GameMetadata = {
  gameId: 're86',
  officialTitle: 're86',
  informalName: 'Reach Emblems',
  description: 'Slide pieces until, together, they cover a set of small visible target dots; walls only start appearing in the last three levels.',
  mechanicsExplanation: 'You control one piece at a time on a board and slide it in 3-pixel steps; a fifth action hands control to the next piece. The small colored target dots sit behind your (mostly see-through) pieces and are visible on the board from the very start, not hidden -- the win-check only cares about each dot\'s center pixel, ignoring the decorative border drawn around it. Colored pads recolor whichever piece touches them in a slow spreading stain. From level 6 on, walls also appear: rigid pieces stop dead against them while elastic ones compress instead -- levels 1-5 have no walls at all, even though elastic pieces show up earlier. A per-level move budget ends the attempt in a loss if it runs out first.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION1', description: 'Slide selected piece Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Slide selected piece Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Slide selected piece Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Slide selected piece Right', commonName: 'Right' },
    { action: 'ACTION5', description: 'Cycle selected piece', commonName: 'Cycle' },
  ],
  hints: [],
  resources: [
    {
      title: 'RE86 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/fcc4f8b7-01e5-4009-923d-1c7d1fcae9fe',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'RE86 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/d7c629e9-5f79-4225-8344-53131c1c5dbc',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['pixel-matching', 'sliding-pieces', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the targets are visible, not a hidden image, and the wall/elastic mechanic only exists in the last 3 of 8 levels.',
};
