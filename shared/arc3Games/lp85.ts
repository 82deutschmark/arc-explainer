/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12; human replay
 *         detailed by Claude Opus 5, 2026-09-15
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for LP85, including embedded replay video reference.
 *          Adversarially re-verified 2026-09-12: levels 3-4 add a mandatory second,
 *          orange block/target pair the original write-up never mentioned; the
 *          "swap/push/pull button" hint described a mechanic that doesn't exist
 *          anywhere in the code; and the mover/target sprite roles were reversed.
 *          2026-09-15: the thin resources[] entry added in 891dc5a6 for the 2026-09-15
 *          human win was expanded in place with the figures the session API and the
 *          committed NDJSON recording both derive. Its score was dropped at that point on
 *          a direction the owner never actually gave (see CHANGELOG 9.82.0); the session
 *          score of 76.39 was restored to the page later the same day.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, checked in lp85.py (build
 *          305b61c3) and run in the engine. Kept the human-run facts and the one-action/no-undo
 *          text. Corrected three things in description/simpleExplanation/mechanicsExplanation:
 *          orange is on levels 3-4 only (the text said "from level 3" / "from level 3 on"),
 *          there are several loops from level 2 (not one shared loop), and a target is four
 *          corner dots framing a slot the size of the moving square (not a small target
 *          square for a larger block). Added the step budget and stacked buttons.
 * SRP/DRY check: Pass - Single responsibility for LP85 game data.
 */

import { Arc3GameMetadata } from './types';

