/*
 * Author: Claude Sonnet 5; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-09-11 (corrected against source 2026-09-12 and 2026-09-16)
 * PURPOSE: Game metadata for SB26 (Sequence Belt), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: level 1 has only one machine and no portal tiles at all, Undo
 *          reverts your last tile move (not your last run), and a 64-point energy
 *          budget that can lose the level was missing entirely.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, traced from
 *          sb26-7fbdac44/sb26.py and run in the engine (levels 1, 2, 5, 7 and 8 cleared,
 *          mismatch / empty-slot / ran-out / ring-loop failures, loss at 0 energy, undo).
 *          Corrected the text: tiles start in a tray under the energy line and you place
 *          them (they do not start in the slots); reading only follows the machine with
 *          the white corner marks and whatever machines its rings lead to, not "every
 *          machine"; each run, move or swap costs exactly 1 of the 64 energy; undo is free
 *          but does not refund energy.
 *          2026-09-18 (Claude Opus 5): added playerObservations -- Boss's framing of the game
 *          after his second clear (8/8, 93.47), a coded band rather than a sorting band. It
 *          confirms the traced mechanics, it does not change them.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 * SRP/DRY check: Pass - Single responsibility for SB26 game data.
 */

import { Arc3GameMetadata } from './types';

export const sb26: Arc3GameMetadata = {
  gameId: 'sb26',
  officialTitle: 'sb26',
  informalName: 'Sequence Belt',
  description: 'Place colored tiles into the slots of machine containers, then run them to be read against a required color sequence, on a limited energy budget.',
  simpleExplanation: 'You move colored tiles from a tray into containers, then run them so their colors get read out in order and checked against the row of colors at the top. Every run and every move costs energy, so don\'t waste them.',
  mechanicsExplanation: 'Colored square tiles start in a tray under a long line near the bottom. Click a tile to pick it up, then click an empty slot in a machine to put it there, or a tile in a machine to swap the two; tiles and rings that start inside a machine are fixed. Level 1 has just one machine and nothing else; from level 2 on, ring-shaped tiles act as color-coded doorways: when a run reaches a ring, reading jumps into the machine whose border is that color and comes back after that machine\'s last slot, and rings can be nested. A run starts at the leftmost slot of the machine with the white corner marks and checks each tile\'s color against the next unfilled square in the goal row across the top. Each match fills a square, and the level clears the moment the last square fills. The first mismatch, an empty slot, or reaching the end of the first machine with squares still unfilled stops the run with a red flash and empties every square again. Each run, move or swap costs 1 of the level\'s 64 energy (the line above the tray); picking tiles up is free. When energy hits 0 the game is over. Undo reverts your last tile swap or placement, not your last run, costs nothing and does not give the energy back.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'Click a loose tile in the tray (below the long line near the bottom) to pick it up; a white outline appears around it. Click the same tile again to put it back down. Picking up and putting down are free.', source: 'sb26.py:903-912, 1042-1057; engine run' },
    { category: 'controls', text: 'With a tile picked up, click an empty slot (a small gray dot) to move the tile there, or click a tile sitting in a machine to swap the two. Each move or swap costs 1 energy.', source: 'sb26.py:1051-1072; engine run on level 1' },
    { category: 'controls', text: 'With a tray tile picked up, clicking another tray tile just picks that one up instead. It does not swap them and costs nothing.', source: 'sb26.py:1058-1060; engine run' },
    { category: 'controls', text: 'A tile can go back to the tray. A tray spot a tile has left shows a gray dot and takes a tile like any empty slot.', source: 'sb26.py:731-735, 1064-1072; engine run on level 5' },
    { category: 'controls', text: 'Clicking empty background, or clicking an empty slot with nothing picked up, does nothing and costs nothing.', source: 'sb26.py:908-912, 1042-1047; engine run' },
    { category: 'controls', text: 'Run (ACTION5) costs 1 energy and reads your tiles against the goal row. Any picked-up tile is dropped first.', source: 'sb26.py:889-900, 998-1021' },
    { category: 'controls', text: 'Undo (ACTION7) takes back your last tile move or swap, and you can keep pressing it all the way back to the level\'s starting layout. It is free, but it does not give back the energy those moves spent, and it drops any picked-up tile.', source: 'sb26.py:901-902, 1074-1088; engine run' },
    { category: 'controls', text: 'RESET restores the level\'s starting layout and a full 64 energy.', source: 'sb26.py:721-724; arcengine/base_game.py:305-330; engine run' },
    { category: 'goal', text: 'The row of hollow colored squares across the top is the color sequence you need, read left to right. The level clears the moment the last square fills, even if tiles are left unread.', source: 'sb26.py:729-730, 915-933, 800-806' },
    { category: 'goal', text: 'A run starts at the leftmost slot of the machine with the white corner marks and reads right, one slot at a time. Each tile must match the color of the next unfilled square.', source: 'sb26.py:726-727, 745-747, 998-1021, 915-925; engine run' },
    { category: 'pieces', text: 'Machines are outlined boxes with a row of slots. Level 1 has one red machine with four slots and four loose tiles.', source: 'sb26.py:362-385, 998-1008' },
    { category: 'hazards', text: 'The run fails at the first tile that doesn\'t match its square, or at an empty slot.', source: 'sb26.py:915-925, 991' },
    { category: 'hazards', text: 'The run also fails if the first machine runs out of slots while squares are still unfilled.', source: 'sb26.py:958-973; engine run on level 8' },
    { category: 'budget', text: 'Each level gives 64 energy. Runs, moves and swaps cost 1 each. Picking up, putting down, undo and clicks on nothing are free.', source: 'sb26.py:721-724, 890, 1062, 1072' },
    { category: 'hazards', text: 'When energy reaches 0 after a move, a swap or a failed run, the game is over. There are no lives. A run that clears the level on your last point still counts.', source: 'sb26.py:826-837, 879-887, 926-933; engine run: 64th run on level 1 ended the game' },
    { category: 'feedback', text: 'The long line between the board and the tray is the energy bar: gray for energy left, dark gray for energy spent. It refills at the start of each level.', source: 'sb26.py:700-710, 723-724' },
    { category: 'feedback', text: 'A move or swap flashes a white outline at both spots, which quickly fades out.', source: 'sb26.py:879-888, 1063-1072, 1102-1103' },
    { category: 'feedback', text: 'During a run, a white ring marks the slot being read and another marks the goal square being checked. On a match the square flashes white, then fills with the tile\'s color.', source: 'sb26.py:807-819, 998-1021; engine run' },
    { category: 'feedback', text: 'When a tile doesn\'t match or a slot is empty, the two white rings flash red, then every filled goal square empties again.', source: 'sb26.py:820-858, 993-996; engine run on level 1' },
    { category: 'feedback', text: 'When the first machine runs out with squares left, a red bar flashes over the unfilled squares, then every filled square empties again.', source: 'sb26.py:792-799, 958-973; engine run on level 8' },
    { category: 'feedback', text: 'When the level clears, the black backing behind the goal squares fades to white before the next level loads.', source: 'sb26.py:800-806, 926-933' },
    { introducedOnLevel: 2, category: 'pieces', text: 'A second machine and a ring tile (a hollow colored square) appear. When a run reaches a ring, no goal square fills: reading jumps to the leftmost slot of the machine whose border is the ring\'s color, and a dark gray outline marks the ring. After that machine\'s last slot, reading comes back and carries on from the slot after the ring.', source: 'sb26.py:386-424, 934-957, 975-990; engine run: level 2 cleared through its green ring' },
    { introducedOnLevel: 2, category: 'pieces', text: 'A machine is only read if the first machine, or a ring, leads to it.', source: 'sb26.py:998-1021, 975-990' },
    { introducedOnLevel: 2, category: 'pieces', text: 'Tiles and rings that start inside a machine are fixed. Clicking them does nothing.', source: 'sb26.py:731-737; engine run on level 4 (clicking its fixed green tile picked nothing up)' },
    { introducedOnLevel: 2, category: 'feedback', text: 'On level 2 only, a green line joins the ring to the green machine it leads to.', source: 'sb26.py:396' },
    { introducedOnLevel: 3, category: 'pieces', text: 'Level 3\'s first machine holds two fixed rings, one green and one blue, each leading to its own small two-slot machine.', source: 'sb26.py:425-464' },
    { introducedOnLevel: 4, category: 'pieces', text: 'Rings appear loose in the tray, so you choose where the detours go.', source: 'sb26.py:465-502' },
    { introducedOnLevel: 5, category: 'pieces', text: 'Two rings of the same color can both lead into the same machine, so its tiles get read twice in one run.', source: 'sb26.py:503-545; engine run: level 5 cleared with both blue rings' },
    { introducedOnLevel: 5, category: 'hazards', text: 'Rings that would send reading round in a circle without reading a tile, such as a ring in the first slot of the machine it leads to, make the run fail.', source: 'sb26.py:975-978; engine run on level 5 and level 8' },
    { introducedOnLevel: 7, category: 'pieces', text: 'Rings can be nested: a ring inside a machine that another ring leads to sends reading one machine deeper, and each machine hands reading back to the one that sent it. Level 7 was cleared reading three machines deep.', source: 'sb26.py:934-957, 979-990; engine run on level 7' },
    { introducedOnLevel: 8, category: 'goal', text: 'The goal is two rows of six squares: the top row is read left to right, then the second row.', source: 'sb26.py:637-686, 729-730' },
    { introducedOnLevel: 8, category: 'pieces', text: 'A red ring leads back into the red first machine itself, so reading can loop through it again.', source: 'sb26.py:637-686, 979-990; engine run: level 8 cleared with the red ring in the blue machine' },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-18',
      saw: 'The row across the top is showing you an order it wants to see the colored boxes in. That is pretty much all it is, and then it is abstractions: "here is what I want, and I am going to read the band like this."',
      did: 'Played it and cleared it -- twice, most recently 8/8 at 93.47 in 174 actions with no resets.',
      happened: 'It is incredibly easy once you see that. He likens it to a coded band rather than a sorting band -- writing out old computer code on punch cards, where the card holds the instruction and the reader decides how the card gets read. The same framing he used on TR87: "the game asks you for a certain code," only with colors instead of runes.',
      inCode: 'Agrees with the stored mechanics: the hollow colored squares along the top are the required sequence read left to right (sb26.py:729-730, 915-933), and a run starts at the leftmost slot of the machine with the white corner marks and reads right (sb26.py:726-727, 745-747, 998-1021). The "abstractions" are the ring tiles -- reading jumps into the machine whose border matches the ring\'s color and returns after that machine\'s last slot, and rings nest. Confirmation of what was already traced, not a new mechanic.',
    },
    {
      player: 'Boss',
      date: '2026-09-16',
      saw: 'The colored boxes and the band.',
      happened: 'Once you see it is like an extraction code, it is pretty easy; the hardest part is working out which colors go where. He lost one run by pressing reset twice by accident, which sends you back to level 1. Reset is a double-edged sword.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'easy',
  aiDifficulty: 'medium',
  levelCount: 8,
  actionMappings: [
    { action: 'ACTION5', description: 'Run the arrangement', commonName: 'Run' },
    { action: 'ACTION6', description: 'Swap/move a tile', commonName: 'Click' },
    { action: 'ACTION7', description: 'Undo to last tile move', commonName: 'Undo' },
  ],
  hints: [],
  resources: [
    {
      title: 'SB26 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/6066c7d2-601e-4d5c-9abc-9ba3b7ff57dd',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'SB26 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/7eebd5e4-fac6-47c7-b829-4ca32cc491e2',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/sb26/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/sb26/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/sb26/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/sb26/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/sb26/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/sb26/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/sb26/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/sb26/lvl8.png' },
  ],
  tags: ['sequencing', 'belt', 'portals', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: level 1 has no portal/chain mechanic at all, Undo targets the wrong action, and a losable energy budget was missing.',
};
