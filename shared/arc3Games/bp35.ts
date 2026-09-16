/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-13 (updated from Boss's live play across levels 2, 4, 6, 8 -- see notes)
 * PURPOSE: Game metadata for BP35 (Buoyant Pontoons), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026).
 *          Originally rewritten 2026-09-12 after reading bp35.py's real game logic
 *          (Bp35 / uakietkqfso class, obfuscated names) instead of the placeholder
 *          `levels` list at the top of the file. Confirmed against Boss's own play:
 *          - There is no vertical move action at all (available_actions = [3,4,6,7]:
 *            left, right, click, undo). Every left/right step (pywlvyklps) is
 *            automatically followed by an unstoppable slide (fsvnqdbzrp) through open
 *            space in whichever direction is currently "up" -- you cannot move
 *            sideways without also being carried in that direction. This is the
 *            "suction" Boss described, confirmed, not softened.
 *          - A clickable red control tile flips a real boolean (vivnprldht) that
 *            reverses that direction, turning your automatic rise into an automatic
 *            sink. This is a functional mechanic, not decorative, and is not always
 *            visible in the starting frame -- Boss has had to explore off-screen
 *            (level 4) and make a long down-then-up traversal (level 6) just to find it.
 *          - The rising "chaser" (mylefxfaev, aknlbboysnc sprite) is real code with a
 *            real self.lose() call, active only in levels 1-3, that advances only when
 *            you fail to gain height twice in a row. Boss confirms it basically never
 *            fires in normal play, which matches: reaching it requires repeated failed
 *            moves, and it's coded out entirely from level 4 on.
 *          - RESOLVED 2026-09-13: the purple tile with a bit of yellow and white on it
 *            (ubhhgljbnpu/hzusueifitk in code) kills the player when the auto-rise
 *            carries them onto it -- confirmed by Boss on every instance he's hit
 *            across multiple levels. This matches the code's self.lose() call. The
 *            death plays a teleport-into-the-void animation, but per Boss that is
 *            purely visual -- it is not an actual teleport, just an instant death
 *            with flair. Distinct from a second, unmarked solid-purple element seen
 *            on level 8, which behaves like buildable/climbable bridge material (Boss
 *            used it to reach the level 8 control tile) and separately "spreads" under
 *            a not-yet-understood rule -- do not conflate the two purple elements.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown traced in
 *          bp35-0a0ad940/bp35.py and run in the engine, and corrected the three text
 *          fields to match. Owner-confirmed facts kept (spikes kill, the void animation is
 *          only an animation, level 4's flip block starts above the view). Code settles
 *          the level-8 "spreading": clicking a plain Purple block removes it and fills
 *          every empty cell touching it with new Purple. Also corrected: the bar fills up
 *          (64 actions on levels 1-6, 128 on 7-9) rather than draining; the chaser rises on
 *          every other wasted move, not only after two failed moves in a row; Orange blocks
 *          and the Light Pink plus exit exist from levels 3 and 1, not from level 8; level
 *          5 does show its exit at the start.
 * SRP/DRY check: Pass - Single responsibility for BP35 game data.
 */

import { Arc3GameMetadata } from './types';

export const bp35: Arc3GameMetadata = {
  gameId: 'bp35',
  officialTitle: 'bp35',
  informalName: 'Buoyant Pontoons',
  description: 'Steer left or right through a flooded shaft; every move automatically carries you further in whichever direction is currently "up" until you hit something solid, and a control tile lets you flip which way that is. The level world is bigger than the viewport shown at start -- the exit and the control tile are routinely off-screen, so nearly every level requires scrolling/exploring to even locate them (level 5 is the one level whose exit is in view at the start).',
  simpleExplanation: 'You only move left and right. Whenever there is open space in the pull direction -- up, at the start of every level -- you get carried along until something solid stops you, and you cannot opt out. Click blocks to reshape the shaft: Green ones break, Orange ones switch between solid and see-through, Red ones flip the pull, and plain Purple ones break but grow into the empty cells around them. Reach the Light Pink plus, and never get carried into a Purple spike. The view shows only a slice of each level (about 10 rows of a shaft 32 to 50 rows tall), so the exit and the Red blocks usually start off-screen and you have to explore to find them.',
  mechanicsExplanation: 'You steer only left and right; there is no up or down action. Every sideways step is followed by a forced slide through any open space in whichever direction currently pulls you (up at the start of every level), until something solid stops you. Levels are 11 cells wide and far taller than the view, which scrolls to follow you, so the exit and the Red flip blocks are usually off-screen at the start -- on level 4 the one you need sits just above the starting view. You win by stepping or sliding onto the Light Pink plus. Clicking reshapes the level: a Green block breaks; an Orange block turns into see-through Orange dots you slide through, and clicking those turns them solid again; a Red block (from level 4) flips the pull and is used up, so later levels have you sinking instead of rising; a plain Purple block (from level 8) breaks, but every empty cell touching it fills with new Purple, which is how Purple spreads and how you build bridges with it. Being carried into a Purple spike -- a Purple block with a Black frame and a Yellow and White stripe -- kills you instantly; the shrinking-into-nothing effect is only the death animation. Walking sideways into a spike just bumps. In levels 1-3 a Purple-and-Black mass sits below you and rises one row whenever you make a move that goes nowhere (a bump, or a sideways step with no slide) and your running count of moves and clicks is even; if it reaches your row you lose. It is gone from level 4 on. Every action, including clicks on nothing and Undo, fills one step of a bar along the bottom edge: 64 actions on levels 1-6 (Purple on White), 128 on levels 7-9 (Light Pink, then Purple over it). Filling it ends the attempt. Undo takes back one action, including a gravity flip, but still costs a step.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'controls',
      text: 'Four actions: Left, Right, Click and Undo. There is no up or down key.',
      source: 'bp35.py:4479, 4512-4555',
    },
    {
      category: 'controls',
      text: 'You are a Blue ball. Left or Right moves you one cell sideways; the Yellow side of the ball shows which way you last moved.',
      source: 'bp35.py:3325-3334, 4077-4090',
    },
    {
      category: 'controls',
      text: 'After a sideways step, if the cell in the pull direction is open you keep sliding that way until something solid stops you. You cannot stop partway. Every level starts with the pull pointing up.',
      source: 'bp35.py:4100-4119, 4211-4221, 4040-4044',
    },
    {
      category: 'controls',
      text: 'Stepping into anything solid (a wall, a block, a spike) is a bump: the ball shakes in place and you do not move, but it still costs an action.',
      source: 'bp35.py:4197-4209',
    },
    {
      category: 'goal',
      text: 'The exit is a Light Pink plus with a Black outline. Step sideways onto it or slide onto it to win the level.',
      source: 'bp35.py:3380-3384, 4096-4099, 4222-4223',
    },
    {
      category: 'pieces',
      text: 'Black walls with Dark Gray specks are solid and nothing you do changes them.',
      source: 'bp35.py:3300-3304, 4289-4401',
    },
    {
      category: 'pieces',
      text: 'Click a Green block and it shrinks away. If it was the block holding you back in the pull direction, you slide on through the gap right away.',
      source: 'bp35.py:3235-3254, 4294-4304, 4231-4253',
    },
    {
      category: 'controls',
      text: 'Clicking anything else -- empty space, a wall, a spike, the exit, yourself -- does nothing, but it still costs an action. You can only click what is on screen.',
      source: 'bp35.py:4289-4293, 4400-4401, 4541-4545',
    },
    {
      category: 'feedback',
      text: 'The level is 11 cells wide and 32 to 50 rows tall, but the view only shows about 10 rows. It scrolls up and down to follow you, showing a little more space in the direction you are being pulled. The exit is out of view at the start on every level except level 5.',
      source: 'bp35.py:4040-4050, 4116-4119',
    },
    {
      category: 'budget',
      text: 'Every action fills one cell of a bar along the bottom edge of the screen: Purple filling a White row from the left. Moves, clicks on nothing and Undo all count. On levels 1-6 the level is lost when the bar hits 64.',
      source: 'bp35.py:4404-4445, 4512-4555',
    },
    {
      category: 'hazards',
      text: 'On levels 1-3 a Purple-and-Black mass sits below you. It rises one row whenever you make a move that goes nowhere -- a bump, or a sideways step with no slide -- and your running count of moves and clicks is even. Clicks and slides never raise it. If it reaches your row, you lose.',
      source: 'bp35.py:3370-3379, 4052-4075, 4102-4113, 4198-4209',
    },
    {
      category: 'controls',
      text: 'Undo puts the level back one action -- position, blocks and the pull direction -- but it still fills a cell of the bar, even when there is nothing left to undo.',
      source: 'bp35.py:463-467, 4546-4550',
    },
    {
      category: 'other',
      text: 'RESET restarts the level and empties the bar.',
      source: 'bp35.py:4551-4565; arcengine/base_game.py:305-330',
    },
    // ---- Level 2 ----
    {
      introducedOnLevel: 2,
      category: 'hazards',
      text: 'Purple spikes: a Purple block with a Black frame and a Yellow-White-Yellow stripe. If you are carried into one, you die -- the ball shrinks to a dot and vanishes, which is only the death animation. Stepping sideways onto a cell that has a spike right next to it in the pull direction counts too.',
      source: 'bp35.py:3360-3369, 3438-3502, 4122-4152, 4224-4225',
    },
    {
      introducedOnLevel: 2,
      category: 'hazards',
      text: 'Walking sideways straight into a spike is safe: it is only a bump.',
      source: 'bp35.py:4100, 4197-4209',
    },
    // ---- Level 3 ----
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Solid Orange block: click it and it turns into a see-through X of Orange dots that you walk and slide through. Click the dots and they turn back into a solid block.',
      source: 'bp35.py:3275-3284, 3503-3560, 4340-4384, 4217',
    },
    // ---- Level 4 ----
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Red block: click it and the pull reverses (up becomes down, or back again), the Red block is used up, and you slide the new way at once. It works from anywhere on screen, even when the Red block is buried inside a wall.',
      source: 'bp35.py:3255-3274, 3561-3626, 4385-4399, 4231-4253',
    },
    {
      introducedOnLevel: 4,
      category: 'feedback',
      text: 'Level 4 needs the pull reversed, and none of its Red blocks is in view at the start; the nearest sits just above the starting view.',
      source: 'bp35.py:3561-3626, 4040-4050',
    },
    {
      introducedOnLevel: 4,
      category: 'hazards',
      text: 'The rising Purple-and-Black mass is gone from level 4 on.',
      source: 'bp35.py:4052-4054',
    },
    // ---- Level 5 ----
    {
      introducedOnLevel: 5,
      category: 'hazards',
      text: 'From level 5 some spikes have the stripe on the other edge, lying on floors for when you are sinking. They kill the same way.',
      source: 'bp35.py:3365-3369, 3627-3692, 4224',
    },
    // ---- Level 7 ----
    {
      introducedOnLevel: 7,
      category: 'budget',
      text: 'From level 7 the bar allows 128 actions: the bottom row first fills Light Pink, then Purple fills over it. The level is lost when it reaches 128.',
      source: 'bp35.py:4446-4460',
    },
    // ---- Level 8 ----
    {
      introducedOnLevel: 8,
      category: 'pieces',
      text: 'Plain Purple block (no stripe): solid. Clicking it breaks it, but every empty cell touching it -- above, below, left and right -- fills with a new Purple block. That is how Purple spreads, and how you grow it into a bridge.',
      source: 'bp35.py:3305-3324, 3818-3884, 4305-4339',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'very-hard',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Click a control shape', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo', commonName: 'Undo', notes: 'One of only 3 public games (with lf52, sk48) where Undo is load-bearing, not a convenience -- see notes below.' },
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
      title: "BP35 Boss's Official Human Replay",
      url: 'https://arcprize.org/replay/c935ca1b-dfee-4be1-9574-bf4cc80c5b89',
      type: 'replay',
      description: "Boss's own official ARC Prize replay, human play, from the live-play session that confirmed the purple death-tile mechanic (2026-09-13).",
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
  notes: 'Reread 2026-09-12 by Boss, who actually plays this game, against the real bp35.py logic (not the placeholder `levels` list at the top of the file). Confirmed: the auto-rise is a forced pull with no opt-out, not optional floating; the gravity-flip control tile is a real functional mechanic, not decorative; and the rising "chaser" (mylefxfaev/aknlbboysnc) is real code with a real self.lose() call, gated to levels 1-3, but requires repeated failed moves in a row to trigger, which matches Boss never seeing it fire in practice. EARLY OBSERVATION (2026-09-13, live play, level 2), later refined -- see RESOLVED note below: the purple tile with a bit of yellow and white on it (ubhhgljbnpu/hzusueifitk in code) does something to the player when the auto-rise carries them onto it that initially looked like a teleport. Also from live level 2 play: the level layout forks -- the shaft splits into branches, and which way you move left/right (combined with the forced auto-slide) determines which branch, and which tile type (purple vs green), you end up on. This path-choice structure is separate from the purple-tile behavior itself and should be reflected in the mechanics description. Also from live level 4 play (2026-09-13): the buoyancy-flip control tile is off-screen at level start -- it sits above the visible frame, so you have to float up and explore to find it before you even know it exists. Level 4 needs the opposite parity (sink, not rise) from what worked before, so any fixed hypothesis fails until the hidden tile is found and clicked. Boss flags this as a likely human-vs-agent difficulty gap: a human explores and finds it, an agent locked onto a working hypothesis from earlier levels probably does not. From live level 6 play (2026-09-13): the control tile is not just off-screen but far off-screen -- reaching it means tracing all the way down to the bottom of the map, then all the way back up to the opposite corner where the red tile sits. So the discovery/traversal cost the control tile imposes appears to grow across levels (level 4: just above the start frame; level 6: a long down-then-up round trip), not a one-time trick. From live level 8 play (2026-09-13): a new mass of solid purple blocks appears (visually distinct from the earlier individual yellow/white-marked purple tiles seen on levels 2/4/6 -- this looks like a different element, not confirmed the same mechanic). These purple blocks seem to spread as a result of certain mistakes, and Boss has not worked out the exact trigger/rule yet. Some mistakes on this level are apparently unrecoverable in place and require Undo or a full Reset rather than just continuing to play through them. Level 8 also introduces orange circle tiles, orange checkered tiles, and a pink plus/cross tile not seen on earlier levels -- purpose of each not yet documented. RESOLVED 2026-09-13 (level 8 play, then corrected by Boss right after): the yellow/white-marked purple tile kills the player when the auto-rise carries them onto it -- confirmed on every instance Boss has hit, across levels. It plays a teleport-into-the-void death animation, but Boss confirmed that\'s purely the animation -- there is no actual teleportation, it\'s an instant death dressed up to look like one. This is a different element from the plain solid-purple blocks also seen on level 8, which act as buildable/climbable bridge material (used to reach that level\'s control tile) and separately "spread" under a rule still not worked out -- the two purple elements are visually distinct (marked vs unmarked) and should be tracked separately going forward. Boss\'s working prediction for level 9 is that the marked purple tiles will behave the same way (instant death with the void animation) -- unconfirmed until played. General principle from live play across levels 2/4/6/8 (2026-09-13): this game never shows the exit or the control tile up front -- every level requires exploring the full map to find them, not just reacting to what is visible in the start frame. That exploration requirement, more than any single mechanic, looks like the core human-vs-agent difficulty driver for this game. Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No embedded replay video for this game (2026-09-14): tried rendering Boss\'s official replay recording via generate_arc3_video.py, but the raw NDJSON only captures one frame per completed action (pre/post state), not the intermediate ticks of the forced auto-slide -- so the rendered clip cut instantly between resting positions instead of showing the actual sliding motion, which for a game built entirely around continuous slide animation looked broken/misleading. Pulled the video field rather than ship it. The three replay links under resources (two GPT-6 Astra runs, one Boss\'s own) remain the way to actually watch this game played. Level screenshots were rendered from the game source on 2026-09-12; no hints exist yet. ACTION7 (Undo) cross-game note (2026-09-14): six of the 25 public games expose ACTION7 (bp35, lf52, sk48, ar25, su15, sb26), but Boss identifies bp35, lf52, and sk48 as the three where Undo is actually load-bearing -- necessary to realistically complete the game -- versus ar25/su15/sb26 where it\'s more of a convenience. In bp35 specifically: every left/right press triggers the forced, un-declinable auto-slide, so a single directional choice can carry you onto a fatal purple tile or into a wasted detour with no way to stop partway through and reconsider -- Undo is the only way to back out of a bad slide before it costs you the level or the action budget, since the level world extends beyond the viewport and you often can\'t see the consequence of a direction choice before committing to it. See lf52.ts and sk48.ts for the other two. Most of the remaining ~19 games have no undo at all -- Boss\'s read is that this is deliberate, since giving it to them would remove a big chunk of their difficulty (mistakes there are meant to be costly and are part of the challenge).',
};
