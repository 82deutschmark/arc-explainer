/*
 * Author: Claude Sonnet 5; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-09-11 (corrected against source 2026-09-12; breakdown added 2026-09-16)
 * PURPOSE: Game metadata for TN36 (Toggle Navigator), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the two panels' roles were swapped (the "sandbox" panel is
 *          actually locked from manual clicks; the winning panel is the one you
 *          freely toggle), switches split into several independent instruction banks
 *          rather than one shared number, and the final level adds an unmentioned
 *          freeze hazard.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, traced in
 *          external/ARCEngine/environment_files/tn36/ef4dde99/tn36.py, with the click
 *          budget, snap-back, wall blocking and two-square jumps, off-board movement,
 *          rotation direction, checkpoints, beam hazards and demo tabs run in the engine.
 *          Corrected the prose: the left panel has no target and is not on screen at all
 *          on level 1; the six-instruction chain starts on level 3, not the last level;
 *          the level 7 hazard breaks the token rather than freezing it; the "scrolling
 *          strip" is the blue bar along the top, 60 clicks on levels 1-5 and 121 on 6-7.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 * SRP/DRY check: Pass - Single responsibility for TN36 game data.
 */

import { Arc3GameMetadata } from './types';

export const tn36: Arc3GameMetadata = {
  gameId: 'tn36',
  officialTitle: 'tn36',
  informalName: 'Toggle Navigator',
  description: 'Freely toggle switches on the right-hand panel to chain move/rotate/scale/recolor instructions onto its token, matching a target; from level 2 the left panel only plays preset demo programs.',
  simpleExplanation: 'You flip switches to build a short program of moves, turns, resizes and recolors, then run it on a yellow block to land it exactly in its target outline. Every click shortens the blue bar at the top, and you lose when it runs out.',
  mechanicsExplanation: 'The right-hand panel is the one that counts: a yellow block with a notch, a yellow target outline, a row of switch columns and a blue run button. Each column of switches adds up to one number, and each number is a fixed instruction (move one square, jump two squares, turn, grow or shrink, recolor, or nothing). Pressing run plays the columns left to right, one per frame. You win when the run ends with the block in the target at the same spot, size, rotation and color. A run that misses sends the block back to its start. From level 2 a left-hand panel appears with tabs underneath; clicking a tab plays a preset demo program on a gray block so you can work out what the instructions do, but its switches can\'t be clicked. From level 3 there are six columns and pink walls that stop moves (a two-square jump goes straight over them). Level 6 adds yellow checkered save squares that move the start, and level 7 adds beams that shoot out after the third instruction of every run and break the block. Every click spends one unit of the blue bar at the top: 60 clicks on levels 1-5, 121 on levels 6-7, and the next click after that is a loss.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'controls',
      text: 'Click is the only action. What it does depends on where you click: a switch, the blue run button, or (from level 2) a demo tab. Clicking anywhere else does nothing but still costs a click.',
      source: 'tn36.py:2603, 2500-2511, 2621-2627',
    },
    {
      category: 'goal',
      text: 'Win by running a program that leaves the yellow block sitting exactly inside the yellow target outline, with the same size, the same rotation and the same color as the target, all at once. Only the right-hand panel counts.',
      source: 'tn36.py:2153-2156, 2471-2472, 2628-2631, 2637-2638',
    },
    {
      category: 'pieces',
      text: 'The block is a yellow square with a two-cell notch cut into one side, so you can see which way it is turned. The target is a yellow U-shaped outline with a small bump in the middle; the bump shows where the notch has to go.',
      source: 'tn36.py:31-43, 908-922',
    },
    {
      category: 'controls',
      text: 'Switches sit in columns under the board. Click one to flip it: black is on, light gray is off.',
      source: 'tn36.py:1930-1949, 2033-2040',
    },
    {
      category: 'pieces',
      text: 'Each column is one instruction. Count a column\'s switches from the top as 1, 2, 4, 8, 16 and 32 and add up the ones that are on; that total picks the instruction. On level 1 each column only has the 1 and 2 switches.',
      source: 'tn36.py:1955-1956, 2004-2007, 2171-2191',
    },
    {
      category: 'pieces',
      text: 'Level 1 instructions: 0 (both off) = do nothing, 1 = move left one square, 2 = move right one square, 3 = move down one square. One square is one square of the checkerboard.',
      source: 'tn36.py:2171-2175, 1051-1086',
    },
    {
      category: 'controls',
      text: 'Clicking the blue circle runs the program. The columns play left to right, one per frame, and the column being played lights up blue behind its switches. You can\'t click anything until the run ends. Every run starts from the block\'s starting spot, not from where the last run left it.',
      source: 'tn36.py:2297-2306, 2308-2311, 2358-2406, 2557-2563, 2621-2622',
    },
    {
      category: 'pieces',
      text: 'Nothing stops the block at the edge of the checkerboard: a move can slide it off the board and under the black frame.',
      source: 'tn36.py:2269-2281',
    },
    {
      category: 'feedback',
      text: 'A run that doesn\'t match the target sends the block straight back to its starting spot, size, rotation and color when it ends.',
      source: 'tn36.py:2382-2387',
    },
    {
      category: 'feedback',
      text: 'A winning run flashes the block and the target green for a frame, then the next level loads.',
      source: 'tn36.py:1890-1892, 2118-2120, 2366-2370, 2388-2396, 2613-2616',
    },
    {
      category: 'feedback',
      text: 'The run button flashes light blue for a frame when you click it.',
      source: 'tn36.py:2297-2306, 2419-2424',
    },
    {
      category: 'budget',
      text: 'The blue bar along the top edge is your click budget. Every click, including clicks on nothing, moves it one step off to the left. On levels 1 to 5 you get 60 clicks and the 61st loses; on levels 6 and 7 it only moves every second click, so you get 121 clicks and the 122nd loses. If the click that empties the bar is a run that wins, the win still counts.',
      source: 'tn36.py:2577-2593, 2623-2634, 2640-2641',
    },
    {
      category: 'other',
      text: 'RESET restarts the current level: block, switches and the blue bar all go back to how the level started. There is no undo; to un-flip a switch you click it again, which costs a click.',
      source: 'tn36.py:2605-2610; arcengine/base_game.py:305-330',
    },
    // ---- Level 2 ----
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'A second panel on the left with a gray block on a plain gray board. Its switches can\'t be flipped; clicking them only costs a click. It has no target and nothing you do there counts toward winning.',
      source: 'tn36.py:1076, 1156-1158, 2011, 2033-2037, 2474-2498',
    },
    {
      introducedOnLevel: 2,
      category: 'controls',
      text: 'Square tabs under the left panel. Clicking one turns it blue (the others go gray), loads that tab\'s preset program into the left switches, puts the gray block at that tab\'s starting spot, and plays the program right away. The block stays where the demo leaves it. Clicking the same tab again replays it. Each tab carries a small picture of what its program does: a yellow block trailing white dots for a move, a big or a tiny yellow square for grow or shrink, a yellow diamond for a turn, a purple square for recolor.',
      source: 'tn36.py:274-325, 2500-2556, 2435-2442; level data "Programs" and "Reset" and the tab pictures placed at 1097-1098, 1186-1189, 1295-1298, 1397-1401, 1504-1507',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Columns now have six switches, so the instructions above 3 (up, two-square jumps, turns, size and color) become possible. Level 2 has four columns.',
      source: 'tn36.py:1087-1175',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'More move instructions: 33 = up one square, 34 = also left one square, 10 or 11 = right two squares, 12 or 13 = left two squares.',
      source: 'tn36.py:2171-2191',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Turn instructions: 5 = quarter turn clockwise, 6 or 16 = quarter turn counterclockwise, 7 = half turn.',
      source: 'tn36.py:2171-2191; arcengine/sprites.py:465-470',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Size instructions: 8 = grow one size, 9 = shrink one size. The block grows out to the right and down from its top-left corner, and it never shrinks below normal size.',
      source: 'tn36.py:1865-1870, 2171-2191, 2283-2295',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Color instructions: 14 = turn blue, 15 = turn red, 63 (all six switches on) = turn purple. Every number not listed in these bullets does nothing.',
      source: 'tn36.py:1872-1875, 2171-2191, 2397-2402',
    },
    // ---- Level 3 ----
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Six columns on the right panel, so a program is up to six instructions long.',
      source: 'tn36.py:1176-1284',
    },
    {
      introducedOnLevel: 3,
      category: 'hazards',
      text: 'Pink walls on the board. A one-square move or a grow that would overlap a wall doesn\'t happen, and the program carries on with the next column. A two-square jump only checks where it lands, so it goes straight over a one-square wall.',
      source: 'tn36.py:1273-1274, 2269-2295',
    },
    // ---- Level 4 ----
    {
      introducedOnLevel: 4,
      category: 'goal',
      text: 'The block starts bigger than the target, so size now has to be fixed as well as position.',
      source: 'tn36.py:1288, 1285-1386',
    },
    // ---- Level 5 ----
    {
      introducedOnLevel: 5,
      category: 'goal',
      text: 'The target is purple and twice normal size, and the block starts turned a different way, so this level needs turning, growing and recoloring in one program. One of the demo tabs shows a block turning purple.',
      source: 'tn36.py:1387-1490, 1473, 1484',
    },
    // ---- Level 6 ----
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'Yellow checkered squares are save points. If a run ends with the block, at normal size, on one of them, that spot becomes the block\'s new start (along with its current rotation and color), and every later run begins there. The square disappears while the block covers it. A grown block doesn\'t save. RESET puts the start back.',
      source: 'tn36.py:1497-1499, 2261-2267, 2313-2318, 2374-2381',
    },
    {
      introducedOnLevel: 6,
      category: 'budget',
      text: 'The blue bar drains at half speed on levels 6 and 7: one step every second click.',
      source: 'tn36.py:2586-2593',
    },
    // ---- Level 7 ----
    {
      introducedOnLevel: 7,
      category: 'hazards',
      text: 'Two beam emitters: small boxes with a green edge and an orange and dark red checkered middle, one on each side of the board. Touching an emitter box breaks the block. After the third instruction of every run, both shoot out an orange and dark red beam three and a half squares long; a block in the beam, or moving into it, breaks.',
      source: 'tn36.py:370-393, 1626-1629, 2074-2078, 2216-2232, 2350-2356',
    },
    {
      introducedOnLevel: 7,
      category: 'feedback',
      text: 'A broken block shows as an orange and dark red checkered block for one frame and then disappears. It ignores the rest of the program, the run fails, and the block comes back at its start. The beams pull back in when a failed run ends.',
      source: 'tn36.py:1894-1914, 2269-2281, 2382-2387',
    },
    {
      introducedOnLevel: 7,
      category: 'pieces',
      text: 'There is also a hidden save square under the block\'s starting spot. It shows up once the block moves off it, so you can move the start back there.',
      source: 'tn36.py:105-117, 1608, 2261-2267',
    },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-18',
      saw: 'Something like lab pipetting, or a piano.',
      happened: 'It never made sense to him and he had to cheat. Level 7 looked close to impossible (his scorecard didn\'t finish there). A hard one; he doesn\'t know how anybody solves it.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'very-hard',
  levelCount: 7,
  actionMappings: [
    { action: 'ACTION6', description: 'Flip a switch on the right panel, press the blue run button, or pick a demo tab under the left panel', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'TN36 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/f8c61b63-9b3c-4ad0-80ef-a5f9fcb5c330',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'TN36 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/6f5dd73e-fdf4-4b30-a87a-22e4557d8189',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/tn36/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/tn36/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/tn36/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/tn36/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/tn36/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/tn36/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/tn36/lvl7.png' },
  ],
  tags: ['binary-logic', 'opcode-deduction', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the panels\' clickable/locked roles were backwards, the single-shared-number framing was wrong, and the final level\'s freeze hazard was missing.',
};
