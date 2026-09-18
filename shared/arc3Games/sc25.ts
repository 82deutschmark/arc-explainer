/*
 * Author: Claude Sonnet 5; mechanics breakdown by Claude Opus 5, 2026-09-16
 * Date: 2026-09-11 (corrected against source 2026-09-12 and 2026-09-16)
 * PURPOSE: Game metadata for SC25 (Sigil Caster), part of the ARC-AGI-3 public
 *          demo set (25 games as of Sep 2026). Mechanics adversarially re-verified
 *          2026-09-12: the fireball only destroys crystals via one specific marked
 *          tile (then clears all matching crystals in the level, not just nearby
 *          ones), and the "bulldozed" crystal tile is non-solid and disappears on
 *          contact regardless of the grow spell.
 *          See docs/2026-09-11-arc3-public-set-additional-games-study.md.
 *          2026-09-16 (Claude Opus 5): added mechanicsBreakdown, traced from
 *          sc25-635fd71a/sc25.py and run in the engine (level 1 cleared, blocked grow,
 *          teleport on levels 2, 5 and 6, fireball hit and miss on level 3, pickup refund
 *          on level 4, loss at 51 counted actions, the level 1 first-action demo).
 *          Corrected the text: the teleport only moves the wizard onto a pad, it is not a
 *          swap; a fireball that hits the pink-framed target removes that target and every
 *          block of the target's middle color (dark red or orange), not "every matching
 *          marked crystal"; the pickup is a small green square that takes 10 off the used
 *          count; each cast costs one extra action when the spell finishes.
 *          2026-09-18 (Claude Opus 5): Boss's play notes from Discord (#arc-3, via Bubba) and from his
 *          18-Sep round-up added to playerObservations, worded from what he said.
 * SRP/DRY check: Pass - Single responsibility for SC25 game data.
 */

import { Arc3GameMetadata } from './types';

