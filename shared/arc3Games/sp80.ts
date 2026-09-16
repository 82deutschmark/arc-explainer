/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-01-09 (corrected against source 2026-09-12; breakdown added 2026-09-16)
 * PURPOSE: Game metadata for SP80 (Streaming Purple) with embedded streaming replay
 *          clip. A 2026-09-12 pixel-palette read of the source flagged the liquid as
 *          color 6 and argued for "Pink" over "Purple," but Mark called that rename
 *          out directly from having watched the actual gameplay video -- reverted;
 *          the name stays Streaming Purple. Kept: the containers are yellow, not
 *          white, and "the liquid falls straight down" only holds for 3 of the 6
 *          levels -- the other 3 render the whole screen rotated 180 degrees.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, every bullet traced in
 *          external/ARCEngine/environment_files/sp80/589a99af/sp80.py and the flow, spill,
 *          cup-rim, L-piece, blocking, pour-limit, step-bar and RESET claims run in the
 *          engine. Rewrote simpleExplanation and mechanicsExplanation (a failed pour is
 *          cleaned up automatically -- it never needed a reset -- and there is a
 *          four-failed-pour limit), fixed ACTION6 (a click selects a piece, it does not
 *          move one), added the arrow actions, and fixed hint 2 (there are no diagonal
 *          platforms; the redirectors are purple L pieces from level 5).
 * SRP/DRY check: Pass - Single responsibility for SP80 game data.
 */

import { Arc3GameMetadata } from './types';

