/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11
 * PURPOSE: Game metadata for CD82 (Compass Dye), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics traced from the source's step()/win-condition code in a single-pass read (not adversarially double-checked).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for CD82 game data.
 */

import { Arc3GameMetadata } from './types';

export const cd82: Arc3GameMetadata = {
  gameId: 'cd82',
  officialTitle: 'cd82',
  informalName: 'Compass Dye',
  description: 'Fire colored dye from 8 compass stations onto a grid to match a reference pattern.',
  mechanicsExplanation: 'You control a color-throwing rig built around a small 10x10 target square, cycling between eight fixed compass stations (N/NE/E/SE/S/SW/W/NW) around it. At each station you pick a color, then fire to wash half the target (cardinal stations) or a diagonal triangle of it (intercardinal stations) in that color. The goal is to reproduce a small reference pattern shown in the corner before a 100-move countdown runs out, across six levels of increasingly multi-region, multi-color targets.',
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
  tags: ['color-matching', 'compass', 'budget', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Mechanics traced from the source\'s step()/win-condition code in a single-pass read (not adversarially double-checked).',
};
