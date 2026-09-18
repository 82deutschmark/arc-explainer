/*
 * Author: Claude Sonnet 5; human replay added by Claude Opus 5, 2026-09-15
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for M0R0 (Mirror Rendezvous), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: trap tiles reset both twins (not just spare blocks), gates are
 *          live buttons confined to the last two levels, and every level has an
 *          unmentioned 150-move budget that can lose the game.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-15: a human win was added to resources[] -- the first non-agent
 *          replay on this game -- and its raw NDJSON recording committed under arc3/.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, checked in m0r0.py (build
 *          492f87ba) and run in the engine. Kept the gates/traps/150 facts. Corrected one
 *          sentence in mechanicsExplanation: mirrored motion does change the gap between the
 *          twins (by two cells a press); what it never changes is their row difference and
 *          the column halfway between them, and each level blocks the halfway cell on the twins'
 *          starting row (engine runs and a collision probe). Appended the missing pieces: movable blue blocks picked by clicking
 *          (level 3+), traps also resetting blocks, merging side by side, and that the 150
 *          counts every action including clicks and the do-nothing fifth action.
 *          2026-09-16 (Claude Opus 5, later): actionMappings fixed -- no drag (click picks a block, arrows move it) and the missing ACTION5 no-op added.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 * SRP/DRY check: Pass - Single responsibility for M0R0 game data.
 */

import { Arc3GameMetadata } from './types';

