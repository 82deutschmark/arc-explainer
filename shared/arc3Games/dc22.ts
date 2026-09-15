/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for DC22 (Deck Control), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). A second, independent adversarial
 *          re-verification pass on 2026-09-12 found the "never kills you" claim is
 *          false: draining the budget to zero on a wrong press ends the game.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for DC22 game data.
 */

import { Arc3GameMetadata } from './types';

export const dc22: Arc3GameMetadata = {
  gameId: 'dc22',
  officialTitle: 'dc22',
  informalName: 'Deck Control',
  description: 'Press panel buttons to reshape platforms into a walkable floor; later a claw rides the panel too. Draining your budget on a wrong press can end the game outright.',
  simpleExplanation: 'You press buttons on a side panel to reshape platforms into a path a walker can cross to reach the goal. A wrong press costs you, and running your budget to zero ends the level outright.',
  mechanicsExplanation: 'A walker has to reach a goal, but most of the floor doesn\'t exist yet; you press buttons on a side panel that reshape platforms across the board. A wrong press irises the screen to black, rewinds one move, and charges the budget — and if that charge drains the budget to zero, the level ends in a loss immediately instead of rewinding, so mistakes are more than just expensive. From the fifth level the panel grows a claw that rides a painted track, moving twice as far as the walker and clamping onto a pillar you then stand on; coloured pads fling you to their twin, and a missing button appears only after you fetch a token on foot.',
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
      title: "DC22 Mark's Official Human Replay",
      url: 'https://arcprize.org/replay/d13d39eb-6a87-4168-8406-12cd77eb637f',
      type: 'replay',
      description: "Mark's own official ARC Prize replay, human play, from the level 6 live-play session (2026-09-15).",
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/dc22/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/dc22/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/dc22/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/dc22/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/dc22/lvl5.png' },
    {
      level: 6,
      imageUrl: '/arc3-levels/dc22/lvl6.png',
      caption: "Mid-play capture from Mark's own level 6 attempt (2026-09-15), not the auto-rendered opening frame like levels 1-5.",
      notes: 'Cropped from a full console screenshot Mark sent while mid-run; shows the board after at least one panel press, not the level\'s starting state.',
    },
  ],
  tags: ['platform-building', 'budget', 'panel', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12: the original "adversarially verified" pass still missed that a wrong press can end the game outright, caught by a second, independent re-verification. Level 6 screenshot replaced 2026-09-15 with a mid-play capture from Mark\'s own attempt; the original auto-rendered opening frame is gone (git history has it if it\'s ever needed back). LIVE PLAY, LEVEL 6 (2026-09-15): Mark sent two console screenshots seconds apart, same level, and comparing them shows the reshape mechanic actually firing: the right-side panel (the fixed column of pressable shapes -- a red bar, a magenta ledge, a grey cross with four colored dots, a yellow L-bracket, a small 2x2 four-color square, and a larger multicolor cluster) is pixel-identical in both, confirming it is a static button deck, not board state. The left play-field is not: an orange bar with a red-centered tile -- read here as the claw-and-track piece already described in mechanicsExplanation -- sits isolated mid-board in the first frame, and in the second frame the same piece has relocated to bridge the two top grey platforms, with the white walkable path reshaped to originate from that new junction. This is inferred from pixels only (no source read to confirm it is literally the claw/track and not some other reshaped element), but it is the first time this file has an actual before/after pair showing a single panel press change the board, rather than a static single-level screenshot -- worth confirming against source or against Mark directly before stating as fact in mechanicsExplanation.',
};
