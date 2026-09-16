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
 *
 * 2026-09-16 (Claude Opus 5, mechanics breakdown pass): added mechanicsBreakdown, every
 *          bullet checked in su15.py and most run in the engine. Adds the white ring
 *          animation (its first frame is the exact 8-cell reach), the foul blink, the win
 *          flash, the bottom-row step bar, dead header clicks eating an Undo, creatures
 *          chasing the nearest block, and the level 1 teaching aids. Corrected: the size
 *          chain is hidden on level 1 and shows only four tiers on levels 2-5 (not six);
 *          the foul penalty is not lowered by Undo; hint 5's level 9 clause (level 9 can
 *          only ever make one dark red creature); the notes' "alternates 32 and 48".
 *          2026-09-16 (Claude Opus 5, later): playerObservations added from Boss's reports (suction-radius animation, why Sorting Urn was the wrong name).
 * SRP/DRY check: Pass - Single responsibility for SU15 game data.
 */

import { Arc3GameMetadata } from './types';

export const su15: Arc3GameMetadata = {
  gameId: 'su15',
  officialTitle: 'su15',
  informalName: 'Sucking Up',
  description: 'Click to suck nearby blocks toward you, fusing same-size blocks into bigger ones, until the blue circles hold exactly the number the header asks for of each piece it lists.',
  simpleExplanation: 'Clicking the board pulls everything near that point toward it, like a vacuum; the white ring that flashes around your click shows how far the pull reaches. Two or more blocks of the same size that come together fuse into one block of the next size up. The strip at the top-left shows that size chain in order; the pieces shown at the top-center are exactly what you have to deliver into the blue circles. Get that set, exactly -- no more and no fewer -- before your clicks run out.',
  mechanicsExplanation: 'Every click (ACTION6) is a vacuum pull: every piece with any part within 8 cells of the point you clicked gets dragged onto that point, and the click costs one step from the level budget, even if it catches nothing. A thin white ring flashes around the click while the pull plays out: on its first frame it is drawn at that 8-cell reach, then it shrinks in toward the click. Blocks come in nine tiers, each a plain solid square, distinguished only by size and color -- nothing is numbered or labelled. In order the chain runs 1x1 light blue, 2x2 pink, 3x3 purple, 4x4 yellow, 5x5 orange, 7x7 red, 8x8 blue, 9x9 light pink, 10x10 green. Any overlapping cluster of same-tier blocks caught by that one click collapses into a single block one tier up, placed at the cluster\'s center -- so three blocks of a size give you one of the next size, not one plus a spare, and merging the top green tier destroys the whole group outright. Only pieces the current click actually caught can merge; blocks left overlapping from an earlier click sit there until a later click catches them together. Shoving two *different* tiers into each other is a foul: the two blocks blink white, the move is undone for you, and the level is charged an escalating penalty of 2, then 4, then 6 steps and so on instead of the usual 1. Undo does not lower that penalty; only starting or restarting the level does. The top ten rows are a header you cannot click into -- a click up there is simply ignored and costs no step -- and they hold two legends. Top-left is the size chain in merge order. Level 1 has none; levels 2-5 show the first four tiers (light blue, pink, purple, yellow); from level 6 it shows six, adding orange and red. Top-center is the shopping list: one life-size copy of each piece the level wants, repeated when it wants two of something. The targets are blue circles, between one and four of them per level, and the counts pool across all of them -- two required blocks may sit in two different circles. A block counts as delivered once its center is inside a circle. The win condition is an exact count, not a minimum, and only the pieces the level actually lists are counted -- a block of some other size sitting in a circle is ignored. From level 4 on, small 4x5 creatures that read as alien landers chase the nearest block, moving only while a click plays out (so an empty click still lets them move); they come in light pink, green and dark red and merge among themselves along their own three-step chain, which levels 8 and 9 display as a second legend row under the size chain. Levels 6, 8 and 9 require you to deliver a creature as well as blocks, so you have to breed the right one. A block that touches a creature recoils away and drops one tier, except the smallest 1x1, which is destroyed on contact. Each tier is worth double the one below it, and if you destroy so much that the blocks left on the board can no longer add up to what the level wants, the circles and the shopping list turn gray to tell you the level is already lost -- Undo restores them. Undo (ACTION7) is free, costs no steps, and simply restores the position before your last click; it does not give back the step that click cost. Level budgets are 32 or 48 clicks depending on the level, not a shrinking budget; you lose if the budget hits zero or if every block is gone.',
  mechanicsBreakdown: [
    {
      category: 'controls',
      text: 'Click anywhere on the field to vacuum. Every piece with any part within 8 cells of the click point is caught and slides onto that point over the next few frames. Each click costs 1 step, even one that catches nothing.',
      source: 'su15.py:1113-1128, 1135-1193, 1505-1579, 1888-1912',
    },
    {
      category: 'controls',
      text: 'Clicks in the top ten rows (the header) or on the very bottom row do nothing and cost no step, though they still count toward your action total.',
      source: 'su15.py:1135-1137',
    },
    {
      category: 'controls',
      text: 'Undo puts every block and creature back where it was before your last click. It is free, and you can keep pressing it back to the start of the level, but it does not refund the step that click cost.',
      source: 'su15.py:1129-1132, 2083-2137',
    },
    {
      category: 'controls',
      text: 'A dead click in the header or the bottom row still adds an entry to the undo history, so the next Undo after one of those appears to do nothing. Press it again.',
      source: 'su15.py:1117-1118, 1135-1137, 2083-2093',
    },
    {
      category: 'controls',
      text: 'RESET restarts the current level: full step bar, starting layout, and the foul penalty back to 2.',
      source: 'su15.py:960-965; arcengine/base_game.py:305-329',
    },
    {
      category: 'feedback',
      text: 'Each click draws a thin white ring around the click point. On its first frame the ring sits at the full 8-cell reach, so anything inside it is being pulled. It then shrinks in toward the click over about four frames while the pieces slide in.',
      source: 'su15.py:1194-1215, 1569-1571',
    },
    {
      category: 'pieces',
      text: 'Blocks are plain solid squares in nine sizes, smallest to largest: 1x1 light blue, 2x2 pink, 3x3 purple, 4x4 yellow, 5x5 orange, 7x7 red, 8x8 blue, 9x9 light pink, 10x10 green. Nothing is numbered; size and color are the only labels.',
      source: 'su15.py:37-262, 878-889',
    },
    {
      category: 'pieces',
      text: 'When the pull ends, all caught blocks of one size that overlap fuse into a single block one size up, placed where they met. Since everything caught slides onto the same spot, catching two, three or four same-size blocks gives you one bigger block, not pairs.',
      source: 'su15.py:1061-1064, 1224-1280, 1331-1408',
    },
    {
      category: 'pieces',
      text: 'Only blocks this click caught can fuse. Blocks left overlapping from an earlier click stay as they are until a later click catches them together.',
      source: 'su15.py:1148-1151, 1224-1280',
    },
    {
      category: 'pieces',
      text: 'Fusing the largest size (10x10 green) does not make anything bigger: every green block in that group is destroyed.',
      source: 'su15.py:1353-1364',
    },
    {
      category: 'hazards',
      text: 'Foul: if a click leaves two blocks of different sizes overlapping, both turn white and blink for about 16 frames, then the whole click is rewound. Instead of 1 step it costs 2, then 4 for the next foul, then 6, and so on. Undo does not lower the penalty; only a new level or RESET does.',
      source: 'su15.py:841-850, 1096-1108, 1246-1256, 1457-1504',
    },
    {
      category: 'goal',
      text: 'The goal is the blue circles. A piece counts once its center is inside a circle, and the counts are pooled across every circle on the level, so two required blocks can sit in two different circles.',
      source: 'su15.py:2014-2082',
    },
    {
      category: 'goal',
      text: 'The pieces drawn at the top center of the header are the shopping list: a life-size copy of each piece the level wants, drawn twice when it wants two. You win when the circles hold exactly that: one too many of a listed piece is as bad as one too few. Pieces the list does not mention are ignored, even inside a circle.',
      source: 'su15.py:613-825, 2033-2082',
    },
    {
      category: 'feedback',
      text: 'On a win, the circles and the shopping list flash white for about ten frames, then the next level loads.',
      source: 'su15.py:1044-1058, 1066-1070, 1086-1089',
    },
    {
      category: 'budget',
      text: 'The white bar along the bottom row is your step budget, and it shrinks as you spend. Levels give 32 or 48 steps (32, 32, 48, 48, 32, 32, 32, 48, 48). When it runs out you lose the level, but a click that completes the shopping list wins even if it spends your last step.',
      source: 'su15.py:826-857, 960-965, 1086-1093',
    },
    {
      category: 'hazards',
      text: 'You also lose if every block on the board is gone.',
      source: 'su15.py:1090-1091',
    },
    {
      category: 'feedback',
      text: 'Each size is worth double the size below it. If the blocks left can no longer add up to the blocks on the shopping list, the circles and the shopping list turn gray: the level cannot be won from here. Undo back to a position that can still make it, and the color comes back. Creatures on the list are not part of this check.',
      source: 'su15.py:1075-1082, 2131-2136, 2138-2171',
    },
    {
      category: 'other',
      text: 'Level 1 teaches the click: a small white plus sign near the purple block marks a spot that will catch it, a dotted dark gray line runs from the block to the circle, and a dark gray 3x3 outline inside the circle shows what goes there. The plus sign disappears when you click on it or once the block moves. Level 1 has no size chain in the header.',
      source: 'su15.py:614-631, 1083-1085, 1119-1123',
    },
    {
      introducedOnLevel: 2,
      category: 'feedback',
      text: 'The size chain appears at the top left of the header: small color chips in merge order. Levels 2 to 5 show only the first four: light blue, pink, purple, yellow.',
      source: 'su15.py:632-654 (a dark gray plate at x=16 hides the rest)',
    },
    {
      introducedOnLevel: 3,
      category: 'goal',
      text: 'First level with two circles and two different pieces on the shopping list (one yellow 4x4 and one purple 3x3), so the pooled count starts to matter.',
      source: 'su15.py:655-680',
    },
    {
      introducedOnLevel: 4,
      category: 'hazards',
      text: 'Creatures appear: small 4x5 light pink outlines shaped like landers. They chase the nearest block, one cell per frame, but only while a click is playing out, about 4 cells per click. An empty click still lets them move.',
      source: 'su15.py:681-704, 1580-1662',
    },
    {
      introducedOnLevel: 4,
      category: 'hazards',
      text: 'When a creature touches a block, the block shakes in place, then drops one size and flies about 10 cells straight away from the creature. A 1x1 light blue block is destroyed instead. The creature then sits still for a few frames.',
      source: 'su15.py:1664-1674, 1695-1832',
    },
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'A click that catches a creature pulls it toward the click point, the same as a block. That is how you steer creatures into circles or into each other.',
      source: 'su15.py:1150-1188, 1505-1531',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Two creatures of the same color that overlap fuse into the next kind: two light pink make a green, two green make a dark red, and two dark red destroy each other. Unlike blocks, creatures fuse whenever they overlap during a click, caught or not.',
      source: 'su15.py:1225, 1281-1330, 1409-1456, 1676, 1929-1935',
    },
    {
      introducedOnLevel: 6,
      category: 'feedback',
      text: 'The size chain grows to six chips, adding orange and red after yellow.',
      source: 'su15.py:730-747 (no plate over the chain from level 6)',
    },
    {
      introducedOnLevel: 6,
      category: 'goal',
      text: 'The shopping list can include a creature. Level 6 wants a light pink one in a circle along with a yellow block. Creatures count by exact number, the same as blocks.',
      source: 'su15.py:730-747, 2062-2082',
    },
    {
      introducedOnLevel: 8,
      category: 'feedback',
      text: 'A second row under the size chain shows the creature chain: light pink, green, dark red. Level 8 wants a green creature, level 9 a dark red one.',
      source: 'su15.py:771-824',
    },
    {
      introducedOnLevel: 8,
      category: 'hazards',
      text: 'Two creatures of different colors overlapping is a foul, the same as mismatched blocks: they blink white, the click is rewound, and you pay the rising penalty.',
      source: 'su15.py:1301-1311, 1457-1475',
    },
    {
      introducedOnLevel: 9,
      category: 'hazards',
      text: 'A dark red creature chases twice as fast as the others, two cells per frame. Level 9 is the only level with enough light pink creatures (four) to make one.',
      source: 'su15.py:797-824, 1628-1636',
    },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-16',
      saw: 'Every click plays a brief animation that shows roughly the radius that is about to get sucked up -- the kind of quick animation he suspects a lot of models ignore.',
      did: 'Clicked, with pieces inside and outside that radius.',
      happened: 'Everything inside the radius is pulled to the click point, and two similar objects inside it join and become the bigger object. None of this, including what the animation means, was explained anywhere on the page.',
      inCode: 'Each click draws a thin white ring at the full 8-cell catch reach, which shrinks over about four frames while the pieces slide in (su15.py:1194-1215). Every caught same-size block that ends up overlapping fuses into ONE block of the next size up, so three small blocks give one bigger block, not a bigger block plus a spare.',
    },
    {
      player: 'Boss',
      date: '2026-09-16',
      saw: 'The game was listed as "Sorting Urn".',
      happened: 'That was not what it was. The game really is sucking things up, so it was renamed "Sucking Up".',
    },
  ],
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
      content: 'The header strip across the top is not decoration, and you cannot click into it. The row at the top-left is the size chain in merge order: light blue, pink, purple, yellow, and from level 6 on also orange and red (level 1 has no chain at all). That is what fuses into what. The pieces sitting at the top-center are your shopping list -- one life-size copy of each thing the level wants delivered, shown twice if it wants two. Match the shopping list into the blue circles and the level ends. Nothing on screen is numbered; size and color are the only labels there are.',
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
      content: 'The small 4x5 shapes that look like alien landers are creatures, and the first three levels have none. Touching one makes a block bounce away and shrink a size; a smallest 1x1 block touching one is simply gone. But they are not only hazards -- levels 6, 8 and 9 require you to deliver one into a circle, and they merge with each other along their own chain, light pink into green into dark red, which is the second legend row that appears on levels 8 and 9. Level 8 wants a green one, so two light pink ones have to be introduced. Level 9 wants a dark red one, which takes all four on the board. And the chain ends there: pushing two dark red ones together destroys both.',
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
  notes: 'Rewritten 2026-09-16 after the site owner cleared all 9 levels and reported that the page did not describe the game he had just played. The previous text called these "numbered blocks" -- they are not numbered, and nothing in this game renders a digit; the nine tiers differ only in size and color. It also never mentioned the two legends in the header strip, which are what make the game readable: the size chain at top-left and the delivery requirement at top-center. The creatures were called "diamond" critters; they are small lander-shaped glyphs. The step budget was described as shrinking; it is 32 or 48 depending on the level. Informal name changed from "Sorting Urn" to "Sucking Up" at the owner\'s direction, after the vacuum-pull click that is the game\'s only real verb. Level screenshots were rendered from the game\'s own source on 2026-09-12. An earlier 2026-09-12 pass corrected two other errors: Undo\'s cost claim was backwards, and the critter mechanic\'s scope and smallest-tier outcome were both wrong.',
};
