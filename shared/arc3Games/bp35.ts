/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (renamed 2026-09-12)
 * PURPOSE: Game metadata for BP35 (Buoyant Ascent), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Renamed from "Buoyant Pursuit": an
 *          independent adversarial re-verification pass on 2026-09-12 confirmed
 *          mylefxfaev() (bp35.py:4052-4054) hard-disables the chase check past level
 *          3, so "Pursuit" is false for 6 of the game's 9 levels -- the real universal
 *          danger in every level is a fixed action budget, not a pursuing entity.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for BP35 game data.
 */

import { Arc3GameMetadata } from './types';

export const bp35: Arc3GameMetadata = {
  gameId: 'bp35',
  officialTitle: 'bp35',
  informalName: 'Buoyant Ascent',
  description: 'Steer left/right floating up a flooded shaft under a fixed action budget; a chaser below only stalks levels 1-3.',
  mechanicsExplanation: 'You steer only left and right; height is always a consequence of your moves, never a direct command, which is why it reads as floating up a flooded shaft. Only in levels 1-3 does something also rise from below and gain ground on you during moves where you failed to rise yourself; from level 4 on there is no chaser at all. The real danger in every level, 1 through 9, is a fixed budget of total actions (shown as a bar filling at the bottom of the screen) that drains the same amount whether or not you rose that turn -- run it out and you lose. Later, decorative see-through shapes you had been swimming through turn out to be clickable controls, and a decorative band flips which way is down.',
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
  tags: ['vertical-scroller', 'budget', 'physics', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Renamed from "Buoyant Pursuit" to "Buoyant Ascent" 2026-09-12: a second, independent adversarial re-verification pass confirmed the chase check (mylefxfaev) is hard-disabled past level 3, so "Pursuit" was false for 6 of 9 levels; the fixed action budget that actually threatens every level was added to the description.',
};
