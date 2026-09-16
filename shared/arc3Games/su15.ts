/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12; rewritten 2026-09-16)
 * PURPOSE: Game metadata for SU15 (Sucking Up), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: Undo is actually free (the escalating cost is charged for
 *          colliding different-tier blocks, not Undo), critters are absent from the
 *          first 3 of 9 levels, and the smallest tier is destroyed outright on
 *          critter contact rather than demoted.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *
 * Correction: Claude Opus 5, 16-September-2026. Rewritten against build su15-1944f8ab
 *          after the site owner won the game 9/9 and reported the page was wrong.
 *          Three errors fixed. (1) "Numbered blocks" was fabricated -- nothing in this
 *          game renders a digit. The nine tiers are plain squares of different size
 *          and color; the sprite assets happen to be *named* "0".."8", which is
 *          almost certainly what a prior pass misread as on-screen labels.
 *          (2) The two header legends -- the merge chain at top-left and the
 *          delivery requirement at top-center -- were missing entirely, and they are
 *          the things that make the game readable. (3) The "diamond hazard critters"
 *          are 4x5 lander/saucer glyphs, and the step budget does not shrink.
 *          Also added: hints (the array was empty) and the owner's winning replay.
 * SRP/DRY check: Pass - Single responsibility for SU15 game data.
 */

import { Arc3GameMetadata } from './types';

