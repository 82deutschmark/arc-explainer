/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-13 (updated from Mark's live play across levels 2, 4, 6, 8 -- see notes)
 * PURPOSE: Game metadata for BP35 (Buoyant Pontoons), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026).
 *          Originally rewritten 2026-09-12 after reading bp35.py's real game logic
 *          (Bp35 / uakietkqfso class, obfuscated names) instead of the placeholder
 *          `levels` list at the top of the file. Confirmed against Mark's own play:
 *          - There is no vertical move action at all (available_actions = [3,4,6,7]:
 *            left, right, click, undo). Every left/right step (pywlvyklps) is
 *            automatically followed by an unstoppable slide (fsvnqdbzrp) through open
 *            space in whichever direction is currently "up" -- you cannot move
 *            sideways without also being carried in that direction. This is the
 *            "suction" Mark described, confirmed, not softened.
 *          - A clickable red control tile flips a real boolean (vivnprldht) that
 *            reverses that direction, turning your automatic rise into an automatic
 *            sink. This is a functional mechanic, not decorative, and is not always
 *            visible in the starting frame -- Mark has had to explore off-screen
 *            (level 4) and make a long down-then-up traversal (level 6) just to find it.
 *          - The rising "chaser" (mylefxfaev, aknlbboysnc sprite) is real code with a
 *            real self.lose() call, active only in levels 1-3, that advances only when
 *            you fail to gain height twice in a row. Mark confirms it basically never
 *            fires in normal play, which matches: reaching it requires repeated failed
 *            moves, and it's coded out entirely from level 4 on.
 *          - RESOLVED 2026-09-13: the purple tile with a bit of yellow and white on it
 *            (ubhhgljbnpu/hzusueifitk in code) kills the player when the auto-rise
 *            carries them onto it -- confirmed by Mark on every instance he's hit
 *            across multiple levels. This matches the code's self.lose() call. The
 *            death plays a teleport-into-the-void animation, but per Mark that is
 *            purely visual -- it is not an actual teleport, just an instant death
 *            with flair. Distinct from a second, unmarked solid-purple element seen
 *            on level 8, which behaves like buildable/climbable bridge material (Mark
 *            used it to reach the level 8 control tile) and separately "spreads" under
 *            a not-yet-understood rule -- do not conflate the two purple elements.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for BP35 game data.
 */

import { Arc3GameMetadata } from './types';

