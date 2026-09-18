/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for DC22 (Deck Control), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). A second, independent adversarial
 *          re-verification pass on 2026-09-12 found the "never kills you" claim is
 *          false: draining the budget to zero on a wrong press ends the game.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 *
 * 2026-09-16 (Claude Opus 5, mechanics breakdown pass): added mechanicsBreakdown, read from
 *          dc22.py (build fdcac232) and run in the engine level by level. Rewrote description,
 *          simpleExplanation and mechanicsExplanation: you walk the green square yourself (the
 *          old text read as if a walker crossed on its own); a bad press is one that leaves you
 *          with no floor, costs exactly 20 steps and undoes only that press; the claw rides a
 *          track on the board (levels 5-6), not the panel; the pads only teleport when you press
 *          pink while standing on one; the token-revealed button starts on level 2, not level 5.
 *          Also confirmed the level 6 live-play note in `notes` (see the dated line there).
 *          2026-09-18 (Claude Opus 5): human mid-play captures tagged `kind: 'human'` so the page
 *          and the private game dataset (/api/arc3/dataset) can tell them from engine renders.
 *          Level 6's engine render restored beside Boss's capture (now lvl6-human.png).
 * SRP/DRY check: Pass - Single responsibility for DC22 game data.
 */

import { Arc3GameMetadata } from './types';

