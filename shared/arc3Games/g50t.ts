/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-13 (renamed and reframed after Boss's own playthrough)
 * PURPOSE: Game metadata for G50T (Ghost Twin, formerly "Ghost Timer"), part of the
 *          ARC-AGI-3 public demo set (25 games as of Sep 2026).
 *          Renamed 2026-09-13 per Boss: "Timer" was the wrong headline -- the timer
 *          bar is real (confirmed in code, drains on a fixed schedule, ends the run at
 *          zero) but it isn't what makes the game hard or interesting. The defining
 *          mechanic, confirmed by rereading G50t/qxlodtievc.move() and .pmlawcgvcp()
 *          in g50t.py: every successful move is silently recorded, and the fifth
 *          action doesn't just "rewind" -- it walks you back to the start step by
 *          step, then clones your just-finished run into a ghost twin that owns that
 *          exact move list and replays it move-for-move alongside your next attempt.
 *          Boss's framing, confirmed against source: pressing it is like saying
 *          "remember everything I just did, send me back to start, and spawn a twin
 *          that performs those exact moves and nothing else." Nothing in the level
 *          hints at this before you try it, so a blind first run can't be perfect --
 *          you have to burn an attempt discovering what the fifth action even does.
 *          Prior corrections retained, not re-verified this pass: patrols only exist
 *          in the last 2 of 7 levels, and 3 levels add a paired-tile teleport
 *          mechanic. See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *
 * 2026-09-16 (Claude Opus 5, mechanics breakdown pass): added mechanicsBreakdown, read from
 *          g50t.py (build 5849a774) and run in the engine: the level 1 ghost-holds-the-plate
 *          solve, a gate closing on the player, the second rewind on level 1 wiping the ghost,
 *          a two-ghost swap on level 4, a patrol landing on the player on level 6, and the
 *          timer running out on action 130. Kept the ghost-twin facts. Corrected: the "paired
 *          tiles" are not stepped-on teleporters -- a purple plate swaps whatever stands on
 *          two hollow purple pads, on levels 4, 5 and 7 (7 is the last level, not a middle
 *          one); patrols walk a fixed hidden route one square per move you make and kill you
 *          when they finish a step on your square; "goal chest" is a blue bracket you step
 *          into. Added what was missing: gates crush you, yellow gates toggle, level 1 allows
 *          one ghost and later levels two, and a rewind past that limit wipes every ghost.
 * SRP/DRY check: Pass - Single responsibility for G50T game data.
 */

import { Arc3GameMetadata } from './types';

export const g50t: Arc3GameMetadata = {
  gameId: 'g50t',
  officialTitle: 'g50t',
  informalName: 'Ghost Twin',
  description: 'Every move you make is being recorded; the fifth action sends you back to the start and spawns a twin that replays those exact moves alongside you, all under a draining timer bar.',
  simpleExplanation: 'Nothing tells you this up front, so figuring it out costs you a run: every move you make toward the goal is being recorded. The fifth action isn\'t a simple rewind — it walks you back to the start and spawns a ghost twin that performs that exact recorded sequence, move for move, right alongside whatever you do next. You\'re meant to use that twin to hold a pressure plate down while the real you goes finish the job. A timer bar drains as you act and ends the run if it empties first.',
  mechanicsExplanation: 'You control a small blue square moving through black corridors toward the goal (an open blue bracket you step into), and every successful move is silently appended to a history list. The fifth action doesn\'t move you -- it plays that history back in reverse to walk you to the start, then clones your just-finished self into a ghost twin bound to that exact move list. From then on, the twin re-executes its recorded moves in lockstep with your live moves, one step per step you take, whether or not that still makes sense for the room you\'re now in. Nothing in the level explains this before you trigger it, so a first attempt can\'t be a clean run -- you\'re meant to spend it learning what the fifth action does, then use the twin(s) it leaves behind to hold pressure plates while the real you reaches the chest. A timer bar drains on a fixed schedule tied to your action count and ends the run at zero if it beats you there. Plates open gates only while something stands on them, and a gate that shuts on you kills you; yellow gates instead flip open or shut each time their plate is pressed. Level 1 lets you keep one ghost and later levels two; rewinding once more wipes every ghost and starts the cycle over. The last two levels add green patrols that walk a fixed, unmarked route one square for each move you make and kill you if they finish a step on your square. Levels 4, 5 and 7 add hollow purple pads: pressing the purple plate swaps whatever is standing on one pad with whatever is on the other.',
  mechanicsBreakdown: [
    {
      category: 'controls',
      text: 'Arrow keys move your blue square (with a black center dot) one square along the black corridors. A move into a wall or a shut gate does nothing, is not recorded, and does not move any ghost or patrol, but it still counts against the timer.',
      source: 'g50t.py:1847, 2644-2658, 2670-2680, 2816-2828',
    },
    {
      category: 'controls',
      text: 'The fifth action is rewind. It walks you back to the start one step at a time (ghosts and patrols rewind with you), then leaves a ghost at the start that will replay the moves you just made. Pressing it before you have moved does nothing except use up a timer tick.',
      source: 'g50t.py:2698-2726, 2752-2777, 2824-2825',
    },
    {
      category: 'controls',
      text: 'There is no undo beyond rewind. RESET restarts the level from scratch with no ghosts and a full timer.',
      source: 'g50t.py:2793, 2796-2802; arcengine/base_game.py:305-329',
    },
    {
      category: 'goal',
      text: 'The goal is a blue bracket, an open box with a dot inside. Step your square into it and the next level loads.',
      source: 'g50t.py:2515-2517, 2805-2807, 2833-2839',
    },
    {
      category: 'pieces',
      text: 'A ghost is a gray copy of your square. Each time you make a successful move, every ghost makes its next recorded move at the same time. If that move is now blocked, the ghost skips it and carries on with the rest. When its list runs out it stands still.',
      source: 'g50t.py:2086-2093, 2680-2687, 2769-2772',
    },
    {
      category: 'pieces',
      text: 'Ghosts cannot be killed and do not block you. They do press plates, which is what they are for.',
      source: 'g50t.py:2644-2658, 2745-2749',
    },
    {
      category: 'pieces',
      text: 'Plates are small colored squares on the floor, joined to a gate by a thin line of the same color. A red plate holds its gate open only while you, a ghost or a patrol stands on it; step off and the gate slides shut again.',
      source: 'g50t.py:2111-2176, 2198-2236, 2664-2668, 2745-2749',
    },
    {
      category: 'hazards',
      text: 'A gate that slides shut onto your square kills you: the square bursts apart and the run is over.',
      source: 'g50t.py:2043-2079, 2237-2247, 2829-2832, 2841-2842',
    },
    {
      category: 'budget',
      text: 'The blue bar along the bottom is a timer. It slides one cell to the left for every two actions you take (moves, blocked moves and rewinds all count). It is gone after 128 actions, and the 130th action on a level loses the game.',
      source: 'g50t.py:2826-2828, 2841-2849',
    },
    {
      category: 'feedback',
      text: 'The small squares at the top left are ghost slots. The one in use is blue with a blue bar under it, used ones turn gray, and unused ones are light gray.',
      source: 'g50t.py:2402-2428, 2632-2639, 2736-2744, 2774-2777',
    },
    {
      category: 'pieces',
      text: 'Level 1 has two slots, so it allows one ghost. Rewinding again once every slot is used wipes all ghosts and starts over with none.',
      source: 'g50t.py:1636-1653, 2759-2765',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Three slots from here on, so you can keep two ghosts at once, each replaying its own run.',
      source: 'g50t.py:1655-1677, 2759-2773',
    },
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Yellow plates and yellow gates. A yellow gate does not care when you step off: each new press of its plate flips it, open the first time and shut the next.',
      source: 'g50t.py:1679-1705, 2186-2205',
    },
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Hollow purple pads and a purple plate. When something presses the plate, there is a short pause and a small purple animation on the line between the pads, then whatever stands on one pad swaps places with whatever stands on the other. That is the only way onto some parts of the map.',
      source: 'g50t.py:1707-1731, 2264-2367, 2555-2569, 2596-2622',
    },
    {
      introducedOnLevel: 6,
      category: 'hazards',
      text: 'A green patrol (a green square with a black dot) walks a route that is not drawn on the map, one square each time you make a successful move, turning at corners and doubling back at dead ends. If it finishes a step on your square, you die. Patrols rewind with you.',
      source: 'g50t.py:1768-1805, 2436-2491, 2544-2554, 2688-2718',
    },
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'Patrols press plates too, and a gate that shuts on a patrol kills it.',
      source: 'g50t.py:2248-2251, 2745-2749',
    },
    {
      introducedOnLevel: 7,
      category: 'pieces',
      text: 'Two purple plates and two separate pairs of purple pads, plus a patrol.',
      source: 'g50t.py:1807-1843',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'very-hard',
  levelCount: 7,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION5', description: 'Rewind (spawn a ghost)', commonName: 'Rewind' },
  ],
  hints: [],
  resources: [
    {
      title: 'G50T Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/86b31ba0-245b-44c1-8587-bf7782bc27f2',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'G50T Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/b93ce848-16a9-4930-994b-871dd64ed93d',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: "G50T Boss's Official Human Replay",
      url: 'https://arcprize.org/replay/58483738-cfaf-4e57-8c55-4c9c593bbab5',
      type: 'replay',
      description: "Boss's own official ARC Prize replay, human play (2026-09-15).",
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/g50t/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/g50t/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/g50t/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/g50t/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/g50t/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/g50t/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/g50t/lvl7.png' },
  ],
  tags: ['ghost-twin', 'move-recording', 'time-loop', 'timer', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Renamed 2026-09-13 from "Ghost Timer" to "Ghost Twin" by Boss, who played it: the timer bar is real but isn\'t the point, and the old name buried the actual mechanic -- an unexplained fifth action that records your moves and replays them via a cloned twin. Confirmed against g50t.py that move history is recorded and replayed exactly as Boss described. Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: "dodge patrols" and "a handful of ghosts" both overstated what most levels actually contain, and a teleport-tile mechanic in 3 levels was missing entirely.',
};
