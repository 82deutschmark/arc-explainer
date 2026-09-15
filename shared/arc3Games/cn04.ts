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
 * SRP/DRY check: Pass - Single responsibility for CN04 game data.
 */

import { Arc3GameMetadata } from './types';

export const cn04: Arc3GameMetadata = {
  gameId: 'cn04',
  officialTitle: 'cn04',
  informalName: 'Coded Notches',
  description: 'Slide and turn loose parts until every printed mark meets its match on another part.',
  simpleExplanation: 'You hold one part at a time, slide and rotate it, until every printed mark on it lines up with a matching mark on another part.',
  mechanicsExplanation: 'Anywhere from two to five loose parts, depending on the level, each printed with marks; you hold one part at a time and slide it with the arrow actions until every mark meets a matching mark on another part. A mark goes dark the instant it is satisfied. From level 3 on, only the part currently in your hand shows its own colour and marks -- everything else is flattened to grey -- so tracking what still needs to line up means remembering what you\'ve already seen.\n\nInteract does two completely different things, and which one you get is a property of the part, not of anything on screen that tells you in advance. Across the whole of levels 1 through 4 it is a quarter-turn, every single time. From level 5 on, some parts are built as a stack of nested variants of the same shape sharing one spot, and on those parts Interact never turns the part at all -- it steps up the stack, so the part GROWS. It always starts on the smallest variant, and the bigger variants carry marks the smaller ones simply do not have: level 5\'s yellow part shows 3 marks at its starting size and 7 at full extent, so four of the marks you have to satisfy do not exist on screen until you expand it. Form a plan from what level 5 first shows you and you are planning against an incomplete board. The stepping is a bounce, not a wrap -- reach the largest variant and the next Interact walks it back down. Level 6 does it twice, with a six-deep yellow part and a four-deep purple one.\n\nThere is no resize action in the game, and that is exactly what makes this hard to document: the growth is implemented as a swap between stacked sprites, so reading the source for a stretch primitive turns up nothing at all while the screen plainly shows a part getting bigger.',
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
    { action: 'ACTION6', description: 'Select a part; click the part you are already holding to release it', commonName: 'Click', notes: 'Clicking the body of a stacked part you are already holding steps it through its variants, same as Interact, instead of releasing it.' },
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
