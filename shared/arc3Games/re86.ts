/*
 * Author: Claude Sonnet 5; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-09-11 (corrected against source 2026-09-12 and 2026-09-16)
 * PURPOSE: Game metadata for RE86 (Reach Emblems), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the target dots are visible from frame one, not hidden, and
 *          the wall/elastic collision rule doesn't exist anywhere in the first 5 of
 *          8 levels.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, traced from
 *          re86-8af5384d/re86.py and run in the engine (level 1 cleared in 20 moves,
 *          pad repaint animation, wall behavior on level 6, step-out loss, RESET).
 *          Corrected the wall text: crosses do not "stop dead" at walls -- the line that
 *          would hit stays put while the other line keeps sliding -- and hollow squares
 *          squash thinner and longer rather than compress. Win check now says the dot
 *          must be covered by a piece of the same color.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 * SRP/DRY check: Pass - Single responsibility for RE86 game data.
 */

import { Arc3GameMetadata } from './types';

export const re86: Arc3GameMetadata = {
  gameId: 're86',
  officialTitle: 're86',
  informalName: 'Reach Emblems',
  description: 'Slide colored outline pieces until every small target dot sits under a piece of its own color. Color pads that repaint pieces arrive on level 4; walls that bend crosses and squash squares only appear in the last three levels.',
  simpleExplanation: 'You slide one outline piece at a time, switching between them, until every little target dot is covered by a piece of the same color, before your steps run out. Later levels add pads that repaint pieces and walls that bend or squash them.',
  mechanicsExplanation: 'Up, Down, Left and Right slide the selected piece 3 pixels; ACTION5 hands control to the next piece. The selected piece is the one with a white pixel in its middle. The small target dots (one colored pixel in a darker gray ring) are on the board from the very start, under your see-through outline pieces, not hidden. The level clears the moment every dot\'s colored center pixel is covered by a piece of the same color -- any piece will do, the gray rings are ignored, and pieces lying elsewhere don\'t matter. Pieces pass straight through each other, and a move that would push a piece\'s middle off the board is refused. From level 4, color pads (small gray-bordered squares with a colored middle) repaint any piece of another color that slides onto them, as a stain that spreads across the piece during that one move; on levels 4, 5, 7 and 8 no piece starts in a dot color, so repainting is required. From level 6, light gray ring walls appear, and levels 1-5 have none. A cross whose line would run into a wall does not stop dead: the stuck line stays put and the other line keeps sliding, so the lines cross at a new point, until they cross at the very end of a line. A hollow square pushed into a wall squashes 3 pixels thinner and 3 pixels longer per push, down to 4 pixels thick. Neither change springs back before RESET. Every action, including switching pieces and refused moves, spends one step of the level\'s budget (100, 100, 200, 200, 250, 200, 300 and 400 for levels 1-8), shown as the purple bar along the bottom row; running out ends the game. RESET restarts the level, and there is no undo.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'Up, Down, Left and Right slide the selected piece 3 pixels. Only the selected piece moves, and there is no clicking in this game.', source: 're86.py:1755, 1880, 2126-2143' },
    { category: 'controls', text: 'ACTION5 switches control to the next piece in a fixed order, wrapping back to the first. It costs a step, the same as a move.', source: 're86.py:2144-2153' },
    { category: 'controls', text: 'RESET puts every piece back the way it started (position, color and shape) and refills the step bar. There is no undo.', source: 'arcengine/base_game.py:305-330; engine run' },
    { category: 'goal', text: 'Each level shows small target dots: one colored pixel inside a darker gray ring. They are on the board from the start, drawn under the pieces.', source: 're86.py:1615-1750 (target layer -1)' },
    { category: 'goal', text: 'The level clears the moment every dot\'s colored center pixel is covered by a piece of the same color. Any piece of that color will do, the gray rings don\'t count, and pieces lying over empty board don\'t matter.', source: 're86.py:1894-1918, 2154-2155; engine run: level 1 cleared in 20 moves' },
    { category: 'pieces', text: 'Pieces are thin outlines, so only their lines cover anything. Level 1 has two plus-shaped crosses, one yellow and one blue, for the yellow and blue dots.', source: 're86.py:1616-1627' },
    { category: 'pieces', text: 'Pieces slide straight through each other and never block one another. Where two overlap, the one drawn on top is the one the win check sees.', source: 're86.py:1894-1916, 2095-2100' },
    { category: 'pieces', text: 'A piece can hang partly off the edge of the board, but a move that would put its middle off the board is refused. The refused move still costs a step.', source: 're86.py:1943-1951, 2126-2129; engine run' },
    { category: 'budget', text: 'Every action spends one step: moves, refused moves and piece switches all count. Budgets are 100, 100, 200, 200, 250, 200, 300 and 400 steps for levels 1-8.', source: 're86.py:1838-1842, 1883-1892, 2126-2146, StepCounter in 1615-1750' },
    { category: 'hazards', text: 'If the steps run out before the level clears, the game is over. There are no lives. The win check runs first, so clearing a level on your very last step still counts.', source: 're86.py:2154-2158; engine run' },
    { category: 'feedback', text: 'The bar along the bottom row of the screen is the step budget: purple for steps left, light gray for steps spent. It refills at the start of each level.', source: 're86.py:1826-1861, 1888-1892' },
    { category: 'feedback', text: 'The selected piece has a single white pixel in its middle, and no other piece has one. White is not a color here, so a dot sitting exactly under that pixel is not covered while that piece is selected.', source: 're86.py:1775-1777, 1894-1918, 1920-1941, 2092' },
    { introducedOnLevel: 2, category: 'pieces', text: 'X-shaped pieces (two crossing diagonal lines) and a hollow diamond appear alongside the crosses. With no walls on levels 2-5, they slide exactly like the crosses.', source: 're86.py:1628-1640' },
    { introducedOnLevel: 3, category: 'pieces', text: 'A single straight line piece appears. On level 3 all three pieces (an X, a hollow diamond and the line) and every dot are red.', source: 're86.py:1641-1653' },
    { introducedOnLevel: 4, category: 'pieces', text: 'Color pads appear: small squares with a gray border and a solid colored middle. When a piece of another color slides onto a pad, the whole piece is repainted in the pad\'s color. Pads never block, and a piece that is already the pad\'s color crosses it with no change.', source: 're86.py:2078-2091, 2102-2120; engine run on level 4' },
    { introducedOnLevel: 4, category: 'goal', text: 'On levels 4, 5, 7 and 8 no piece starts in the color of any dot, so each piece you need has to be repainted on a pad first. Level 6 has no pads.', source: 're86.py:1654-1749' },
    { introducedOnLevel: 4, category: 'feedback', text: 'A repaint plays out as an animation inside that one move: the new color starts where the piece touches the pad and spreads along its lines until the whole piece has changed, then the white selection pixel comes back. It costs one step like any move.', source: 're86.py:2102-2120; engine run: 27 frames for the level 4 pink cross' },
    { introducedOnLevel: 6, category: 'pieces', text: 'Walls appear: light gray rings, 8 pixels wide on levels 6 and 7 and 5 pixels wide on level 8. No piece passes through a wall, but what happens instead depends on the piece\'s shape.', source: 're86.py:1690-1749, 1952-2058' },
    { introducedOnLevel: 6, category: 'pieces', text: 'Push a cross so one of its lines runs into a wall and it does not stop: the line that would hit stays where it is and the other line keeps moving, so the two lines now cross at a different point. Once they cross at the very end of a line, pushes that way are refused. This works both when a line hits the wall side-on and when its tip hits it end-on.', source: 're86.py:2004-2058; engine runs on level 6' },
    { introducedOnLevel: 6, category: 'pieces', text: 'A bent cross stays bent. Sliding it away moves it as it is, and only RESET straightens it. The white selection pixel stays in the middle of the piece\'s outer box, so on a bent cross it can sit off the lines.', source: 're86.py:2004-2058, 2092; engine run on level 6' },
    { introducedOnLevel: 6, category: 'pieces', text: 'Push a hollow square into a wall and it squashes: each push makes it 3 pixels thinner in the push direction and 3 pixels longer the other way, with the edge touching the wall staying put. At 4 pixels thick, pushes that way are refused. It never springs back before RESET.', source: 're86.py:1952-2003; engine run on level 6: 19x19 went to 16x22, 13x25, 10x28, 7x31, 4x34, then refused' },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-18',
      saw: 'What to do is pretty obvious.',
      happened: 'It is just fiddly. He hasn\'t played it through, and hates games like this one.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'easy',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION1', description: 'Slide selected piece Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Slide selected piece Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Slide selected piece Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Slide selected piece Right', commonName: 'Right' },
    { action: 'ACTION5', description: 'Cycle selected piece', commonName: 'Cycle' },
  ],
  hints: [],
  resources: [
    {
      title: 'RE86 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/fcc4f8b7-01e5-4009-923d-1c7d1fcae9fe',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'RE86 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/d7c629e9-5f79-4225-8344-53131c1c5dbc',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/re86/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/re86/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/re86/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/re86/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/re86/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/re86/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/re86/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/re86/lvl8.png' },
  ],
  tags: ['pixel-matching', 'sliding-pieces', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the targets are visible, not a hidden image, and the wall/elastic mechanic only exists in the last 3 of 8 levels.',
};
