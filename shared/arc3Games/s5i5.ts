/*
 * Author: Claude Sonnet 5; controls corrected and hints added by Claude Opus 5, 2026-09-16
 * Date: 2026-09-11 (corrected against source 2026-09-16)
 * PURPOSE: Game metadata for S5I5 (Sliding Indicator), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16: controls re-derived from s5i5-18d95033/s5i5.py and exercised in the
 *          real engine. The rotate button is a PLUS/CROSS, not a diamond (the hollow
 *          diamonds are the pins), and it only exists on levels 6-8. A slider button drives
 *          every rod of its color, not "the rod anchored there". Rotation is a quarter turn
 *          counterclockwise, and a rejected click still spends a click. Level 5's 28-click
 *          solution was found by breadth-first search over the engine and replayed to a clear.
 *          2026-09-16 (later): level 7 annotated from the owner's own human play. The game
 *          declares available_actions=[6] (s5i5.py:2042) and the build file contains no
 *          undo/ACTION7 of any kind, so RESET is the only recovery. His winning session
 *          (850dee42, verified against his arcprize.org account) spent 5 resets and 507
 *          actions for an 8/8 clear, 115 of them on level 7 against an 86-action baseline.
 *          2026-09-16 (Claude Opus 5, mechanics breakdown): added mechanicsBreakdown from
 *          s5i5-18d95033/s5i5.py plus engine runs (level 1 cleared in 13 clicks, cancelled
 *          click draws 2 frames, fold-back skip on level 6, level 8 four-rod pinwheel, loss
 *          at 0 budget). Kept every owner-confirmed fact. Two small wording fixes in
 *          mechanicsExplanation: light gray bars have no anchor end, and the slider buttons
 *          are not along the bottom on levels 1 and 8.
 *          2026-09-16 (Claude Opus 5, later): playerObservations added from Boss's reports (level 5 confusion, plus-shaped button, level 7 overgrown rod).
 *          2026-09-18 (Claude Opus 5): human mid-play captures tagged `kind: 'human'` so the page
 *          and the private game dataset (/api/arc3/dataset) can tell them from engine renders.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 * SRP/DRY check: Pass - Single responsibility for S5I5 game data.
 */

import { Arc3GameMetadata } from './types';

