/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for AR25 (Axis Reflectors), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: most levels give you TWO independently movable/reflecting
 *          pieces, not one, and Cycle (ACTION5) spends a step too.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown traced in
 *          ar25-0c556536/ar25.py and run in the engine, and tightened
 *          mechanicsExplanation: the pieces are Black, not colored; level 1's mirror is
 *          fixed; clicking to select is free; each mirror only slides across its own line.
 * SRP/DRY check: Pass - Single responsibility for AR25 game data.
 */

import { Arc3GameMetadata } from './types';

export const ar25: Arc3GameMetadata = {
  gameId: 'ar25',
  officialTitle: 'ar25',
  informalName: 'Axis Reflectors',
  description: 'Move one or two pieces and axis-aligned mirrors; live reflections must cover every target dot.',
  simpleExplanation: 'You move one or two Black pieces and the Light Blue mirror lines that reflect them across the board. Any Yellow target square touched by a piece or its Darker Gray reflection counts as covered. Clear a level by covering every target, often by moving the mirror instead of the piece.',
  mechanicsExplanation: 'The board is 21x21 cells on a Blue background. You control one or two Black pieces -- levels 3, 4, 6, 7 and 8 give you two -- plus straight Light Blue mirror lines: a fixed vertical one on level 1, a movable vertical one on level 2, a movable horizontal one on levels 3 and 4, and one of each from level 5. A vertical mirror only slides left and right, a horizontal one only up and down. Every piece is reflected live across every mirror, and the reflections are drawn in Darker Gray. The target is a shape made of Yellow squares; the level ends the moment every Yellow square is covered by a piece or a reflection. Pieces pass through each other and through mirror lines. Each cell a piece or mirror moves costs one step from a colored bar on the right edge of the screen (64, 128 or 320 steps), and pressing Cycle to switch what is selected costs a step too, but clicking a piece or mirror to select it is free. Undo moves things back one move but never refunds the step. The move that empties the bar loses the level unless that same move wins it.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'controls',
      text: 'Arrow keys move whatever is selected one cell. Cycle, click and undo are also available.',
      source: 'ar25.py:1277, 1722-1778',
    },
    {
      category: 'goal',
      text: 'The target is a shape made of Yellow squares. The level ends the moment every Yellow square is covered, either by a Black piece or by one of its Darker Gray reflections.',
      source: 'ar25.py:59-68, 1688-1696, 1767-1770',
    },
    {
      category: 'pieces',
      text: 'Pieces are Black shapes on the Blue board. They move inside the board edges, and pressing toward an edge they already touch does nothing and costs nothing.',
      source: 'ar25.py:1744-1755',
    },
    {
      category: 'pieces',
      text: 'A mirror is a Light Blue line across the whole board. Every piece is reflected across it, and the reflection is drawn in Darker Gray on the other side, the same distance from the line.',
      source: 'ar25.py:1555-1618, 1088',
    },
    {
      category: 'pieces',
      text: 'On level 1 the mirror is fixed: you cannot select it or move it, so only the piece moves.',
      source: 'ar25.py:667-677, 719-735, 1357-1360',
    },
    {
      category: 'pieces',
      text: 'Reflections are live. Move a piece or a mirror and every reflection redraws at once.',
      source: 'ar25.py:1767, 1682-1686',
    },
    {
      category: 'budget',
      text: 'Every cell a piece or mirror actually moves costs one step. The bar is a column on the right edge of the screen that drains from the top: 64 steps on levels 1-2, 128 on levels 3-5, 320 on levels 6-8.',
      source: 'ar25.py:1092-1147, 1771-1773, 732-1061',
    },
    {
      category: 'budget',
      text: 'The move that uses your last step loses the level, unless that same move covers the last Yellow square.',
      source: 'ar25.py:1767-1773',
    },
    {
      category: 'controls',
      text: 'Cycle switches the selection to the next movable thing (mirrors first, then pieces) and always costs a step, even when there is only one thing to select.',
      source: 'ar25.py:1779-1791',
    },
    {
      category: 'controls',
      text: 'Clicking a piece or mirror selects it for free. Clicking empty board, a Yellow square or a reflection does nothing and costs nothing. Where a piece sits on a mirror line, the click picks the piece.',
      source: 'ar25.py:1792-1846',
    },
    {
      category: 'controls',
      text: 'Undo puts pieces and mirrors back where they were one move ago. It does not give the step back and does not change the selection.',
      source: 'ar25.py:1309-1329, 1716-1721',
    },
    {
      category: 'other',
      text: 'RESET puts the level back to its start with a full bar and clears the undo history.',
      source: 'ar25.py:1331-1385; arcengine/base_game.py:305-330',
    },
    {
      category: 'feedback',
      text: 'The selected piece or mirror shows a White dot in the middle of each of its cells; unselected ones show Blue dots. A Yellow square that is covered keeps a small Yellow dot showing through whatever covers it.',
      source: 'ar25.py:1150-1254',
    },
    // ---- Level 2 ----
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'From level 2 the mirror moves. A vertical mirror only slides left and right; pressing up or down on it does nothing and costs nothing. Levels 2 to 8 start with a mirror selected, not a piece.',
      source: 'ar25.py:617-627, 736-755, 1740-1743, 1357-1360',
    },
    {
      introducedOnLevel: 2,
      category: 'feedback',
      text: 'On level 2, if you spend 15 steps without ever switching the selection, a White box flashes three times around the Black piece, hinting that you can select it.',
      source: 'ar25.py:79-90, 1702-1711, 1774-1776',
    },
    // ---- Level 3 ----
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Level 3 swaps in a horizontal mirror, which only slides up and down, and gives you two Black pieces (levels 3, 4, 6, 7 and 8 all have two). Each piece is reflected on its own.',
      source: 'ar25.py:69-78, 756-794',
    },
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Pieces do not block anything: they slide over each other and straight across mirror lines.',
      source: 'ar25.py:1722-1778',
    },
    {
      introducedOnLevel: 3,
      category: 'feedback',
      text: 'Longer budgets use a multi-colored bar. Each 64 steps is one color: the Yellow column drains to show Orange underneath, then Orange drains to Purple, Purple to Red, Red to Green, and the last color drains to nothing.',
      source: 'ar25.py:1098-1104, 1117-1147',
    },
    // ---- Level 5 ----
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'From level 5 there is one vertical and one horizontal mirror at once. A piece then shows up to three Darker Gray copies: one across each mirror and one across both. Clicking where the two lines cross switches between the two mirrors.',
      source: 'ar25.py:832-867, 1555-1618, 1814-1834',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'easy',
  aiDifficulty: 'easy',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION1', description: 'Move piece/mirror Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move piece/mirror Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move piece/mirror Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move piece/mirror Right', commonName: 'Right' },
    { action: 'ACTION5', description: 'Cycle selection', commonName: 'Cycle' },
    { action: 'ACTION6', description: 'Click a piece or mirror to select it', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo', commonName: 'Undo' },
  ],
  hints: [],
  resources: [
    {
      title: 'AR25 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/c28b4a3f-69b3-416e-8137-3890497bc089',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'AR25 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/ed09362c-eb47-41b8-bf46-2d275090be02',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/ar25/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/ar25/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/ar25/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/ar25/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/ar25/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/ar25/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/ar25/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/ar25/lvl8.png' },
  ],
  tags: ['mirrors', 'reflection', 'step-budget', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the single-piece framing and the free-cycling claim were both wrong.',
};
