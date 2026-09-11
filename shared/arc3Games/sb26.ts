/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for SB26 (Sequence Belt), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for SB26 game data.
 */

import { Arc3GameMetadata } from './types';

export const sb26: Arc3GameMetadata = {
  gameId: 'sb26',
  officialTitle: 'sb26',
  informalName: 'Sequence Belt',
  description: 'Arrange a tile belt, then run it to be read through machines against a required color sequence.',
  mechanicsExplanation: 'You control colored square tiles sitting in fixed slots along a chain of machine containers, plus a couple of ring-shaped tiles. Clicking arranges each machine\'s slot contents; ring tiles act as color-coded doorways that redirect the reading order into a different machine mid-sequence and later return. Running the arrangement reads every machine\'s slots in order and checks each tile\'s color against the next color required by a sequence of goal sockets across the top -- get every socket filled in the right order to clear the level, but any mismatch or empty gap stops the run early.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION5', description: 'Run the arrangement', commonName: 'Run' },
    { action: 'ACTION6', description: 'Swap/move a tile', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo to last run', commonName: 'Undo' },
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
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