export const s5i5: Arc3GameMetadata = {
  gameId: 's5i5',
  officialTitle: 's5i5',
  informalName: 'Sliding Indicator',
  description: 'Grow, shrink and (from level 6) rotate color-coded rods to walk the markers riding them onto every pin.',
  simpleExplanation: 'You click color-coded buttons to grow, shrink and later rotate telescoping rods, carrying the dots riding on them onto the hollow-diamond pins before your clicks run out.',
  mechanicsExplanation: 'Every level is a set of color-coded telescoping rods, each colored rod with a dark gray anchor end. The two-headed slider buttons (along the bottom on most levels) are color-matched: clicking the right half grows every rod of that color by one 3-pixel segment away from its anchor, the left half shrinks it (never below one segment), and the thin center line does nothing. (Level 1\'s one upright slider works the same way, bottom half grows, top half shrinks.) One button often drives two rods in different parts of the board at once. From level 6, plus-shaped (cross) buttons appear: clicking one turns every rod of that color a quarter turn counterclockwise around its own anchor. Rods are chained into parent/child groups, so growing, shrinking or turning a rod carries everything attached to it, including the markers, and a child rod never folds back onto its parent (that turn is skipped). Some rods have no button at all and only move because they are attached to one that does; purple pieces are fixed walls. Any click that would make one rod overlap another rod or a wall is cancelled in full, and it still costs a click. The level clears when every hollow-diamond pin has a marker (the single dot riding a rod) sitting exactly on it. Every click anywhere spends one unit of the level\'s budget (the bar along the bottom row: 50, 150, 200, 100, 150, 150, 200 and 200 clicks for levels 1-8), and running it out ends the game.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'The only action is a click. Every click spends one unit of the budget, including clicks on empty board, rods, markers, pins or walls, which do nothing else.', source: 's5i5.py:2042, 2188-2193; engine run' },
    { category: 'controls', text: 'Click the right half of a two-headed slider button to grow every rod of that button\'s color by one 3-pixel segment, away from the rod\'s dark gray anchor end. The left half shrinks them by one segment. The thin dark gray line down the middle does nothing, but the click still costs.', source: 's5i5.py:2218-2242, 2110-2136; engine run on level 1' },
    { category: 'controls', text: 'A rod never shrinks below one segment. If one button drives several rods and one of them is already down to one segment, that rod stays as it is while the others still shrink.', source: 's5i5.py:2228-2238' },
    { category: 'controls', text: 'Level 1\'s yellow slider stands upright: its bottom half grows, its top half shrinks.', source: 's5i5.py:1729-1747, 2220-2227' },
    { category: 'controls', text: 'There is no undo. RESET puts the level back to its starting layout with a full budget.', source: 's5i5.py:2042; arcengine/base_game.py:305-330; engine run' },
    { category: 'goal', text: 'The level clears when every pin (a small hollow dark red diamond) has a marker (a single dark red dot riding a rod) sitting exactly on it. Any marker can fill any pin, and pins never move. The check runs after each click.', source: 's5i5.py:2080-2086, 2243-2244; engine run: level 1 cleared in 13 clicks' },
    { category: 'pieces', text: 'Rods are solid colored bars with a dark gray square at one end, the anchor. The anchor stays put while the rod grows or shrinks from the other end.', source: 's5i5.py:2100-2136' },
    { category: 'pieces', text: 'A marker that touches a rod when the level starts rides on that rod from then on, moving with it whenever it grows, shrinks or turns.', source: 's5i5.py:2051-2058, 2088-2092; engine run' },
    { category: 'pieces', text: 'Purple pieces are fixed walls. On level 1 two purple blocks sit just past the bottom and right edges of the board, in line with the two rods, so neither rod can grow off the board.', source: 's5i5.py:1729-1747; engine run: the 10th grow of the level 1 yellow rod was cancelled' },
    { category: 'hazards', text: 'A click that would make any rod overlap another rod or a purple wall is cancelled in full, for every rod it would have moved, and it still costs a click. Markers and pins never block anything.', source: 's5i5.py:2138-2143, 2213-2217, 2238-2242' },
    { category: 'budget', text: 'Budgets are 50, 150, 200, 100, 150, 150, 200 and 200 clicks for levels 1-8. Running out before the level clears ends the game, and there are no lives. The win check runs first, so clearing on your last click counts.', source: 's5i5.py:1745, 1767, 1797, 1824, 1852, 1873, 1903, 1938, 2243-2247; engine run on level 2' },
    { category: 'feedback', text: 'The bar along the bottom row of the screen is the budget: dark gray for clicks left, darker gray for clicks spent. It refills at the start of each level.', source: 's5i5.py:1952-1987, 2074-2078' },
    { category: 'feedback', text: 'A cancelled click is not silent: the game draws the attempted move for one frame, then snaps everything back to where it was.', source: 's5i5.py:2182-2187, 2213-2215, 2238-2240; engine run: 2 frames on a cancelled click, 1 on a normal one' },
    { introducedOnLevel: 2, category: 'pieces', text: 'Chained rods appear: a rod can be attached to the end of another rod, and gets carried along whenever the rod it hangs from grows, shrinks or turns. Level 2 has a chain of four one-segment rods.', source: 's5i5.py:1748-1769, 2060-2072, 2088-2092' },
    { introducedOnLevel: 3, category: 'pieces', text: 'Light gray bars appear. They have no anchor end and no button, so they never grow, shrink or turn on their own. They only move because they are attached to a rod that does.', source: 's5i5.py:1770-1799, 2046-2053' },
    { introducedOnLevel: 4, category: 'controls', text: 'One button can drive several rods: every rod of its color moves on the same click, even rods in different parts of the board growing in different directions. Level 4 has five yellow rods on one yellow button.', source: 's5i5.py:1800-1826, 2046-2053, 2228-2238' },
    { introducedOnLevel: 5, category: 'controls', text: 'Smaller slider buttons appear. They work exactly like the big ones.', source: 's5i5.py:1827-1854, 2218-2238' },
    { introducedOnLevel: 6, category: 'controls', text: 'Plus-shaped rotate buttons appear. Clicking one turns every rod of that color a quarter turn counterclockwise around its own anchor, swinging everything attached to it around the same point.', source: 's5i5.py:2194-2217, 2145-2179; engine run on level 6' },
    { introducedOnLevel: 6, category: 'pieces', text: 'A rod attached to another rod skips the turn that would fold it straight back over its parent: that click turns it a half turn instead.', source: 's5i5.py:2202-2212; engine run on level 6 (yellow and blue rods)' },
    { introducedOnLevel: 6, category: 'pieces', text: 'Level 6 has no purple border, so a rod can swing or grow partly off the board.', source: 's5i5.py:1855-1876; engine run: the level 6 blue rod turned to sit partly above the top edge' },
    { introducedOnLevel: 8, category: 'pieces', text: 'One rod can carry several rods at once: on level 8 a one-segment yellow rod has red, green, orange and blue rods attached on all four sides, and the yellow rotate button swings all four around it like a pinwheel.', source: 's5i5.py:1907-1941; engine run on level 8' },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-16',
      level: 5,
      saw: 'On level 5 the buttons had obviously changed from level 4, and something else had changed too.',
      did: 'Clicked everywhere on the board looking for what the new rule was.',
      happened: 'It made no sense: most clicks moved nothing. The buttons are only smaller versions of the same grow/shrink sliders (right half grows, left half shrinks). What changed is that the orange and green buttons each drive two rods in different parts of the board, and any click that would make any rod hit something is cancelled while still costing a click. The level also starts with the light blue marker already on its pin, and that rod is in the way -- it has to be pulled off its pin and put back at the end.',
      inCode: 'The click budget is spent before the hit test in step(), and a collision restores every rod that moved. A breadth-first search over the real engine found a 28-click minimum for level 5, and no solution at all without shrinking the light blue rod.',
    },
    {
      player: 'Boss',
      date: '2026-09-16',
      level: 6,
      saw: 'The rotate button looks like a cross or a plus sign.',
      happened: 'The write-up had called it a diamond. It is a plus; the hollow diamonds on the board are the pins you are aiming for.',
      inCode: 'The rotate-button sprites are plus shapes and exist only on levels 6-8. Each click turns every rod of that color a quarter turn counterclockwise around its anchor.',
    },
    {
      player: 'Boss',
      date: '2026-09-16',
      level: 7,
      saw: 'After turning rods, the light blue rod had grown one segment too many.',
      did: 'Tried shrinking it back.',
      expected: 'Shrinking would give back the position he had before.',
      happened: 'It did not: once a rod has been turned, shrinking it does not restore the earlier position, and he was left with a rod he could not fold into place. The undo key in the site player does nothing here -- RESET was the only way back.',
      inCode: 'The game declares only ACTION6 (s5i5.py:2042) and has no undo of any kind.',
    },
    {
      player: 'Boss',
      date: '2026-09-16',
      level: 7,
      saw: 'Level 7: colored crosses and stiff arms.',
      happened: 'Demonic. You use the colored crosses to rotate the stiff arms, like an unfolding mechanical arm. He only got this far by watching GPT-6 Astra replays. It badly needs an undo, though undo might make it too easy: you can get completely stuck where only a reset gets you out, and with any exploration at all you will need reset on this level. A nightmare for his spatial reasoning.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'hard',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION6', description: 'Grow/shrink rods of a color (slider halves) or rotate them (plus button)', commonName: 'Click' },
  ],
  hints: [
    {
      id: 's5i5-hint-1',
      title: 'Buttons Move Colors, Not Rods',
      content: 'A button moves every rod of its color at once, and they can be on opposite sides of the board growing in different directions. If a click does nothing, some rod of that color somewhere would have hit something, so the whole click was cancelled. It still cost you a click.',
      spoilerLevel: 1,
      dateAdded: '2026-09-16',
    },
    {
      id: 's5i5-hint-2',
      title: 'Plus Buttons Rotate (Levels 6-8)',
      content: 'The plus-shaped buttons turn every rod of that color a quarter turn counterclockwise around its anchor, swinging anything attached with it. The hollow diamonds are the pins you are aiming for, not buttons. Levels 1-5 have no rotate button at all.',
      spoilerLevel: 2,
      dateAdded: '2026-09-16',
    },
    {
      id: 's5i5-hint-3',
      title: 'Level 5: Un-Solve the Solved Pin',
      content: 'Level 5 starts with the light blue rod\'s marker already on its pin, and that rod is in the way. The light gray bar has no button, and you have to lift it past the light blue rod, so pull the light blue marker off and put it back at the end. Buttons left to right are blue, orange, green, light blue. From the level 5 starting layout: blue left x1, orange right x3, green right x1, light blue left x2, green right x3, blue left x4, green left x3, orange right x6, green right x3, light blue right x2. 28 clicks out of 150.',
      spoilerLevel: 3,
      dateAdded: '2026-09-16',
    },
    {
      id: 's5i5-hint-4',
      title: 'There Is No Undo. Reset Early.',
      content: 'The game declares only ACTION6 (s5i5.py:2042) and the build file has no undo of any kind, so the greyed-out UNDO (Z) key in the site player does nothing here -- RESET is the only way back. That matters most from level 6 on, where rotation enters: the owner reports that once you have turned a rod, shrinking it back does not get you the position you had. Grow one segment too many and you can be left with a rod you cannot fold into place, with every cancelled click still spending budget. Reported by the owner on level 7, 16-Sep-2026, after overgrowing the light blue rod (see the level 7 screenshots). Exploring costs resets: his winning 8/8 run used 5 of them, and the failed run before it used 10.',
      spoilerLevel: 2,
      dateAdded: '2026-09-16',
    },
  ],
  resources: [
    {
      title: 'S5I5 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/39d9f100-328a-4121-ad81-ce298e1f9626',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'S5I5 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/7609fe46-64be-4d12-b100-81733da7c768',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'S5I5 Human Replay -- Full 8/8 Clear (site owner, 16-Sep-2026)',
      url: 'https://arcprize.org/replay/850dee42-d148-44c4-91e7-efb149fd9542',
      type: 'replay',
      description: 'Human run, WIN, all 8 levels in 507 actions with 5 resets, score 79.61. Level actions [13, 27, 49, 38, 49, 127, 115, 89] against baselines [20, 89, 106, 54, 162, 38, 86, 83] -- level 7 cost 115 against an 86 baseline. Provenance verified, not assumed: GET three.arcprize.org/api/sessions/850dee42-... returns tags ["human"] and card_id 339c8f8f-7235-4bcb-b4e8-0ff0a6458344, and that card appears under user_name "Boss" in GET arcprize.org/api/user/scorecards with the owner cookie, published 2026-09-16T18:57:55Z. The same card also holds the losing run that preceded it: GAME_OVER at 4 levels, 831 actions, 10 resets.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/s5i5/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/s5i5/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/s5i5/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/s5i5/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/s5i5/lvl5.png', notes: 'Smaller slider buttons, same controls. Orange and green each drive two rods; one marker starts already on its pin.' },
    { level: 6, imageUrl: '/arc3-levels/s5i5/lvl6.png', notes: 'First level with the plus-shaped rotate buttons.' },
    { level: 7, imageUrl: '/arc3-levels/s5i5/lvl7.png', notes: 'The hardest level for a human player. The rods behave like an unfolding mechanical arm, swung a quarter turn at a time by the plus buttons, and a rod grown one segment too far can leave you unable to seat it -- there is no undo on this game, only RESET. The two captures below are from a human clear on 16-Sep-2026, which spent 115 actions here against an 86-action baseline.' },
    { level: 7, imageUrl: '/arc3-levels/s5i5/lvl7-human-overextended.png', kind: 'human', caption: 'human play, light blue rod overgrown by one segment', notes: 'Not an engine render: the arcprize.org player console during a human run, 16-Sep-2026. The light blue rod runs right from a cross button near the top left, one segment longer than it should be, and will not flip into position from here. The UNDO (Z) key visible in the console is greyed out and has nothing behind it on this game.' },
    { level: 7, imageUrl: '/arc3-levels/s5i5/lvl7-human-arm.png', kind: 'human', caption: 'human play, the arm part-unfolded', notes: 'Not an engine render: the same human run at a different point. Red and orange lie horizontal across the top with their markers on them, blue runs down the left, yellow up the right, green along the bottom -- the unfolding-arm shape this level is built around.' },
    { level: 8, imageUrl: '/arc3-levels/s5i5/lvl8.png' },
  ],
  tags: ['rods', 'point-and-click', 'chained-pieces', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. Level screenshots rendered from the game source on 2026-09-12; the two replay links are the ones ARC Prize published with the GPT-6 Astra results. Controls corrected 2026-09-16 against s5i5-18d95033/s5i5.py and run in the real engine: the rotate button is a plus, not a diamond, and appears only on levels 6-8; slider buttons drive every rod of their color; cancelled clicks still cost a click. The level 5 solution in the hints was found by breadth-first search over the engine (28 clicks is the minimum) and replayed to a clear. A human replay was added 2026-09-16: the site owner cleared all 8 levels in 507 actions with 5 resets (session 850dee42, verified as his via the scorecards API). Two level 7 captures from that session are listed above alongside the rendered level 7 grid; they are photographs of the player console during real play, not engine renders.',
};
