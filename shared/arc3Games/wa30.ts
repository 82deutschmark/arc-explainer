/*
 * Author: Claude Sonnet 5; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-09-11 (renamed and de-badged 2026-09-11; breakdown added 2026-09-16)
 * PURPOSE: Game metadata for WA30 (Warehouse Associates), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Renamed from "Warehouse Allies" after a
 *          direct source read found levels 6-7 spawn only the crate-stealing unit and zero
 *          of the actual helper unit, so "Allies" was false for two of nine levels. The
 *          "adversarially verified" claim below is dropped for the same reason: that pass
 *          already knew about the crate-stealing unit (see the 2026-09-02 doc) and still
 *          produced this name.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, traced in
 *          external/ARCEngine/environment_files/wa30/ee6fef47/wa30.py. Level 1 was solved in
 *          the engine (the win only lands on the release), and facing, bump-to-turn, grab,
 *          push, pull, sideways drag, crate outline colors, the move budget, the helper's
 *          routine, snatching a crate from a helper, the green-speckled line, the thief's
 *          routine and removing a thief with Action 5 were all run there. Corrected the prose:
 *          Action 5 grabs and lets go (it is not push/pull); the uncrossable line only exists
 *          on levels 3, 4 and 9, so the helper is not always "on the far side"; the
 *          unverified "no move is ever unrecoverable" is dropped; added that a thief can be
 *          removed for good by facing it and pressing Action 5.
 *          2026-09-17 (Claude Opus 5): Boss's level 3 play note and his mid-run capture.
 * SRP/DRY check: Pass - Single responsibility for WA30 game data.
 */

import { Arc3GameMetadata } from './types';

