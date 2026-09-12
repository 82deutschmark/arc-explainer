/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for FT09 (Functional Tiles) with featured replay clip metadata.
 *          The original write-up's core premise was wrong: there is no "dominant
 *          color" precedence system, the top-right block is just a color legend (not
 *          a target to match), the real win condition is scattered match/mismatch
 *          markers, every level has a click budget that can lose the game, and one
 *          tile type recolors several neighbors per click, not just itself.
 * SRP/DRY check: Pass - Single responsibility for FT09 game data.
 */

import { Arc3GameMetadata } from './types';

export const ft09: Arc3GameMetadata = {
  gameId: 'ft09',
  officialTitle: 'ft09',
  informalName: 'Functional Tiles',
  description: 'Satisfy small color-matching and color-clashing markers scattered across the grid, under a shrinking click budget.',
  mechanicsExplanation: 'Small marker sprites are scattered all over each level (not just in one corner), and each one demands that its neighboring tiles either match or clash in color. The level is won only once every single marker\'s rule holds at once -- there is no "dominant color" that overrides a conflicting one; one unsatisfied marker fails the whole level. The block of colors that sits near the top-right in most levels is not a target picture to copy -- it\'s just an ordered list of the colors that level actually uses (and each tile\'s default color). Clicking a tile normally advances it through that level\'s color list, a plain round-robin, though one special tile type recolors itself and up to four orthogonal neighbors at once in a single click. Every level also gives you a limited number of clicks, shown as a draining bar along the bottom edge; run out before every marker is satisfied and you lose the level outright.',
  category: 'preview',
  difficulty: 'medium',
  actionMappings: [
    { action: 'ACTION6', description: 'Click to change tile/color', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'ft09-hint-1',
      title: 'The Corner List Is Not a Target',
      content: 'The colors near the top-right aren\'t a picture to recreate -- they\'re just the list of colors this level uses. The real goal is a set of small markers scattered around the board, each demanding its own neighboring tiles match or clash; every one of them has to hold at once.',
      spoilerLevel: 2,
    },
    {
      id: 'ft09-hint-2',
      title: 'Color Cycling and a Hidden Click Budget',
      content: 'Clicking a tile advances it through that level\'s fixed color list, wrapping back to the start -- a plain round-robin, not a smart toggle. One special tile type also recolors its neighbors, not just itself. Every level also caps your total clicks, shown as a draining bar; run out and you lose.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'FT09 Replay',
      url: 'https://three.arcprize.org/replay/ft09-b8377d4b7815/39b51ef3-b565-43fe-b3a8-7374ca4c5058',
      type: 'replay',
      description: 'Gameplay replay of FT09 (Functional Tiles)',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/ft09/lvl1.png', notes: 'Current 6-level build (ARCEngine, March 2026) -- see the note below on why this differs from the level 8/9 shots further down.' },
    { level: 2, imageUrl: '/arc3-levels/ft09/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/ft09/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/ft09/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/ft09/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/ft09/lvl6.png' },
    {
      level: 8,
      imageUrl: '/ft09-lvl8.png',
      notes: 'Preview-era capture (Jul-Aug 2025) from a build with more levels than the current 6-level source -- kept for its own sake, not the same numbering as the renders above. The top-right block is just a color legend, not a target to copy -- the real goal is the scattered match/clash markers around the board.',
    },
    {
      level: 9,
      imageUrl: '/ft09-lvl9.png',
      notes: 'Same preview-era build as the level 8 shot above; not present in the current 6-level source.',
    },
  ],
  tags: ['preview-set', 'pattern-matching', 'logic'],
  thumbnailUrl: '/ft09.png',
  video: {
    src: '/videos/arc3/ft09-b8377d4b7815.mp4',
    caption: 'Functional Tiles replay showing the scattered color-matching markers in play',
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct, adversarially-verified source read: the original "dominant color" precedence framing had no code behind it at all. The real mechanic is independent, all-must-hold color markers scattered around the board, a per-level click budget that can lose the game, and a tile type that recolors several neighbors per click.',
};
