/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Sonnet 5.5 Low; Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): every render cache (front memo, reverse memo, thumbnails) is sized from the collection
 *          (cards x 1.2, so a full crawl hits); a competitor's reverse no longer renders a front it never shows (only team and
 *          sponsor backs carry the miniature); the reverse memo key includes the stamp word through frontKey.
 * PURPOSE: The public entry points the site uses to draw a Card Cabinet card. renderCardFace() turns a CollectionCard
 *          into its 750 x 1050 front or back PNG: it checks the art address, enriches the card once (enrich.ts, cached
 *          per collection content, never per request), picks the look named by the card's set (sets.ts -> looks.ts) and
 *          draws. renderCardThumb() is the Cabinet grid's small WebP behind an LRU cache. RENDER_VERSION (shared, so the
 *          browser and the server agree) is part of every image address: bump it when a design changes and every cached
 *          image, thumbnail and link preview is refetched.
 *          getNewsCollection() re-reads the files on every call and so returns a fresh object each time; the enrichment
 *          is therefore cached on a fingerprint of the collection's CONTENT, and the first object seen for a fingerprint
 *          is reused so enrich.ts's own per-object context cache also hits.
 * SRP/DRY check: Pass. Orchestration and caching only; layout lives in the look modules, data decisions in enrich.ts,
 *          art reading and its address guard in art.ts.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Low): first version (replaces the old newsCollectionImage.ts renderer).
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium, review fixes): the reverse is memoised like the front (one in-flight render per card
 *          version, a whole crawl's worth kept) and no longer renders the front first when it is already cached.
 */
import sharp from 'sharp';
import type { CollectionCard, NewsCollection } from '../../../../shared/newsCollection';
import { enrichCard } from './enrich';
import { assertCollectionArtPath } from './art';
import { lookFor, LOOKS, type LookOpts } from './looks';
import { setDesigns, setForSeason } from './sets';
import { lintNode, careerNames } from './lint';
import { frontKey, sizeFrontMemo } from './render';
import type { Node } from './kit';
import { cardFrameRepair } from '../../../../shared/cardFrameRepair';

export { RENDER_VERSION } from '../../../../shared/newsCollection';
export { LOOKS, lookFor } from './looks';
export type { Look } from './looks';
export { lintNode, careerNames } from './lint';

export type CardSide = 'front' | 'back';
/** What a caller may tune: the colour behind the rounded corners (default page paper; null keeps them transparent) and a tier override. */
export type CardFaceOpts = Pick<LookOpts, 'flatten' | 'tierOverride'>;

const fnv = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};

interface Cached { fingerprint: string; collection: NewsCollection; names: Record<string, string>; models: Map<string, any> }
let current: Cached | null = null;
const seen = new WeakMap<NewsCollection, string>();

/** The cache entry for a collection's content; a new fingerprint starts a fresh one, so edits never serve stale models. */
function cacheFor(collection: NewsCollection): Cached {
  let fingerprint = seen.get(collection);
  if (!fingerprint) seen.set(collection, fingerprint = fnv(JSON.stringify([collection.season, collection.updatedAt, collection.cards])));
  if (current?.fingerprint === fingerprint) return current;
  const names = Object.fromEntries(collection.cards.map(card => [card.id, card.name]));
  sizeCaches(collection.cards.length);
  return current = { fingerprint, collection, names, models: new Map() };
}

const warnedSeason = new Set<string>();
/** The enriched model of one card (cached). A season with no set row is drawn in the newest set and warns once. */
export function cardFaceModel(card: CollectionCard, collection: NewsCollection): { model: any; names: Record<string, string> } {
  const cache = cacheFor(collection);
  const key = fnv(JSON.stringify(card));
  let model = cache.models.get(key);
  if (!model) {
    if (setForSeason(card.season)) model = enrichCard(card, cache.collection);
    else {
      const newest = setDesigns().at(-1)!;
      if (!warnedSeason.has(card.season)) { warnedSeason.add(card.season); console.warn(`[cardFace] no set registered for season ${card.season}; drawing in the ${newest.season} set`); }
      model = enrichCard({ ...card, season: newest.season }, cache.collection);
      model.series = { ...model.series, season: card.season };
    }
    if (cache.models.size >= Math.max(400, cacheLimit)) cache.models.delete(cache.models.keys().next().value as string);
    cache.models.set(key, model);
  }
  return { model, names: cache.names };
}

