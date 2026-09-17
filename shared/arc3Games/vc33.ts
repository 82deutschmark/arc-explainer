/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12; orientation note
 *         added 2026-09-12 PM; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-01-09 (corrected against source 2026-09-12; breakdown added 2026-09-16)
 * PURPOSE: Game metadata for VC33 with featured replay video metadata.
 *          Adversarially re-verified 2026-09-12: player-square transit needs a manual
 *          click on a specific bar (it's a two-way swap, not an automatic glide),
 *          blue squares don't move liquid at all (only red/maroon do), and every
 *          level has an unmentioned click budget that can lose the game.
 *          2026-09-12 PM: an eccentric chicken farmer, who played this at its original
 *          release, flagged that the current build reads as more confusing than it used
 *          to -- the liquid framing isn't presented consistently level to level. Checked
 *          against our own level screenshots: lvl1.png fills left-to-right along a
 *          horizontal bar, while lvl4.png and lvl7.png read as ordinary vertical columns
 *          rising off a floor line. Same conservation-of-volume mechanic underneath in
 *          both; the axis it's drawn on just isn't fixed, which is what makes it read as
 *          "liquid, but tilted" rather than obviously liquid the way the vertical levels
 *          do at a glance.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, traced in
 *          external/ARCEngine/environment_files/vc33/5430563c/vc33.py; levels 1-4 were solved
 *          in the engine by search over clicks, and the pump pairs, wall-height limit, empty
 *          tank, gate crossing and click budget were run there. CORRECTION to the 2026-09-12
 *          line above: in the live build the blue squares ARE the pumps that move liquid, and
 *          there is no red or maroon piece at all (the older 9851e02b build is the same).
 *          The red pumps come from /vc33-lvl7.png, a screenshot of the original 9-level
 *          preview build. Rewrote description, simpleExplanation and mechanicsExplanation
 *          (the goal -- each rider level with a mark of its color -- was missing, and a gate
 *          needs the liquid exactly level with it, not "a gap closed enough"), fixed the
 *          click mapping and hint 2.
 *          2026-09-16 (Claude Opus 5, later): level 7 screenshot now the live-build render, not the 9-level preview capture.
 *          2026-09-17 (Claude Opus 5): Boss's level 5 play note (green down first, yellow later) and his mid-run capture.
 * SRP/DRY check: Pass - Single responsibility for VC33 game data.
 */

import { Arc3GameMetadata } from './types';

export const vc33: Arc3GameMetadata = {
  gameId: 'vc33',
  officialTitle: 'vc33',
  informalName: 'Volume Control',
  description: 'Pump white liquid between tanks so every rider sitting on a liquid surface ends up level with a mark of its own color, carrying riders through gates in the walls when they need to change tanks, before your click budget runs out. Not every level draws its tanks standing up -- some run sideways or hang upside down, same mechanic on a different axis.',
  simpleExplanation: 'White liquid sits in tanks divided by black walls. Clicking a blue pump moves liquid through a wall, raising one side and lowering the other, and the little riders sitting on the liquid go up and down with it. Get every rider level with the stripe of its own color on a wall next to it. From level 4, a gate in a wall turns orange when the liquid on both sides is exactly level with it; clicking it sends the riders across.',
  mechanicsExplanation: 'Each level is a set of tanks of white liquid separated by black walls, and the liquid settles toward one side of the screen (right, left, down or up depending on the level). Blue pumps sit in pairs at the foot of each wall, one on each side; clicking a pump moves one step of liquid through the wall into the tank on the pump\'s side, so that tank\'s surface rises and the other tank\'s surface drops. A pump does nothing if the tank it drains is empty or the tank it fills is already up to the top of the shorter wall beside it. Riders (small caps with a yellow, green or purple base) sit on liquid surfaces and move only with them; they can\'t be clicked. You win when every rider is level with a stripe of its own color painted on a wall next to its tank. From level 4, light gray gates are set into some walls. A gate turns orange, with white brackets beside it, when the liquid on both sides is exactly level with it; clicking it then slides riders across to the other tank (two riders swap). From level 6, black bars cap how far a tank can be filled. Every click, including a wasted one, spends one unit of a per-level budget; run out before finishing and you lose.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'controls',
      text: 'Click is the only action. Clicking a blue pump or an orange gate does something. Clicking anything else, including a gray gate or a pump that can\'t move liquid right now, does nothing but still uses a click.',
      source: 'vc33.py:1842, 2094-2124',
    },
    {
      category: 'pieces',
      text: 'The white areas are liquid in tanks divided by black walls. The liquid settles toward one side of the screen, and that side changes by level: right on levels 1 and 5, left on 2 and 6, down on 3 and 4, up on 7. The pumps always sit on the side the liquid settles toward, and the surface is the far face of the liquid.',
      source: 'vc33.py:1568, 1589, 1622, 1651, 1681, 1704, 1740, 1853-1886',
    },
    {
      category: 'pieces',
      text: 'Blue squares are pumps. They come in pairs at the foot of a black wall, one on each side of it. Clicking one moves liquid through that wall into the tank on the pump\'s own side: that tank\'s surface moves out one step and the tank across the wall drops one step. A step is 2 pixels on levels 1-3 and 7, and 3 pixels on levels 4-6.',
      source: 'vc33.py:1894-1935, 2030-2056',
    },
    {
      category: 'pieces',
      text: 'A pump does nothing if the tank it would drain is empty, or if the tank it would fill already reaches the end of the shorter black wall beside it.',
      source: 'vc33.py:1994-1997, 2014-2028, 2030-2031',
    },
    {
      category: 'pieces',
      text: 'Riders are small shapes with a darker gray cap and a colored base (yellow, green or purple), sitting on a liquid surface. You can\'t click them. They move only when the surface under them moves, and they go with it.',
      source: 'vc33.py:195-257, 2010-2012, 2033-2037',
    },
    {
      category: 'goal',
      text: 'You win when every rider is level with a short stripe of its own color painted on a black wall next to its tank. The check runs after every click.',
      source: 'vc33.py:1937-1955, 2120-2121',
    },
    {
      category: 'budget',
      text: 'The strip along the top edge is the click budget: light pink for clicks left, darker gray for clicks used. Every click costs one. The budgets are 50, 50, 75, 50, 200, 50 and 200 for levels 1 to 7. The click that uses the last one loses, unless that same click wins the level.',
      source: 'vc33.py:1792-1827, 1844-1848, 2103, 2120-2124',
    },
    {
      category: 'other',
      text: 'RESET restarts the current level with a full budget. There is no undo; the other pump of a pair moves the liquid back, and that costs a click too.',
      source: 'vc33.py:1894-1899; arcengine/base_game.py:305-330',
    },
    // ---- Level 2 ----
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Three tanks in a row. The middle tank has a wall on each side, so it can be filled or drained through either wall.',
      source: 'vc33.py:1571-1591',
    },
    // ---- Level 3 ----
    {
      introducedOnLevel: 3,
      category: 'goal',
      text: 'Three riders at once (yellow, green and purple). Each one needs a stripe of its own color, and all three have to be level at the same time.',
      source: 'vc33.py:1592-1624, 1937-1955',
    },
    // ---- Level 4 ----
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Light gray gates set into the black walls. A gate is ready when the liquid on both sides of it is exactly level with its end nearest the liquid; it then turns orange and white brackets appear on both sides of it. When it stops being level, it goes back to light gray.',
      source: 'vc33.py:1628-1629, 1957-1992',
    },
    {
      introducedOnLevel: 4,
      category: 'controls',
      text: 'Clicking an orange gate opens it: the gate slides back out of the way, a rider on either side slides across to the middle of the tank on the other side, and the gate slides shut. If both sides have a rider, they swap. The whole crossing plays out as one click. Clicking a gray gate does nothing.',
      source: 'vc33.py:2058-2092, 2094-2118',
    },
    // ---- Level 6 ----
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'Black bars in a tank\'s path. A tank can\'t be pumped past the bar, and if a rider sits on that tank, it stops early enough to leave the rider room.',
      source: 'vc33.py:1687, 1999-2005, 2014-2023',
    },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-17',
      level: 5,
      saw: 'Level 5 of 7 is one of the levels turned 90 degrees counterclockwise since the preview, so the tanks run sideways. The yellow piece has to get through a gate and up to where it wants to be, and the gates only show up once you make them appear.',
      did: 'Lost the level once. On the next try, put the green piece down first, then went back to work on the yellow piece.',
      happened: 'That is the order the level wants: green has to go down first and yellow gets finished later. Devious.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'easy',
  actionMappings: [
    { action: 'ACTION6', description: 'Click a blue pump to move liquid through a wall, or click an orange gate to send riders across it', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'vc33-hint-1',
      title: 'Hydraulic Logic',
      content: 'Think of the total volume of white pixels as constant. Raising one column usually requires lowering another. Map out which controllers affect which "tubes".',
      spoilerLevel: 2,
    },
    {
      id: 'vc33-hint-2',
      title: 'Manual Crossing',
      content: 'Riders don\'t glide across by themselves -- once the liquid on both sides of a gate is exactly level with it, the gate turns orange, and you have to click it directly; that click sends the riders on either side across (two riders swap). Watch your click budget while you experiment.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'VC33 Replay',
      url: 'https://three.arcprize.org/replay/vc33-6ae7bf49eea5/29409ce8-c164-447e-8810-828b96fa4ceb',
      type: 'replay',
      description: 'Gameplay replay of VC33 (Volume Control)',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/vc33/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/vc33/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/vc33/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/vc33/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/vc33/lvl5.png' },
    { level: 5, imageUrl: '/arc3-levels/vc33/lvl5-human-gates.png', caption: 'human play, green put down, yellow next', notes: 'Not an engine render: the arcprize.org player console during Boss\'s run, 17-Sep-2026. Green is already down in the bottom tank; yellow sits by the orange gate, still to be taken through and up.' },
    { level: 6, imageUrl: '/arc3-levels/vc33/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/vc33/lvl7.png' },
  ],
  tags: ['preview-set', 'hydraulics', 'physics'],
  thumbnailUrl: '/vc33.png',
  video: {
    src: '/videos/arc3/vc33-6ae7bf49eea5.mp4',
    caption: 'Volume Control replay highlighting hydraulic manipulation',
  },
  isFullyDocumented: true,
  notes: 'Orientation note added 2026-09-12 PM, from an eccentric chicken farmer who played this game at its original release: it used to read unambiguously as liquid, and the current build is a little more confusing because the columns aren\'t all drawn standing up anymore. Corrected 2026-09-12 after a direct, adversarially-verified source read: transit is a manual click-to-swap on a specific bar, not an automatic glide; blue squares never move liquid; and a per-level click budget that can lose the game was missing. Corrected again 2026-09-16 against the live build (5430563c): the blue squares are the pumps that move liquid, and no red or maroon piece exists in it. The red pumps are only in /vc33-lvl7.png, which is a screenshot of the original 9-level preview build, not the current 7-level game.',
};