export const su15: Arc3GameMetadata = {
  gameId: 'su15',
  officialTitle: 'su15',
  informalName: 'Sucking Up',
  description: 'Click to suck nearby blocks toward you, fusing same-size blocks into bigger ones, until the blue circles hold exactly the number the header asks for of each piece it lists.',
  simpleExplanation: 'Clicking the board pulls everything near that point toward it, like a vacuum. Two or more blocks of the same size that come together fuse into one block of the next size up. The strip at the top-left shows that size chain in order; the pieces shown at the top-center are exactly what you have to deliver into the blue circles. Get that set, exactly -- no more and no fewer -- before your clicks run out.',
  mechanicsExplanation: 'Every click (ACTION6) is a vacuum pull: everything within about 8 cells of the point you clicked gets dragged toward it, and the click costs one step from the level budget. Blocks come in nine tiers, each a plain solid square, distinguished only by size and color -- nothing is numbered or labelled. In order the chain runs 1x1 light blue, 2x2 pink, 3x3 purple, 4x4 yellow, 5x5 orange, 7x7 red, 8x8 blue, 9x9 light pink, 10x10 green. Any touching cluster of same-tier blocks caught by that one click collapses into a single block one tier up, placed at the cluster\'s center -- so three blocks of a size give you one of the next size, not one plus a spare, and merging the top green tier destroys the whole group outright. Only pieces the current click actually caught can merge; blocks left touching from an earlier click sit there until a later click catches them together. Shoving two *different* tiers into each other is a foul: the move is undone for you and the level is charged an escalating penalty of 2, then 4, then 6 steps and so on, reset at the start of each level. The top ten rows are a header you cannot click into -- a click up there is simply ignored and costs no step -- and they hold two legends. Top-left is the size chain, shown as the first six tiers in merge order. Top-center is the shopping list: one life-size copy of each piece the level wants, repeated when it wants two of something. The targets are blue circles, between one and four of them per level, and the counts pool across all of them -- two required blocks may sit in two different circles. A block counts as delivered once its center is inside a circle. The win condition is an exact count, not a minimum, and only the pieces the level actually lists are counted -- a block of some other size sitting in a circle is ignored. From level 4 on, small 4x5 creatures that read as alien landers drift around the field; they come in light pink, green and dark red and merge among themselves along their own three-step chain, which levels 8 and 9 display as a second legend row under the size chain. Levels 6, 8 and 9 require you to deliver a creature as well as blocks, so you have to breed the right one. A block that touches a creature recoils away and drops one tier, except the smallest 1x1, which is destroyed on contact. Each tier is worth double the one below it, and if you destroy so much that the blocks left on the board can no longer add up to what the level wants, the circles and the legend turn gray to tell you the level is already lost -- Undo restores them. Undo (ACTION7) is free, costs no steps, and simply restores the position before your last click. Level budgets are 32 or 48 clicks depending on the level, not a shrinking budget; you lose if the budget hits zero or if every block is gone.',
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'medium',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION6', description: 'Vacuum-pull nearby pieces toward a point (costs 1 step)', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo the last click (free)', commonName: 'Undo' },
  ],
  hints: [
    {
      id: 'su15-hint-1',
      title: 'Read the Two Legends First',
      content: 'The header strip across the top is not decoration, and you cannot click into it. The row at the top-left is the size chain in merge order: light blue, pink, purple, yellow, orange, red. That is what fuses into what. The pieces sitting at the top-center are your shopping list -- one life-size copy of each thing the level wants delivered, shown twice if it wants two. Match the shopping list into the blue circles and the level ends. Nothing on screen is numbered; size and color are the only labels there are.',
      spoilerLevel: 1,
      dateAdded: '2026-09-16',
    },
    {
      id: 'su15-hint-2',
      title: 'Exact Counts, and the Circles Share a Total',
      content: 'The win check is an exact match, not a minimum -- an extra block of a required size inside a circle keeps the level open just as surely as a missing one. When a level has several blue circles, they are not separate goals: the counts are pooled across all of them, so if a level wants two yellow blocks they can sit in two different circles. A block counts once its center is inside the circle, so nudging one that is only overlapping the edge is usually worth the click.',
      spoilerLevel: 1,
      dateAdded: '2026-09-16',
    },
    {
      id: 'su15-hint-3',
      title: 'Different Sizes Colliding Is the Expensive Mistake',
      content: 'Undo is free and always available, so use it. The thing that actually drains your budget is driving two different-size blocks into each other: the game rewinds the move for you and bills you 2 steps, then 4 the next time, then 6, climbing all level. A vacuum click grabs everything within about 8 cells, so the cost is usually a bystander you did not mean to catch. Clicking from further out, so you pull only what you want, is cheaper than clicking in the middle of a crowd.',
      spoilerLevel: 2,
      dateAdded: '2026-09-16',
    },
    {
      id: 'su15-hint-4',
      title: 'A Cluster Merges Into One Block, So Mass Is Easy to Lose',
      content: 'Same-size blocks caught by one click do not pair off -- the whole touching cluster becomes a single block one size up. Three small blocks get you one medium and nothing else, so sweeping everything into one pile wastes material. Each size is worth double the one below it, and if you burn so much that what is left cannot add up to the shopping list, the circles and the legend go gray: that level is already lost and you are just spending clicks. Undo puts the color back. Merging two of the largest green blocks deletes both.',
      spoilerLevel: 2,
      dateAdded: '2026-09-16',
    },
    {
      id: 'su15-hint-5',
      title: 'The Little Landers (Levels 4-9)',
      content: 'The small 4x5 shapes that look like alien landers are creatures, and the first three levels have none. Touching one makes a block bounce away and shrink a size; a smallest 1x1 block touching one is simply gone. But they are not only hazards -- levels 6, 8 and 9 require you to deliver one into a circle, and they merge with each other along their own chain, light pink into green into dark red, which is the second legend row that appears on levels 8 and 9. Level 8 wants a green one, so two light pink ones have to be introduced. Level 9 wants a dark red one, which takes all four on the board. And the chain ends there: pushing two dark red ones together destroys both, which on level 9 loses you the run.',
      spoilerLevel: 3,
      dateAdded: '2026-09-16',
    },
  ],
  resources: [
    {
      title: 'SU15 Human Win, 9/9 (site owner)',
      url: 'https://arcprize.org/replay/23823a58-a8bb-42d5-b61b-1bb8c81a5b78',
      type: 'replay',
      description: 'The site owner\'s own playthrough on 16-Sep-2026, tagged human on his arcprize scorecard: a WIN clearing all 9 levels in 293 actions with 8 resets, score 90.62. Played on build su15-1944f8ab, the same build the level renders and the mechanics above were read from.',
    },
    {
      title: 'SU15 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/68e24873-d70f-4115-8617-711e48454c15',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'SU15 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/2e3994e1-8760-4e47-89f3-7ec096fce420',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/su15/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/su15/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/su15/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/su15/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/su15/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/su15/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/su15/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/su15/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/su15/lvl9.png' },
  ],
  tags: ['merging', 'sorting', 'exact-count', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Rewritten 2026-09-16 after the site owner cleared all 9 levels and reported that the page did not describe the game he had just played. The previous text called these "numbered blocks" -- they are not numbered, and nothing in this game renders a digit; the nine tiers differ only in size and color. It also never mentioned the two legends in the header strip, which are what make the game readable: the size chain at top-left and the delivery requirement at top-center. The creatures were called "diamond" critters; they are small lander-shaped glyphs. The step budget was described as shrinking; it alternates 32 and 48. Informal name changed from "Sorting Urn" to "Sucking Up" at the owner\'s direction, after the vacuum-pull click that is the game\'s only real verb. Level screenshots were rendered from the game\'s own source on 2026-09-12. An earlier 2026-09-12 pass corrected two other errors: Undo\'s cost claim was backwards, and the critter mechanic\'s scope and smallest-tier outcome were both wrong.',
};