/** A card's front or back as a 750 x 1050 PNG. Throws only for an art address that fails the guard. */
export async function renderCardFace(card: CollectionCard, collection: NewsCollection, side: CardSide = 'front', opts: CardFaceOpts = {}): Promise<Buffer> {
  if (card.art) await assertCollectionArtPath(card.art.src);
  const { model, names } = cardFaceModel(card, collection);
  const look = lookFor(model.look);
  const repair = cardFrameRepair(card);
  // This approved 5:7 illustration was authored for the full card. Its smaller native resolution
  // had sent it through the legacy contain/crop fallback, wasting the intended composition.
  // The back never repeats the front's art: it shows a second picture or a blank design (Boss rule, 5 Nov 2026).
  const lookOpts: LookOpts = { ...opts, namesById: names, preservePicture: true, backPicture: card.backArt?.src ?? repair?.backArtSrc, ...(repair ? { artOverride: { file: model.art.file, kind: 'contract-5x7', bakedText: false } } : {}) };
  if (side === 'front') return look.frontBuffer(model, lookOpts);
  // The reverse costs about a second: one in-flight render per card version, remembered for the next request.
  const key = `${look.key}|${lookOpts.backPicture ?? ''}|${frontKey(model, lookOpts)}`;
  let hit = BACK_MEMO.get(key);
  if (hit) { BACK_MEMO.delete(key); BACK_MEMO.set(key, hit); return hit; }
  // Only team and sponsor reverses print a miniature of the front; a competitor's ledger reverse never shows it, so it is not drawn.
  hit = model.kind === 'competitor' ? look.back(model, lookOpts)
    : look.frontBuffer(model, lookOpts).then(front => look.back(model, { ...lookOpts, frontBuffer: front }));
  BACK_MEMO.set(key, hit);
  hit.catch(() => BACK_MEMO.delete(key));            // a failed render is never remembered
  while (BACK_MEMO.size > cacheLimit) BACK_MEMO.delete(BACK_MEMO.keys().next().value as string);
  return hit;
}
const BACK_MEMO = new Map<string, Promise<Buffer>>();
/** Faces each render cache keeps: the whole set with headroom (cards x 1.2), so a full crawl hits instead of evicting itself. */
let cacheLimit = 120;
/** Thumbnails per card the Cabinet asks for (front and back, each at a couple of widths). */
const THUMBS_PER_CARD = 4;
const limitFor = (cards: number) => Math.max(1, Math.ceil(cards * 1.2));
function sizeCaches(cards: number): void {
  cacheLimit = limitFor(cards);
  sizeFrontMemo(cacheLimit);
  while (BACK_MEMO.size > cacheLimit) BACK_MEMO.delete(BACK_MEMO.keys().next().value as string);
  while (THUMB_CACHE.size > cacheLimit * THUMBS_PER_CARD) THUMB_CACHE.delete(THUMB_CACHE.keys().next().value as string);
}
/** The render cache size for a collection (cards x 1.2); the share preview cache uses the same number. */
export const renderCacheLimit = (collection: NewsCollection): number => limitFor(collection.cards.length);

/** The Satori tree of a front, for the wording lint (see cardFaceLint). */
export async function cardFaceNode(card: CollectionCard, collection: NewsCollection): Promise<Node> {
  if (card.art) await assertCollectionArtPath(card.art.src);
  const { model, names } = cardFaceModel(card, collection);
  return lookFor(model.look).frontNode(model, { namesById: names, ...(cardFrameRepair(card) ? { artOverride: { file: model.art.file, kind: 'contract-5x7', bakedText: false } } : {}) });
}
/** Banned-word problems in a card's front tree (empty when clean). Kaggle's own contest and team names are allowed. */
export async function cardFaceLint(card: CollectionCard, collection: NewsCollection): Promise<string[]> {
  const { model } = cardFaceModel(card, collection);
  return lintNode(await cardFaceNode(card, collection), careerNames(model));
}

const THUMB_CACHE = new Map<string, Buffer>();
/** Smallest and largest thumbnail width the site serves. */
export const THUMB_MIN_WIDTH = 120, THUMB_MAX_WIDTH = 750;
/**
 * A small WebP of a card face for the Cabinet grid, so ninety cards do not mean ninety full PNGs. `version` is the card's
 * image version, collectionShareVersion(card, collection): it covers RENDER_VERSION, the card, what it prints about other
 * cards (teammates' tiers and medals, shared-art names, the set's tier count) and the stamp phase, so a change to any of
 * them gets a fresh key and the old entry ages out.
 */
export async function renderCardThumb(card: CollectionCard, collection: NewsCollection, side: CardSide, width: number, version: string): Promise<Buffer> {
  const w = Math.min(THUMB_MAX_WIDTH, Math.max(THUMB_MIN_WIDTH, Math.round(width)));
  const key = `${card.id}|${side}|${w}|${version}`;
  const hit = THUMB_CACHE.get(key);
  if (hit) { THUMB_CACHE.delete(key); THUMB_CACHE.set(key, hit); return hit; }   // refresh recency
  const thumb = await sharp(await renderCardFace(card, collection, side)).resize({ width: w }).webp({ quality: 82 }).toBuffer();
  while (THUMB_CACHE.size >= cacheLimit * THUMBS_PER_CARD) THUMB_CACHE.delete(THUMB_CACHE.keys().next().value as string);
  THUMB_CACHE.set(key, thumb);
  return thumb;
}

/** Registered look keys, oldest first (for tests and diagnostics). */
export const registeredLooks = (): string[] => Object.keys(LOOKS);
