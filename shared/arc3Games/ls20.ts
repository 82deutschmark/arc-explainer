/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12; human replay added and
 *         the lives/step-budget mechanic corrected by Claude Opus 5, 2026-09-15
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for LS20 (Locksmith), including featured replay video details.
 *          Adversarially re-verified 2026-09-12: every level runs a hidden 42-step
 *          budget with a 3-life game-over system (BOTH of those claims are wrong; see the
 *          2026-09-15 correction below), level 6 has two doors to solve in
 *          sequence, and the final level adds fog-of-war -- none of this was in the
 *          original write-up.
 *          2026-09-15: the 2026-09-12 reading of the life system was itself wrong. The
 *          three lives are PER LEVEL, not per run, and the THIRD loss ends the run, not
 *          the fourth; RESET refills both lives and the step meter. The 42-step budget is
 *          42 meter units, which is only 42 moves on levels 1/4/6 -- levels 2/3/5/7 drain
 *          two units a move, so 21. Verified against ls20-9607627b/ls20.py and a human
 *          winning recording; see docs/2026-09-15-ls20-lives-and-step-budget.md. A human
 *          win was also added to resources[] with its raw NDJSON committed under arc3/.
 * SRP/DRY check: Pass - Single responsibility for LS20 game data.
 */

import { Arc3GameMetadata } from './types';

export const ls20: Arc3GameMetadata = {
  gameId: 'ls20',
  officialTitle: 'ls20',
  informalName: 'Locksmith',
  description: 'Transform a key into the required shape, color, and rotation to unlock an exit door, under a hidden step budget and three lives per level.',
  simpleExplanation: 'You carry a key made of colored pixels and walk it over special tiles to change its shape, color, and rotation. Reach the door with the key matching the lock, before you run out of moves. Running out costs one of the level\'s three lives; lose all three on one level and the whole run ends.',
  mechanicsExplanation: 'The key is represented as a distinct group of pixels, typically located in the bottom-left area at the start of each level. You must move your player avatar over transformation tiles to change the key\'s shape, color, and rotation to match the lock. The door does not require a specific trigger action; simply reaching it with the correct key configuration will finish the level -- though level 6 has two separate doors that both need solving in turn, not just one. Every level also runs on a hidden step meter of 42 units, drawn as a bar of pips at the bottom-left of the frame. That is not 42 moves everywhere: levels 1, 4 and 6 drain one unit a move (42 moves), while levels 2, 3, 5 and 7 drain two (21 moves). Running the meter out does not end the level -- it respawns you at the level\'s start with a full meter and costs one life. You get three lives PER LEVEL, shown as three red pips at the bottom-right, and they are restored every time a new level begins. The THIRD loss on a single level ends the entire run, not just the level. RESET also restores both the lives and the step meter, because it re-runs the same level-setup routine, which makes it the only mid-level way to buy a life back -- a human win on 2026-09-15 used exactly that on the final level, one pip from losing the run. The final level adds fog-of-war, blacking out everything beyond a short radius around you.',
  category: 'preview',
  humanDifficulty: 'easy',
  aiDifficulty: 'very-hard',
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
  ],
  hints: [
    {
      id: 'ls20-hint-1',
      title: 'Key Transformation',
      content: 'Identify the "recipe" for tiles. Some tiles might rotate the key by 90 degrees, while others change its color or append a new block to its shape.',
      spoilerLevel: 2,
    },
    {
      id: 'ls20-hint-2',
      title: 'Exit Requirement',
      content: 'The door area often shows a hint of the "target" key. Ensure your key matches that ghost image perfectly before approaching.',
      spoilerLevel: 1,
    },
    {
      id: 'ls20-hint-3',
      title: 'Hidden Move Limit',
      content: 'Every level secretly caps you at a 42-unit step meter before it respawns you and costs a life. Half the levels burn two units a move, so on levels 2, 3, 5 and 7 that is really only 21 moves. You get 3 lives on each level, not 3 for the whole run, and the third loss on one level ends the run. RESET gives you back both the lives and the full meter. The final level also blacks out everything beyond a short radius around you.',
      spoilerLevel: 2,
    }
  ],
  resources: [
    {
      title: 'LS20 Replay',
      url: 'https://three.arcprize.org/replay/ls20-fa137e247ce6/7405808f-ec5b-4949-a252-a1451b946bae',
      type: 'replay',
      description: 'A human playthrough on the older, now-replaced ls20-fa137e247ce6 build, published 2026-01-04: a win in 508 actions with one reset -- over EIGHT levels, not the current build\'s seven. From before per-level baselines existed for this game, so it has no baseline or score to compare (both are the -1 sentinel).',
    },
    {
      title: 'LS20 Human Replay (Win, 7/7 Levels, Score 100)',
      url: 'https://arcprize.org/replay/7537433d-75af-48fa-ad3d-45fd32b23c00',
      type: 'replay',
      description: 'A human playthrough on the current ls20-9607627b build: a win, all seven levels cleared, score 100. 561 actions against a 776-action baseline (0.72x) -- and under baseline on every single level, split 14/67/43/79/74/109/175 against 22/123/73/84/96/192/186. Three mid-run resets, one of which bought back two lost lives on the final level. The raw 562-row NDJSON recording is committed at arc3/ls20-9607627b.7537433d-75af-48fa-ad3d-45fd32b23c00.jsonl, and the life/step-budget mechanic it exposed is written up in docs/2026-09-15-ls20-lives-and-step-budget.md.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/ls20/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/ls20/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/ls20/lvl3.png' },
    { level: 4, imageUrl: '/ls20-lvl4.png' },
    { level: 5, imageUrl: '/ls20-lvl5.png', notes: 'Key starts in bottom left. Door is usually at the top or center.' },
    { level: 6, imageUrl: '/arc3-levels/ls20/lvl6.png' },
    { level: 7, imageUrl: '/arc3-levels/ls20/lvl7.png' },
  ],
  tags: ['preview-set', 'transformation', 'navigation'],
  thumbnailUrl: '/ls20.png',
  video: {
    src: '/videos/arc3/ls20-fa137e247ce6.mp4',
    caption: 'Locksmith walkthrough replay captured Dec 2025',
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct, adversarially-verified source read: added the hidden step budget, level 6\'s second door, and the final level\'s fog-of-war, none of which the original write-up mentioned. Corrected again 2026-09-15: that pass got the life system wrong in both directions -- the three lives are per LEVEL and refill on every level change and on RESET, and the THIRD loss on a level ends the run, not the fourth. The 42-unit meter is also only 42 moves on levels 1, 4 and 6; levels 2, 3, 5 and 7 drain two units a move. Both corrections are cited line by line against ls20-9607627b/ls20.py and confirmed frame-by-frame on a human winning recording in docs/2026-09-15-ls20-lives-and-step-budget.md. That win, added to resources[] the same day, is the first replay listed here on the current build -- the older ls20-fa137e247ce6 links, including the video, are from a build that has since been replaced, and had EIGHT levels where this one has seven. Both listed replays are human; neither is an agent run.',
};
