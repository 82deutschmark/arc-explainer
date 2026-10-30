/**
 * Author: Claude Sonnet 5.5 Low
 * Date: 30-Oct-2026
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
import { frontKey } from './render';
import type { Node } from './kit';

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
    if (cache.models.size >= 400) cache.models.delete(cache.models.keys().next().value as string);
    cache.models.set(key, model);
  }
  return { model, names: cache.names };
}

/** A card's front or back as a 750 x 1050 PNG. Throws only for an art address that fails the guard. */
export async function renderCardFace(card: CollectionCard, collection: NewsCollection, side: CardSide = 'front', opts: CardFaceOpts = {}): Promise<Buffer> {
  if (card.art) await assertCollectionArtPath(card.art.src);
  const { model, names } = cardFaceModel(card, collection);
  const look = lookFor(model.look);
  const lookOpts: LookOpts = { ...opts, namesById: names };
  if (side === 'front') return look.frontBuffer(model, lookOpts);
  // The reverse costs about a second: one in-flight render per card version, remembered for the next request.
  const key = `${look.key}|${frontKey(model, lookOpts)}`;
  let hit = BACK_MEMO.get(key);
  if (hit) { BACK_MEMO.delete(key); BACK_MEMO.set(key, hit); return hit; }
  hit = look.frontBuffer(model, lookOpts).then(front => look.back(model, { ...lookOpts, frontBuffer: front }));
  BACK_MEMO.set(key, hit);
  hit.catch(() => BACK_MEMO.delete(key));            // a failed render is never remembered
  while (BACK_MEMO.size > BACK_MEMO_LIMIT) BACK_MEMO.delete(BACK_MEMO.keys().next().value as string);
  return hit;
}
const BACK_MEMO = new Map<string, Promise<Buffer>>();
const BACK_MEMO_LIMIT = 60;

/** The Satori tree of a front, for the wording lint (see cardFaceLint). */
export async function cardFaceNode(card: CollectionCard, collection: NewsCollection): Promise<Node> {
  if (card.art) await assertCollectionArtPath(card.art.src);
  const { model, names } = cardFaceModel(card, collection);
  return lookFor(model.look).frontNode(model, { namesById: names });
}
/** Banned-word problems in a card's front tree (empty when clean). Kaggle's own contest and team names are allowed. */
export async function cardFaceLint(card: CollectionCard, collection: NewsCollection): Promise<string[]> {
  const { model } = cardFaceModel(card, collection);
  return lintNode(await cardFaceNode(card, collection), careerNames(model));
}

const THUMB_CACHE = new Map<string, Buffer>();
const THUMB_CACHE_LIMIT = 300;
/** Smallest and largest thumbnail width the site serves. */
export const THUMB_MIN_WIDTH = 120, THUMB_MAX_WIDTH = 750;
/**
 * A small WebP of a card face for the Cabinet grid, so ninety cards do not mean ninety full PNGs. `version` is the card's
 * content version (it includes RENDER_VERSION); a changed card or design gets a fresh key and the old entry ages out.
 */
export async function renderCardThumb(card: CollectionCard, collection: NewsCollection, side: CardSide, width: number, version: string): Promise<Buffer> {
  const w = Math.min(THUMB_MAX_WIDTH, Math.max(THUMB_MIN_WIDTH, Math.round(width)));
  const key = `${card.id}|${side}|${w}|${version}`;
  const hit = THUMB_CACHE.get(key);
  if (hit) { THUMB_CACHE.delete(key); THUMB_CACHE.set(key, hit); return hit; }   // refresh recency
  const thumb = await sharp(await renderCardFace(card, collection, side)).resize({ width: w }).webp({ quality: 82 }).toBuffer();
  if (THUMB_CACHE.size >= THUMB_CACHE_LIMIT) THUMB_CACHE.delete(THUMB_CACHE.keys().next().value as string);
  THUMB_CACHE.set(key, thumb);
  return thumb;
}

/** Registered look keys, oldest first (for tests and diagnostics). */
export const registeredLooks = (): string[] => Object.keys(LOOKS);