export const m0r0: Arc3GameMetadata = {
  gameId: 'm0r0',
  officialTitle: 'm0r0',
  informalName: 'Mirror Rendezvous',
  description: 'A mirrored pair moves in lockstep; deliberately desync them off walls until they meet, within a 150-move budget.',
  simpleExplanation: 'You steer two mirror-image tokens that always move as opposite reflections of each other. You can\'t just walk them together — you have to knock one into a wall to break the mirroring, and repeat until both land on the same tile.',
  mechanicsExplanation: 'You steer a mirror-image pair of tokens that always move together: vertical input shifts both by the same amount, horizontal input pushes them toward or away from each other by equal and opposite amounts. Mirrored motion never changes the difference in their rows or the column halfway between them, so walking alone can only bring them together in that halfway column, and every level blocks the straight route at the start: the halfway cell on their starting row is a wall on levels 1, 2, 3 and 5 and a trap on level 6, and on level 4 they start two rows apart. The puzzle is deliberately driving one twin into a wall or block so only it stops, permanently shifting where they would meet, repeated until both land on the same tile and merge. In the last two levels, colored gates open and close live depending on which button tile either twin is currently standing on -- they\'re switches, not static walls. Checkerboard trap tiles snap both twins straight back to the level\'s starting position. Each level also gives you a hard cap of 150 moves, shown as a shrinking bar; run out before the twins merge and you lose. That cap counts every action, not just moves: clicks count, and so does the fifth action, which does nothing else. From level 3, blue blocks stop a twin like a wall; click one and the arrow keys move that block instead of the twins until you click somewhere else. Traps send the blocks back to their starting cells too. Twins also merge when they stand side by side and you press toward each other.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'You steer two light blue squares, the twins. Up and Down move both of them the same way. Left and Right move them in opposite directions: one twin goes the way you press and the other goes the mirror way.', source: 'm0r0.py:94-113, 770-820; engine run on level 1' },
    { category: 'controls', text: 'A twin that would move into a wall (or, later, a block or a closed gate) stays where it is, and the other twin still moves. Stopping one twin like this is the only way to change where they would meet.', source: 'm0r0.py:868-892; engine run on level 3: one twin stopped under a block while the other moved up' },
    { category: 'controls', text: 'The fifth action (space) does nothing except use up one of your 150 actions.', source: 'm0r0.py:693, 770-866; engine run: twins did not move, action count went up by 1' },
    { category: 'controls', text: 'There is no undo. RESET restarts the level and gives back all 150 actions.', source: 'm0r0.py:693, 697-708, 724-725; arcengine/base_game.py:148-160, 305-330; engine run' },
    { category: 'goal', text: 'Get the twins together. The level is won the moment they merge: either both land on the same cell, or they stand side by side and you press toward each other (instead of swapping places they merge on the left one of the two cells).', source: 'm0r0.py:827-866; engine runs: a one-cell gap closed with one press, and side-by-side twins merged, both advancing the level' },
    { category: 'goal', text: 'Walking alone never changes how many rows apart the twins are or the column halfway between them, so walking can only bring them together in that column. Every level blocks the straight route at the start: the halfway cell on the twins\' starting row is a wall on levels 1, 2, 3 and 5 and a trap on level 6, and on level 4 the twins start two rows apart.', source: 'm0r0.py:808-820; engine runs pressing toward each other on levels 1, 2, 3, 5 and 6, plus a collision probe of the halfway cell on each level\'s starting row' },
    { category: 'budget', text: 'Each level allows 150 actions, and every action counts: moves (blocked ones too), clicks and the space action. The 151st action loses the game. There are no lives and nothing else can make you lose.', source: 'm0r0.py:724-729 (the only lose call); engine run: lost on the 151st action' },
    { category: 'feedback', text: 'The very top and very bottom rows of the screen are the action bar. Both start black. As you spend actions the top row turns white from its right end and the bottom row from its left end.', source: 'm0r0.py:583-612, 724-725; engine run: half white after 76 actions' },
    { category: 'feedback', text: 'The walls are drawn in two colors, one for each half of the screen, a reminder that the level is mirrored. The pair of colors changes from level to level (yellow and orange on level 1).', source: 'm0r0.py:392, 430, 445, 476, 496, 575, 621-648; level 1 render' },
    { introducedOnLevel: 2, category: 'hazards', text: 'Traps: red cells with a black checkerboard pattern. When a twin steps onto one, it flashes yellow a few times and then both twins jump back to where the level started. The actions you spent stay spent.', source: 'm0r0.py:114-122, 666-676, 712-723, 821-826; engine run on level 2: 8 frames, both twins back at the start, 1 action used' },
    { introducedOnLevel: 3, category: 'pieces', text: 'Blue blocks with a black outline. A twin can\'t move into one, so a block stops a twin just like a wall.', source: 'm0r0.py:65-78, 657-665, 882-886; engine run on level 3' },
    { introducedOnLevel: 3, category: 'controls', text: 'Click a blue block to pick it. It turns yellow and the twins turn light gray, and now the arrow keys move that block one cell at a time instead of the twins. It won\'t move into walls, twins or traps. Click anything that isn\'t a block to go back to steering the twins, which turn light blue again. Every click costs an action.', source: 'm0r0.py:730-769, 784-794; engine runs on levels 3 and 4' },
    { introducedOnLevel: 4, category: 'hazards', text: 'Traps also send every blue block back to its starting cell.', source: 'm0r0.py:708, 717-719; engine run on level 4: a block moved one cell left went back after a twin hit a trap' },
    { introducedOnLevel: 5, category: 'pieces', text: 'Gates and buttons in green, orange and purple. A gate is a bar three cells long and blocks twins while it is closed. While a twin stands on a button, every gate of that color disappears and can be walked through. As soon as no twin is on that button, those gates come back.', source: 'm0r0.py:35-64, 123-150, 887-892, 894-924; engine run on level 5: green gate gone with a twin on the green button, back when it stepped off' },
    { introducedOnLevel: 6, category: 'pieces', text: 'Only a twin holds a gate open. A blue block can\'t be moved onto a button, and the gate check only looks at the twins anyway.', source: 'm0r0.py:784-794, 894-924; engine run on level 6: the block stopped one cell short of the green button' },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-18',
      saw: 'Two twins sliding around, a bit like the old as66.',
      happened: 'One of the simplest games and easiest wins: you slide around and try to meet up with your twin. Models don\'t seem to have much trouble with it either.',
    },
    {
      player: 'Boss',
      date: '2026-09-18',
      level: 2,
      saw: 'Solid red areas, and dashed red-and-black ones.',
      happened: 'Solid red is fine; the dashed red-and-black areas kill the character. They only show up on levels 2, 4 and 6, and red and black are harmless everywhere else, which will confuse anything that relies on measuring pixel colors.',
      inCode: 'Traps are red cells with a black checkerboard. A twin that steps on one flashes yellow and both twins jump back to where the level started; the actions you spent stay spent.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'hard',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move both twins up (or the picked block up)', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move both twins down (or the picked block down)', commonName: 'Down' },
    { action: 'ACTION3', description: 'One twin moves left, the other moves the mirror way (or the picked block moves left)', commonName: 'Left' },
    { action: 'ACTION4', description: 'One twin moves right, the other moves the mirror way (or the picked block moves right)', commonName: 'Right' },
    { action: 'ACTION5', description: 'Does nothing except use up one of the 150 actions', commonName: 'Space' },
    { action: 'ACTION6', description: 'From level 3: click a blue block to pick it, so the arrows move that block one cell at a time; click anything else to go back to the twins. There is no dragging. Every click costs an action.', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'M0R0 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/d453ad9d-77ac-4228-a0a7-2cad831dd93c',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'M0R0 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/37443746-b7f8-4d5c-9140-b623f00cabe7',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'M0R0 Human Replay (Win, 6/6 Levels, Score 100)',
      url: 'https://arcprize.org/replay/2134c482-1385-44e9-bec8-77aceb508cb1',
      type: 'replay',
      description: 'A human playthrough, not an agent run -- the other two replays listed here are both GPT-6 Astra (checked, not assumed: their sessions return agent tags, and the provider-adapter one is itself a win in 220 actions). Published 2026-09-15: a win, all six levels cleared, score 100, 752 actions and 10 mid-run resets, split 23/56/173/20/259/221 across levels 1-6. Under the game\'s own per-level action baseline on EVERY level -- 752 against 1107 overall, 0.68x -- 23/30, 56/111, 173/203, 20/26, 259/500, 221/237, and every level_score comes back at the 115 ceiling. Read the 100 and the 752 together rather than against each other: the score measures each level against that level\'s baseline, so a run can be well under baseline throughout and still take four times the actions of the fastest humans on the Human Records card beside it (their top ten win in 179-180). The raw 753-row NDJSON recording is committed at arc3/m0r0-492f87ba.2134c482-1385-44e9-bec8-77aceb508cb1.jsonl.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/m0r0/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/m0r0/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/m0r0/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/m0r0/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/m0r0/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/m0r0/lvl6.png' },
  ],
  tags: ['mirrored-movement', 'desync-puzzle', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the three replay links in resources[] -- two ARC Prize published with the GPT-6 Astra results, plus a human win published 2026-09-15 (6/6 levels, score 100, 752 actions, 10 mid-run resets, under baseline on every level), whose raw recording is committed under arc3/. Corrected 2026-09-12 after an adversarially-verified direct source read: traps reset both twins (not just spare blocks), gates are an active switch mechanic in the last 2 levels only, and a 150-move budget that can lose the game was missing entirely.',
};
