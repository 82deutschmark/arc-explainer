/*
 * Author: Claude Sonnet 5; human replay added by Claude Opus 5, 2026-09-15; its session
 *         score backfilled onto the page by Claude Opus 5, 2026-09-15 (see CHANGELOG 9.82.0)
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for KA59 (Kinetic Assembly), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: level 5's special block has no frame to check at all, and
 *          level 3 has two special blocks, not one.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-15: a human win was added to resources[] -- the first non-agent
 *          replay on this game -- and its raw NDJSON recording committed under arc3/.
 *          Later the same day its session score of 84.57 was added, having been held off
 *          the page by 9.78.0 on a direction the owner never actually gave.
 *          2026-09-16 (Claude Opus 5, mechanics breakdown pass): added mechanicsBreakdown,
 *          read from ka59.py (build 38d34dbb) and run in the engine on levels 1, 3, 5 and 6.
 *          Corrected the text: bumping a piece is not "several turns of continued pushing" --
 *          one arrow press knocks it about 15 cells in a single move while your box stays put;
 *          purple areas stop the box you drive but not a knocked piece, which slides on until
 *          it is clear of the purple; bombs are fuses that fill one row per arrow press and
 *          blast in one direction, then re-arm; the win check is that every frame is filled.
 *          Levels 1-2 have no special block. Kept the per-level special block counts.
 * SRP/DRY check: Pass - Single responsibility for KA59 game data.
 */

import { Arc3GameMetadata } from './types';

