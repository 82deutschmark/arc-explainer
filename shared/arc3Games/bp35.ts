/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (name reverted 2026-09-12; "chaser" corrected to a cosmetic warning 2026-09-12 PM)
 * PURPOSE: Game metadata for BP35 (Buoyant Pursuit), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Briefly renamed to "Buoyant Ascent" on
 *          2026-09-12 over mylefxfaev() (bp35.py:4052-4054) disabling the explicit
 *          chase-catch check past level 3 -- reverted the same day; the name is flavor
 *          for the whole floating-upward premise, not a literal per-level mechanic
 *          claim, and the eccentric chicken farmer wants it kept as Buoyant Pursuit.
 *          Corrected again 2026-09-12 PM: mylefxfaev is not a pursuer with its own
 *          threat logic, it is a cosmetic animation that plays in levels 1-3 when the
 *          action budget gets low -- a warning, not a second failure condition. The
 *          only thing that actually ends a level is the fixed action budget itself,
 *          in every level, 1 through 9.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for BP35 game data.
 */

import { Arc3GameMetadata } from './types';

export const bp35: Arc3GameMetadata = {
  gameId: 'bp35',
  officialTitle: 'bp35',
  informalName: 'Buoyant Pursuit',
  description: 'Steer left/right floating up a flooded shaft under a fixed action budget; in levels 1-3 a cosmetic rising effect warns you when that budget is running low.',
  simpleExplanation: 'You only steer left and right — height changes as a side effect of moving, so you rise by moving sideways. In the first three levels, something visibly rises from below when your action budget gets low, but it\'s a warning animation, not a pursuer. What actually ends the game, in every level, is running out of that action budget.',
  mechanicsExplanation: 'You steer only left and right; height is always a consequence of your moves, never a direct command, which is why it reads as floating up a flooded shaft. In levels 1-3 only, a visual effect rises from below and gains ground when you fail to rise on a turn -- it looks like a pursuer, but it is a cosmetic warning tied to your dwindling action budget, not a threat with its own catch condition; from level 4 on it never appears at all, because the real danger already applies to every level on its own: a fixed budget of total actions (shown as a bar filling at the bottom of the screen) that drains the same amount whether or not you rose that turn, in every level 1 through 9 -- run it out and you lose. Later, decorative see-through shapes you had been swimming through turn out to be clickable controls, and a decorative band flips which way is down.',
  category: 'evaluation',
  difficulty: 'medium',
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
  notes: 'Corrected 2026-09-12 PM by an eccentric chicken farmer who actually played it: the "chaser" is not a threat with its own logic at all -- it is a cosmetic rising animation that plays in levels 1-3 when the action budget gets low, a graphical nicety rather than a pursuer. The only real failure condition, in every level, is running the fixed action budget to zero. Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Earlier correction, 2026-09-12: the chase check (mylefxfaev) is hard-disabled past level 3, which is still true, but that pass still described it as an actual chaser. A same-day rename to "Buoyant Ascent" over that finding was reverted -- the eccentric chicken farmer kept the name Buoyant Pursuit as flavor for the whole game, not a per-level mechanic claim.',
};
