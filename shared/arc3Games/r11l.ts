/*
 * Author: Claude Sonnet 5
 * Date: 2026-09-11 (corrected 2026-09-12; mechanics reframed 2026-09-12 PM; renamed and
 *       simpleExplanation added 2026-09-12 PM)
 * PURPOSE: Game metadata for R11L (Reaching Lurch), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the "shadow" marker is explicitly visible, not invisible; the
 *          hazard-zone mistake mechanic only exists in 3 of 6 levels while the wall
 *          obstacle in every level behaves totally differently; and the keyhole
 *          markers are required a level earlier than claimed, not "mostly cosmetic."
 *          Reframed 2026-09-12 after the Boss played it: the shape-matching description
 *          does not survive level 5. The body marker is the centroid of its own pieces
 *          (so pieces drag it like pseudopods) and it absorbs colour by overlapping food
 *          sprites, which only exist on levels 5-6. Verified in r11l.py directly.
 *          Renamed from "Rearrange Layout" 2026-09-12: that name predated the reframe
 *          above and never got updated to match it. New name keeps this set's two-word,
 *          first-letters-match-the-id convention (R11L -> R _ L _, confirmed against
 *          m0r0/g50t/s5i5/tu93/sb26/dc22/cn04/cd82).
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, checked in r11l.py (build
 *          495a7899) and run in the engine. Kept the blob/pseudopod framing. Fixed
 *          mechanicsExplanation: level 6 has 9 food pellets (not 10); on levels 1-4 the body
 *          only has to overlap its own outline (the exact color-set test applies to the
 *          white eating blobs of levels 5-6); a wall-blocked click still spends one of the
 *          60 clicks; the hazard is the BODY entering a light blue zone (levels 2-4); five
 *          hazard hits or the 60th click end the whole game. Note: the "keyhole markers are
 *          required" line above does not match the code -- the win check skips those
 *          outlines on every level (r11l.py:1763). Also narrowed description, which read as if
 *          every level needs a color match; only levels 5-6 do.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 *          2026-09-18 (Claude Opus 5): Boss's own screenshots from Discord added as human captures.
 * SRP/DRY check: Pass - Single responsibility for R11L game data.
 */

import { Arc3GameMetadata } from './types';

