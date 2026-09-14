/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-12 (rewritten after reading bp35.py's real game logic, not just the level scaffolding)
 * PURPOSE: Game metadata for BP35 (Buoyant Pursuit), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026).
 *          This pass reread the actual class (Bp35 / uakietkqfso in bp35.py, lines
 *          ~4032-4465, obfuscated names) instead of the placeholder `levels` list at
 *          the top of the file, and confirmed against Mark's own play:
 *          - There is no vertical move action at all (available_actions = [3,4,6,7]:
 *            left, right, click, undo). Every left/right step (pywlvyklps) is
 *            automatically followed by an unstoppable slide (fsvnqdbzrp) through open
 *            space in whichever direction is currently "up" -- you cannot move
 *            sideways without also being carried in that direction. This is the
 *            "suction" Mark described, confirmed, not softened.
 *          - A clickable red control tile flips a real boolean (vivnprldht) that
 *            reverses that direction, turning your automatic rise into an automatic
 *            sink. This is a functional mechanic, not decorative -- corrected from the
 *            prior "decorative band" wording.
 *          - The rising "chaser" (mylefxfaev, aknlbboysnc sprite) is real code with a
 *            real self.lose() call, active only in levels 1-3, that advances only when
 *            you fail to gain height twice in a row. Mark confirms it basically never
 *            fires in normal play, which matches: reaching it requires repeated failed
 *            moves, and it's coded out entirely from level 4 on.
 *          - OPEN QUESTION, not yet resolved: a purple tile with a bit of yellow and
 *            white on it (ubhhgljbnpu/hzusueifitk in code) sets landed_on_spike and
 *            calls self.lose() when the auto-rise carries the player onto it -- i.e.
 *            the code says it's a fatal hazard tile, not a passage. Mark's play
 *            experience says the opposite: it reads as a pipe-like teleporter you
 *            sometimes have to enter to reach the next space. Neither of us has
 *            resolved this yet -- described here per the code, with the discrepancy
 *            flagged in `notes` rather than picked one way. Revisit against a replay
 *            or a level screenshot before trusting either read fully.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for BP35 game data.
 */

import { Arc3GameMetadata } from './types';

export const bp35: Arc3GameMetadata = {
  gameId: 'bp35',
  officialTitle: 'bp35',
  informalName: 'Buoyant Pursuit',
  description: 'Steer left or right through a flooded shaft; every move automatically carries you further in whichever direction is currently "up" until you hit something solid, and a control tile lets you flip which way that is.',
  simpleExplanation: 'You only ever move left or right — there is no up/down button. Instead, every sideways move automatically sucks you further in whatever direction is currently "up," and you can\'t opt out of it: move onto an open space and it keeps carrying you until you hit something solid. A red control tile flips which way is "up," so in some levels you sink instead of float. In levels 1 through 3 only, something rises toward you if you keep failing to gain height, and can end the level if it catches you — but that takes repeated failed moves in a row, so a normal playthrough basically never triggers it. What actually ends most runs is a fixed action budget, shown as a bar filling at the bottom of the screen.',
  mechanicsExplanation: 'You steer only left and right; there is no direct vertical action. Every left/right step is automatically followed by a slide through any open space in whichever direction currently counts as "up," continuing until you hit something solid -- this is not optional floating, it is a forced pull you cannot decline. A red clickable control tile flips a real boolean that reverses this pull, so later levels can have you sinking instead of rising after the same left/right input. In levels 1-3 only, a background sprite rises one step whenever you fail to gain height on a move, and if it reaches your row the level ends in a loss -- but the code only checks this after a failed move, on top of needing height parity, so it requires repeated failed moves in a row and effectively never triggers in normal play; from level 4 on the check is removed entirely. Regardless of level, a fixed action budget (a bar at the bottom of the screen, roughly double the length in the later levels) drains with every action taken and ends the run at zero. A goal tile ends the level in a win the moment your auto-rise carries you onto it. A purple tile marked with a touch of yellow and white ends the level in a loss when the auto-rise carries you onto it, per the game code -- though this conflicts with how it plays in practice (see notes) and is still unresolved.',
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
  notes: 'Reread 2026-09-12 by Mark, who actually plays this game, against the real bp35.py logic (not the placeholder `levels` list at the top of the file). Confirmed: the auto-rise is a forced pull with no opt-out, not optional floating; the gravity-flip control tile is a real functional mechanic, not decorative; and the rising "chaser" (mylefxfaev/aknlbboysnc) is real code with a real self.lose() call, gated to levels 1-3, but requires repeated failed moves in a row to trigger, which matches Mark never seeing it fire in practice. UNRESOLVED: a purple tile with a bit of yellow and white on it (ubhhgljbnpu/hzusueifitk in code) sets a fatal flag and ends the level when the auto-rise carries the player onto it, per the game source -- but Mark\'s play experience is that it works like a pipe/passage you sometimes have to enter to reach the next space, not a hazard. Revisit against a replay before trusting either read as final. Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from the game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results.',
};