export const wa30: Arc3GameMetadata = {
  gameId: 'wa30',
  officialTitle: 'wa30',
  informalName: 'Warehouse Associates',
  description: 'Sokoban-style crate hauling where other haulers also move crates — for you, or against you.',
  simpleExplanation: 'It\'s Sokoban — you grab crates and push or pull them into their bays — but starting on the second board another hauler is also moving crates, sometimes helping you and sometimes stealing your crate for the wrong spot.',
  mechanicsExplanation: 'You grab a crate in front of you with Action 5 and then drag it with the arrows (push, pull or slide it sideways), and let go with Action 5 again. A level is won when every crate sits in a blue-outlined bay with nobody holding it. From the second board onward you are never the only one hauling: an orange helper takes one step every time you act, walks to a loose crate, and hauls it into a bay. On levels 3, 4 and 9 a green-speckled line splits the floor; nobody can step on it, but crates can be pushed onto it and pulled off from the other side. From level 6 a purple thief does the same job toward its own gray drop area, takes crates out of bays, and will lift a crate out of your hands. Levels 6-7 spawn only the thief and none of the helper, so treat any single hauler you see as a stranger, not a friend, until you\'ve watched which bay it heads for. You can get rid of a thief for good by facing it and pressing Action 5. Every action spends one move from a per-level budget; run out and you lose.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'controls',
      text: 'You are the green square; its white edge shows which way you face. Up, Down, Left and Right move you one square. When you aren\'t holding a crate, pressing a direction turns you to face it even if the move is blocked, so bumping into something is how you turn toward it.',
      source: 'wa30.py:316-328, 860-868, 987-991, 1203-1228',
    },
    {
      category: 'controls',
      text: 'Action 5 while facing a crate right next to you grabs it. While you hold it, the arrows drag it along with you and you keep facing it, so you can push it ahead, pull it behind you, or slide it sideways. The move only happens if both you and the crate have a free square to move into.',
      source: 'wa30.py:842-851, 970-985, 996-1001, 1229-1237',
    },
    {
      category: 'controls',
      text: 'Action 5 while holding a crate lets go of it. Action 5 with nothing in front of you does nothing but still costs a move.',
      source: 'wa30.py:1229-1246',
    },
    {
      category: 'pieces',
      text: 'Crates are small squares with a blue middle. The outline tells you their state: white means you are holding it, dark gray means you are facing it, black means a helper or thief is holding it, and darker gray means none of those.',
      source: 'wa30.py:251-263, 853-857, 1119-1134',
    },
    {
      category: 'pieces',
      text: 'Bays are rectangles with a blue outline. You and crates can move over them freely. Crates, other haulers and the edge of the board block you.',
      source: 'wa30.py:134-149, 899-918, 993-994',
    },
    {
      category: 'goal',
      text: 'You win when every crate sits inside a bay and nobody is holding any of them. The check runs after every move, so a crate held inside a bay doesn\'t count until it is let go.',
      source: 'wa30.py:1194-1196, 1248-1252',
    },
    {
      category: 'budget',
      text: 'The strip along the bottom edge is the move budget: light pink for moves left, darker gray for moves used. Every action costs one, Action 5 and blocked moves included. The budgets are 200, 70, 100, 100, 125, 75, 125, 150 and 70 for levels 1 to 9. The move that uses the last one loses, unless that same move wins the level.',
      source: 'wa30.py:772-806, 964-968, 1203-1254; level data "StepCounter"',
    },
    {
      category: 'other',
      text: 'RESET restarts the current level with a full budget. There is no undo.',
      source: 'wa30.py:896, 899-900; arcengine/base_game.py:305-330',
    },
    // ---- Level 2 ----
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'An orange square helper. Every time you act, it takes one step right after you. It walks the shortest way to a loose crate that isn\'t already in a bay, grabs it once it is next to it, hauls it into a bay, and lets go. Grabbing and letting go each use up one of its steps. It never takes a crate that someone is holding.',
      source: 'wa30.py:62-74, 934-947, 1009-1054, 1142-1163, 1198-1201',
    },
    {
      introducedOnLevel: 2,
      category: 'controls',
      text: 'You can take a crate straight out of a helper\'s hands: face the crate and press Action 5, and the helper lets go.',
      source: 'wa30.py:1103-1117, 1229-1237',
    },
    // ---- Level 3 ----
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'A gray line speckled with green. Nobody can step onto it, not you and not a helper, but a crate can sit on it. Push a crate onto the line and a helper on the other side can pull it off and haul it away.',
      source: 'wa30.py:264-275, 404-419, 928-930, 993-1001',
    },
    // ---- Level 4 ----
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Black wall squares. They block you, the helpers and crates.',
      source: 'wa30.py:276-287, 463-472, 909-912, 996-1001',
    },
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Several helpers and several bays on one board (three helpers on level 4). Each helper works on its own and they all move once per action.',
      source: 'wa30.py:427-486, 1142-1163',
    },
    // ---- Level 6 ----
    {
      introducedOnLevel: 6,
      category: 'hazards',
      text: 'A purple square thief. It moves once per action, after the helpers, and does the helper\'s job in reverse: it hauls crates to its own plain gray area and lets go there. It goes after any crate that isn\'t already in a gray area, including crates sitting in your bays, and it will pull a crate right out of your hands or a helper\'s.',
      source: 'wa30.py:118-133, 162-174, 215-230, 529-530, 949-962, 1056-1101, 1165-1192, 1198-1201',
    },
    {
      introducedOnLevel: 6,
      category: 'controls',
      text: 'Face a thief (its outline turns yellow) and press Action 5 to remove it from the level for good. If it was carrying a crate, the crate drops where it is.',
      source: 'wa30.py:1135-1140, 1239-1245',
    },
    // ---- Level 8 ----
    {
      introducedOnLevel: 8,
      category: 'hazards',
      text: 'Helpers and thieves on the same board (two of each on level 8). A helper will carry crates back out of a thief\'s gray area, and a thief will carry them back out of the bays.',
      source: 'wa30.py:619-677, 934-962, 1142-1192',
    },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-17',
      level: 3,
      saw: 'On level 3 the boxes have to go on the area in the middle. That was not obvious at all.',
      did: 'Put the boxes there, then walked around for a while waiting.',
      happened: 'After that the orange helper does the rest, and you just have to trust it will do it correctly. There is literally nothing for the character to do on level 3 once the boxes are down. Weird, but interesting.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'very-hard',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION1', description: 'Move up (or turn to face up if blocked); drags a held crate', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move down (or turn to face down if blocked); drags a held crate', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move left (or turn to face left if blocked); drags a held crate', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move right (or turn to face right if blocked); drags a held crate', commonName: 'Right' },
    { action: 'ACTION5', description: 'Grab the crate you are facing, let go of the one you hold, or remove the thief you are facing', commonName: 'Interact' },
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
    { level: 3, imageUrl: '/arc3-levels/wa30/lvl3-human-handoff.png', caption: 'human play, boxes handed off to the orange helper', notes: 'Not an engine render: the arcprize.org player console during Boss\'s run, 17-Sep-2026. The player is on the left of the speckled middle line; the orange helper is on the right with a box, and two boxes are already inside the blue outline.' },
    { level: 4, imageUrl: '/arc3-levels/wa30/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/wa30/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/wa30/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/wa30/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/wa30/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/wa30/lvl9.png' },
  ],
  tags: ['sokoban', 'crate-pushing', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Renamed from "Warehouse Allies" to "Warehouse Associates" 2026-09-11: levels 6-7 spawn zero of the helper unit and one of the crate-stealing unit, so "Allies" was false for those levels. The prior "adversarially verified" claim is dropped -- that pass already documented the crate-stealing unit and still named the game after the helper alone.',
};
