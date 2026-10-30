/**
 * Author: Claude Sonnet 5.5 Low (replaces GPT-6 / Codex's renderer of 29-Oct-2026)
 * Date: 30-Oct-2026
 * PURPOSE: The stable import point the Express routes use for Card Cabinet card images. The drawing itself now lives in
 *          cardFace/ (a Topps-style 2026 set chosen per season by the set registry); this file only gives the routes their
 *          long-standing names: buildCollectionCardImage (750 x 1050 front or back PNG) and buildCollectionCardThumb
 *          (small WebP behind an LRU cache). Both take the collection the card came from, because the renderer enriches
 *          each card against it (rank board, rosters, career), once per collection content.
 * SRP/DRY check: Pass. Delegates to cardFace/index.ts; the art path guard, the fonts and the thumbnail cache all live there.
 *
 * CHANGELOG
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Low): the old front/back drawing code is gone (its wording and layout are retired);
 *          both functions now take the collection as their second argument.
 */
import type { CollectionCard, NewsCollection } from '../../../shared/newsCollection';
import { renderCardFace, renderCardThumb, type CardSide } from './cardFace';

/** A card's front or back as a 750 x 1050 PNG. */
export const buildCollectionCardImage = (card: CollectionCard, collection: NewsCollection, side: CardSide = 'front'): Promise<Buffer> =>
  renderCardFace(card, collection, side);

/** A small WebP of a card face for the Cabinet grid; `version` is the card's content version (collectionShareVersion). */
export const buildCollectionCardThumb = (card: CollectionCard, collection: NewsCollection, side: CardSide, width: number, version: string): Promise<Buffer> =>
  renderCardThumb(card, collection, side, width, version);
