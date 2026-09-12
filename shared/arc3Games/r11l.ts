/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected 2026-09-12; mechanics reframed 2026-09-12 PM)
 * PURPOSE: Game metadata for R11L (Rearrange Layout), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the "shadow" marker is explicitly visible, not invisible; the
 *          hazard-zone mistake mechanic only exists in 3 of 6 levels while the wall
 *          obstacle in every level behaves totally differently; and the keyhole
 *          markers are required a level earlier than claimed, not "mostly cosmetic."
 *          Reframed 2026-09-12 after the Boss played it: the shape-matching description
 *          does not survive level 5. The body marker is the centroid of its own pieces
 *          (so pieces drag it like pseudopods) and it absorbs colour by overlapping food
 *          sprites, which only exist on levels 5-6. Verified in r11l.py directly.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 * SRP/DRY check: Pass - Single responsibility for R11L game data.
 */

import { Arc3GameMetadata } from './types';

export const r11l: Arc3GameMetadata = {
  gameId: 'r11l',
  officialTitle: 'r11l',
  informalName: 'Rearrange Layout',
  description: 'Drag a blob around by its arms to swallow colored food, then park it on the outline that wants exactly those colors.',
  mechanicsExplanation: 'Click-only. Each piece is one arm of a blob: clicking an arm selects it, clicking an empty cell moves that arm there, and the blob\'s body marker is then re-centered to the arithmetic centroid of all its arms (rvkbignsyr, r11l.py:1536-1551). You never move the body directly -- you reposition arms and the body gets dragged along behind them, like an amoeba pulling itself with pseudopods. A level clears when every blob\'s body sits on its own outline target AND the set of colors on the body exactly equals the set on that outline (ldzvchvkvp, :1601-1607). Levels 1-4 contain no food, so there the body already carries its colors and it genuinely is just shape-into-outline. Level 5 changes the game: it adds 4 food particles (level 6 adds 10; puukul- sprites), and whenever the body overlaps one, the food\'s pixels are copied onto the body and the food is deleted from the level (zlkgwqnxrp, :1585-1599) -- you eat it, and that permanently changes which outline you can satisfy. That is why level 5 reads as incomprehensible under a pure shape-matching model: from level 5 on, some outlines can only be matched by a color you have to go swallow first. Walls (wakneh-) silently block a move with no penalty; 3 of the 6 levels also place a hazard zone that snaps a piece back and counts a mistake, and five mistakes or an exhausted per-level click budget loses the level.',
  category: 'evaluation',
  difficulty: 'unknown',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION6', description: 'Select / relocate a piece', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'R11L Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/e026fd52-5b68-477f-8388-72fdfd8c56cf',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'R11L Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/932837ac-8800-414f-9d7c-46537ebea3a3',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'R11L Human Full Clear (6/6, score 72.87)',
      url: 'https://arcprize.org/replay/60c0af00-18bc-477d-976f-ac595b76f5f4',
      type: 'replay',
      description: 'Human player, 12-Sep-2026: all six levels cleared in 316 clicks over 13m56s with 7 resets. Per-level clicks 13/17/31/35/40/180 against baselines of 22/33/51/26/52/49 -- levels 1-3 and 5 beat baseline, level 6 took 3.7x it. The clearest demonstration of the level-5 colour-eating shift.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/r11l/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/r11l/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/r11l/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/r11l/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/r11l/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/r11l/lvl6.png' },
  ],
  tags: ['click-puzzle', 'shape-matching', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the marker sprite is visible not invisible, the hazard/mistake mechanic is level-scoped, and the keyhole markers matter a level earlier than claimed.',
};