export const r11l: Arc3GameMetadata = {
  gameId: 'r11l',
  officialTitle: 'r11l',
  informalName: 'Reaching Lurch',
  description: 'Drag a blob around by its limbs until its body sits on its outline; from level 5 the bodies start white and must eat colored food until their colors exactly match an outline.',
  simpleExplanation: 'It\'s an amoeba, or blob, with limbs. You can\'t move its body directly, but the body always re-centers between its limbs. In the early levels the body already has the colors its target wants; in later levels you have to move the body over food pellets to eat them, changing the body\'s color, until it matches what the target needs.',
  mechanicsExplanation: 'Click-only. Each piece is one arm of a blob: clicking an arm selects it, clicking an empty spot moves that arm there, and the blob\'s body is then re-centered to the average position of all its arms (r11l.py:1536-1551). You never move the body directly -- you reposition arms and the body gets dragged along behind them, like an amoeba pulling itself with pseudopods. On levels 1-4 each blob already wears its colors and a level clears when every blob\'s body overlaps its own outline of the same colors -- touching the outline is enough, it doesn\'t need to be centered (r11l.py:1758-1783). Levels 4-6 also show outlines that belong to no blob; the win check skips them. Level 5 changes the game: the blobs\' bodies start plain white, the level adds 4 food pellets (level 6 has 9), and whenever the BODY overlaps one -- not the arm that moved it there -- the pellet\'s colored pixels are painted onto the body and the pellet is gone (r11l.py:1585-1599). You eat it, and that changes which outline you can satisfy: on levels 5-6 an outline only counts when a body sits on it with exactly the same set of colors (white doesn\'t count), and a later pellet can paint over a color you ate earlier. That is why level 5 reads as incomprehensible under a pure shape-matching model: from level 5 on, some outlines can only be matched by a color you have to go swallow first. Walls block an arm from being placed on them, but the click still spends one of the level\'s 60 clicks. On levels 2-4, light blue hazard zones punish a move that puts a body in them: the body flashes, the arm jumps back, and it counts a strike. Five strikes on a level, or reaching the 60th click, ends the game.',
  mechanicsBreakdown: [
    { category: 'pieces', text: 'A blob is a body (a small rounded square in the blob\'s colors with a pink dot in the middle) and two or more arms (small plus shapes with a colored center). Thin light gray lines join each arm to its body.', source: 'r11l.py:660-672, 764-776, 1334-1364; level 1 render' },
    { category: 'controls', text: 'Clicking is the only control. Click an arm to pick it: the picked arm is drawn with a white outline and the others with dark gray. At the start of a level the arm nearest the top-left corner is already picked.', source: 'r11l.py:1440, 1511-1518, 1529-1534, 1826-1833; engine run on level 1' },
    { category: 'controls', text: 'Click anywhere that isn\'t an arm and the picked arm jumps so its center is where you clicked. Arms of any blob can be picked, one at a time.', source: 'r11l.py:1834-1841, 1568-1576, 1717-1730; engine run on level 1' },
    { category: 'pieces', text: 'You never move a body directly. After every arm move the body jumps to the average position of all its arms, so moving arms drags the body around.', source: 'r11l.py:1536-1551, 1725-1730; engine run on level 1: body went from (15,45) to (34,32) after one arm move' },
    { category: 'pieces', text: 'Gray walls stop arms: if the arm would overlap a wall where you clicked, it doesn\'t move. The body is never checked against walls, so it can end up on top of one.', source: 'r11l.py:816-830, 1553-1566, 1839-1843, 1536-1551; engine run on level 1: a click into the wall left both arms in place' },
    { category: 'goal', text: 'Each blob has an outline target: a hollow ring of dots in the blob\'s colors. On levels 1-4 the level is won when every blob\'s body overlaps its own outline. Touching it is enough, the body doesn\'t need to be centered in it.', source: 'r11l.py:355-367, 1758-1783, 1705-1709; engine runs on level 1: a body only touching the outline\'s edge still cleared the level' },
    { category: 'feedback', text: 'When a body lands on its outline, a white copy of the outline blinks over it a few times and then stays on while the body is there. It disappears if the body moves off. When the last one is in place, the next level loads after the blinking.', source: 'r11l.py:411-423, 1646-1689, 1699-1709; engine runs: 23 frames on the winning move of level 1, highlight removed when the body left an outline on level 5' },
    { category: 'budget', text: 'Every click costs one of the level\'s 60 clicks: picking an arm, moving it, and clicks into walls that do nothing. The 60th click ends the game on the spot, so you really get 59. The count starts over on each level.', source: 'r11l.py:1406-1407, 1805-1812; arcengine/base_game.py:148-160; engine run: game over on the 60th click' },
    { category: 'feedback', text: 'The column along the left edge of the screen is the click bar. It starts white and turns black from the top down as you spend clicks.', source: 'r11l.py:1306-1331; engine run: 31 white pixels left after 31 clicks' },
    { category: 'controls', text: 'There is no undo. RESET restarts the level, with every arm back in place, the click count back to zero and any strikes cleared.', source: 'r11l.py:1440, 1463-1527; arcengine/base_game.py:305-330' },
    { introducedOnLevel: 2, category: 'pieces', text: 'Two blobs at once, each with its own color, arms and outline. Both bodies have to be on their outlines.', source: 'r11l.py:1164-1179, 1758-1783' },
    { introducedOnLevel: 2, category: 'hazards', text: 'Light blue hazard zones (levels 2, 3 and 4). If an arm move puts any body into one, that body blinks white a few times, the arm jumps back to where it was, and you get a strike. Only bodies trigger it, not arms. The move still costs its click.', source: 'r11l.py:86-98, 1733-1757, 1620-1644, 1786-1803; engine run on level 2: 23 frames, arm and body back in place' },
    { introducedOnLevel: 2, category: 'hazards', text: 'Five strikes on one level ends the game. Nothing on screen counts the strikes for you.', source: 'r11l.py:1747-1753, 1306-1331 (only the click bar is drawn); engine run on level 2: game over on the 5th hazard hit' },
    { introducedOnLevel: 4, category: 'pieces', text: 'Blobs and outlines with more than one color, split into two or three colored parts.', source: 'r11l.py:1198-1227' },
    { introducedOnLevel: 4, category: 'goal', text: 'Some outlines belong to no blob. They look just like real ones, but the win check skips them, so they can be left empty. Level 4 has five of them, level 5 three and level 6 one.', source: 'r11l.py:1203-1212, 1232-1237, 1256-1259, 1763' },
    { introducedOnLevel: 5, category: 'pieces', text: 'The blobs\' bodies start plain white, and food pellets appear: small blobs, part white and part one color. When a move puts a body over a pellet, the pellet\'s colored pixels are painted onto the body in the same spots and the pellet is gone. Only the body eats, not the arms. Level 5 has 4 pellets and level 6 has 9.', source: 'r11l.py:464-476, 673-685, 1238-1241, 1260-1268, 1585-1599, 1731-1732; engine run on level 5: the body turned half red and the red pellet disappeared' },
    { introducedOnLevel: 5, category: 'pieces', text: 'A later pellet can paint over a color the body already ate, so the order you eat in matters.', source: 'r11l.py:1594-1596; engine run on level 5: blue was replaced by green, leaving red and green' },
    { introducedOnLevel: 5, category: 'goal', text: 'On levels 5 and 6 no outline has a blob of its own. An outline is filled when any body sits on it with exactly the same set of colors (white doesn\'t count), and the level is won when every real outline is filled.', source: 'r11l.py:1601-1618, 1769-1783; engine runs on levels 5 and 6: with one outline filled the level did not end, and with both real outlines filled level 5 advanced and level 6 won the game' },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-12',
      saw: 'A blob with limbs, food pellets, and a colored gate.',
      did: 'Used the limbs to pull the body over the food.',
      happened: 'It is an amoeba. You can\'t move the body directly; it always re-centers between the limbs. The body itself has to be over a pellet to eat it, and dragging a limb over a pellet does nothing. Eating changes the body\'s color, which is what gets it through the gate.',
    },
    {
      player: 'Boss',
      date: '2026-09-12',
      level: 5,
      saw: 'Level 5.',
      happened: 'Hard to tell what it wants. On the first levels the body is already the target color; from here you have to eat pellets to make it the right color or combination of colors.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'hard',
  aiDifficulty: 'medium',
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
    { level: 5, imageUrl: '/arc3-levels/r11l/lvl5-human.png', kind: 'human', caption: 'human play', notes: 'Not an engine render: Boss\'s screenshot of level 5, 12-Sep-2026, sent while working out what it wants.' },
  ],
  tags: ['click-puzzle', 'shape-matching', 'public-demo-2026'],
  isFullyDocumented: false,
  notes: 'The blob/pseudopod mechanic on this page was identified by an eccentric chicken farmer after playing the game directly. The original write-up here, produced by coding agents reading the obfuscated source, missed it entirely and described this as a generic shape-into-outline puzzle -- a description that only holds through level 4. Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the marker sprite is visible not invisible, the hazard/mistake mechanic is level-scoped, and the keyhole markers matter a level earlier than claimed.',
};