export const ka59: Arc3GameMetadata = {
  gameId: 'ka59',
  officialTitle: 'ka59',
  informalName: 'Kinetic Assembly',
  description: 'Drive one green box at a time and knock the other pieces around until every outline frame on the board holds a piece of its size. Bumping a piece sends it flying about 15 cells; from level 5, bombs on a fuse blast pieces too.',
  simpleExplanation: 'Click a green box to pick it, then move it with the arrow keys, 3 cells at a time. Drive it into another piece and your box stays put while the other piece gets knocked about 15 cells away. Fill every dark gray outline frame with a piece that fits it exactly before your steps run out.',
  mechanicsExplanation: 'Click a green box to select it (the selected box has a white center), then each arrow press moves it 3 cells. If the move would run into another piece -- another box, a yellow special block, or a bomb -- your box does not move; instead that piece is knocked about 15 cells in that direction in one go, shoving anything further in line along with it, until a wall stops it. Purple areas stop the box you are driving, but a knocked piece slides right across them, and one that would stop on purple keeps sliding until it is clear. The level is won the moment every dark gray outline frame holds a piece of exactly its size: the small frames want green boxes, the large ones want the yellow special blocks, which you can never select and can only move by knocking them. Levels 1 and 2 have no special block, level 3 has two, levels 4, 6 and 7 have one, and level 5 has one placed off the visible board with no frame, so it plays no part. From level 5, bombs fill with orange one row per arrow press; when the last row fills, the bomb shoots an orange blast out of one side that knocks whatever it hits, then turns dark red and starts filling again. Every click and every arrow press costs one step, whether or not anything moves: budgets are 100, 127, 100, 127, 100, 150 and 200. Run out and you lose.',
  mechanicsBreakdown: [
    {
      category: 'controls',
      text: 'Click a green box to select it. The selected box has a white center; the others have a dark center. Every click costs 1 step, even on empty floor or on the box that is already selected.',
      source: 'ka59.py:41101-41112, 41136-41140, 41153-41156, 41448-41457',
    },
    {
      category: 'controls',
      text: 'Arrow keys move the selected box 3 cells. Every arrow press costs 1 step, including one where the box is blocked and does not move.',
      source: 'ka59.py:41041, 41158-41178, 41380-41447',
    },
    {
      category: 'controls',
      text: 'There is no undo. RESET restarts the level with a full budget.',
      source: 'ka59.py:41133, 41136-41151; arcengine/base_game.py:305-329',
    },
    {
      category: 'pieces',
      text: 'Driving into another piece does not move your box. Instead the piece you hit is knocked in that direction, 3 cells a frame for 5 frames (about 15 cells), all in one move. Anything in its way gets shoved along with it. If the piece at the far end of the line is against a wall, nothing in the line moves, and the knock is over.',
      source: 'ka59.py:41042, 41180-41201, 41250-41260, 41319-41334, 41380-41390',
    },
    {
      category: 'pieces',
      text: 'Gray walls stop everything. Purple areas only stop the box you are driving: a knocked piece slides straight across purple, and if it would come to rest on purple it keeps sliding until it is clear. On level 1, a box sitting 12 cells left of the purple strip and knocked right travels 18 cells instead of 15 for that reason.',
      source: 'ka59.py:41158-41178, 41180-41201, 41250-41255',
    },
    {
      category: 'goal',
      text: 'Dark gray outline frames are the targets. The level is won the moment every frame has a piece sitting exactly inside it, one cell in from the outline on all sides, so the piece has to be the frame\'s size. Pieces with no frame to fill do not matter.',
      source: 'ka59.py:41093-41098, 41262-41273, 41458-41460',
    },
    {
      category: 'feedback',
      text: 'All green boxes have a green outline. On the selected box, any side that is touching another piece turns white, and a white line flashes on the side you bumped while the knocked piece slides away.',
      source: 'ka59.py:41275-41304, 41306-41318, 41386-41390',
    },
    {
      category: 'budget',
      text: 'The bottom row is the step bar: dark gray for what is left, turning white from the right as you spend. Budgets are 100, 127, 100, 127, 100, 150 and 200 steps for levels 1 to 7. When it hits zero you lose, unless that last step completed the board.',
      source: 'ka59.py:41051-41086, 41147-41151, 41458-41462, 40946, 40962, 40975, 40989, 41005, 41020, 41036',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Boxes and frames come in more shapes: 3x3, 3 wide by 6 tall, 6 wide by 3 tall, and 6x6. Each frame only counts a box of its own shape.',
      source: 'ka59.py:40948-40963, 41093-41098',
    },
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Yellow special blocks (9x9) with their own larger frames. You cannot select them: the only way to move one is to knock it with a box (or, later, a bomb blast). Level 3 has two of them and only one green box.',
      source: 'ka59.py:40964-40976, 41262-41273',
    },
    {
      introducedOnLevel: 5,
      category: 'hazards',
      text: 'Bombs: dark red squares that fill with orange one row for every arrow press (clicks do not count). When the last row fills, the bomb shoots an orange blast out of the side the fill was heading toward, growing 3 cells a frame, and knocks anything it touches the same way, your own box included. Then the bomb goes dark red and starts filling again. Small bombs go off every 3 presses, big ones every 6.',
      source: 'ka59.py:40991-41006, 41227-41248, 41335-41379',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Bombs are pieces too: drive into one and it gets knocked like anything else, so you can move a bomb to aim its blast.',
      source: 'ka59.py:41089-41090, 41158-41178, 41180-41201',
    },
    {
      introducedOnLevel: 5,
      category: 'other',
      text: 'Level 5\'s special block (a small blue one) is placed outside the visible board and has no frame, so it plays no part. The level itself is one green box, one frame and five bombs, with the box starting inside a purple pocket that the big bomb caps.',
      source: 'ka59.py:40991-41006',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'medium',
  levelCount: 7,
  actionMappings: [
    { action: 'ACTION1', description: 'Push selected box Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Push selected box Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Push selected box Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Push selected box Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Select a box', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'KA59 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/36989e6c-72fc-4b22-a48b-1e7988df6477',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'KA59 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/a20bebda-f97c-4a72-940f-de03dae1833b',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'KA59 Human Replay (Win, 7/7 Levels, Score 84.57)',
      url: 'https://arcprize.org/replay/1333b2ee-cf42-40dc-8994-cff1a5a9c55d',
      type: 'replay',
      description: 'A human playthrough, not an agent run -- the other two replays listed here are GPT-6 Astra. Published 2026-09-15: a win, all seven levels cleared, score 84.57, 598 actions and 2 mid-run resets, split 22/102/55/43/59/174/143 across levels 1-7. Under the game\'s own action baseline overall (730), but over it on three levels -- marginally on level 3 (55 against 51), and heavily on the two that were clearly the hard ones: level 5 at 59 against 33 and level 6 at 174 against 132, where one of the run\'s two resets happened (the other was eight actions into level 1). Level 7 ran 143 against a 326 baseline. The 84.57 is those three over-baseline levels showing up in the score -- level_scores reads [115, 114.20, 85.98, 115, 31.28, 57.55, 115], with its two lowest values on exactly levels 5 and 6. It is the same scale as the 100s on the Human Records card beside it, not a different unit. The raw 599-row NDJSON recording is committed at arc3/ka59-38d34dbb.1333b2ee-cf42-40dc-8994-cff1a5a9c55d.jsonl.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/ka59/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/ka59/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/ka59/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/ka59/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/ka59/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/ka59/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/ka59/lvl7.png' },
  ],
  tags: ['sokoban', 'chain-push', 'bombs', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the three replay links in resources[] -- two ARC Prize published with the GPT-6 Astra results, plus a human win published 2026-09-15 (7/7 levels, score 84.57, 598 actions, 2 mid-run resets), whose raw recording is committed under arc3/. Corrected 2026-09-12 after an adversarially-verified direct source read: the special block\'s role varies a lot more per level (0, 1, or 2 blocks, with or without a frame) than "one special block" implied.',
};
