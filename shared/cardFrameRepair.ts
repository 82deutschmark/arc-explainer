/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 03-November-2026
 * PURPOSE: Select the limited, source-matched card framing repair without changing other cards.
 * The existing approved illustration and original frame remain canonical; layout only is repaired.
 * SRP/DRY check: Pass — one small selection is shared by page, renderer and image version.
 */
const repairs: Record<string, { artSrc: string; backArtSrc: string; version: number }> = {
  'person-refv00-2026': { artSrc: '/news-images/cards/2026/refv00-solo-v2.webp', backArtSrc: '/news-images/cards/2026/refv00-solo-v5.webp', version: 1 },
  'person-daniel-franzen-2026': { artSrc: '/news-images/cards/2026/daniel-franzen-duck-solo-v1.png', backArtSrc: '/news-images/cards/2026/daniel-franzen-duck-v2.webp', version: 2 },
};
export function cardFrameRepair(card: { id: string; art?: { src: string } | null }) {
  const repair = repairs[card.id];
  return repair && repair.artSrc === card.art?.src ? repair : undefined;
}
