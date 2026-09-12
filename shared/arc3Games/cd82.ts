/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for CD82 (Compass Dye), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: a second paint tool gates in at level 3, and the win-check
 *          skips the target's two diagonals (80 of 100 cells actually matter).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for CD82 game data.
 */

import { Arc3GameMetadata } from './types';

export const cd82: Arc3GameMetadata = {
  gameId: 'cd82',
  officialTitle: 'cd82',
  informalName: 'Compass Dye',
  description: 'Fire colored dye from 8 compass stations, plus a dab tool from level 3, to match most of a reference pattern on a grid.',
  mechanicsExplanation: 'You control a color-throwing rig built around a small 10x10 target square, cycling between eight fixed compass stations (N/NE/E/SE/S/SW/W/NW) around it. At each station you pick a color, then fire to wash half the target (cardinal stations) or a diagonal triangle of it (intercardinal stations) in that color. From level 3 on, the four cardinal stations also gain a second tool -- an arrow-dab that paints a thin edge strip in the current color -- because Fire alone can only ever lay down a full half or triangle and can\'t build the more intricate patterns those levels need. The goal is to reproduce a small reference pattern shown in the corner before a 100-move countdown runs out; the win-check is a bit forgiving, since it never checks the target\'s two diagonal lines of cells, across six levels of increasingly multi-region, multi-color targets.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move selector', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move selector', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move selector', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move selector', commonName: 'Right' },
    { action: 'ACTION5', description: 'Fire the station\'s throw', commonName: 'Fire' },
    { action: 'ACTION6', description: 'Pick a color / arrow-dab', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'CD82 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/dc5800f9-f4be-4e93-8b54-111d19fba5d2',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'CD82 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/f4cac4df-b688-49e1-8cef-02935d9ef885',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/cd82/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/cd82/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/cd82/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/cd82/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/cd82/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/cd82/lvl6.png' },
  ],
  tags: ['color-matching', 'compass', 'budget', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the write-up omitted the level-3+ dab tool and overstated how strict the win-check is.',
};
