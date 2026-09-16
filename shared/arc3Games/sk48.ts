/*
 * Author: Claude Sonnet 5; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-09-11 (corrected against source 2026-09-12 and 2026-09-16)
 * PURPOSE: Game metadata for SK48 (Skewer Kebabs), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the skewer actively pushes beads ahead of its tip (and can be
 *          blocked from extending at all), and level 5+ adds solid walls the skewer
 *          can't push through. Win-condition specifics still need a fuller pass.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, traced from
 *          sk48-d8078629/sk48.py and run in the engine. The win condition is now pinned
 *          down: level 1 was cleared in 14 moves (found by breadth-first search over the
 *          engine and replayed from a fresh start), and the level 4 rule (the references
 *          belong to the two fixed rods, not your rod) was checked by placing beads and
 *          calling the win check. Corrected the text: a bead with nowhere to go does NOT
 *          block the extension -- the rod slides through it and skewers it; extension is
 *          only stopped by the board edge or a wall. Walls exist on levels 5 and 6 only,
 *          not "5 on". Retracting drags the beads on the rod back with it.
 * SRP/DRY check: Pass - Single responsibility for SK48 game data.
 */

import { Arc3GameMetadata } from './types';

export const sk48: Arc3GameMetadata = {
  gameId: 'sk48',
  officialTitle: 'sk48',
  informalName: 'Skewer Kebabs',
  description: 'Extend, retract and slide a skewer that pushes colored beads ahead of its tip and skewers the ones that can\'t move, until the beads on each skewer match the reference skewers at the bottom.',
  simpleExplanation: 'You extend, pull back and slide a skewer to push colored beads around and skewer them. Get the beads on each skewer into the same color order as the reference skewer shown at the bottom before you run out of energy.',
  mechanicsExplanation: 'Each rod sticks out of a square handle. Pressing the rod\'s own direction extends it one segment, pressing the opposite way pulls it back one segment, and pressing sideways slides the whole rod one step along the striped rail beside its handle (no rail, no slide). Extending doesn\'t pass through loose beads -- it pushes each one ahead of the tip -- but a bead that can\'t be pushed any further (board edge, wall, or another stuck bead) stays put and the rod slides through it, skewering it. Beads already on the rod ride along when it extends, get dragged back when it retracts, and get carried when it slides; a slide that would push a bead off the board doesn\'t happen, and the tip can\'t go past the board edge or into a wall. The strip at the bottom holds a reference rod for each rod that counts: the level clears when the beads on each matching rod, read outward from its handle, have the reference\'s colors in the same order, and a white dot marks each position that already matches. From level 3 there are fixed rods you can\'t move, and on level 4 the references belong to two fixed rods while your own rod is only a tool. Solid black walls appear on levels 5 and 6, and from level 6 you switch between two rods by clicking a handle. Every direction press costs 1 of the level\'s 196 energy; clicks and undo are free, undo restores rods and beads but not energy, and running out of energy ends the game.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'Press the direction the selected rod points (away from its handle) to extend it one segment. Press the opposite direction to pull it back one segment. It never shrinks below the one segment under its handle.', source: 'sk48.py:768-791; engine run on level 1' },
    { category: 'controls', text: 'Press a sideways direction to slide the whole rod, handle and all, one step along the striped gray rail beside the handle. Where the rail ends, or with no rail, nothing moves.', source: 'sk48.py:792-797; engine run on level 1' },
    { category: 'controls', text: 'Every direction press costs 1 energy, even when nothing moves.', source: 'sk48.py:768-769; engine run on level 1' },
    { category: 'controls', text: 'Undo (ACTION7) puts the rods and beads back as they were before your last move that changed something, and you can keep pressing it back to the level start. It is free, but it does not give back energy.', source: 'sk48.py:757-758, 739-742, 861-891; engine run on level 1' },
    { category: 'controls', text: 'RESET restores the level with full energy.', source: 'sk48.py:656-659; arcengine/base_game.py:305-330; engine run' },
    { category: 'goal', text: 'The strip below the long line at the bottom shows a reference rod with a row of colored beads for each rod that counts, matched to it by handle color. The level clears when the beads on each of those rods, read outward from its handle, have the reference\'s colors in the same order.', source: 'sk48.py:661-676, 684-690, 842-859, 731-738; engine run: level 1 cleared in 14 moves' },
    { category: 'goal', text: 'Only the first as many beads as the reference holds are checked; extra beads further out on the rod don\'t matter.', source: 'sk48.py:850-859' },
    { category: 'pieces', text: 'Your rod is a gray zigzag bar sticking out of a pink square handle. Beads are small colored squares. Level 1 has one rod, a rail beside its handle, and a column of red, blue and green beads to be skewered as red, green, blue.', source: 'sk48.py:268-298' },
    { category: 'pieces', text: 'Extending pushes a loose bead just ahead of the tip along in front of it, and beads already on the rod ride forward with it.', source: 'sk48.py:775-785, 893-944; engine run on level 7' },
    { category: 'pieces', text: 'A bead that can\'t be pushed any further (board edge, wall, or another bead that is stuck) stays where it is and the rod slides through it. That is how a bead gets skewered.', source: 'sk48.py:905-921; engine runs on levels 1 and 7' },
    { category: 'pieces', text: 'Pulling the rod back drags the beads on it back toward the handle. A bead right next to the handle has nowhere to go, so the rod pulls out of it and leaves it loose.', source: 'sk48.py:786-791, 893-944; engine run on level 1' },
    { category: 'pieces', text: 'Sliding carries every bead on the rod and pushes loose beads in its way. If a bead would be pushed off the board, the slide doesn\'t happen.', source: 'sk48.py:792-797, 893-944; engine run on level 1' },
    { category: 'hazards', text: 'The tip can\'t go past the edge of the board. An extension that would do that does nothing, and still costs 1.', source: 'sk48.py:775-777, 960-971; engine run' },
    { category: 'budget', text: 'Each level gives 196 energy, and only direction presses spend it. Clicks and undo are free.', source: 'sk48.py:658-659, 769' },
    { category: 'hazards', text: 'When energy hits 0 the game is over. There are no lives. A move that clears the level with your last point still counts.', source: 'sk48.py:731-745, 763-766; engine run: the 196th press on level 1 ended the game' },
    { category: 'feedback', text: 'The long line above the bottom strip is the energy bar: gray for energy left, dark gray for energy spent. It refills at the start of each level.', source: 'sk48.py:629-639, 658-659' },
    { category: 'feedback', text: 'A white dot appears on a reference bead whenever the bead in the same position on the matching rod has the same color, so you can see which positions are already right.', source: 'sk48.py:684-690, 842-859; engine run on level 1' },
    { category: 'feedback', text: 'When a bead gets newly skewered, an outline in the bead\'s color flashes around it for a moment.', source: 'sk48.py:718-730, 797-802; engine runs: 3 frames on a skewering move, 2 on a plain one' },
    { category: 'feedback', text: 'The selected rod\'s handle has a white inside and its rod is drawn a lighter gray. Its reference in the bottom strip lights up the same way.', source: 'sk48.py:818-840' },
    { category: 'feedback', text: 'On a clear, all the beads on the rods flash white a few times before the next level loads.', source: 'sk48.py:709-717, 731-738' },
    { introducedOnLevel: 3, category: 'pieces', text: 'A fixed rod appears: a vertical rod with a black handle and a yellow center, which you can\'t select or move. Your rod passes straight through it. A bead on it can slide up and down along it (your rod can carry it that way), but nothing can push it sideways off the rod.', source: 'sk48.py:335-376, 922-935; engine run on level 3' },
    { introducedOnLevel: 4, category: 'goal', text: 'The rods you must fill can be ones you don\'t control. On level 4 the two references belong to the two fixed rods at the top (light blue and yellow centers), and your pink rod has no reference at all: it is only a tool for moving beads onto them.', source: 'sk48.py:377-427, 661-676; engine check: beads placed on the fixed rods in reference order passed the win check' },
    { introducedOnLevel: 5, category: 'hazards', text: 'Solid black wall squares appear on levels 5 and 6. The tip can\'t extend into one and beads can\'t be pushed into one.', source: 'sk48.py:450, 498, 960-971' },
    { introducedOnLevel: 6, category: 'controls', text: 'Two rods you control, pink and purple. Click a rod\'s handle, or its reference in the bottom strip, to switch to it. Switching is free, and clicking anything else does nothing.', source: 'sk48.py:746-756; engine run on level 7' },
    { introducedOnLevel: 6, category: 'pieces', text: 'The purple rod hangs down from the top and slides left and right along a rail across the top. The two rods pass straight through each other.', source: 'sk48.py:467-520, 792-797; engine run on level 7' },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'very-hard',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION1', description: 'Extend/retract Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Extend/retract Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Extend/retract Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Extend/retract Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Select a skewer', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo', commonName: 'Undo', notes: 'One of only 3 public games (with bp35, lf52) where Undo is load-bearing, not a convenience -- see notes below.' },
  ],
  hints: [],
  resources: [
    {
      title: 'SK48 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/549f92a6-c1d5-4990-a3c4-91323c1fc8e8',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'SK48 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/ec8d80f4-250f-47c4-948f-6e5d51379cb5',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/sk48/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/sk48/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/sk48/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/sk48/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/sk48/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/sk48/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/sk48/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/sk48/lvl8.png' },
  ],
  tags: ['skewer', 'threading', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12: adversarial re-verification confirmed the skewer pushes beads rather than passing through them, and added the level-5+ solid walls; the win-condition specifics are still an open gap. ACTION7 (Undo) cross-game note (2026-09-14): Boss identifies sk48 as one of only three public games (with bp35 and lf52) where Undo is load-bearing rather than a convenience -- see bp35.ts for the full breakdown of which games expose ACTION7 at all. Reasoning for why it matters here specifically: this is a push-block mechanic (the skewer shoves beads ahead of its tip instead of passing through them), and push-block puzzles are the classic case where moves are one-directional -- retracting or sliding the skewer back does not pull a pushed bead back with it, so a bad extension can permanently scramble the bead arrangement with no way to recover it by further play. That is presumably why the source implementation makes Undo explicitly restore bead positions, not just skewer position (per mechanicsExplanation) -- ordinary movement cannot undo a push, only the dedicated Undo can. Bounded by a step budget same as bp35/lf52, so Undo also saves you from re-spending moves re-deriving a bead layout a Reset would have thrown away.',
};
