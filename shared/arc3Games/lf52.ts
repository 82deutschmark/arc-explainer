/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for LF52 (Leapfrog), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). A second, independent adversarial
 *          re-verification pass on 2026-09-12 found the original pass still missed a
 *          permanent red peg (levels 6+), a manually-driven rail cart, and an
 *          undocumented per-level move budget that can lose the game.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, every bullet checked in
 *          lf52.py (build 271a04aa) and most of them run in the engine. Fixed the text: the
 *          red peg is on levels 6 and 7 only (not "6+"), levels 8-10 add blue pegs that never
 *          come off and don't count, levels 4+ add purple blocks you hop over, there are
 *          several carts and every arrow press moves all of them, the restart button is a
 *          separate icon that only appears after certain dead-end hops (it is not part of the
 *          cart), and undo refunds the move it takes back.
 *          2026-09-18 (Claude Opus 5): Boss's play notes moved out of the prose into playerObservations,
 *          worded from what he said; the prose is left as it was.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 *          2026-09-18 (Claude Opus 5): Boss's own screenshots from Discord added as human captures.
 * SRP/DRY check: Pass - Single responsibility for LF52 game data.
 */

import { Arc3GameMetadata } from './types';

export const lf52: Arc3GameMetadata = {
  gameId: 'lf52',
  officialTitle: 'lf52',
  informalName: 'Leapfrog',
  description: 'Peg solitaire: click a peg, click its landing spot, and it hops a same-color neighbor off the board. From level 2, the arrow keys drive rail carts that carry pegs between rooms, and every action spends a limited move budget.',
  simpleExplanation: 'It\'s peg solitaire: click a peg, then click where it lands, and the peg it jumped over is removed. Get down to one peg. From level 2 the arrow keys move rail carts that carry pegs between rooms, and every click or key press uses up a limited number of moves.',
  mechanicsExplanation: 'Click a green peg, then click one of the gray rings that show where it can land: it hops straight over the next peg (or purple block) into the empty square beyond, and a jumped peg of the same color is removed. Get down to one peg to clear the level. From level 2, black tracks carry rail carts (orange squares with a yellow rim). Every arrow press moves every cart one square along its track, and a peg can hop onto an empty cart and ride it to another room. From level 4, purple blocks can be hopped over but never come off. Levels 6 and 7 each have one red peg: green and red pegs can hop over each other but neither removes the other, so those two levels are won with two pegs left, the red one and one more. Levels 8-10 add blue pegs that move and can be hopped over but never come off and never count, so you only need to get down to one green peg. Every click and arrow press costs a move, even one that does nothing: 64 on level 1, 320 on levels 2-5 and 640 on levels 6-10, and running out is the only way to lose. Undo takes back your last action and refunds its move. On levels 1, 2, 3 and 6, certain dead-end hops gray out every peg and raise a purple restart button in the bottom-left corner. Clicking it resets the level and your move count. It is its own icon, not part of the cart.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'Click a peg to pick it. A dark gray ring goes around it, and a small gray ring appears on every square it can hop to, pulsing between a ring and a dot. Clicking a different peg switches to that one.', source: 'lf52.py:4427-4441, 5334-5341, 5353-5365; engine run on level 1' },
    { category: 'controls', text: 'A hop goes straight up, down, left or right, never diagonally. It needs a peg (or, from level 4, a purple block) in the very next square and an empty floor tile just past it.', source: 'lf52.py:5649-5669' },
    { category: 'controls', text: 'Click one of the gray landing rings to make the hop.', source: 'lf52.py:5342-5344, 5374-5419' },
    { category: 'controls', text: 'Click a peg that has no legal hop and it gives a quick sideways wiggle. Nothing gets picked.', source: 'lf52.py:5364-5367, 5671-5680' },
    { category: 'controls', text: 'Clicking anything that isn\'t a peg or a landing ring (empty floor, background, a purple block, a cart) just drops the current pick. Level 1 is the exception, see the hint below. The click still costs a move.', source: 'lf52.py:5334-5351, 5369-5372; engine run on level 4 (clicking a purple block picked nothing)' },
    { category: 'controls', text: 'The arrow keys move the rail carts. Level 1 has no carts, so there an arrow press does nothing except spend a move.', source: 'lf52.py:5276-5290, 5811-5826; engine run: 64 arrow presses lose level 1' },
    { category: 'controls', text: 'Undo takes back your last action: a hop, a pick, a cart move, even a wasted click. It also refunds the move that action cost. You can undo again and again, one action at a time.', source: 'lf52.py:5853-5857, 2436-2448, 831-835; engine run: 63 arrow presses then 5 undos left the move count at 58' },
    { category: 'controls', text: 'RESET restarts the current level and sets both the move count and the top-row meter back to zero.', source: 'lf52.py:5858-5872; arcengine/base_game.py:305-330; engine run on level 2' },
    { category: 'goal', text: 'A hop removes the peg it jumps over when both pegs are the same color. Get the board down to one peg and the level is won: the pegs left do a little bounce and the next level loads.', source: 'lf52.py:5391-5410, 5572-5581, 5592-5605, 5644-5647, 5763-5766; engine run: level 1 cleared in 4 hops' },
    { category: 'pieces', text: 'Pegs are green circles. The floor is light gray tiles with white rims on a white board. A peg can only land on a floor tile, never on the light blue background.', source: 'lf52.py:4367-4371, 4452-4456, 5666-5669; level 1 render' },
    { category: 'budget', text: 'Every click and every arrow press costs one move, even one that does nothing. Level 1 gives you 64 moves, levels 2-5 give 320 and levels 6-10 give 640. Use them all up and the game is over. The win check runs first, so a winning hop on your very last move still counts.', source: 'lf52.py:5277, 5335, 5763-5782; engine runs: lost on the 64th action on level 1, the 320th on level 2 and the 640th on level 6' },
    { category: 'hazards', text: 'There are no enemies, hazards or lives. Running out of moves is the only way to lose.', source: 'lf52.py:5763-5782 (the only lose calls)' },
    { category: 'feedback', text: 'When you hop, the peg slides over and briefly swells, a sideways hop arcs up a few pixels on the way, and the peg you jumped shrinks away to nothing.', source: 'lf52.py:5399-5418, 5522-5532, 5583-5590' },
    { category: 'feedback', text: 'The top row of the screen is an action meter, not the move limit. Each action, undo included, adds one pixel from the left, and the row gets one shade darker every 64 actions (white, then light gray, gray, dark gray, darker gray). Undo doesn\'t take pixels back, so the meter can show more than you have really spent. It clears on RESET or a new level.', source: 'lf52.py:5683-5695, 5716-5731, 5811-5862, 5872; engine run sampling the meter at 10, 70 and 200 actions' },
    { category: 'feedback', text: 'Level 1 only: clicking empty space before your first hop blinks a blue circle over the peg to start with, or over its landing square once you have picked that peg. The hint click costs a move like any other.', source: 'lf52.py:5225-5273, 5348-5350, 4610-4628; engine run on level 1' },
    { category: 'feedback', text: 'On levels 1, 2, 3 and 6 the game knows some dead-end hops. Land on one of those squares and, after a short pause, every peg turns gray and shakes, then a purple pin-shaped button with a white centre rises into the bottom-left corner. On level 1, clicking empty space after that blinks the blue circle over the button. Not every losing hop is caught, and levels 4, 5 and 7-10 have no such squares.', source: 'lf52.py:5420-5432, 5471-5474, 5607-5641, 5228-5242, 4589-4609; engine runs on levels 1 and 2' },
    { category: 'controls', text: 'While that button is showing, a click anywhere in the bottom-left corner (not just on the icon) plays a black speckle fade and puts the level back to its start. Your move count goes back to zero, but the top-row meter keeps counting.', source: 'lf52.py:5832-5848, 2450-2453, 837-843; engine run: click at (15,49) restored level 2, moves 0' },
    { introducedOnLevel: 2, category: 'pieces', text: 'Black track lines appear, with a rail cart on them: an orange square with a yellow rim. Each arrow press moves the cart one square that way if there is track there. It won\'t leave the track or move into another cart. Moving a cart also drops your current pick.', source: 'lf52.py:4457-4461, 4549-4588, 4667-4702, 5276-5313; engine run on level 2' },
    { introducedOnLevel: 2, category: 'pieces', text: 'An empty cart counts as a landing square, so a peg can hop onto it, and whatever sits on a cart rides along when it moves. That is how pegs get from one group of tiles to another. A cart that already has something on it can\'t be landed on.', source: 'lf52.py:5294-5313, 5666-5669; engine run on level 2: a peg hopped onto the cart and rode it down and left' },
    { introducedOnLevel: 3, category: 'pieces', text: 'Several carts on one level. An arrow press moves every cart that has track ahead of it, all at the same time.', source: 'lf52.py:4703-4739, 5278-5313; engine runs on levels 3 and 4' },
    { introducedOnLevel: 3, category: 'feedback', text: 'From level 3 most boards are bigger than the screen, and the view slides along. It pans when a cart carries a green peg (levels 3, 5, 6, 8 and 9, and the upper carts on level 4; a red or blue passenger doesn\'t move the view), and when a peg lands on certain squares (levels 4, 5, 6, 7 and 9).', source: 'lf52.py:5294-5325, 5433-5521; engine runs: level 4 landing on the cart panned 30 pixels, level 3 carrying a green peg panned 8' },
    { introducedOnLevel: 4, category: 'pieces', text: 'Purple blocks: purple squares with a light pink and white centre. A peg can hop over one, but the block never comes off, can\'t be picked, and can\'t be landed on.', source: 'lf52.py:4505-4509, 5391-5396, 5660-5669; engine run on level 4' },
    { introducedOnLevel: 5, category: 'pieces', text: 'Some purple blocks sit on carts and travel with them, so the thing you hop over can be moved into place.', source: 'lf52.py:4785-4815 (P tiles), 5294-5313' },
    { introducedOnLevel: 6, category: 'pieces', text: 'A red peg (a red circle), one each on levels 6 and 7. Green pegs can hop over it and it can hop over green pegs, but neither removes the other, so the red peg never comes off.', source: 'lf52.py:4402-4406, 4816-4883, 5391-5396; engine run on level 6 in both directions' },
    { introducedOnLevel: 6, category: 'goal', text: 'Because the red peg can\'t be removed, levels 6 and 7 are won with two pegs left: the red one and one other. Level 7 starts with only two green pegs and the red one, so one capture clears it.', source: 'lf52.py:5572, 4849-4883' },
    { introducedOnLevel: 6, category: 'feedback', text: 'When a green peg and the red peg hop over each other, a copy of the jumping peg is drawn on top so you can see it pass over.', source: 'lf52.py:5533-5571' },
    { introducedOnLevel: 8, category: 'pieces', text: 'Blue pegs (blue circles). They can be picked, can hop, and can be hopped over like any peg, but a blue peg never comes off and never removes anything it jumps.', source: 'lf52.py:4412-4421, 5391-5396; engine runs: blue over blue on level 8, green over blue and blue over green on level 9' },
    { introducedOnLevel: 8, category: 'goal', text: 'Blue pegs don\'t count toward the goal. Levels 8-10 are won when one green peg is left, however many blue pegs are still on the board.', source: 'lf52.py:5171-5173, 5375-5377, 5572' },
    { introducedOnLevel: 10, category: 'feedback', text: 'Level 10\'s board runs off the bottom of the screen and the view never moves. A column of five carts carrying blue pegs starts mostly below the edge and comes into view as you push the carts up.', source: 'lf52.py:4959-5000; 5162-5163 (start offset); 5307-5308 (the cart-carry pan is zero on level 10); 5433-5521 (no landing pan on level 10), and those are the only view-pan calls; engine run: 4 Up presses raised the column from rows 9-13 to rows 5-9 with the view offset unchanged' },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-14',
      saw: 'Undo (ACTION7) is available.',
      happened: 'Undo is load-bearing here: one of three public games (with bp35 and sk48) where you realistically need it to finish, not a convenience.',
    },
    {
      player: 'Boss',
      date: '2026-09-12',
      level: 1,
      saw: 'Level 1.',
      happened: 'It should take no more than 10 actions. He believes it can be done in 3.',
    },
    {
      player: 'Boss',
      date: '2026-09-12',
      level: 2,
      saw: 'A car on the board.',
      happened: 'You move the car with the direction keys. The AI runs never realize that, so they never solve level 2.',
      inCode: 'Black track lines appear with a rail cart on them; each arrow press moves the cart one square along its track.',
    },
    {
      player: 'Boss',
      date: '2026-09-12',
      level: 3,
      saw: 'Level 3.',
      happened: 'Everything is side-scrolling: you have to go way off the original screen. It is like bp35, except bp35 scrolls up and down and this one scrolls sideways.',
      inCode: 'From level 3 most boards are bigger than the screen, and the view slides along.',
    },
    {
      player: 'Boss',
      date: '2026-09-12',
      saw: 'Ten levels, each needing a lot more clicks than the last.',
      happened: 'It is much more than peg solitaire. The later levels get bigger budgets because they take far more clicks. On the human leaderboard the gap between #1 and #10 is hundreds of actions, and a player without the right idea in the first couple of moves falls apart.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'very-hard',
  levelCount: 10,
  actionMappings: [
    { action: 'ACTION1', description: 'Move rail cart Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move rail cart Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move rail cart Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move rail cart Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Select/place a peg', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo', commonName: 'Undo', notes: 'One of only 3 public games (with bp35, sk48) where Undo is load-bearing, not a convenience -- see notes below.' },
  ],
  hints: [],
  resources: [
    {
      title: 'LF52 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/0beb41f9-31a2-499f-9d5a-64f187ae1edd',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'LF52 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/248b7fbd-5f82-40bd-af6d-ff811283526a',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/lf52/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/lf52/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/lf52/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/lf52/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/lf52/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/lf52/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/lf52/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/lf52/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/lf52/lvl9.png' },
    { level: 10, imageUrl: '/arc3-levels/lf52/lvl10.png' },
    { level: 2, imageUrl: '/arc3-levels/lf52/lvl2-human.png', kind: 'human', caption: 'human play, the cart on its track', notes: 'Not an engine render: the arcprize.org player console, 12-Sep-2026.' },
    { level: 3, imageUrl: '/arc3-levels/lf52/lvl3-human.png', kind: 'human', caption: 'human play, the board running off the screen', notes: 'Not an engine render: the arcprize.org player console, 12-Sep-2026.' },
  ],
  tags: ['peg-solitaire', 'linked-rooms', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12: the original "adversarially verified" pass still missed the red peg, the manual rail cart, and the per-level move budget, caught by a second, independent re-verification. ACTION7 (Undo) cross-game note (2026-09-14): Boss identifies lf52 as one of only three public games (with bp35 and sk48) where Undo is load-bearing rather than a convenience -- see bp35.ts for the full breakdown of which games expose ACTION7 at all. Reasoning for why it matters here specifically: this is peg solitaire, a combinatorial puzzle where a hop that looks fine in isolation can quietly make the remaining board unsolvable, and that usually isn\'t obvious until several hops later. Combined with a hard per-level move ceiling (64/320/640) where every hop is irreversible on the board itself, a full Reset after a bad line throws away all the correct hops made before it and re-spends move budget re-deriving them, while Undo only costs you the bad hop(s) -- the difference between backing out one step and re-solving the level from scratch inside a shrinking budget. The multi-room rail-cart structure compounds this: a hop set up in one room may only reveal whether it was a mistake once the cart carries you to a room you couldn\'t see at the time, which is the same viewport-vs-world gap documented on bp35\'s page, just expressed through room transitions instead of scrolling.',
};