export const lp85: Arc3GameMetadata = {
  gameId: 'lp85',
  officialTitle: 'lp85',
  informalName: 'Loop and Pull',
  description: 'Click red and green buttons to turn loops of colored squares back or forward until every yellow square (and, on levels 3-4, the orange one) sits inside a target of its color, marked by four corner dots.',
  simpleExplanation: 'Each button turns a loop of squares one step forward (green) or back (red). Turn the loops until every yellow square sits inside a yellow target, marked by four corner dots, and on levels 3-4 the orange square sits in the orange one.',
  mechanicsExplanation: 'Each target is four small corner dots framing one slot, and it is filled when a square of its color sits in that slot: every yellow target needs a yellow square, and on levels 3 and 4 the orange target also needs the orange square. The number of targets ranges from one to three depending on the level, never a fixed four. You control the sequence by pushing red and green buttons. Each button belongs to a loop of slots, and a click steps every square on that loop forward (green) or backward (red) by one position, with the last slot wrapping to the first; there is no swap, push, or pull hidden in later levels. From level 2 loops cross, so a square on a shared slot can be handed from one loop to the other, and on levels 6-8 some buttons are stacked so one click turns two, three or eight loops at once. Clicks that miss the buttons do nothing and cost nothing, but every button click spends one of the level\'s steps (13, 60, 80, 150, 80, 80, 80 and 80 for levels 1-8), and using the last one without finishing ends the game. LP85 is a one-action game: it declares available_actions = [6] and nothing else, on every frame of a full eight-level recording. ACTION6 is a click carrying x/y coordinates, and the action space exposes no undo -- so RESET, which restarts the current level, is the only recovery primitive the game offers.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'Clicking is the only control. The buttons are small arrowheads: green ones point right and red ones point left.', source: 'lp85.py:36-50, 1054-1068, 21352' },
    { category: 'controls', text: 'Each button belongs to one loop of slots. Click a green button and every square on its loop moves one slot forward; click a red one and they all move one slot back. The loop wraps, so going forward from the last slot lands on the first and going back from the first lands on the last.', source: 'lp85.py:21265-21286, 21394-21430; engine run on level 1' },
    { category: 'controls', text: 'Clicking anywhere that isn\'t a button does nothing and costs nothing.', source: 'lp85.py:21405-21406, 21431-21433; engine run: 30 clicks on empty board left all 13 steps' },
    { category: 'controls', text: 'There is no undo. RESET restarts the level with every square back in place and a full step bar.', source: 'lp85.py:21352, 21355-21364; arcengine/base_game.py:305-330; engine run on level 1' },
    { category: 'goal', text: 'A target is four small yellow corner dots framing one slot. The level is cleared the moment every yellow target has a yellow square sitting in it. Any yellow square fills any yellow target.', source: 'lp85.py:130-143, 580-590, 21434-21437, 21442-21446; engine run: level 1 cleared in 5 red clicks' },
    { category: 'pieces', text: 'A loop is a chain of small colored squares (blue, light blue, light gray, gray and purple) with the yellow square among them, all the same size. The whole chain moves together. The other colors don\'t matter for winning, they only help you see the loop turn.', source: 'lp85.py:96-107, 792-803, 21419-21430, 21442-21451; level 1 render' },
    { category: 'pieces', text: 'Targets and buttons never move. Only squares sitting in a loop slot get carried along.', source: 'lp85.py:21419-21430 (only sprites exactly on a slot are moved; targets sit one pixel off the slot grid)' },
    { category: 'budget', text: 'Every button click spends one step. The levels allow 13, 60, 80, 150, 80, 80, 80 and 80 clicks. If a click uses up the last step without clearing the level, the game is over. The win check runs first, so clearing the level on your last step still counts.', source: 'lp85.py:1121, 1181, 1227, 1291, 1328, 1452, 1484, 1578, 21301-21307, 21434-21440; engine run: 13th non-winning click on level 1 lost' },
    { category: 'hazards', text: 'There are no enemies, hazards or lives. Running out of steps is the only way to lose.', source: 'lp85.py:21438-21440 (the only lose call)' },
    { category: 'feedback', text: 'The column along the left edge of the screen is the step bar. It starts all green and turns black from the top down as you spend steps. It refills at the start of each level.', source: 'lp85.py:21324-21330, 21355-21360; engine run' },
    { category: 'feedback', text: 'The row of eight short dashes across the top tracks progress: one dash turns green for each level you have cleared.', source: 'lp85.py:21312-21314, 21331-21335; engine run: first dash green on level 2' },
    { category: 'feedback', text: 'There is no animation. Squares jump straight to their new slots in a single frame.', source: 'lp85.py:21426-21440; engine run: 1 frame per click' },
    { introducedOnLevel: 2, category: 'pieces', text: 'Several loops, each with its own red and green button. Loops cross each other, and a slot where two loops cross belongs to both, so a square sitting there can be carried off by either one. That is how a yellow square gets from one loop to another.', source: 'lp85.py:1126-1184 and the level 2 loop maps; engine run' },
    { introducedOnLevel: 2, category: 'goal', text: 'Two yellow squares and two yellow targets. Levels 2, 5 and 7 have two, levels 6 and 8 have three.', source: 'lp85.py:1137-1138, 1303-1304, 1352-1354, 1462-1463, 1509-1511' },
    { introducedOnLevel: 3, category: 'goal', text: 'Levels 3 and 4 have one yellow pair and one orange pair: an orange square and an orange target (four orange corner dots). The orange square has to end up in the orange target too, and a yellow square doesn\'t fill it.', source: 'lp85.py:260-273, 308-318, 1205-1206, 1256-1257, 21447-21450' },
    { introducedOnLevel: 4, category: 'pieces', text: 'Each button appears four times, spread around the board. All copies of a button do exactly the same thing.', source: 'lp85.py:1232-1288' },
    { introducedOnLevel: 5, category: 'pieces', text: 'A short loop can sit on top of part of a longer one. On level 5 a straight row of five slots belongs to both: its own buttons cycle just those five squares, with the square at the end of the row jumping back to the start.', source: 'lp85.py:1296-1331 and the level 5 loop maps; engine run: B green moved the end square back to the start of the row' },
    { introducedOnLevel: 6, category: 'pieces', text: 'Level 6 has only green buttons, so every loop turns one way. Several loops share each button spot, so one click turns three or eight loops at once. One spot drives three loops that have only two slots each, so that click just swaps the squares in each pair.', source: 'lp85.py:1333-1455 and the level 6 loop maps; engine run: one click at the top-right button moved 24 squares and cost 1 step' },
    { introducedOnLevel: 7, category: 'pieces', text: 'On level 7 the red and green buttons in the middle each drive two loops at once: a straight row whose end square wraps back to the start, and a small four-slot square. A separate pair of buttons drives a three-slot loop that shares one slot with the row, so you can park a square off the row while the other two loops turn.', source: 'lp85.py:1457-1487 and the level 7 loop maps; engine run: one red click moved both loops' },
    { introducedOnLevel: 8, category: 'pieces', text: 'On level 8 one red and one green button each drive three loops at once, and three more loops have their own buttons. Some colored squares are not on any loop and never move.', source: 'lp85.py:1489-1581 and the level 8 loop maps' },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'easy',
  actionMappings: [
    { action: 'ACTION6', description: 'Click Red/Green button to shift blocks', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'lp85-hint-1',
      title: 'Indicator Targets',
      content: 'The small squares are not decorations; they are the exact slots for the larger blocks of the same color. Levels 3-4 add a second, orange pair alongside the yellow one -- match every color\'s target, not just yellow.',
      spoilerLevel: 1,
    },
    {
      id: 'lp85-hint-2',
      title: 'Two Buttons, One Loop',
      content: 'Red and green only ever step the shared loop forward or backward by one position each press -- there is no swap or push mechanic hiding in later levels. Watch which blocks share a loop and count how many steps apart they need to end up.',
      spoilerLevel: 2,
    }
  ],
  resources: [
    {
      title: 'LP85 Replay (Human, Win, 8/8 Levels)',
      url: 'https://three.arcprize.org/replay/lp85-d265526edbaa/dc3d96aa-762b-4c2e-ac68-6418c8f54c74',
      type: 'replay',
      description: 'Gameplay replay of LP85 (Loop and Pull). Its session is tagged human, not an agent run: a win on all eight levels in 545 actions with 4 resets, published 2026-01-05 against the older lp85-d265526edbaa build, before per-level baselines were published for this game (the session reports none). The mp4 on this page carries the same lp85-d265526edbaa game id, though nothing in the repo states outright which recording it was rendered from.',
    },
    {
      title: 'LP85 Human Replay (Win, 8/8 Levels, Score 76.39)',
      url: 'https://arcprize.org/replay/129ddf21-d7ba-4ca0-9577-0cea2af042b6',
      type: 'replay',
      description: 'The owner\'s own ARC Prize replay, published 2026-09-15 -- and the second human run in this list, not the first: the January 2026 replay in this same list is tagged human too. A win, all eight levels cleared, score 76.39, 415 actions and 6 mid-run resets, split 7/23/26/17/22/103/55/162 across levels 1-8. Honestly read, that is slightly OVER the game\'s own action baseline, not under it: 415 against 388, a ratio of 1.07x. The walls were level 7 (55 actions against a 26 baseline, 2.12x) and level 6 (103 against 60, 1.72x), and the API\'s level_scores agree without being asked -- its two lowest values, 22.3 and 33.9, fall on exactly those two levels. Level 6\'s single reset came straight after a GAME_OVER, so it was forced recovery rather than a choice. Level 8 reads 1.02x by actions (162 against 159), but that understates it: five of the run\'s six resets happened inside level 8, so those 162 actions are 157 clicks spread across six separate attempts. The 76.39 is those over-baseline levels showing up in the score, on the same scale as the 100s on the Human Records card beside it rather than in a different unit. The raw 416-row NDJSON recording is committed at arc3/lp85-305b61c3.129ddf21-d7ba-4ca0-9577-0cea2af042b6.jsonl.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/lp85.png', notes: 'Align the big yellow block with the small yellow square slots.' },
    { level: 2, imageUrl: '/arc3-levels/lp85/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/lp85/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/lp85/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/lp85/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/lp85/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/lp85/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/lp85/lvl8.png' },
  ],
  tags: ['evaluation-set', 'looping', 'sequencing'],
  thumbnailUrl: '/lp85.png',
  video: {
    src: '/videos/arc3/lp85-d265526edbaa.mp4',
    caption: 'Loop and Pull expert run showing button sequencing',
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct, adversarially-verified source read: levels 3-4 add a second, orange block/target pair the write-up never mentioned; the "swap/push/pull button" claim described a mechanic that doesn\'t exist in the code; and the mover/target sprite roles were reversed.',
};
