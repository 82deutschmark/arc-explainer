/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (name reverted 2026-09-12)
 * PURPOSE: Game metadata for BP35 (Buoyant Pursuit), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Briefly renamed to "Buoyant Ascent" on
 *          2026-09-12 over mylefxfaev() (bp35.py:4052-4054) disabling the explicit
 *          chase-catch check past level 3 -- reverted the same day; the name is flavor
 *          for the whole floating-upward premise, not a literal per-level mechanic
 *          claim, and Mark wants it kept as Buoyant Pursuit. The level-scope detail
 *          (chaser only in 1-3, a flat action budget threatens every level) stays in
 *          the body text below since that part is a real, distinct correction.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for BP35 game data.
 */

import { Arc3GameMetadata } from './types';

export const bp35: Arc3GameMetadata = {
  gameId: 'bp35',
  officialTitle: 'bp35',
  informalName: 'Buoyant Pursuit',
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
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/bp35/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/bp35/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/bp35/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/bp35/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/bp35/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/bp35/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/bp35/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/bp35/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/bp35/lvl9.png' },
  ],
  tags: ['vertical-scroller', 'budget', 'physics', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Description corrected 2026-09-12: the chase check (mylefxfaev) is hard-disabled past level 3, so a chaser only threatens levels 1-3; a flat action budget is what actually threatens every level. A same-day rename to "Buoyant Ascent" over that finding was reverted -- Mark kept the name Buoyant Pursuit as flavor for the whole game, not a per-level mechanic claim.',
};
