/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-13 (renamed and reframed after Mark's own playthrough)
 * PURPOSE: Game metadata for G50T (Ghost Twin, formerly "Ghost Timer"), part of the
 *          ARC-AGI-3 public demo set (25 games as of Sep 2026).
 *          Renamed 2026-09-13 per Mark: "Timer" was the wrong headline -- the timer
 *          bar is real (confirmed in code, drains on a fixed schedule, ends the run at
 *          zero) but it isn't what makes the game hard or interesting. The defining
 *          mechanic, confirmed by rereading G50t/qxlodtievc.move() and .pmlawcgvcp()
 *          in g50t.py: every successful move is silently recorded, and the fifth
 *          action doesn't just "rewind" -- it walks you back to the start step by
 *          step, then clones your just-finished run into a ghost twin that owns that
 *          exact move list and replays it move-for-move alongside your next attempt.
 *          Mark's framing, confirmed against source: pressing it is like saying
 *          "remember everything I just did, send me back to start, and spawn a twin
 *          that performs those exact moves and nothing else." Nothing in the level
 *          hints at this before you try it, so a blind first run can't be perfect --
 *          you have to burn an attempt discovering what the fifth action even does.
 *          Prior corrections retained, not re-verified this pass: patrols only exist
 *          in the last 2 of 7 levels, and 3 levels add a paired-tile teleport
 *          mechanic. See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for G50T game data.
 */

import { Arc3GameMetadata } from './types';

export const g50t: Arc3GameMetadata = {
  gameId: 'g50t',
  officialTitle: 'g50t',
  informalName: 'Ghost Twin',
  description: 'Every move you make is being recorded; the fifth action sends you back to the start and spawns a twin that replays those exact moves alongside you, all under a draining timer bar.',
  simpleExplanation: 'Nothing tells you this up front, so figuring it out costs you a run: every move you make toward the goal chest is being recorded. The fifth action isn\'t a simple rewind — it walks you back to the start and spawns a ghost twin that performs that exact recorded sequence, move for move, right alongside whatever you do next. You\'re meant to use that twin to hold a pressure plate down while the real you goes finish the job. A timer bar drains as you act and ends the run if it empties first.',
  mechanicsExplanation: 'You control a small avatar navigating a dungeon-style room toward a goal chest, and every successful move is silently appended to a history list. The fifth action doesn\'t move you -- it plays that history back in reverse to walk you to the start, then clones your just-finished self into a ghost twin bound to that exact move list. From then on, the twin re-executes its recorded moves in lockstep with your live moves, one step per step you take, whether or not that still makes sense for the room you\'re now in. Nothing in the level explains this before you trigger it, so a first attempt can\'t be a clean run -- you\'re meant to spend it learning what the fifth action does, then use the twin(s) it leaves behind to hold pressure plates while the real you reaches the chest. A timer bar drains on a fixed schedule tied to your action count and ends the run at zero if it beats you there. The last two levels add roaming patrols that kill on contact, and three middle levels add paired tiles that teleport whatever is standing on one to its linked partner.',
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
  notes: 'Renamed 2026-09-13 from "Ghost Timer" to "Ghost Twin" by Mark, who played it: the timer bar is real but isn\'t the point, and the old name buried the actual mechanic -- an unexplained fifth action that records your moves and replays them via a cloned twin. Confirmed against g50t.py that move history is recorded and replayed exactly as Mark described. Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: "dodge patrols" and "a handful of ghosts" both overstated what most levels actually contain, and a teleport-tile mechanic in 3 levels was missing entirely.',
};
