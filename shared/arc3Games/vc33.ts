/*
 * Author: Cascade (ChatGPT); corrected by Claude Sonnet 5, 2026-09-12
 * Date: 2026-01-09 (corrected against source 2026-09-12)
 * PURPOSE: Game metadata for VC33 with featured replay video metadata.
 *          Adversarially re-verified 2026-09-12: player-square transit needs a manual
 *          click on a specific bar (it's a two-way swap, not an automatic glide),
 *          blue squares don't move liquid at all (only red/maroon do), and every
 *          level has an unmentioned click budget that can lose the game.
 * SRP/DRY check: Pass - Single responsibility for VC33 game data.
 */

import { Arc3GameMetadata } from './types';

export const vc33: Arc3GameMetadata = {
  gameId: 'vc33',
  officialTitle: 'vc33',
  informalName: 'Volume Control',
  description: 'Manage white columns as a liquid system, then click the crossing bar to swap player squares across a cleared gap, before your click budget runs out.',
  mechanicsExplanation: 'The white columns function like liquid or water within a closed system. Clicking red/maroon controller squares causes the "liquid" to flow from one contained area to another -- the blue-colored squares aren\'t a second control, they\'re just the disabled look of a separate crossing-trigger bar before it\'s ready. Large player squares (yellow, green, purple) cannot be manually selected, and don\'t glide across on their own either: once a gap clears enough to align that bar, you have to click it directly, and the click swaps the two player squares on either side of the gap with each other. If a player square is sitting on a white column, it will rise or fall with the column height, similar to a person sitting on top of a tube of liquid. Every click, including a wasted one, spends part of a small per-level budget; run out before finishing and you lose.',
  category: 'evaluation',
  difficulty: 'medium',
  actionMappings: [
    { action: 'ACTION6', description: 'Click red/maroon controller to shift liquid, or click the crossing bar to swap players', commonName: 'Click' },
  ],
  hints: [
    {
      id: 'vc33-hint-1',
      title: 'Hydraulic Logic',
      content: 'Think of the total volume of white pixels as constant. Raising one column usually requires lowering another. Map out which controllers affect which "tubes".',
      spoilerLevel: 2,
    },
    {
      id: 'vc33-hint-2',
      title: 'Manual Crossing',
      content: 'Player squares don\'t glide across by themselves -- once the gap is high enough, you have to click the crossing bar directly, and that click swaps the two squares on either side of it. Watch your click budget while you experiment.',
      spoilerLevel: 1,
    }
  ],
  resources: [
    {
      title: 'VC33 Replay',
      url: 'https://three.arcprize.org/replay/vc33-6ae7bf49eea5/29409ce8-c164-447e-8810-828b96fa4ceb',
      type: 'replay',
      description: 'Gameplay replay of VC33 (Volume Control)',
    },
  ],
  levelScreenshots: [
    { level: 1, imageUrl: '/arc3-levels/vc33/lvl1.png' },
    { level: 2, imageUrl: '/arc3-levels/vc33/lvl2.png' },
    { level: 3, imageUrl: '/arc3-levels/vc33/lvl3.png' },
    { level: 4, imageUrl: '/arc3-levels/vc33/lvl4.png' },
    { level: 5, imageUrl: '/arc3-levels/vc33/lvl5.png' },
    { level: 6, imageUrl: '/arc3-levels/vc33/lvl6.png' },
    { level: 7, imageUrl: '/vc33-lvl7.png', notes: 'Players sit atop the white hydraulic columns.' },
  ],
  tags: ['preview-set', 'hydraulics', 'physics'],
  thumbnailUrl: '/vc33.png',
  video: {
    src: '/videos/arc3/vc33-6ae7bf49eea5.mp4',
    caption: 'Volume Control replay highlighting hydraulic manipulation',
  },
  isFullyDocumented: true,
  notes: 'Corrected 2026-09-12 after a direct, adversarially-verified source read: transit is a manual click-to-swap on a specific bar, not an automatic glide; blue squares never move liquid; and a per-level click budget that can lose the game was missing.',
};
