/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (renamed and de-badged 2026-09-11)
 * PURPOSE: Game metadata for WA30 (Warehouse Associates), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Renamed from "Warehouse Allies" after a
 *          direct source read found levels 6-7 spawn only the crate-stealing unit and zero
 *          of the actual helper unit, so "Allies" was false for two of nine levels. The
 *          "adversarially verified" claim below is dropped for the same reason: that pass
 *          already knew about the crate-stealing unit (see the 2026-09-02 doc) and still
 *          produced this name.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 * SRP/DRY check: Pass - Single responsibility for WA30 game data.
 */

import { Arc3GameMetadata } from './types';

export const wa30: Arc3GameMetadata = {
  gameId: 'wa30',
  officialTitle: 'wa30',
  informalName: 'Warehouse Associates',
  description: 'Sokoban-style crate hauling where other haulers on the far side also move crates — for you, or against you.',
  mechanicsExplanation: 'Crate-hauling with Sokoban\'s verbs (push and pull), so no move is ever unrecoverable. From the second board onward you are never the only one hauling: a unit on the far side of an uncrossable line does your job for you, one cell per key you press. Later a second unit does the identical thing toward the wrong bay and will lift a crate out of your hands, so the haulers you rely on can also work against you. Levels 6-7 spawn only the crate-stealing unit and none of the helper unit, so treat any single hauler you see as a stranger, not a friend, until you\'ve watched which bay it heads for.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION5', description: 'Push/Pull crate', commonName: 'Interact' },
  ],
  hints: [],
  resources: [
    {
      title: 'WA30 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/be78fcef-1244-4cf8-b680-0a5e4e8f9afe',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'WA30 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/49ac7afb-b83a-46f4-bb1e-3ecc902ca291',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/wa30/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/wa30/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/wa30/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/wa30/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/wa30/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/wa30/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/wa30/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/wa30/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/wa30/lvl9.png' },
  ],
  tags: ['sokoban', 'crate-pushing', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No screenshots, replay video, or hints exist yet for this game -- only the two replay links ARC Prize published with the GPT-6 Astra results. Renamed from "Warehouse Allies" to "Warehouse Associates" 2026-09-11: levels 6-7 spawn zero of the helper unit and one of the crate-stealing unit, so "Allies" was false for those levels. The prior "adversarially verified" claim is dropped -- that pass already documented the crate-stealing unit and still named the game after the helper alone.',
};
