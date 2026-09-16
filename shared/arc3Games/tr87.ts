/*
 * Author: Claude Sonnet 5; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-09-11 (corrected against source 2026-09-12; breakdown added 2026-09-16)
 * PURPOSE: Game metadata for TR87 (Tongue Runes), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). A second, independent adversarial
 *          re-verification pass on 2026-09-12 found the original pass still missed
 *          that levels 5-6 invert the puzzle (the answer is pre-solved and you repair
 *          the dictionary instead), misattributed which element "freezes," and left
 *          out a move budget that can lose the level.
 *          See docs/2026-09-02-arc3-official-game-studies.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, traced in
 *          external/ARCEngine/environment_files/tr87/cd924810/tr87.py; all six levels were
 *          solved in the engine from the rules described here, and the cursor, letter
 *          cycling, budget loss and win animation were checked there too. Corrected the
 *          prose: in levels 5-6 Up/Down do not rotate dictionary glyphs, they step the
 *          selected dictionary side through its alphabet; added the one-to-many (level 2),
 *          many-to-one (level 3), two-step (level 4) and branching (level 6) translation
 *          rules; the action mappings now say what each arrow does.
 * SRP/DRY check: Pass - Single responsibility for TR87 game data.
 */

import { Arc3GameMetadata } from './types';

