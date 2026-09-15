/*
 * Author: Claude Sonnet 5; human replay added by Claude Opus 5, 2026-09-15; its session
 *         score backfilled onto the page by Claude Opus 5, 2026-09-15 (see CHANGELOG 9.82.0)
 * Date: 2026-09-11 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for CD82 (Compass Dye), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: a second paint tool gates in at level 3, and the win-check
 *          skips the target's two diagonals (80 of 100 cells actually matter).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-15: a human win was added to resources[] -- the first non-agent
 *          replay on this game -- and its raw NDJSON recording committed under arc3/.
 *          Later the same day its session score of 59.92 was added, having been held
 *          off the page by 9.74.0 on a justification that measurement refuted.
 * SRP/DRY check: Pass - Single responsibility for CD82 game data.
 */

import { Arc3GameMetadata } from './types';

export const cd82: Arc3GameMetadata = {
  gameId: 'cd82',
  officialTitle: 'cd82',
  informalName: 'Compass Dye',
  description: 'Fire colored dye from 8 compass stations, plus a dab tool from level 3, to match most of a reference pattern on a grid.',
  simpleExplanation: 'You fire colored dye from eight stations around a small target square to recreate a reference pattern shown in the corner, before your move countdown runs out.',
  mechanicsExplanation: 'You control a color-throwing rig built around a small 10x10 target square, cycling between eight fixed compass stations (N/NE/E/SE/S/SW/W/NW) around it. At each station you pick a color, then fire to wash half the target (cardinal stations) or a diagonal triangle of it (intercardinal stations) in that color. From level 3 on, the four cardinal stations also gain a second tool -- an arrow-dab that paints a thin edge strip in the current color -- because Fire alone can only ever lay down a full half or triangle and can\'t build the more intricate patterns those levels need. The goal is to reproduce a small reference pattern shown in the corner before a 100-move countdown runs out; the win-check is a bit forgiving, since it never checks the target\'s two diagonal lines of cells, across six levels of increasingly multi-region, multi-color targets.',
  category: 'evaluation',
  humanDifficulty: 'easy',
  aiDifficulty: 'medium',
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
    {
      title: 'CD82 Human Replay (Win, 6/6 Levels, Score 59.92)',
      url: 'https://arcprize.org/replay/496ee425-9705-409f-8410-463a2229627e',
      type: 'replay',
      description: 'A human playthrough, not an agent run -- the other two replays listed here are GPT-6 Astra. Published 2026-09-15: a win, all six levels cleared, score 59.92, 216 actions total and no mid-run resets, split 25/7/20/17/75/72 across levels 1-6. The score is the lowest of the six human runs on this site, and it is earned on exactly two levels: the run is comfortably under the per-level action baseline on levels 1-4 (25/55, 7/8, 20/41, 17/21) and then runs 75 against 23 on level 5 and 72 against 23 on level 6 -- 3.26x and 3.13x. The API\'s level_scores agree without being consulted: 115 on each of the first four levels and 9.40 and 10.20 on the last two. Overall that is 216 actions against a 171-action baseline, 1.26x, so this is the one run here that does NOT beat the baseline. A low score on this scale means levels run far over their own baseline; it is not a different unit from the 100s on the Human Records card beside it. The raw 217-row NDJSON recording is committed at arc3/cd82-fb555c5d.496ee425-9705-409f-8410-463a2229627e.jsonl.',
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
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the three replay links in resources[] -- two ARC Prize published with the GPT-6 Astra results, plus a human win published 2026-09-15 (6/6 levels, 216 actions, no mid-run resets), whose raw recording is committed under arc3/. Corrected 2026-09-12 after an adversarially-verified direct source read: the write-up omitted the level-3+ dab tool and overstated how strict the win-check is.',
};