export const dc22: Arc3GameMetadata = {
  gameId: 'dc22',
  officialTitle: 'dc22',
  informalName: 'Deck Control',
  description: 'Walk a small green square to the yellow goal square while pressing panel buttons that swing, flip, extend and slide pieces of floor into place. From level 5 you also drive a claw that carries a piece of floor for you. A press that pulls the floor out from under you costs 20 steps, and if that empties your budget the game is over.',
  simpleExplanation: 'You move the green square with the arrow keys, but only onto floor, and most of the path is missing. Buttons on the black panel to the right change the pieces of floor that match them: swinging bars, tiles that go solid or checkered, gaps that close, slabs that slide. Build the path, walk it to the yellow square, and do not press a button that removes the floor you are standing on: that costs 20 steps and is undone.',
  mechanicsExplanation: 'You control the green 2x2 square directly: each arrow press moves it 2 cells, but only onto floor (gray tiles, solid colored pieces, pads, tokens), and every press costs 1 step even when you cannot move. Reach the yellow 2x2 square and the next level loads at once. The black panel on the right holds the buttons, and clicking one costs 2 steps; clicking on nothing costs 1. On levels 1-3 each colored button changes every piece of its color: red and pink bars swing a quarter turn around their center block, and blue and purple tiles flip between solid (floor) and checkered (not floor). Level 1 outlines both buttons in white until your first press. Level 2 hides the red button until you walk over a small red token; level 3 does the same for purple. Level 3 adds pink pads: stand exactly on one and press pink, and you jump to the other pad. Level 4 adds a gray square button that closes a black gap 2 cells from each end per press (orange when closed, then it opens again) and a yellow L-shaped button that slides a light gray slab 2 cells along its track. Level 5 adds a red claw on a white track, driven by five panel buttons: it moves 4 cells a press up the left side or along the top or bottom row, a move off the track costs 1 step and just nudges it, and the red bar grabs the orange pillar at the end of the top row, which you can then carry and stand on. There is no release, and a grab with nothing under the claw is free. Level 6 swaps in a square claw that can only move onto the white track tiles and grabs the orange rotating bridge; its direction buttons only show while you stand on the matching tile of a small cross of tiles, its grab button appears after a red token, and a multicolor token reveals a button that recolors one pad pink, red, yellow, blue in turn, so it links to a different pad. After any click, if the green square has no floor under it, the square fades, the screen closes to black around it, the click is undone, and you are charged 20 steps; if that takes the budget to zero, you lose. Budgets are 128, 192, 192, 192, 512 and 1024 steps, shown as the bottom row turning dark gray from the left. There is no undo button; RESET restarts the level.',
  mechanicsBreakdown: [
    {
      category: 'controls',
      text: 'Arrow keys move the small green square 2 cells. You can only move onto floor: gray tiles, solid colored pieces, pads, tokens. A move into a wall or off the floor does nothing. Every arrow press costs 1 step, even one that goes nowhere.',
      source: 'dc22.py:9874, 10649-10660, 10864-10870, 10885-10888, 10362-10421',
    },
    {
      category: 'controls',
      text: 'Click a button on the black panel on the right to use it. A button press costs 2 steps. Clicking on nothing (or on a hidden button) costs 1 step and does nothing.',
      source: 'dc22.py:10663-10708, 10851-10863',
    },
    {
      category: 'controls',
      text: 'There is no undo. RESET restarts the current level with a full budget.',
      source: 'dc22.py:9966-9971, 9980-9981; arcengine/base_game.py:305-329',
    },
    {
      category: 'goal',
      text: 'Step onto the small yellow square. The next level loads the moment the green square lands exactly on it, even if that move spends your last step.',
      source: 'dc22.py:10881-10888, 10891-10892',
    },
    {
      category: 'pieces',
      text: 'Each button changes every piece linked to it at once. On levels 1-3 that simply means every piece of the button\'s color.',
      source: 'dc22.py:10677-10708, 10423-10432',
    },
    {
      category: 'pieces',
      text: 'Red button (level 1): the red bar with a dark red end block swings a quarter turn around that end block, between pointing left and pointing up.',
      source: 'dc22.py:9626-9645, 10695-10708',
    },
    {
      category: 'pieces',
      text: 'Blue button: blue tiles flip between solid blue, which is floor, and a blue checkered pattern, which you cannot stand on and which can block you.',
      source: 'dc22.py:9626-9645, 10042-10053, 10695-10708, 10406-10421',
    },
    {
      category: 'hazards',
      text: 'If a click leaves the green square with no floor under it, the square fades out, the screen closes to black in a shrinking circle around it, and then the click is undone and 20 steps are taken from your budget. If that empties the budget, you lose. This goes for any click, claw moves included.',
      source: 'dc22.py:9912-9914, 9933-9953, 10569-10594, 10833-10838',
    },
    {
      category: 'budget',
      text: 'The bottom row of the screen is the step bar: it starts white and turns dark gray from the left as you spend. Budgets are 128, 192, 192, 192, 512 and 1024 steps for levels 1 to 6. Running out on a move or a press loses the game.',
      source: 'dc22.py:9907-9910, 9923-9932, 9644, 9669, 9699, 9731, 9774, 9852',
    },
    {
      category: 'feedback',
      text: 'Level 1 draws a white outline around both panel buttons as a hint. The outlines disappear on your first button press.',
      source: 'dc22.py:9637-9638, 10679-10681',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Long red and pink bars (20 cells) with a center block swing a quarter turn around that center, between lying flat and standing upright.',
      source: 'dc22.py:9646-9670, 10695-10708',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Hidden buttons: a panel button can be missing at the start. Walk over the small token of its color on the board and the button appears. Level 2 hides red, level 3 and level 5 hide purple.',
      source: 'dc22.py:9646-9670, 10871-10879, 10300-10331',
    },
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Purple pieces flip between solid purple (floor) and purple checkered (not floor), the same as the blue tiles.',
      source: 'dc22.py:9671-9700, 10695-10708',
    },
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'Pink pads: two small pink and light pink checkered squares. Stand exactly on one and press the pink button, and you jump to the other pad. Pressing pink while not on a pad does not move you.',
      source: 'dc22.py:9671-9700, 10686-10694, 10476-10496',
    },
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Gray square button: closes a black gap from both ends, 2 cells per end per press, in light gray. On the fourth press the gap is fully bridged and turns orange; the next presses open it again, an 8-press cycle. Two gaps on a level can be out of step with each other.',
      source: 'dc22.py:9701-9732, 10028-10037, 10423-10432',
    },
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Yellow L-shaped button: a short light gray slab slides 2 cells along its strip per press, turns orange at the far end, and on the next press jumps back to the start, a 6-press cycle.',
      source: 'dc22.py:9701-9732, 10423-10432',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'A red claw sits on a white track on the board, driven by panel buttons: light blue squares for left and right, blue squares for up and down, a red bar to grab. It moves 4 cells per press, up and down the left side of the track and left and right along its top and bottom rows. A good move costs 1 step.',
      source: 'dc22.py:9733-9775, 10709-10769, 10789-10832',
    },
    {
      introducedOnLevel: 5,
      category: 'feedback',
      text: 'A claw move off the track costs 1 step, and the claw nudges that way and snaps back. Grabbing with nothing under the claw is free, and the claw just flickers open and shut.',
      source: 'dc22.py:10595-10645, 10784-10788, 10839-10850',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Grab with the claw over the orange pillar and the claw closes on it. The pillar then moves with the claw, and it is floor you can stand on. There is no release: pressing grab again costs a step and does nothing.',
      source: 'dc22.py:9733-9775, 10770-10783, 10829-10832',
    },
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'The claw becomes a red square outline that can only move onto the white track tiles, 4 cells per press. Its grab picks up the orange bridge (an orange bar with a red-outlined center) and carries it, and the pink button still swings that bridge while it is carried.',
      source: 'dc22.py:9776-9853, 10129-10144, 10715-10776, 10792-10827',
    },
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'The claw\'s direction buttons only show while you stand on the matching tile of a small cross of tiles: each tile has a colored dot (orange left, purple up, green right, light blue down). Step off and the button disappears. On this level those buttons are panel buttons, so a good claw move costs 2 steps.',
      source: 'dc22.py:9776-9853, 10247-10287, 10851-10863',
    },
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'The claw\'s grab button appears after you walk over the red token, and a multicolor token reveals a four-color square button. That button recolors one pad pink, red, yellow, blue in turn. A pad sends you to the other pad of the same color, so recoloring it picks where it leads.',
      source: 'dc22.py:9776-9853, 9983-9988, 10448-10474, 10683-10694',
    },
    {
      introducedOnLevel: 6,
      category: 'goal',
      text: 'The yellow goal is not on the open board: it sits in a notch cut into the top of the panel, reached along gray tiles.',
      source: 'dc22.py:9776-9853',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'easy',
  aiDifficulty: 'hard',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Press a panel button', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'DC22 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/a3b944b0-1863-4e98-bfb3-6802d327311b',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'DC22 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/eb980b49-c92d-4fdd-b5a0-ff2aa8254cb9',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: "DC22 Boss's Official Human Replay",
      url: 'https://arcprize.org/replay/d13d39eb-6a87-4168-8406-12cd77eb637f',
      type: 'replay',
      description: "Boss's own official ARC Prize replay, human play, from the level 6 live-play session (2026-09-15).",
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/dc22/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/dc22/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/dc22/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/dc22/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/dc22/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/dc22/lvl6.png' },
    {
      level: 6,
      imageUrl: '/arc3-levels/dc22/lvl6-human.png',
      kind: 'human',
      caption: "Mid-play capture from Boss's own level 6 attempt (2026-09-15).",
      notes: 'Cropped from a full console screenshot Boss sent while mid-run; shows the board after at least one panel press, not the level\'s starting state.',
    },
  ],
  tags: ['platform-building', 'budget', 'panel', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12: the original "adversarially verified" pass still missed that a wrong press can end the game outright, caught by a second, independent re-verification. Level 6 screenshot replaced 2026-09-15 with a mid-play capture from Boss\'s own attempt; the original auto-rendered opening frame is gone (git history has it if it\'s ever needed back). Restored 2026-09-18: the engine render is lvl6.png again and Boss\'s capture sits beside it as lvl6-human.png. LIVE PLAY, LEVEL 6 (2026-09-15): Boss sent two console screenshots seconds apart, same level, and comparing them shows the reshape mechanic actually firing: the right-side panel (the fixed column of pressable shapes -- a red bar, a magenta ledge, a grey cross with four colored dots, a yellow L-bracket, a small 2x2 four-color square, and a larger multicolor cluster) is pixel-identical in both, confirming it is a static button deck, not board state. The left play-field is not: an orange bar with a red-centered tile -- read here as the claw-and-track piece already described in mechanicsExplanation -- sits isolated mid-board in the first frame, and in the second frame the same piece has relocated to bridge the two top grey platforms, with the white walkable path reshaped to originate from that new junction. This is inferred from pixels only (no source read to confirm it is literally the claw/track and not some other reshaped element), but it is the first time this file has an actual before/after pair showing a single panel press change the board, rather than a static single-level screenshot -- worth confirming against source or against Boss directly before stating as fact in mechanicsExplanation. CONFIRMED IN SOURCE 2026-09-16 (Claude Opus 5): the orange bar with the red-outlined center is the level 6 orange bridge, not the claw. The pink button swings it a quarter turn, and the square claw can grab it and carry it along the white track tiles, which is what moves it to a new spot (checked in the engine). The panel is also not a fully static deck on level 6: the claw direction buttons only show while you stand on the matching tile of the small cross of tiles, and the grab and four-color buttons appear only after you walk over their tokens.',
};