export const tr87: Arc3GameMetadata = {
  gameId: 'tr87',
  officialTitle: 'tr87',
  informalName: 'Tongue Runes',
  description: 'Translate a phrase into a second alphabet using a wall of paired runes as your only dictionary -- in the last two levels, the answer is already right and you repair the dictionary instead.',
  simpleExplanation: 'You translate a phrase into a second alphabet by matching each symbol to its paired rune on the wall. In the last two levels the answer is already right, and you fix the wall of rune-pairs instead of translating.',
  mechanicsExplanation: 'The top half of the screen is a dictionary: entries of glyphs on colored tiles, each linked by a short line to its translation, with the tile color marking the alphabet. The bottom half holds the phrase (never editable) and your answer row. In levels 1-4 you move a white bracket along the answer row with Left/Right and step the glyph under it through its alphabet with Up/Down, until the answer is the phrase translated entry by entry. The tilt of a glyph is random and means nothing; only which letter it is counts. Level 2 adds entries that turn one glyph into several, level 3 adds entries that turn a group of glyphs into one, and level 4 hides the direct translation: you look the phrase up into a middle alphabet that only appears on the wall, then look that up again. In levels 5-6 the answer row is fixed and correct and the dictionary is scrambled instead: Left/Right step through the sides of the dictionary entries, and Up/Down change every glyph on the selected side by one letter together, until the wall translates the phrase into the answer. Level 6 also branches: each phrase glyph becomes two middle glyphs, each looked up on its own. A move budget (128 actions in levels 1-5, 256 in level 6) ticks down on every action, including a bare cursor move; run out and you lose.',
  mechanicsBreakdown: [
    // ---- Level 1 ----
    {
      category: 'pieces',
      text: 'The top half of the screen is the dictionary. Each entry is a glyph on a colored tile, a short dark gray line, and its translation on tiles of another color. The tile color tells you the alphabet: light blue, light pink and, from level 2, yellow. Each alphabet has 7 glyphs.',
      source: 'tr87.py:57-104, 105-113, 927-942, 1024-1029',
    },
    {
      category: 'pieces',
      text: 'The bottom half has two rows. The top row is the phrase, which can never be changed. The row under it is your answer, marked by a white bracket above and below the selected glyph.',
      source: 'tr87.py:920-926, 959-966, 1031-1042',
    },
    {
      category: 'controls',
      text: 'Left and Right move the bracket along the answer row. It wraps around from one end to the other.',
      source: 'tr87.py:996-1004',
    },
    {
      category: 'controls',
      text: 'Up and Down change the glyph under the bracket to the previous or next glyph of its alphabet, wrapping around after the 7th. The glyph keeps its tilt when it changes.',
      source: 'tr87.py:1005-1014, 1024-1029',
    },
    {
      category: 'pieces',
      text: 'A glyph\'s tilt means nothing. Every glyph gets a random quarter-turn when the level loads, so the same glyph can appear tilted differently in the phrase, the answer and the dictionary. Only which glyph it is counts.',
      source: 'tr87.py:912-919, 1107-1113',
    },
    {
      category: 'goal',
      text: 'Win when the answer row is the phrase translated. The phrase is read left to right; at each point the game uses the first dictionary entry (reading the wall row by row) whose left side matches, and the answer has to continue with that entry\'s right side. The check runs after every Up or Down, so the level ends on the press that finishes the translation.',
      source: 'tr87.py:1015-1019, 1044-1105',
    },
    {
      category: 'other',
      text: 'The answer row starts scrambled, and the scramble and the tilts are the same every time the level loads.',
      source: 'tr87.py:912-919, 943-956',
    },
    {
      category: 'budget',
      text: 'The strip along the bottom edge is the move budget: light gray is what\'s left, darker gray is used. Every arrow press costs one, cursor moves included. You get 128 per level on levels 1 to 5. At zero you lose, unless that last press completed the translation.',
      source: 'tr87.py:888-898, 967-968, 1003, 1014-1021',
    },
    {
      category: 'feedback',
      text: 'On a win, each translated chunk of the phrase and answer changes color in turn (red, green, purple, pink, blue, orange, then white), and the dictionary entry used for that chunk gets a white outline. Then the next level loads.',
      source: 'tr87.py:885, 975-995',
    },
    {
      category: 'other',
      text: 'RESET restarts the level with the same scramble and a full budget. There is no undo; you fix a wrong glyph by pressing the opposite arrow, which costs moves too.',
      source: 'tr87.py:910-911, 967-968; arcengine/base_game.py:305-330',
    },
    // ---- Level 2 ----
    {
      introducedOnLevel: 2,
      category: 'pieces',
      text: 'An entry can turn one glyph into two or three, so the answer row is longer than the phrase. Level 2 translates light pink into yellow.',
      source: 'tr87.py:530-600, 936-941',
    },
    // ---- Level 3 ----
    {
      introducedOnLevel: 3,
      category: 'pieces',
      text: 'An entry\'s left side can be a group of two or three glyphs, which translates as one unit. Level 3 translates yellow into light blue, and the answer row is shorter than the phrase.',
      source: 'tr87.py:601-679, 932-935',
    },
    // ---- Level 4 ----
    {
      introducedOnLevel: 4,
      category: 'goal',
      text: 'Two-step translation. The phrase is light blue and the answer is yellow, but no entry goes straight from light blue to yellow. Look each phrase glyph up to get a light pink glyph, then find the entry that starts with that light pink glyph; its yellow right side is what goes in the answer. Light pink only appears on the wall.',
      source: 'tr87.py:680-757, 1080-1101',
    },
    // ---- Level 5 ----
    {
      introducedOnLevel: 5,
      category: 'goal',
      text: 'Repair mode. The answer row is already the target and can\'t be changed. Each side of each dictionary entry starts shifted by its own amount, and you win by fixing the wall until it translates the phrase into the answer row.',
      source: 'tr87.py:758-811, 944-951',
    },
    {
      introducedOnLevel: 5,
      category: 'controls',
      text: 'In repair mode, Left and Right step the bracket through the dictionary instead: the first entry\'s left side, then its right side, then the next entry, wrapping around. The bracket stretches over the one, two or three glyphs of the selected side.',
      source: 'tr87.py:998-1000, 1033-1037',
    },
    {
      introducedOnLevel: 5,
      category: 'controls',
      text: 'In repair mode, Up and Down change every glyph on the selected side by one glyph together, so a side made of two identical glyphs stays two identical glyphs.',
      source: 'tr87.py:1007-1010',
    },
    // ---- Level 6 ----
    {
      introducedOnLevel: 6,
      category: 'budget',
      text: 'The move budget doubles to 256.',
      source: 'tr87.py:967',
    },
    {
      introducedOnLevel: 6,
      category: 'goal',
      text: 'Branching translation, still in repair mode. Each light blue phrase glyph translates into two light pink glyphs, and each of those is looked up on its own in a light pink to yellow entry, so three phrase glyphs become six yellow answer glyphs. You have to repair both kinds of entry.',
      source: 'tr87.py:812-878, 1065-1079',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'hard',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Change the selected glyph to the previous glyph of its alphabet (levels 5-6: every glyph on the selected dictionary side)', commonName: 'Up' },
    { action: 'ACTION2', description: 'Change the selected glyph to the next glyph of its alphabet (levels 5-6: every glyph on the selected dictionary side)', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move the bracket left along the answer row (levels 5-6: to the previous dictionary side)', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move the bracket right along the answer row (levels 5-6: to the next dictionary side)', commonName: 'Right' },
  ],
  hints: [],
  resources: [
    {
      title: 'TR87 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/28185f71-d397-4228-819d-523b195190da',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'TR87 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/5c144b64-fd15-4913-bdc4-28feac5046ee',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/tr87/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/tr87/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/tr87/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/tr87/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/tr87/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/tr87/lvl6.png' },
  ],
  tags: ['translation', 'lookup-table', 'alphabet', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12: the original "adversarially verified" pass still missed that levels 5-6 invert the puzzle, caught by a second, independent re-verification.',
};
