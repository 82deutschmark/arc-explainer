/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12; human replay added and
 *         the lives/step-budget mechanic corrected by Claude Opus 5, 2026-09-15
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for LS20 (Locksmith), including featured replay video details.
 *          Adversarially re-verified 2026-09-12: every level runs a hidden 42-step
 *          budget with a 3-life game-over system (BOTH of those claims are wrong; see the
 *          2026-09-15 correction below), level 6 has two doors to solve in
 *          sequence, and the final level adds fog-of-war -- none of this was in the
 *          original write-up.
 *          2026-09-15: the 2026-09-12 reading of the life system was itself wrong. The
 *          three lives are PER LEVEL, not per run, and the THIRD loss ends the run, not
 *          the fourth; RESET refills both lives and the step meter. The 42-step budget is
 *          42 meter units, which is only 42 moves on levels 1/4/6 -- levels 2/3/5/7 drain
 *          two units a move, so 21. Verified against ls20-9607627b/ls20.py and a human
 *          winning recording; see docs/2026-09-15-ls20-lives-and-step-budget.md. A human
 *          win was also added to resources[] with its raw NDJSON committed under arc3/.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, checked in ls20.py (build
 *          9607627b) and run in the engine. Kept the lives/step-meter facts from 2026-09-15
 *          as they were (the engine runs agree). Appended to mechanicsExplanation the pieces
 *          it never named: refill pickups (level 2+), launch pads (level 3+), tiles that
 *          slide along hidden paths (level 5+), which bumps cost a step, and that a lost
 *          life also resets the key, the pickups and any door already opened.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 * SRP/DRY check: Pass - Single responsibility for LS20 game data.
 */

import { Arc3GameMetadata } from './types';

