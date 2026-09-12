/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for SB26 (Sequence Belt), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: level 1 has only one machine and no portal tiles at all, Undo
 *          reverts your last tile move (not your last run), and a 64-point energy
 *          budget that can lose the level was missing entirely.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for SB26 game data.
 */

import { Arc3GameMetadata } from './types';

export const sb26: Arc3GameMetadata = {
  gameId: 'sb26',
  officialTitle: 'sb26',
  informalName: 'Sequence Belt',
  description: 'Arrange tiles in machine containers, then run them to be read against a required color sequence, on a limited energy budget.',
  mechanicsExplanation: 'You control colored square tiles sitting in fixed slots inside machine containers. Level 1 has just one container and nothing else; from level 2 on, ring-shaped tiles act as color-coded doorways that redirect the reading order into a different machine mid-sequence and later return. Running the arrangement reads every machine\'s slots in order and checks each tile\'s color against the next color required by a sequence of goal sockets across the top -- get every socket filled in the right order to clear the level, but any mismatch or empty gap stops the run early. Every run and every tile swap or move also spends part of a 64-point energy pool; drain it to zero and the level is lost outright. Undo reverts your last tile swap or placement, not your last run.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION5', description: 'Run the arrangement', commonName: 'Run' },
    { action: 'ACTION6', description: 'Swap/move a tile', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo to last tile move', commonName: 'Undo' },
  ],
  hints: [],
  resources: [
    {
      title: 'SB26 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/6066c7d2-601e-4d5c-9abc-9ba3b7ff57dd',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'SB26 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/7eebd5e4-fac6-47c7-b829-4ca32cc491e2',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  tags: ['sequencing', 'belt', 'portals', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: level 1 has no portal/chain mechanic at all, Undo targets the wrong action, and a losable energy budget was missing.',
};
