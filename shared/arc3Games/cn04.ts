/*
 * Author: Claude Sonnet 5 (re-corrected against source and a human win by Claude Opus 5, 2026-09-15)
 * Date: 2026-09-11 (corrected against source 2026-09-12; corrected again 2026-09-15)
 * PURPOSE: Game metadata for CN04 (Coded Notches), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). A second, independent adversarial
 *          re-verification pass on 2026-09-12 found the original "adversarially
 *          verified" pass still missed real errors: there is no stretch action, and
 *          the piece count is nothing like "three to five" (2 to 13 across levels).
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 *          2026-09-15: a human win surfaced a real mechanic both prior passes missed,
 *          and showed the 2026-09-12 "correction" was itself a method error. Interact
 *          on a stacked part does not rotate it -- it steps up a stack of nested
 *          growing variants, so the part visibly GROWS, and the small variants hide
 *          marks you must satisfy. "There is no stretch action" is true of the code
 *          and false of the screen: the growth is a sprite swap, so grepping the
 *          source for a resize primitive finds nothing while the game plainly shows
 *          a part getting bigger. The 2026-09-12 pass deleted a correct observation
 *          because it could not find an implementation for it. Also corrected here:
 *          "2 to 13 parts" counted sprite entries, not manipulable parts; the real
 *          range is 2 to 5. All verified against
 *          arc-3 docs/static/games/src/cn04-2fe56bfb/cn04.py -- ACTION5 branch at
 *          :1066-1075, stack grouping by shared anchor at :843-858, cycle at :1111-1135,
 *          level table at :677-775.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown traced in the
 *          external/ARCEngine copy of cn04-2fe56bfb/cn04.py (its line numbers run about 22
 *          higher than the arc-3 docs copy cited above) and run in the engine. The
 *          2026-09-15 facts all held (growth by stack, 3 -> 7 marks on level 5, bounce, 6-
 *          and 4-deep stacks on level 6). Added what was missing: the Red marks come in two
 *          look-alike kinds and only same-kind pairs count, the held part is drawn White on
 *          levels 1-2, the action limits and the top bar, and the two growing parts on level
 *          6 share one grow/shrink direction. Fixed the ACTION6 note: only a click on the
 *          growing part's single White dot grows it; clicking its body puts it down.
 * SRP/DRY check: Pass - Single responsibility for CN04 game data.
 */

import { Arc3GameMetadata } from './types';

