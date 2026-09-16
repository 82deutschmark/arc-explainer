/*
 * Author: Claude Sonnet 5 (mechanics rewrite and breakdown: Claude Opus 5)
 * Date: 2026-09-11 (corrected against source 2026-09-12; rewritten 2026-09-16)
 * PURPOSE: Game metadata for TU93 (Trail Unwind), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the signature trail-replay hazard doesn't exist until level 7
 *          of 9, there's a third lose condition (your token worn down to nothing),
 *          and the hazard's first moves on waking aren't actually a player replay yet.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16 (Claude Opus 5): rewrote description / simpleExplanation /
 *          mechanicsExplanation and added mechanicsBreakdown, all traced in
 *          tu93-0768757b/tu93.py and run in the engine. The owner's level-2 report holds
 *          (the Red enemy kills you head-on, you kill it from the side). Two 09-12 claims
 *          were wrong: there is no "worn down" lose condition (the shrinking outline is the
 *          one-hit death burst), and the Dark Red follower copies your moves two turns
 *          late, not one.
 *          2026-09-16 (Claude Opus 5, later): playerObservations added from Boss's report of the level 2 red enemy (bites head-on, dies from the side).
 * SRP/DRY check: Pass - Single responsibility for TU93 game data.
 */

import { Arc3GameMetadata } from './types';