export const bp35: Arc3GameMetadata = {
  gameId: 'bp35',
  officialTitle: 'bp35',
  informalName: 'Buoyant Pontoons',
  description: 'Steer left or right through a flooded shaft; every move automatically carries you further in whichever direction is currently "up" until you hit something solid, and a control tile lets you flip which way that is. The exit and the control tile are rarely visible at level start -- every level requires exploring the full map to find them.',
  simpleExplanation: 'You only ever move left or right — there is no up/down button. Instead, every sideways move automatically sucks you further in whatever direction is currently "up," and you can\'t opt out of it: move onto an open space and it keeps carrying you until you hit something solid. A red control tile flips which way is "up," so in some levels you sink instead of float -- and that tile is not always on screen when the level starts. On level 4, for example, it sits above the visible frame, so you have to float up first just to discover it exists before you can use it. A hypothesis that only worked on earlier levels (e.g. "always rise") breaks here, and finding the fix means exploring off-screen, not reasoning from what is visible. In levels 1 through 3 only, something rises toward you if you keep failing to gain height, and can end the level if it catches you — but that takes repeated failed moves in a row, so a normal playthrough basically never triggers it. What actually ends most runs is a fixed action budget, shown as a bar filling at the bottom of the screen. More generally, this game does not show you the exit up front on any level -- you have to explore the whole map just to find where you\'re going, not just to find the control tile.',
  mechanicsExplanation: 'You steer only left and right; there is no direct vertical action. Every left/right step is automatically followed by a slide through any open space in whichever direction currently counts as "up," continuing until you hit something solid -- this is not optional floating, it is a forced pull you cannot decline. A red clickable control tile flips a real boolean that reverses this pull, so later levels can have you sinking instead of rising after the same left/right input. Critically, this control tile is not guaranteed to be visible in the starting viewport -- on level 4 it sits above the frame shown at level start, off-screen, and has to be discovered by floating up before a player even knows it exists. Levels can require the opposite parity from what worked before (level 4 requires sinking, not rising), so a fixed rise/sink hypothesis carried over from earlier levels fails until the off-screen tile is found and toggled. In levels 1-3 only, a background sprite rises one step whenever you fail to gain height on a move, and if it reaches your row the level ends in a loss -- but the code only checks this after a failed move, on top of needing height parity, so it requires repeated failed moves in a row and effectively never triggers in normal play; from level 4 on the check is removed entirely. Regardless of level, a fixed action budget (a bar at the bottom of the screen, roughly double the length in the later levels) drains with every action taken and ends the run at zero. A goal tile ends the level in a win the moment your auto-rise carries you onto it. A purple tile marked with a touch of yellow and white kills you when the auto-rise carries you onto it -- confirmed consistently in live play, not a passage. The death plays out as an animation that looks like being pulled/teleported into the void, but that is purely visual flair on an instant death, not an actual teleport to another location. This is a separate element from the plain, unmarked solid-purple blocks that appear from level 8 on: those behave as buildable/climbable bridge material and separately seem to spread under a rule not yet worked out -- the two purple elements should not be conflated.',
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'very-hard',
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
    {
      title: "BP35 Mark's Official Human Replay",
      url: 'https://arcprize.org/replay/c935ca1b-dfee-4be1-9574-bf4cc80c5b89',
      type: 'replay',
      description: "Mark's own official ARC Prize replay, human play, from the live-play session that confirmed the purple death-tile mechanic (2026-09-13).",
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
  video: {
    src: '/videos/arc3/bp35-c935ca1bdfee.mp4',
    caption: "Mark's full official human playthrough (recorded 2026-09-13) -- 16 recorded deaths before the win, rendered from the raw ARC Prize recording.",
  },
  isFullyDocumented: false,
  notes: 'Reread 2026-09-12 by Mark, who actually plays this game, against the real bp35.py logic (not the placeholder `levels` list at the top of the file). Confirmed: the auto-rise is a forced pull with no opt-out, not optional floating; the gravity-flip control tile is a real functional mechanic, not decorative; and the rising "chaser" (mylefxfaev/aknlbboysnc) is real code with a real self.lose() call, gated to levels 1-3, but requires repeated failed moves in a row to trigger, which matches Mark never seeing it fire in practice. EARLY OBSERVATION (2026-09-13, live play, level 2), later refined -- see RESOLVED note below: the purple tile with a bit of yellow and white on it (ubhhgljbnpu/hzusueifitk in code) does something to the player when the auto-rise carries them onto it that initially looked like a teleport. Also from live level 2 play: the level layout forks -- the shaft splits into branches, and which way you move left/right (combined with the forced auto-slide) determines which branch, and which tile type (purple vs green), you end up on. This path-choice structure is separate from the purple-tile behavior itself and should be reflected in the mechanics description. Also from live level 4 play (2026-09-13): the buoyancy-flip control tile is off-screen at level start -- it sits above the visible frame, so you have to float up and explore to find it before you even know it exists. Level 4 needs the opposite parity (sink, not rise) from what worked before, so any fixed hypothesis fails until the hidden tile is found and clicked. Mark flags this as a likely human-vs-agent difficulty gap: a human explores and finds it, an agent locked onto a working hypothesis from earlier levels probably does not. From live level 6 play (2026-09-13): the control tile is not just off-screen but far off-screen -- reaching it means tracing all the way down to the bottom of the map, then all the way back up to the opposite corner where the red tile sits. So the discovery/traversal cost the control tile imposes appears to grow across levels (level 4: just above the start frame; level 6: a long down-then-up round trip), not a one-time trick. From live level 8 play (2026-09-13): a new mass of solid purple blocks appears (visually distinct from the earlier individual yellow/white-marked purple tiles seen on levels 2/4/6 -- this looks like a different element, not confirmed the same mechanic). These purple blocks seem to spread as a result of certain mistakes, and Mark has not worked out the exact trigger/rule yet. Some mistakes on this level are apparently unrecoverable in place and require Undo or a full Reset rather than just continuing to play through them. Level 8 also introduces orange circle tiles, orange checkered tiles, and a pink plus/cross tile not seen on earlier levels -- purpose of each not yet documented. RESOLVED 2026-09-13 (level 8 play, then corrected by Mark right after): the yellow/white-marked purple tile kills the player when the auto-rise carries them onto it -- confirmed on every instance Mark has hit, across levels. It plays a teleport-into-the-void death animation, but Mark confirmed that\'s purely the animation -- there is no actual teleportation, it\'s an instant death dressed up to look like one. This is a different element from the plain solid-purple blocks also seen on level 8, which act as buildable/climbable bridge material (used to reach that level\'s control tile) and separately "spread" under a rule still not worked out -- the two purple elements are visually distinct (marked vs unmarked) and should be tracked separately going forward. Mark\'s working prediction for level 9 is that the marked purple tiles will behave the same way (instant death with the void animation) -- unconfirmed until played. General principle from live play across levels 2/4/6/8 (2026-09-13): this game never shows the exit or the control tile up front -- every level requires exploring the full map to find them, not just reacting to what is visible in the start frame. That exploration requirement, more than any single mechanic, looks like the core human-vs-agent difficulty driver for this game. Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from the game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results.',
};