export const cn04: Arc3GameMetadata = {
  gameId: 'cn04',
  officialTitle: 'cn04',
  informalName: 'Coded Notches',
  description: 'Slide and turn loose parts until every printed mark meets its match on another part.',
  simpleExplanation: 'You hold one part at a time, slide and rotate it, until every printed mark on it lines up with a matching mark on another part.',
  mechanicsExplanation: 'Anywhere from two to five loose parts, depending on the level, each printed with marks; you hold one part at a time and slide it with the arrow actions until every mark meets a matching mark on another part. A mark goes dark the instant it is satisfied -- but it also goes dark when it lands on the wrong kind of mark: the marks come in two kinds that look exactly alike, and only a pair of the same kind counts toward finishing the level. From level 3 on, only the part currently in your hand shows its own colour and marks -- everything else is flattened to grey -- so tracking what still needs to line up means remembering what you\'ve already seen.\n\nInteract does two completely different things, and which one you get is a property of the part, not of anything on screen that tells you in advance (the one small tell: a growing part you are holding carries a single White dot, which is gone at its largest size). Across the whole of levels 1 through 4 it is a quarter-turn, every single time. From level 5 on, some parts are built as a stack of nested variants of the same shape sharing one spot, and on those parts Interact never turns the part at all -- it steps up the stack, so the part GROWS. It always starts on the smallest variant, and the bigger variants carry marks the smaller ones simply do not have: level 5\'s yellow part shows 3 marks at its starting size and 7 at full extent, so four of the marks you have to satisfy do not exist on screen until you expand it. Form a plan from what level 5 first shows you and you are planning against an incomplete board. The stepping is a bounce, not a wrap -- reach the largest variant and the next Interact walks it back down. Level 6 does it twice, with a six-deep yellow part and a four-deep purple one.\n\nThere is no resize action in the game, and that is exactly what makes this hard to document: the growth is implemented as a swap between stacked sprites, so reading the source for a stretch primitive turns up nothing at all while the screen plainly shows a part getting bigger.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'controls',
      text: 'The arrow keys slide the part you are holding one cell. A part cannot leave the 20x20 board; pressing into the edge does nothing.',
      source: 'cn04.py:1102-1130',
    },
    {
      category: 'controls',
      text: 'Interact turns the part you are holding a quarter turn clockwise. If the turn would leave it hanging off the board, it is pushed back inside.',
      source: 'cn04.py:1089-1101, 1174-1182',
    },
    {
      category: 'controls',
      text: 'Click a part to pick it up; whatever you were holding is put down. Click the part in your hand to put it down. Clicking empty board does nothing.',
      source: 'cn04.py:1062-1088, 888-918',
    },
    {
      category: 'controls',
      text: 'Each level starts with the part nearest the top-left corner already in your hand. With nothing in your hand, arrows and Interact do nothing.',
      source: 'cn04.py:881-885, 1090, 1108',
    },
    {
      category: 'goal',
      text: 'Every Red mark on every part has to sit on top of a Red mark on another part. The level ends as soon as that is true after a slide or an Interact.',
      source: 'cn04.py:1023-1049, 1098-1100, 1126-1129, 1052-1055',
    },
    {
      category: 'pieces',
      text: 'Parts never block each other. They slide over and under one another freely, which is how marks end up on top of each other.',
      source: 'cn04.py:1119-1125',
    },
    {
      category: 'hazards',
      text: 'The Red marks come in two kinds that look exactly the same on screen. A mark only counts when it sits on a mark of the same kind. A wrong-kind pair still turns Dark Gray, so the board can look finished while the level stays open.',
      source: 'cn04.py:868, 946-994, 1023-1049',
    },
    {
      category: 'feedback',
      text: 'A mark turns Dark Gray when it sits on exactly one other mark. Three marks stacked on one spot do not count.',
      source: 'cn04.py:977-1018',
    },
    {
      category: 'feedback',
      text: 'On levels 1 and 2 the part in your hand is drawn White with its Red marks; every other part shows its own color.',
      source: 'cn04.py:888-904, 928-945',
    },
    {
      category: 'budget',
      text: 'Each level has an action limit: 75, 100, 125, 125, 150 and 200 for levels 1 to 6. Every action counts, including clicks on nothing and presses with nothing held. The action that reaches the limit loses the level.',
      source: 'cn04.py:709-795, 851, 1057-1061',
    },
    {
      category: 'feedback',
      text: 'The limit is a short bar in the middle of the top edge: Darker Gray, turning White from the left as actions are used.',
      source: 'cn04.py:803-830',
    },
    {
      category: 'other',
      text: 'There is no undo. RESET puts every part back where the level started.',
      source: 'cn04.py:846-886; arcengine/base_game.py:305-330',
    },
    // ---- Level 3 ----
    {
      introducedOnLevel: 3,
      category: 'feedback',
      text: 'From level 3 every part you are not holding is drawn solid Darker Gray, marks included, even marks already matched. Only the part in your hand shows its color and its marks.',
      source: 'cn04.py:726-739, 861, 870-871, 941-945, 1019-1021',
    },
    // ---- Level 5 ----
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Growing part: on this part Interact never turns it. Each press swaps it for the next bigger size, growing out from its top-left corner. At the largest size the next press shrinks it again, back down to the smallest, and so on.',
      source: 'cn04.py:755-773, 865-880, 1089-1097, 1133-1157',
    },
    {
      introducedOnLevel: 5,
      category: 'pieces',
      text: 'Bigger sizes carry more marks. Level 5\'s Yellow part has 5 sizes and starts on the smallest, with 3 marks; the largest has 7. The missing marks are not on the board until you grow it, and they all have to be matched.',
      source: 'cn04.py:756-762, 1023-1049',
    },
    {
      introducedOnLevel: 5,
      category: 'feedback',
      text: 'A growing part you are holding shows one White dot (the largest size has none). Clicking that White dot grows it just like Interact. Clicking anywhere else on it puts it down.',
      source: 'cn04.py:1074-1085, 1168-1172',
    },
    // ---- Level 6 ----
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'Level 6 has two growing parts: a Yellow one with 6 sizes and a Purple one with 4. Only the Yellow one gains marks as it grows (2 up to 6); the Purple one has 3 at every size.',
      source: 'cn04.py:774-797',
    },
    {
      introducedOnLevel: 6,
      category: 'pieces',
      text: 'The two growing parts share one grow-or-shrink direction. Once one of them bounces back from its largest size, Interact on the other one shrinks it too, until it reaches its own smallest size and turns around.',
      source: 'cn04.py:875, 1133-1157',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'hard',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Slide held part', commonName: 'Up' },
    { action: 'ACTION2', description: 'Slide held part', commonName: 'Down' },
    { action: 'ACTION3', description: 'Slide held part', commonName: 'Left' },
    { action: 'ACTION4', description: 'Slide held part', commonName: 'Right' },
    { action: 'ACTION5', description: 'Rotate the held part 90° -- unless it is a stacked part, in which case it grows instead and never rotates', commonName: 'Interact', notes: 'Levels 1-4 contain no stacked parts, so Interact is purely a rotation there. Level 5 introduces one 5-deep stack and level 6 has two (6-deep and 4-deep). On a stacked part Interact steps through nested growing variants and bounces at the largest.' },
    { action: 'ACTION6', description: 'Select a part; click the part you are already holding to release it', commonName: 'Click', notes: 'A growing (stacked) part you are holding shows one White dot. Clicking that White dot steps it through its sizes, same as Interact; clicking anywhere else on it releases it like any other part. The largest size has no White dot.' },
  ],
  hints: [
    {
      id: 'cn04-hint-1',
      title: 'Interact stops meaning "rotate" on level 5',
      content: 'Levels 1 through 4 teach you that Interact turns the held part 90 degrees, and that is true of every part in all four levels. Level 5 introduces a part where Interact does not rotate at all -- it makes the part bigger. Nothing on screen warns you, and there is no separate stretch action to discover. If Interact seems to be doing nothing useful, look at the part\'s size, not its orientation.',
      spoilerLevel: 1,
      contributor: 'Human playthrough (WIN, 6/6, 454 actions)',
      dateAdded: '2026-09-15',
    },
    {
      id: 'cn04-hint-2',
      title: 'Expand the yellow part on level 5 before you plan anything',
      content: 'The yellow part on level 5 starts at its smallest variant, showing 3 marks. Fully expanded it shows 7. The four extra marks do not exist on the board until you expand it, so any strategy you form from the opening view is built on a board you have not fully seen. Expand it first, then plan. The stepping bounces rather than wrapping, so if you overshoot the largest variant the next press shrinks it again.',
      spoilerLevel: 2,
      contributor: 'Human playthrough (WIN, 6/6, 454 actions)',
      dateAdded: '2026-09-15',
    },
  ],
  resources: [
    {
      title: 'CN04 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/3cd20b12-b1c0-47e2-a3a1-406b6e4f75a7',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'CN04 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/f6296e32-d4b0-4068-9bb0-3be64b8afef5',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'CN04 Human Replay -- WIN, all six levels',
      url: 'https://arcprize.org/replay/f714032e-914d-4bb5-bc95-386dfacebca0',
      type: 'replay',
      description: 'A human playthrough, unlike the two GPT-6 Astra agent runs above. WIN, 6 of 6 levels, 454 actions, 4 resets, score 100. Under the per-level action baseline on every single level (454 against a baseline of 789). This is the run that turned up the level-5 growing-part mechanic -- and the winning move was an Interact.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/cn04/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/cn04/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/cn04/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/cn04/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/cn04/lvl5.png', notes: 'The yellow part here is a 5-deep stack of nested variants sharing one spot, and it opens on the smallest one. Interact grows it instead of rotating it -- the only place in the game where that has happened so far. At its starting size it shows 3 marks; fully expanded it shows 7. The board you can see is not the board you have to solve until you expand it.' },
    { level: 6, imageUrl: '/arc3-levels/cn04/lvl6.png', notes: 'Two growing parts now, not one: a six-deep yellow stack and a four-deep purple stack. Thirteen sprite entries in the source, but only five parts you can actually pick up and move.' },
  ],
  tags: ['matching', 'manipulation', 'memory', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video exists for this game yet -- the page carries the level screenshots rendered from its own game source on 2026-09-12, two replay links ARC Prize published with the GPT-6 Astra results, and one human replay. Corrected 2026-09-12: the original "adversarially verified" pass still missed a fabricated stretch action and a wrong piece-count claim, caught by a second, independent re-verification. Corrected again 2026-09-15, and this one is worth reading twice, because the 2026-09-12 correction was itself wrong in an instructive way. A human win (f714032e) reported that on level 5 one part expands rather than rotates. It does. Interact on a part that shares its spot with other parts steps through a stack of nested growing variants and never rotates it (cn04.py:1066-1075), and the small variants carry fewer marks than the large ones, so marks you must satisfy are absent from the board until you expand the part. The 2026-09-12 pass looked for a resize primitive in the source, found none, and deleted the original pass\'s observation as fabricated -- but the original pass was describing something real. "No stretch action" is true of the implementation and false of what a player sees, and a documentation method that only trusts implementation primitives will keep making this mistake on other games. The piece-count claim was also still wrong in the correction: 2 to 13 counted sprite entries, and levels 5 and 6 stack several entries on one spot, so the manipulable-part count is 2, 4, 3, 4, 4, 5 across the six levels -- a range of 2 to 5.',
};