export const sp80: Arc3GameMetadata = {
  gameId: 'sp80',
  officialTitle: 'sp80',
  informalName: 'Streaming Purple',
  description: 'Move red bars (and, from level 5, purple L pieces) so that one pour of the purple stream fills every yellow cup without touching a spill line.',
  simpleExplanation: 'Move the red bars into place, then pour. The liquid falls, runs off the ends of bars, and has to fill every yellow cup without touching the light gray floor line. A failed pour is wiped and you try again, but only four failed pours are allowed per level.',
  mechanicsExplanation: 'Click a piece to select it (it turns blue) and move it one cell at a time with the arrows. Action 5 pours: liquid falls from every spout one cell per frame. When it lands on a red bar it runs along the top of the bar both ways and drops off both ends, so each bar splits a stream in two. It fills a yellow cup (the cup turns dark red) only by dropping into the one-cell notch in the middle of the cup. A pour wins the level only if every cup is filled and no liquid touched a light gray spill line. A failed pour is not a reset: the liquid is wiped, your pieces stay where they are, and you can pour again -- but the fourth failed pour is the last one, and pressing Action 5 after it ends the game. Every action except RESET spends one step from the green bar at the edge of the screen; running out is game over. Levels 2, 3 and 5 are drawn upside down (the controls are turned to match). Level 4 adds a spout riding on a movable bar. Level 5 adds purple L pieces that turn a stream 90 degrees and cups mounted sideways on the walls, which only a sideways stream can fill.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'controls',
      text: 'Click a piece to select it. It turns blue and the piece you had selected goes back to its normal color. Anywhere inside the piece\'s box counts as a hit. Each level starts with one piece already selected: the one nearest the top-left corner of the board (the bottom-right corner on the upside-down levels).',
      source: 'sp80.py:580-584, 615-622, 679-694',
    },
    {
      category: 'controls',
      text: 'Clicking on empty space does nothing, but it still spends a step.',
      source: 'sp80.py:676-678, 725-726',
    },
    {
      category: 'controls',
      text: 'Up, Down, Left and Right move the selected piece one cell. A move that gets blocked still spends a step.',
      source: 'sp80.py:697-713',
    },
    {
      category: 'controls',
      text: 'A piece can\'t move into the three rows at the spout end of the board, and it can\'t get within one cell of a yellow cup, diagonals included. The board edge, the spill line and the drop sitting under each spout also stop it.',
      source: 'sp80.py:586-598, 708-711',
    },
    {
      category: 'controls',
      text: 'Pieces slide straight through each other. A bar can sit on top of another bar, and the selected piece is drawn on top.',
      source: 'sp80.py:620, 709-711',
    },
    {
      category: 'controls',
      text: 'Action 5 pours. The whole pour plays out as one action -- you can\'t move anything until it finishes -- and it costs one step no matter how long the liquid runs.',
      source: 'sp80.py:716-724, 631-653, 727-822',
    },
    {
      category: 'goal',
      text: 'You clear a level with one pour that fills every yellow cup while no liquid touches a light gray spill line. Both parts count: a clean pour that misses a cup fails, and a pour that fills every cup but also leaks fails.',
      source: 'sp80.py:728-748',
    },
    {
      category: 'pieces',
      text: 'The spout is a single darker gray pixel at the edge of the board, with the first drop of liquid already sitting next to it. When you pour, the liquid falls straight away from the spout, one cell per frame.',
      source: 'sp80.py:631-653, 750-761',
    },
    {
      category: 'pieces',
      text: 'Red bars: liquid that lands on a bar runs along the row just above it in both directions, one cell per frame, and drops off both ends. So a bar turns one stream into two, one off each end.',
      source: 'sp80.py:764-771',
    },
    {
      category: 'pieces',
      text: 'Yellow cups (U shapes): liquid that drops into the one-cell notch in the middle of a cup fills it, and the cup turns dark red. Liquid that lands on a cup\'s rim splits like it hit a bar: the half that falls into the notch still fills the cup, and the other half keeps falling down the outside.',
      source: 'sp80.py:772-786',
    },
    {
      category: 'pieces',
      text: 'Liquid that runs into liquid already on the board joins it and carries on in its own direction.',
      source: 'sp80.py:762-763',
    },
    {
      category: 'hazards',
      text: 'The light gray line along the bottom edge is a spill line. Liquid that reaches it turns the line green and that pour fails.',
      source: 'sp80.py:812-816, 728-731',
    },
    {
      category: 'budget',
      text: 'Step bar: the strip along the top edge is green for steps left and white for steps used. Every action except RESET costs one step: moves, blocked moves, clicks on nothing, and each pour. The budgets are 30, 45, 100, 120, 100 and 120 steps for levels 1 to 6. Hitting zero is game over.',
      source: 'sp80.py:415-436, 557-560, 676-678, 861-868; level data 274-409',
    },
    {
      category: 'budget',
      text: 'A failed pour cleans itself up. All the poured liquid disappears (the first drop by each spout stays), your pieces stay where you put them, and the selection jumps back to the piece nearest the top-left corner (bottom-right on the upside-down levels). You get four failed pours per level: pressing Action 5 after the fourth failure ends the game. Nothing on screen counts them for you.',
      source: 'sp80.py:655-672, 716-721, 742-745',
    },
    {
      category: 'feedback',
      text: 'After a failed pour, for a few frames the spill line that got hit blinks green and light gray, and every cup that stayed empty blinks white and yellow. That shows you where it leaked and which cups you missed.',
      source: 'sp80.py:730-741',
    },
    {
      category: 'feedback',
      text: 'A winning pour goes straight to the next level as soon as the liquid stops moving, with every cup shown dark red.',
      source: 'sp80.py:744-748, 776-778',
    },
    {
      category: 'other',
      text: 'RESET restarts the current level: pieces back to their starting spots, a full step bar, and the failed-pour count back to zero. It doesn\'t cost a step.',
      source: 'sp80.py:538-566, 677; arcengine/base_game.py:305-330',
    },
    {
      category: 'other',
      text: 'There is no undo. The only actions are the four arrows, Action 5 and click.',
      source: 'sp80.py:535',
    },
    // ---- Level 2 ----
    {
      introducedOnLevel: 2,
      category: 'other',
      text: 'Levels 2, 3 and 5 are drawn upside down: the spout is at the bottom, the liquid rises, and the cups hang from the top. The arrows and clicks are turned to match, so Up still moves a piece up on screen. On these levels the step bar runs along the bottom edge, and its white (used) part grows from the left.',
      source: 'sp80.py:439-452, 454-495, 845-859; level data "dojfslwbg": 180 on levels 2, 3, 5',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'More than one bar, in different lengths (a 5-cell bar and two 3-cell bars on level 2), so you click to choose which bar you are moving.',
      source: 'sp80.py:292-311',
    },
    // ---- Level 3 ----
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Three spouts pour at the same time. Every stream has to end up in a cup, and none of them can leak.',
      source: 'sp80.py:312-336, 631-653',
    },
    // ---- Level 4 ----
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'A red bar with a darker gray spout in its middle. When you pour, it starts its own stream from the cell just below that spout. It moves like any other bar, so you decide where the second stream starts.',
      source: 'sp80.py:207-215, 346, 641-653',
    },
    // ---- Level 5 ----
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Purple L pieces (a 2x2 block with one corner missing). Liquid that flows into the missing corner is turned 90 degrees and leaves through the open side it didn\'t come in from. On level 5 the L is missing its top-right corner, so falling liquid comes out heading right. You select and move L pieces like bars, and they turn blue when selected.',
      source: 'sp80.py:254-262, 375, 568-569, 787-811',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Liquid that hits the outside of an L piece splits around it like it hit a bar.',
      source: 'sp80.py:803-811',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'A sideways stream runs in a straight line and does not fall. When it hits a bar or the outside of a piece it splits above and below and keeps going sideways.',
      source: 'sp80.py:750-771',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Cups mounted on their side against a wall, with the notch facing into the board. Falling liquid can\'t reach the notch, so only a sideways stream can fill one.',
      source: 'sp80.py:369, 393, 395-396, 772-786',
    },
    {
      introducedOnLevel: 5,
      category: 'hazards',
      text: 'The side edges become spill lines too: the right edge on level 5 and both edges on level 6. A sideways stream that reaches one fails the pour, same as the floor.',
      source: 'sp80.py:377-378, 401-402, 812-816',
    },
    // ---- Level 6 ----
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'A second kind of L piece, missing its top-left corner: falling liquid that drops into it comes out heading left. Level 6 has one of each kind.',
      source: 'sp80.py:244-252, 398, 787-803',
    },
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'A standing red bar, four cells tall. It splits streams the same way a lying bar does.',
      source: 'sp80.py:159-170, 391, 764-771',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'hard',
  actionMappings: [
    { action: 'ACTION1', description: 'Move the selected piece up one cell', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move the selected piece down one cell', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move the selected piece left one cell', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move the selected piece right one cell', commonName: 'Right' },
    { action: 'ACTION5', description: 'Pour: start the liquid from every spout', commonName: 'Interact/Execute' },
    { action: 'ACTION6', description: 'Select the red bar or purple L piece you click on (it does not move it)', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'sp80-hint-1',
      title: 'Pre-Flight Check',
      content: 'Do not start the stream until you are 100% sure the path is complete. The stream logic triggers a multi-frame animation that you cannot interrupt.',
      spoilerLevel: 2,
    },
    {
      id: 'sp80-hint-2',
      title: 'U-Shape Targeting',
      content: 'In half the levels the liquid falls straight down, but the other 3 of the 6 flip the entire screen upside-down for display, so the same physics looks like it\'s flowing up. From level 5, purple L pieces turn the stream 90 degrees so it can run sideways into the notch of a cup mounted on a wall.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'SP80 Replay',
      url: 'https://three.arcprize.org/replay/sp80-0605ab9e5b2a/212c541e-db90-40c3-9601-79049867dab2',
      type: 'replay',
      description: 'Gameplay replay of SP80 (Streaming Purple)',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/sp80/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/sp80/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/sp80/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/sp80/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/sp80/lvl5.png' },
    { level: 6, imageUrl: '/sp80-lvl6.png', notes: 'Platforms must be set before pressing Action 5.' },
  ],
  tags: ['evaluation-set', 'physics', 'fluid-dynamics'],
  thumbnailUrl: '/sp80.png',
  video: {
    src: '/videos/arc3/sp80-test.mp4',
    caption: 'Streaming Purple capture showing animation when Action 5 triggers flow',
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct source read: the containers are yellow, not white, and "falls straight down" only holds for 3 of the 6 levels, since the other 3 render the screen rotated 180 degrees. A separate rename to "Streaming Pink" was proposed the same day over the liquid\'s exact pixel color, but reverted -- Mark watched the actual gameplay video and confirmed it reads as purple; the name stays Streaming Purple.',
};
