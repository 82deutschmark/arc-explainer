/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for FT09 (Functional Tiles) with featured replay clip metadata.
 *          The original write-up's core premise was wrong: there is no "dominant
 *          color" precedence system, the top-right block is just a color legend (not
 *          a target to match), the real win condition is scattered match/mismatch
 *          markers, every level has a click budget that can lose the game, and one
 *          tile type recolors several neighbors per click, not just itself.
 *
 * 2026-09-16 (Claude Opus 5, mechanics breakdown pass): added mechanicsBreakdown, read from
 *          ft09.py (build 0d8bbf25) and run in the engine on all 6 levels. Rewrote the three
 *          text fields to say exactly how a marker reads (white edge cell = that tile must be
 *          the center color, gray = must not be, dark gray = no tile there), that only tile
 *          clicks spend the budget, that the budget is fixed per level rather than shrinking,
 *          and that the pink-dotted tiles on levels 5-6 recolor themselves plus the neighbors
 *          their pink dots point at (level 6: every tile, and only the tile above). Hint 2
 *          said every click counts; only tile clicks do.
 *          2026-09-16 (Claude Opus 5, later): levelCount: 6 added (six Level() entries and six baselines in build 0d8bbf25).
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 *          2026-09-18 (Claude Opus 5, later): the featured video and the ft09-b8377d4b7815 replay link are
 *          marked as the ORIGINAL game (recorded 5 Jan 2026; the build id is printed in the video's
 *          own footer), so the page shows the video open as "The original game".
 *          No original-vs-today rows: nothing about how it differs is confirmed yet.
 * SRP/DRY check: Pass - Single responsibility for FT09 game data.
 */

import { Arc3GameMetadata } from './types';