export const tu93: Arc3GameMetadata = {
  gameId: 'tu93',
  officialTitle: 'tu93',
  informalName: 'Trail Unwind',
  description: 'Slide a Blue token pad to pad along Gray wires to a Green exit on a step budget, past enemies that bite you from the front, patrol their wires, or wake up and walk your own trail behind you.',
  simpleExplanation: 'Move your Blue token along the wires to the Green square before the Pink step bar runs out. From level 2 there are enemies: step onto one from the side or from behind and it dies, but stop on the spot in front of its dot and it kills you.',
  mechanicsExplanation: 'Four arrow keys, no click, no undo. The board is White pads joined by Gray wires; each move slides your Blue token one pad along a wire, and pressing toward a spot with no wire still costs a step. Land on the Green square to clear the level. A Pink bar along the bottom of the screen counts your steps (20 to 60 depending on the level); run it out and you lose. Every move resolves in the same order: you move first, then the enemies move, then the game checks for the exit. Contact works the same for every enemy: step onto the pad it is standing on and it bursts; be on the pad it moves onto and you burst. One hit ends the attempt, there are no lives. Level 2 adds the Red enemy with a Purple dot. It never moves or turns on its own, but if you finish a move on the pad right in front of its dot, the dot turns Yellow and it lunges onto you. Come at it from the side or from behind and you destroy it. Level 4 adds the Orange patroller, which steps one pad along its wire every time you move and turns around where its wire ends. Level 5 has a decoy that looks exactly like your own token. Level 7 adds the Dark Red sleeper: it wakes (dot turns Yellow) when you stop exactly two pads straight in front of it, walks straight to where you stood, then copies each move you made two turns earlier, so it follows your exact path two pads behind you. Double back and you walk into it. RESET restarts the level.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'controls',
      text: 'Four moves only: up, down, left, right. There is no click and no undo.',
      source: 'tu93.py:1000',
    },
    {
      category: 'controls',
      text: 'The board is White pads joined by short Gray wires on black. A move slides your token along a Gray wire to the next White pad. You can only go where a wire leads.',
      source: 'tu93.py:1202-1249',
    },
    {
      category: 'budget',
      text: 'Pressing a direction with no wire still uses one step, but nothing on the board moves -- enemies stay put too -- so you cannot use it to wait for an enemy to pass.',
      source: 'tu93.py:1202-1249, 1270-1272',
    },
    {
      category: 'pieces',
      text: 'Your token is a Blue square with a Darker Gray dot. The dot turns to point the way you last moved.',
      source: 'tu93.py:435-446, 1202-1249',
    },
    {
      category: 'goal',
      text: 'Land on the solid Green square to clear the level. Each level has exactly one.',
      source: 'tu93.py:424-434, 1261-1264',
    },
    {
      category: 'budget',
      text: 'The step bar is a Pink line along the very bottom edge of the screen. Every arrow press uses one step, and the used part turns White. It refills on each new level: 50, 50, 35, 20, 50, 60, 30, 50 and 50 steps for levels 1 to 9.',
      source: 'tu93.py:951-985, 1007-1011, 777-902',
    },
    {
      category: 'budget',
      text: 'When the bar is empty you lose. A move that spends your last step and lands you on the exit still wins.',
      source: 'tu93.py:1263-1271',
    },
    {
      category: 'other',
      text: 'There are no lives. Getting killed or emptying the bar ends the attempt on the spot, and after that only RESET does anything.',
      source: 'tu93.py:1265-1271; arcengine/base_game.py:205-215',
    },
    {
      category: 'other',
      text: 'RESET puts the level back the way it started: full bar, every enemy back in place.',
      source: 'arcengine/base_game.py:305-330',
    },
    {
      category: 'feedback',
      text: 'Moves are animated one after the other: your token slides to the next pad first, then the enemies slide. You always finish your move before any enemy moves.',
      source: 'tu93.py:1194-1269',
    },
    // ---- Level 2 ----
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Red square with a Purple dot: an enemy. It never moves on its own and never turns. The Purple dot is its front and shows the way it faces.',
      source: 'tu93.py:447-457, 780-792',
    },
    {
      introducedOnLevel: 2,
      category: 'hazards',
      text: 'Finish a move on the pad right in front of a Red enemy\'s dot and it bites: the dot turns Yellow, it lunges onto your pad and you die. It makes no difference how you got there -- walking straight at it or crossing in front of it from the side both get you killed.',
      source: 'tu93.py:1047-1048, 1090-1108',
    },
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'Step onto a Red enemy\'s pad from its side or from behind and you bite it: it is destroyed. You can never reach it head-on, because you would have to stop on the pad in front of it first.',
      source: 'tu93.py:1053-1088',
    },
    {
      introducedOnLevel: 2,
      category: 'hazards',
      text: 'Every enemy follows the same contact rule: step onto the pad an enemy is standing on and it dies; be standing on the pad an enemy moves onto and you die. Enemies do not block your moves.',
      source: 'tu93.py:1053-1123, 1159-1169',
    },
    {
      introducedOnLevel: 2,
      category: 'hazards',
      text: 'The enemies take their move before the game checks for the exit. Landing on the Green square does not save you if an enemy reaches your pad on that same move.',
      source: 'tu93.py:1257-1266',
    },
    {
      introducedOnLevel: 2,
      category: 'feedback',
      text: 'Anything destroyed -- an enemy or your own token -- bursts into a ring of eight dots in its own color that grows once and disappears.',
      source: 'tu93.py:45-70, 1064-1078',
    },
    // ---- Level 4 ----
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Orange square with a Purple dot: a patroller. Every time you make a real move, it steps one pad along its wire the way its dot points, and turns around where its wire ends. It does not chase you, and its dot never turns Yellow.',
      source: 'tu93.py:458-468, 808-821, 1110-1113, 1125-1151',
    },
    {
      introducedOnLevel: 4,
      category: 'hazards',
      text: 'If an Orange patroller steps onto your pad you die, from any direction, including from behind. Its dot always points at the pad it will step onto next, so do not end a move there.',
      source: 'tu93.py:1115-1123',
    },
    {
      introducedOnLevel: 4,
      category: 'pieces',
      text: 'Step onto the pad an Orange patroller is standing on and it is destroyed, even if it is facing you, because you move before it does.',
      source: 'tu93.py:1080-1088, 1250-1256',
    },
    // ---- Level 5 ----
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Level 5 has a second piece that looks exactly like your token (Blue square, Darker Gray dot). It is not you -- it is an enemy that bites like a Red one. It sits in the bottom-right corner facing off the edge of the board, so nothing can ever stand in front of it and it cannot bite. Step onto it and it bursts.',
      source: 'tu93.py:34-44, 822-838',
    },
    // ---- Level 7 ----
    {
      introducedOnLevel: 7,
      category: 'pieces',
      text: 'Dark Red square with a Purple dot: a sleeper. It stays still until you finish a move exactly two pads straight in front of its dot. Then its dot turns Yellow and it is awake. Standing one pad in front of it, or beside it, does not wake it.',
      source: 'tu93.py:480-490, 859-872, 1171-1178',
    },
    {
      introducedOnLevel: 7,
      category: 'hazards',
      text: 'Once awake, the Dark Red enemy moves every time you move. Its first two steps go straight ahead, to the pad where you woke it. After that it copies the move you made two turns earlier, so it walks your exact path two pads behind you. Double back on yourself and it walks into you.',
      source: 'tu93.py:1202-1249, 1153-1157, 1171-1182',
    },
    {
      introducedOnLevel: 7,
      category: 'pieces',
      text: 'A sleeping Dark Red enemy dies if you step onto it. An awake one cannot be caught that way: it is always two of your moves behind you, never one pad away.',
      source: 'tu93.py:1080-1088, 1171-1182',
    },
    // ---- Level 9 ----
    {
      introducedOnLevel: 9,
      category: 'hazards',
      text: 'Level 9 uses all three enemy kinds, and its Green exit sits on the pad right in front of a Red enemy\'s dot. Walking straight onto the exit gets you bitten; that Red enemy has to go first.',
      source: 'tu93.py:887-904',
    },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-16',
      level: 2,
      saw: 'Level 2 introduces an enemy: a red figure with a purple dot in it.',
      did: 'Came at it straight on, then went around it and came at it from the side.',
      happened: 'Straight on, it bites you and kills you. Going around and coming at it from the side, you bite it and destroy it. The page never mentioned this enemy at all, and it is a huge mechanic.',
      inCode: 'The purple dot is the enemy\'s front. Finish a move on the pad the dot points at -- whether you walked straight at it or crossed in front of it -- and the dot turns yellow, it lunges onto your pad, and you die (tu93.py:1047-1048, 1090-1108). Step onto the pad it is standing on from the side or from behind and it is destroyed (tu93.py:1053-1088).',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'easy',
  levelCount: 9,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
  ],
  hints: [],
  resources: [
    {
      title: 'TU93 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/4cdfd8b4-111e-4f56-a0fd-7ad8be6b9bf2',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'TU93 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/7c54faff-3875-43f3-8a06-ca25720b32c8',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/tu93/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/tu93/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/tu93/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/tu93/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/tu93/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/tu93/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/tu93/lvl7.png' },
    { level: 8, imageUrl: '/arc3-levels/tu93/lvl8.png' },
    { level: 9, imageUrl: '/arc3-levels/tu93/lvl9.png' },
  ],
  tags: ['chase', 'trail-replay', 'circuit-board', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the signature hazard is level-7+-only, not a whole-game feature, and a third lose condition and the hazard\'s non-replay opening moves were both missing. Corrected again 2026-09-16 against tu93-0768757b and engine runs: that "third lose condition" does not exist (one hit kills, and the shrinking outline is the death burst), the follower is two moves behind you, not one, and the Red biter the owner met on level 2 had never been written up.',
};