export const sc25: Arc3GameMetadata = {
  gameId: 'sc25',
  officialTitle: 'sc25',
  informalName: 'Sigil Caster',
  description: 'Draw a lit pattern on a toggle grid to auto-cast one of three spells (teleport, grow/shrink, or a block-clearing fireball) and reach the exit.',
  simpleExplanation: 'You draw a pattern on a small toggle grid; if it matches a known symbol, it casts a spell (teleport, grow/shrink, or fireball) that helps your wizard reach the exit.',
  mechanicsExplanation: 'You control a small wizard walking a maze toward an exit doorway. A 3x3 grid of clickable dots at the bottom toggles on/off, and if the lit pattern exactly matches the sigil of a spell unlocked on that level, the game auto-casts it: grow/shrink (the four dots around the center) switches the wizard between big and small so it can squeeze through 2-pixel gaps; teleport (top-left, top-middle and center) moves the wizard straight onto a pad of its size; fireball (the middle column) shoots the way the wizard last moved. The fireball only does something if the first thing in its path is a pink-framed target -- a wall or an ordinary block just fizzles it -- and when it connects, it removes the target and every block of the target\'s middle color (dark red or orange) anywhere on the level. A small green square is not solid: walking onto it takes 10 off your used-action count. Spells are gated per level (drawing a locked sigil does nothing), and a shared budget of moves, dot clicks and casts (50, 25, 50, 35, 65 and 60 for levels 1-6) ends the game in a loss if you go over it.',
  mechanicsBreakdown: [
    { category: 'controls', text: 'Up, Down, Left and Right move the wizard 2 pixels when it is small and 4 when it is big; if a big step is blocked, it tries a 2-pixel step instead. The wizard turns to face the way you pressed even when it cannot move.', source: 'sc25.py:2683-2718; engine run on level 1' },
    { category: 'controls', text: 'Click a dot in the 3x3 grid at the bottom (or the square around it) to light it or turn it off.', source: 'sc25.py:1909-1945, 2647-2672' },
    { category: 'controls', text: 'Click a spell icon to show that spell\'s sigil as white dots in the grid. Clicking the icon already shown plays an animation that lights its dots one by one. Icon clicks are free.', source: 'sc25.py:2613-2646, 2373-2398; engine run on level 4' },
    { category: 'controls', text: 'Clicking anywhere other than the grid or an icon makes the grid flash red and does nothing else. It is free.', source: 'sc25.py:2673-2680, 2332-2371; engine run' },
    { category: 'controls', text: 'There is no undo. RESET restarts the level with a full budget.', source: 'sc25.py:1764, 1769-1834; arcengine/base_game.py:305-330' },
    { category: 'goal', text: 'Reach the exit, a blue-bordered light blue doorway. Bumping into it walks the wizard in and loads the next level, and that last step costs nothing.', source: 'sc25.py:2731-2747, 1836-1857; engine run: level 1 cleared' },
    { category: 'pieces', text: 'The wizard is a small square, light blue on top and blue below. It starts big (4x4) on every level. Black is wall and gray is floor.', source: 'sc25.py:1379-1642 (wizard set to scale 2 on every level)' },
    { category: 'pieces', text: 'A spell casts by itself the moment the lit dots exactly match an unlocked sigil, with no extra dots lit. Lit dots turn the spell\'s color when they match and stay green when they don\'t. The grid clears after the spell.', source: 'sc25.py:1672-1690, 1947-1965, 2431-2465, 2400-2429' },
    { category: 'pieces', text: 'Only the spells shown by the icons on a level work there. Drawing a locked spell\'s sigil does nothing, and its dots stay green.', source: 'sc25.py:1947-1955, 1411-1639 (efvw per level); engine run: teleport sigil on level 1' },
    { category: 'pieces', text: 'Grow/shrink (purple) is the four dots around the center, with the center off. It switches the wizard between big and small. Shrinking always works. Growing shifts the wizard up or left to find room, and if there is none nearby, the wizard flashes and stays small.', source: 'sc25.py:2111-2153, 2269-2330, 2496-2532; engine runs on level 1' },
    { category: 'budget', text: 'The budget counts every move (blocked moves too), every dot click, and one more each time a spell finishes, including a grow that had no room or a fireball that hit nothing. Budgets are 50, 25, 50, 35, 65 and 60 for levels 1-6. Icon clicks, clicks elsewhere and the step into the exit are free.', source: 'sc25.py:1890-1898, 2663, 2560-2602, 2748; engine runs' },
    { category: 'hazards', text: 'Go one action over the budget and the game is over. There are no lives.', source: 'sc25.py:1890-1898, 2663-2668; engine run: the 51st counted action on level 1 ended the game' },
    { category: 'feedback', text: 'The budget bar is a 2-pixel column down the right edge of the screen: green for what is left, white for what is used, filling from the top down.', source: 'sc25.py:1859-1888; engine run' },
    { category: 'feedback', text: 'When a sigil matches, the wizard flashes in the spell\'s color for a moment before the spell happens.', source: 'sc25.py:2400-2429' },
    { category: 'feedback', text: 'On levels 1-3 the grid starts with that level\'s sigil already shown as white dots.', source: 'sc25.py:1829-1833' },
    { category: 'other', text: 'On level 1, the first action you take after the level starts (or after RESET) only plays a short demo of the grow/shrink sigil being drawn. It does not move the wizard or light a dot, and it costs nothing.', source: 'sc25.py:1834, 2542-2555; engine run: 22 frames, wizard did not move' },
    { introducedOnLevel: 2, category: 'pieces', text: 'Teleport (yellow) is the top-left dot, the top-middle dot and the center. It moves the wizard straight onto a teleport pad for its size: a big wizard lands on a pad marked by four yellow corner dots.', source: 'sc25.py:1672-1690, 2186-2251; engine run on level 2' },
    { introducedOnLevel: 2, category: 'feedback', text: 'A larger set of corner marks frames the pad the next teleport will land on.', source: 'sc25.py:2155-2184' },
    { introducedOnLevel: 2, category: 'pieces', text: 'Darker gray gates (a bracket shape with a 2-pixel gap) block the big wizard. Only a small wizard fits through.', source: 'sc25.py:1416-1455, 2713-2718 (gates are solid)' },
    { introducedOnLevel: 3, category: 'pieces', text: 'Fireball (pink) is the middle column of dots. It flies the way the wizard last moved and stops at the first wall, block or target in its path. It flies straight through the darker gray gates.', source: 'sc25.py:1967-2027, 2047-2109; engine run on level 3' },
    { introducedOnLevel: 3, category: 'pieces', text: 'Dark red blocks are solid. A fireball that hits one, or a wall, just fizzles.', source: 'sc25.py:1967-2027, 2047-2109; engine run: fireball into a wall on level 3 removed nothing' },
    { introducedOnLevel: 3, category: 'pieces', text: 'The target is a pink-framed square with a dark red middle. A fireball that hits it removes the target and every dark red block on the level, however far away.', source: 'sc25.py:2084-2093; engine run on level 3' },
    { introducedOnLevel: 3, category: 'other', text: 'The fireball\'s hit line runs along the wizard\'s top edge when shooting left or right, and along its left edge when shooting up or down, so a big wizard has to line that edge up with the target.', source: 'sc25.py:1967-1990' },
    { introducedOnLevel: 4, category: 'controls', text: 'Two spells on one level. The spell icons move to a panel at the top left, and the grid no longer starts with a sigil shown, so click an icon to see its sigil.', source: 'sc25.py:1496-1536, 1829-1833' },
    { introducedOnLevel: 4, category: 'pieces', text: 'A small green square is not solid. Walking onto it removes it and takes 10 off your used-action count (never below zero). A big wizard only collects it with its top-left corner, but growing while on top of it also collects it.', source: 'sc25.py:2719-2730, 2313-2324; engine runs on level 4' },
    { introducedOnLevel: 5, category: 'pieces', text: 'Small teleport pads appear: a solid purple dot. A small wizard teleports to the purple pad and a big one to the yellow pad, and the frame marks switch between yellow and purple as the wizard changes size.', source: 'sc25.py:2155-2171, 2186-2211; engine run on level 5' },
    { introducedOnLevel: 5, category: 'pieces', text: 'Orange blocks and a pink-framed target with an orange middle appear. Hitting that target removes only the orange blocks; the dark red target still removes only dark red blocks.', source: 'sc25.py:1537-1588, 2094-2102' },
    { introducedOnLevel: 6, category: 'pieces', text: 'Two big teleport pads: each big teleport goes to the next pad in turn, and the yellow frame moves to show where the next one will land.', source: 'sc25.py:2186-2211, 2173-2184; engine run on level 6' },
  ],
  playerObservations: [
    {
      player: 'Boss',
      date: '2026-09-18',
      saw: 'The game as a whole.',
      happened: 'He would never have figured it out and had to cheat. Once you understand it is showing you a spell to cast, it is obvious.',
    },
  ],
  category: 'evaluation',
  humanDifficulty: 'medium',
  aiDifficulty: 'medium',
  levelCount: 6,
  actionMappings: [
    { action: 'ACTION1', description: 'Move Up', commonName: 'Up' },
    { action: 'ACTION2', description: 'Move Down', commonName: 'Down' },
    { action: 'ACTION3', description: 'Move Left', commonName: 'Left' },
    { action: 'ACTION4', description: 'Move Right', commonName: 'Right' },
    { action: 'ACTION6', description: 'Toggle a sigil-grid dot', commonName: 'Click' },
  ],
  hints: [],
  resources: [
    {
      title: 'SC25 Standard-Harness Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/14734864-b319-4b44-832f-64b997351be0',
      type: 'replay',
      description: 'ARC Prize published replay, standard harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
    {
      title: 'SC25 Provider-Adapter Replay (GPT-6 Astra)',
      url: 'https://arcprize.org/replay/2e83cea2-946f-4f51-9ce5-d7ca5c8576f3',
      type: 'replay',
      description: 'ARC Prize published replay, provider-adapter harness, from the 2-Sep-2026 GPT-6 Astra results.',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/sc25/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/sc25/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/sc25/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/sc25/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/sc25/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/sc25/lvl6.png' },
  ],
  tags: ['spellcasting', 'pattern-matching', 'maze', 'public-demo-2026'],
  isFullyDocumented: true,
  notes: 'Added 2026-09-11 when the informal-name registry was extended from the original 6 games to the full 25-game public demo set. No replay video or hints exist yet for this game -- only the six level screenshots rendered from their own game source on 2026-09-12 and the two replay links ARC Prize published with the GPT-6 Astra results. Corrected 2026-09-12 after an adversarially-verified direct source read: the fireball and grow-spell claims both mischaracterized what actually gets destroyed.',
};