export const ft09: Arc3GameMetadata = {
  gameId: 'ft09',
  officialTitle: 'ft09',
  informalName: 'Functional Tiles',
  description: 'Click tiles to cycle their colors until every small marker on the board is satisfied, within a fixed click budget per level.',
  simpleExplanation: 'The board is a grid of colored tiles with a few small marker squares mixed in. Each marker has a colored center and a border: a white border cell means the tile on that side must be the center color, a gray one means it must not be. Clicking a tile steps it to the next color. Satisfy every marker at once before your tile clicks run out.',
  mechanicsExplanation: 'Every level is a grid of 3x3 tiles with a few 3x3 markers set in among them. A marker\'s center color is its target, and each of its eight border cells points at the tile on that side, diagonals included: white means that tile must be the target color, gray means it must be any other color, and dark gray (from level 5) means there is no tile on that side. Clicking a tile moves it to the next color in the level\'s list and wraps around; that list is shown as small swatches at the top right from level 2, and every tile starts on the first one. The level ends the moment every marker is satisfied. Only clicks on tiles cost anything: 32 on levels 1 and 2, 96 on levels 3 and 4, 128 on levels 5 and 6, shown as an orange bar along the bottom that gives way to yellow as you spend it. Run out before the board is solved and you lose. Level 1 shows three solved example boards and puts the real one in gray corner brackets that flash if you click outside the tiles. Level 4 is the only level with three colors in the cycle. Level 5 adds tiles with pink dots on their edges: clicking one recolors it and every neighbor a pink dot points at. On level 6 every tile has a single pink dot on its top edge, so a click recolors that tile and the tile above it. There is no undo; RESET restarts the level.',
  mechanicsBreakdown: [
    {
      category: 'controls',
      text: 'Click a tile (a solid 3x3 colored square) to move it to the next color in the level\'s color list. After the last color it wraps back to the first. Each tile click costs 1 from the budget.',
      source: 'ft09.py:2369-2385, 2410-2424, 2431-2432',
    },
    {
      category: 'controls',
      text: 'Clicking anything that is not a tile (a marker, a gap, the background, the color swatches) does nothing and costs nothing.',
      source: 'ft09.py:2386-2392',
    },
    {
      category: 'controls',
      text: 'Clicking is the only action. There is no undo. RESET restarts the level with a full budget.',
      source: 'ft09.py:2306; arcengine/base_game.py:305-329',
    },
    {
      category: 'goal',
      text: 'Markers are small 3x3 squares set in among the tiles. The center color is the target. Each of the eight border cells points at the neighboring tile on that side, diagonals included.',
      source: 'ft09.py:2436-2520',
    },
    {
      category: 'goal',
      text: 'A white border cell means the tile on that side must be the target color. A gray border cell means that tile must be any other color. Two markers can share a tile, and then both rules apply to it.',
      source: 'ft09.py:2436-2520',
    },
    {
      category: 'goal',
      text: 'The level is won the moment every marker is satisfied at once, and the next level loads straight away. The click that solves it does not use up budget.',
      source: 'ft09.py:2426-2429',
    },
    {
      category: 'budget',
      text: 'The bottom row is the click bar: orange for what is left, yellow for what you have spent. Budgets are 32, 32, 96, 96, 128 and 128 tile clicks, refilled at each new level. Hit zero before the board is solved and you lose.',
      source: 'ft09.py:2064, 2093, 2133, 2169, 2220, 2260, 2272-2298, 2308-2312, 2431-2432',
    },
    {
      category: 'other',
      text: 'Level 1 is a lesson: three solved example boards, each a ring of tiles around a marker, and the real puzzle in the lower right inside gray corner brackets. It uses blue and red only.',
      source: 'ft09.py:2040-2069',
    },
    {
      category: 'feedback',
      text: 'On level 1, clicking outside the tiles (anywhere but a tile or the marker) makes the gray corner brackets around the real puzzle flash white twice, pointing you at it. It costs nothing.',
      source: 'ft09.py:2319-2322, 2355-2363, 2386-2390',
    },
    {
      introducedOnLevel: 2,
      category: 'feedback',
      text: 'Small color swatches at the top right list the level\'s colors in click order. The first swatch is the color every tile starts in.',
      source: 'ft09.py:2071-2098, 2341-2348',
    },
    {
      introducedOnLevel: 2,
      category: 'goal',
      text: 'More than one marker on a board, so tiles between two markers have to suit both.',
      source: 'ft09.py:2071-2098',
    },
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Three colors in the cycle (blue, red, orange), so a tile can take two clicks to reach the color you want.',
      source: 'ft09.py:2140-2174',
    },
    {
      introducedOnLevel: 5,
      category: 'goal',
      text: 'Dark gray border cells on a marker: there is no tile on that side, so there is nothing to check there.',
      source: 'ft09.py:2176-2225, 2446-2449',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Tiles with pink dots on their edges. Clicking one recolors it and every neighboring tile a pink dot points at, each one step along the color list. Level 5 has three of these, each with four dots (up, down, left, right).',
      source: 'ft09.py:2176-2225, 2377-2381, 2400-2424',
    },
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'Every tile on level 6 has one pink dot on its top edge, so each click recolors that tile and the tile directly above it (if there is one).',
      source: 'ft09.py:2227-2265, 2400-2424',
    },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-18',
      saw: 'Boxes, and the pattern it shows you.',
      happened: 'It is obvious that it wants certain boxes colored certain ways. He has seen this one too often to judge it fresh, but models have no problem with it.',
    },
  ],
  category: 'preview',
  humanDifficulty: 'easy',
  aiDifficulty: 'easy',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION6', description: 'Click to change tile/color', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'ft09-hint-1',
      title: 'The Corner List Is Not a Target',
      content: 'The colors near the top-right aren\'t a picture to recreate -- they\'re just the list of colors this level uses. The real goal is a set of small markers scattered around the board, each demanding its own neighboring tiles match or clash; every one of them has to hold at once.',
      spoilerLevel: 2,
    },
    {
      id: 'ft09-hint-2',
      title: 'Color Cycling and a Hidden Click Budget',
      content: 'Clicking a tile advances it through that level\'s fixed color list, wrapping back to the start -- a plain round-robin, not a smart toggle. One special tile type also recolors its neighbors, not just itself. Every level also caps your tile clicks (clicks anywhere else are free), shown as a draining bar; run out and you lose.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'FT09 Replay (original game)',
      url: 'https://three.arcprize.org/replay/ft09-b8377d4b7815/39b51ef3-b565-43fe-b3a8-7374ca4c5058',
      type: 'replay',
      description: 'A run on the original FT09 (ft09-b8377d4b7815), before ARC Prize reworked it.',
      originalGame: true,
    },
    {
      title: "FT09 Boss's Official Human Replay",
      url: 'https://arcprize.org/replay/99084b22-7e67-4e13-8d68-6095e944255f',
      type: 'replay',
      description: "Boss's own official ARC Prize replay, human play (2026-09-15).",
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/ft09/lvl1.png', notes: 'Current 6-level build (ARCEngine, March 2026) -- see the note below on why this differs from the level 8/9 shots further down.' },
    { level: 2, imageUrl: '/arc3-levels/ft09/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/ft09/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/ft09/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/ft09/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/ft09/lvl6.png' },
    {
      level: 8,
      imageUrl: '/ft09-lvl8.png',
      notes: 'Preview-era capture (Jul-Aug 2025) from a build with more levels than the current 6-level source -- kept for its own sake, not the same numbering as the renders above. The top-right block is just a color legend, not a target to copy -- the real goal is the scattered match/clash markers around the board.',
    },
    {
      level: 9,
      imageUrl: '/ft09-lvl9.png',
      notes: 'Same preview-era build as the level 8 shot above; not present in the current 6-level source.',
    },
  ],
  tags: ['preview-set', 'pattern-matching', 'logic'],
  thumbnailUrl: '/ft09.png',
  video: {
    src: '/videos/arc3/ft09-b8377d4b7815.mp4',
    caption: 'the scattered color-matching markers in play',
    originalGame: {
      build: 'ft09-b8377d4b7815',
      recordedOn: '2026-01-05',
      intro: 'This replay is the original FT09, before ARC Prize reworked it. FT09 changed less than VC33 or LS20, but this is still the original version, not today\'s game.',
      changes: [],
    },
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct, adversarially-verified source read: the original "dominant color" precedence framing had no code behind it at all. The real mechanic is independent, all-must-hold color markers scattered around the board, a per-level click budget that can lose the game, and a tile type that recolors several neighbors per click.',
};