export const ls20: Arc3GameMetadata = {
  gameId: 'ls20',
  officialTitle: 'ls20',
  informalName: 'Locksmith',
  description: 'Transform a key into the required shape, color, and rotation to unlock an exit door, under a hidden step budget and three lives per level.',
  simpleExplanation: 'You carry a key made of colored pixels and walk it over special tiles to change its shape, color, and rotation. Reach the door with the key matching the lock, before you run out of moves. Running out costs one of the level\'s three lives; lose all three on one level and the whole run ends.',
  mechanicsExplanation: 'The key is represented as a distinct group of pixels, typically located in the bottom-left area at the start of each level. You must move your player avatar over transformation tiles to change the key\'s shape, color, and rotation to match the lock. The door does not require a specific trigger action; simply reaching it with the correct key configuration will finish the level -- though level 6 has two separate doors that both need solving in turn, not just one. Every level also runs on a hidden step meter of 42 units, drawn as a bar of pips at the bottom-left of the frame. That is not 42 moves everywhere: levels 1, 4 and 6 drain one unit a move (42 moves), while levels 2, 3, 5 and 7 drain two (21 moves). Running the meter out does not end the level -- it respawns you at the level\'s start with a full meter and costs one life. You get three lives PER LEVEL, shown as three red pips at the bottom-right, and they are restored every time a new level begins. The THIRD loss on a single level ends the entire run, not just the level. RESET also restores both the lives and the step meter, because it re-runs the same level-setup routine, which makes it the only mid-level way to buy a life back -- a human win on 2026-09-15 used exactly that on the final level, one pip from losing the run. The final level adds fog-of-war, blacking out everything beyond a short radius around you. A lost life also puts the key back to its starting shape, color and rotation, brings back every pickup you used, and closes any door you had already opened. Other pieces the text above never named: from level 2, small yellow rings refill the step meter when you walk onto them; from level 3, light gray bars on the edge of a cell launch you across the room until you hit a wall; from level 5, some of the key-changing tiles slide back and forth along hidden paths, one step each time you move. Walking into a wall still costs a step, but walking into a door with the wrong key does not.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'Up, Down, Left and Right move your block one cell (5 pixels). Your block is the square that is orange on top and blue underneath. There is no clicking and no undo.', source: 'ls20.py:398-410, 1787, 1940-1966; engine run on level 1' },
    { category: 'controls', text: 'Walking into a wall (the darker gray areas) leaves you where you are and still costs a step.', source: 'ls20.py:1879-1881, 1964-1972; engine run on level 1: the bump took the meter from 34 to 33' },
    { category: 'controls', text: 'RESET restarts the level: you, the key, the pickups and the doors all go back to the start, the step meter refills and all three lives come back.', source: 'ls20.py:1800-1843; arcengine/base_game.py:305-330; engine run on level 2: 1 life left, RESET gave back 3' },
    { category: 'goal', text: 'Each door is a black box with a picture of the key it wants, drawn in the right shape, color and rotation. Walk onto the door while your key matches that picture exactly and the door opens. When every door on the level is open, the next level loads.', source: 'ls20.py:384-396, 1827-1839, 1882-1887, 1978-1981, 2039-2060; engine run: level 1 cleared in 15 moves' },
    { category: 'pieces', text: 'Your current key is shown in the black box at the bottom-left of the screen. It changes only when you step onto a key-changing tile.', source: 'ls20.py:1807, 2016-2022, 1893-1909' },
    { category: 'pieces', text: 'The rotation tile, a small white and light gray glyph, turns the key a quarter turn clockwise each time you step onto it. Step off and back on to turn it again.', source: 'ls20.py:370-383, 1905-1909; engine run on level 1: the key went from 270 to 0 and matched the door picture' },
    { category: 'hazards', text: 'Walking into a door with the wrong key does not open it. You stay put, the key box flashes white for a moment, and the move costs no step.', source: 'ls20.py:1882-1887, 1930-1939, 1970-1971; engine run on level 2: meter unchanged, key box white in the first frame' },
    { category: 'budget', text: 'The yellow bar along the bottom of the screen is the step meter, 42 units on every level. Each move uses one unit on levels 1, 4 and 6 and two units on levels 2, 3, 5 and 7, so 42 or 21 moves. Spent units turn dark gray.', source: 'ls20.py:1492-1515, 1543-1546, 1790-1798, 746, 1110, 1346; engine runs: 42 to 41 per move on level 1, 42 to 40 on level 2' },
    { category: 'budget', text: 'Three red pips at the bottom-right are your lives for this level. When the meter runs out, you lose a pip, the whole screen flashes yellow, and you start the level over from the beginning with a full meter. Losing the third pip on one level ends the game. Every new level starts with three again.', source: 'ls20.py:425-437, 1547-1551, 1843, 1972, 1982-2013; engine run on level 2: lives lost on moves 22 and 44, game over on move 66' },
    { category: 'budget', text: 'Losing a life also resets the key to how it started the level, brings back every pickup you used, and closes any door you had already opened.', source: 'ls20.py:1993-2012; engine runs on levels 2 and 6' },
    { category: 'goal', text: 'Reaching the last door on the move that empties the meter still counts: the door check runs before the life is taken.', source: 'ls20.py:1972-1987; engine run on level 2: door reached with 1 unit left (costs 2), level advanced, no life lost' },
    { category: 'feedback', text: 'Level 1 only: when a tile makes your key match the door, white outlines flash around the key box and around the door for a few frames. That move also costs no step.', source: 'ls20.py:2024-2037, 1906-1909, 1930-1939; engine run on level 1: 6 frames, meter stayed at 35' },
    { introducedOnLevel: 2, category: 'pieces', text: 'Small yellow rings are step pickups. Walk onto one and the step meter fills back to full, the ring disappears, and that move costs nothing.', source: 'ls20.py:341-353, 1888-1892, 1972; engine run on level 2: meter went from 10 to 42' },
    { introducedOnLevel: 2, category: 'budget', text: 'From level 2 the meter drains two units per move (levels 2, 3, 5 and 7), so those levels give you only 21 moves per life.', source: 'ls20.py:1790-1798 (default of 2); engine run on level 2' },
    { introducedOnLevel: 3, category: 'pieces', text: 'The color tile, a small patch of blue, green, red, orange and white, changes the key\'s color each time you step onto it, in the order orange, blue, green, red and back to orange.', source: 'ls20.py:411-424, 1771, 1899-1904' },
    { introducedOnLevel: 3, category: 'pieces', text: 'Launch pads: a cell with a light gray bar along one edge. Step into it and it flings you the other way from the bar, sliding you and the bar across the room to the last cell before a wall or door, then the bar springs back. The step into the pad costs a normal move and the ride is free.', source: 'ls20.py:207-219, 1560-1671, 1857-1864, 1972-1977; engine runs on level 3: carried from (9,5) to (34,5) and from (54,4) down to (54,44)' },
    { introducedOnLevel: 3, category: 'pieces', text: 'A launch skips everything it slides you over. Only the cell you stop on takes effect, so a tile or pickup there still works.', source: 'ls20.py:1913-1921, 1623-1647' },
    { introducedOnLevel: 4, category: 'pieces', text: 'The shape tile, a small white glyph, changes the key to the next of six shapes each time you step onto it.', source: 'ls20.py:268-280, 1773-1778, 1893-1898' },
    { introducedOnLevel: 5, category: 'pieces', text: 'Some key-changing tiles move. Each time you move, they take one step along a hidden path, back and forth along a line or around a small square. If your move is blocked, they stay put.', source: 'ls20.py:1674-1762, 1851-1856, 1958-1959, 1967-1969; engine run on level 5: the rotation tile went 14, 19, 24, 19, 14 as the player moved' },
    { introducedOnLevel: 6, category: 'goal', text: 'Two doors, each wanting a different key. You can open them in either order, and the level ends when both are open.', source: 'ls20.py:1339-1346, 2042-2060; engine run on level 6: opened the second door first' },
    { introducedOnLevel: 7, category: 'hazards', text: 'Fog: everything more than 20 pixels from your block is black, doors included. The key box, the step meter and the lives stay visible.', source: 'ls20.py:1465, 1517-1551; engine run on level 7 render' },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-15',
      saw: 'Three red dots: your lives on each level. Every death costs one.',
      did: 'Used reset.',
      happened: 'Reset brings all three back. So on some levels, especially the last one, where you can easily run out of time, you want to reset rather than lose the game. Undo isn\'t available in the current version; reset is. He found the reset rules bizarre when the preview came out, and this is probably why agents do so badly here: they don\'t use reset to keep their lives.',
      inCode: 'RESET restarts the level: the key, pickups and doors go back to the start, the step meter refills and all three lives come back.',
    },
    {
      player: 'Boss',
      date: '2026-08-31',
      saw: 'Lots of energy and three lives.',
      happened: 'Room for a lot of exploration.',
    },
    {
      player: 'Boss',
      date: '2026-09-15',
      saw: 'The ls20 from the preview.',
      happened: 'Today\'s ls20 is fundamentally a different game. Replays from before September don\'t reflect it.',
    },
  ],
  category: 'preview',
  humanDifficulty: 'easy',
  aiDifficulty: 'very-hard',
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
  ],
  hints: [
    {
      id: 'ls20-hint-1',
      title: 'Key Transformation',
      content: 'Identify the "recipe" for tiles. Some tiles might rotate the key by 90 degrees, while others change its color or append a new block to its shape.',
      spoilerLevel: 2,
    },
    {
      id: 'ls20-hint-2',
      title: 'Exit Requirement',
      content: 'The door area often shows a hint of the "target" key. Ensure your key matches that ghost image perfectly before approaching.',
      spoilerLevel: 1,
    },
    {
      id: 'ls20-hint-3',
      title: 'Hidden Move Limit',
      content: 'Every level secretly caps you at a 42-unit step meter before it respawns you and costs a life. Half the levels burn two units a move, so on levels 2, 3, 5 and 7 that is really only 21 moves. You get 3 lives on each level, not 3 for the whole run, and the third loss on one level ends the run. RESET gives you back both the lives and the full meter. The final level also blacks out everything beyond a short radius around you.',
      spoilerLevel: 2,
    }
  ],
  resources: [
    {
      title: 'LS20 Replay',
      url: 'https://three.arcprize.org/replay/ls20-fa137e247ce6/7405808f-ec5b-4949-a252-a1451b946bae',
      type: 'replay',
      description: 'A human playthrough on the older, now-replaced ls20-fa137e247ce6 build, published 2026-01-04: a win in 508 actions with one reset -- over EIGHT levels, not the current build\'s seven. From before per-level baselines existed for this game, so it has no baseline or score to compare (both are the -1 sentinel).',
    },
    {
      title: 'LS20 Human Replay (Win, 7/7 Levels, Score 100)',
      url: 'https://arcprize.org/replay/7537433d-75af-48fa-ad3d-45fd32b23c00',
      type: 'replay',
      description: 'A human playthrough on the current ls20-9607627b build: a win, all seven levels cleared, score 100. 561 actions against a 776-action baseline (0.72x) -- and under baseline on every single level, split 14/67/43/79/74/109/175 against 22/123/73/84/96/192/186. Three mid-run resets, one of which bought back two lost lives on the final level. The raw 562-row NDJSON recording is committed at arc3/ls20-9607627b.7537433d-75af-48fa-ad3d-45fd32b23c00.jsonl, and the life/step-budget mechanic it exposed is written up in docs/2026-09-15-ls20-lives-and-step-budget.md.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/ls20/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/ls20/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/ls20/lvl3.png' },
    { level: 4, imageUrl: '/ls20-lvl4.png' },
    { level: 5, imageUrl: '/ls20-lvl5.png', notes: 'Key starts in bottom left. Door is usually at the top or center.' },
    { level: 6, imageUrl: '/arc3-levels/ls20/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/ls20/lvl7.png' },
  ],
  tags: ['preview-set', 'transformation', 'navigation'],
  thumbnailUrl: '/ls20.png',
  video: {
    src: '/videos/arc3/ls20-fa137e247ce6.mp4',
    caption: 'Locksmith walkthrough replay captured Dec 2025',
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct, adversarially-verified source read: added the hidden step budget, level 6\'s second door, and the final level\'s fog-of-war, none of which the original write-up mentioned. Corrected again 2026-09-15: that pass got the life system wrong in both directions -- the three lives are per LEVEL and refill on every level change and on RESET, and the THIRD loss on a level ends the run, not the fourth. The 42-unit meter is also only 42 moves on levels 1, 4 and 6; levels 2, 3, 5 and 7 drain two units a move. Both corrections are cited line by line against ls20-9607627b/ls20.py and confirmed frame-by-frame on a human winning recording in docs/2026-09-15-ls20-lives-and-step-budget.md. That win, added to resources[] the same day, is the first replay listed here on the current build -- the older ls20-fa137e247ce6 links, including the video, are from a build that has since been replaced, and had EIGHT levels where this one has seven. Both listed replays are human; neither is an agent run.',
};
