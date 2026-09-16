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
 * SRP/DRY check: Pass - Single responsibility for S5I5 game data.
 */

import { Arc3GameMetadata } from './types';

export const s5i5: Arc3GameMetadata = {
  gameId: 's5i5',
  officialTitle: 's5i5',
  informalName: 'Sliding Indicator',
  description: 'Grow, shrink and (from level 6) rotate color-coded rods to walk the markers riding them onto every pin.',
  simpleExplanation: 'You click color-coded buttons to grow, shrink and later rotate telescoping rods, carrying the dots riding on them onto the hollow-diamond pins before your clicks run out.',
  mechanicsExplanation: 'Every level is a set of color-coded telescoping rods, each with a dark gray anchor end. The two-headed slider buttons along the bottom are color-matched: clicking the right half grows every rod of that color by one 3-pixel segment away from its anchor, the left half shrinks it (never below one segment), and the thin center line does nothing. (Level 1\'s one upright slider works the same way, bottom half grows, top half shrinks.) One button often drives two rods in different parts of the board at once. From level 6, plus-shaped (cross) buttons appear: clicking one turns every rod of that color a quarter turn counterclockwise around its own anchor. Rods are chained into parent/child groups, so growing, shrinking or turning a rod carries everything attached to it, including the markers, and a child rod never folds back onto its parent (that turn is skipped). Some rods have no button at all and only move because they are attached to one that does; purple pieces are fixed walls. Any click that would make one rod overlap another rod or a wall is cancelled in full, and it still costs a click. The level clears when every hollow-diamond pin has a marker (the single dot riding a rod) sitting exactly on it. Every click anywhere spends one unit of the level\'s budget (the bar along the bottom row: 50, 150, 200, 100, 150, 150, 200 and 200 clicks for levels 1-8), and running it out ends the game.',
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
      description: 'Human run, WIN, all 8 levels in 507 actions with 5 resets, score 79.61. Level actions [13, 27, 49, 38, 49, 127, 115, 89] against baselines [20, 89, 106, 54, 162, 38, 86, 83] -- level 7 cost 115 against an 86 baseline. Provenance verified, not assumed: GET three.arcprize.org/api/sessions/850dee42-... returns tags ["human"] and card_id 339c8f8f-7235-4bcb-b4e8-0ff0a6458344, and that card appears under user_name "Mark" in GET arcprize.org/api/user/scorecards with the owner cookie, published 2026-09-16T18:57:55Z. The same card also holds the losing run that preceded it: GAME_OVER at 4 levels, 831 actions, 10 resets.',
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
    { level: 7, imageUrl: '/arc3-levels/s5i5/lvl7-human-overextended.png', caption: 'human play, light blue rod overgrown by one segment', notes: 'Not an engine render: the arcprize.org player console during a human run, 16-Sep-2026. The light blue rod runs right from a cross button near the top left, one segment longer than it should be, and will not flip into position from here. The UNDO (Z) key visible in the console is greyed out and has nothing behind it on this game.' },
    { level: 7, imageUrl: '/arc3-levels/s5i5/lvl7-human-arm.png', caption: 'human play, the arm part-unfolded', notes: 'Not an engine render: the same human run at a different point. Red and orange lie horizontal across the top with their markers on them, blue runs down the left, yellow up the right, green along the bottom -- the unfolding-arm shape this level is built around.' },
    { level: 8, imageUrl: '/arc3-levels/s5i5/lvl8.png' },
  ],
  tags: ['rods', 'point-and-click', 'chained-pieces', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. Level screenshots rendered from the game source on 2026-09-12; the two replay links are the ones ARC Prize published with the GPT-6 Astra results. Controls corrected 2026-09-16 against s5i5-18d95033/s5i5.py and run in the real engine: the rotate button is a plus, not a diamond, and appears only on levels 6-8; slider buttons drive every rod of their color; cancelled clicks still cost a click. The level 5 solution in the hints was found by breadth-first search over the engine (28 clicks is the minimum) and replayed to a clear. A human replay was added 2026-09-16: the site owner cleared all 8 levels in 507 actions with 5 resets (session 850dee42, verified as his via the scorecards API). Two level 7 captures from that session are listed above alongside the rendered level 7 grid; they are photographs of the player console during real play, not engine renders.',
};
