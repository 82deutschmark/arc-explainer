/**
 * Author: Claude Sonnet 5.5 Low
 * Date: 30-Oct-2026
 * PURPOSE: The whole-set checks for the Card Cabinet card faces (cardFace/): every real card draws a front and a back
 *          without throwing, with clean wording (lintNode over every Satori tree); PNG signatures and sizes; the share
 *          preview size; the tier recipes really differ at the pixel level (mean border colour, not a golden image);
 *          thumbnail widths; an unknown tier or look warns exactly once; an unknown season falls back to the newest set;
 *          the enrichment is cached on collection content. Kept under about a minute: every front and back TREE is linted,
 *          every front is rasterised, a sample of backs is rasterised.
 * SRP/DRY check: Pass. Uses the production collection and the public entry points in cardFace/index.ts; no fixtures of its own
 *          beyond one cloned card per case.
 */
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { cardFaceLint, cardFaceModel, lookFor, registeredLooks, renderCardFace, renderCardThumb, RENDER_VERSION } from '../server/services/news/cardFace';
import { backNode } from '../server/services/news/cardFace/back';
import { lintNode, careerNames } from '../server/services/news/cardFace/lint';
import { tierByName } from '../server/services/news/cardFace/tiers';
import { BORDER } from '../server/services/news/cardFace/zones';
import { buildCollectionShareImage, buildCollectionShareNode } from '../server/services/news/newsCollectionShareImage';
import { collectionShareVersion } from '../shared/newsCollection';

const collection = getNewsCollection();
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const cardById = (id: string) => collection.cards.find(card => card.id === id)!;

describe('whole set', () => {
  it('draws every real card front (750 x 1050 PNG) with clean wording', { timeout: 120_000 }, async () => {
    expect(collection.cards.length).toBeGreaterThan(50);
    for (const card of collection.cards) {
      expect(await cardFaceLint(card, collection), `${card.id} wording`).toEqual([]);
      const png = await renderCardFace(card, collection, 'front');
      expect(png.subarray(0, 8).equals(PNG_SIGNATURE), card.id).toBe(true);
      expect(await sharp(png).metadata(), card.id).toMatchObject({ format: 'png', width: 750, height: 1050 });
    }
  });

  it('lints a spread of backs (every team and sponsor, every third competitor) and draws a sample', { timeout: 120_000 }, async () => {
    for (const [index, card] of collection.cards.entries()) {
      const { model, names } = cardFaceModel(card, collection);
      if (model.kind === 'competitor' && index % 3 !== 0) continue;
      expect(lintNode(await backNode(model, { namesById: names }), careerNames(model)), `${card.id} back wording`).toEqual([]);
      if (index % 12 !== 0) continue;
      const png = await renderCardFace(card, collection, 'back');
      expect(png.subarray(0, 8).equals(PNG_SIGNATURE), card.id).toBe(true);
      expect(await sharp(png).metadata(), card.id).toMatchObject({ format: 'png', width: 750, height: 1050 });
      expect(png.length, `${card.id} back size`).toBeLessThan(600_000);
    }
  });

  it('draws a 1200 x 630 share preview for a competitor, a sponsor and a team, with clean wording', { timeout: 60_000 }, async () => {
    for (const id of ['person-ivan-sorokin-2026', 'person-francois-chollet-2026', 'team-turducken-2026']) {
      const card = cardById(id);
      expect(await sharp(await buildCollectionShareImage(card, collection)).metadata(), id).toMatchObject({ format: 'png', width: 1200, height: 630 });
      expect(lintNode(await buildCollectionShareNode(card, collection, null), careerNames(cardFaceModel(card, collection).model)), id).toEqual([]);
    }
  });
});

describe('tier recipes', () => {
  /** Mean colour of a region of the same card drawn as `tier`: the left border strip between the corner pieces, or the top-left corner piece. */
  async function regionMean(tier: string, region: 'strip' | 'corner'): Promise<number[]> {
    const card = collection.cards.find(item => item.career?.tier === 'Expert') ?? cardById('person-ivan-sorokin-2026');
    const png = await renderCardFace(card, collection, 'front', { tierOverride: tier });
    const box = region === 'strip' ? { left: 3, top: 300, width: Math.max(4, BORDER - 6), height: 400 } : { left: 0, top: 0, width: 64, height: 64 };
    // stats() ignores a pending extract, so crop to a buffer first.
    const { channels } = await sharp(await sharp(png).extract(box).toBuffer()).stats();
    return channels.slice(0, 3).map(c => c.mean);
  }
  const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

  it('draws Master and Grandmaster borders that differ from Expert (and from each other)', { timeout: 60_000 }, async () => {
    const [expert, master, grandmaster] = [await regionMean('Expert', 'strip'), await regionMean('Master', 'strip'), await regionMean('Grandmaster', 'strip')];
    expect(distance(master, expert)).toBeGreaterThan(25);
    expect(distance(grandmaster, expert)).toBeGreaterThan(25);
    // Master and Grandmaster are both foil; their corner pieces (brackets versus a starburst) are what set them apart.
    expect(distance(await regionMean('Grandmaster', 'corner'), await regionMean('Master', 'corner'))).toBeGreaterThan(15);
  });

  it('warns once for a tier name that is not in the table', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(tierByName('Wizard Class')).toBeNull();
      expect(tierByName('Wizard Class')).toBeNull();
      expect(tierByName('wizard class'.toUpperCase())).toBeNull();   // a different spelling is a different name: one more warning
      expect(warn.mock.calls.filter(call => String(call[0]).includes('Wizard Class'))).toHaveLength(1);
      expect(tierByName('grandmaster')?.key).toBe('Grandmaster');    // the ladder is matched case-insensitively
    } finally { warn.mockRestore(); }
  });
});

describe('looks, sets and caches', () => {
  it('registers the Topps look and falls back to the newest look, warning once, for an unknown key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(registeredLooks()).toContain('topps86');
      expect(lookFor('topps86').key).toBe('topps86');
      const newest = registeredLooks().at(-1)!;
      expect(lookFor('retro-2031').key).toBe(newest);
      expect(lookFor('retro-2031').key).toBe(newest);
      expect(warn.mock.calls.filter(call => String(call[0]).includes('retro-2031'))).toHaveLength(1);
    } finally { warn.mockRestore(); }
  });

  it('draws a card of a season with no set row in the newest set, warning once', { timeout: 30_000 }, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const odd = { ...cardById('team-turducken-2026'), season: '2031' };
      const png = await renderCardFace(odd, collection, 'front');
      expect(await sharp(png).metadata()).toMatchObject({ width: 750, height: 1050 });
      await renderCardFace(odd, collection, 'front');
      expect(warn.mock.calls.filter(call => String(call[0]).includes('season 2031'))).toHaveLength(1);
      expect(cardFaceModel(odd, collection).model.series.season).toBe('2031');
    } finally { warn.mockRestore(); }
  });

  it('enriches once per collection content, even though every read of the files returns a new object', () => {
    const first = cardFaceModel(cardById('person-ivan-sorokin-2026'), collection).model;
    const again = cardFaceModel(cardById('person-ivan-sorokin-2026'), structuredClone(collection)).model;
    expect(again).toBe(first);
  });

  it('puts the render version into every image address', () => {
    expect(Number.isInteger(RENDER_VERSION) && RENDER_VERSION >= 2).toBe(true);
    const card = cardById('team-turducken-2026');
    expect(collectionShareVersion(card)).toBe(collectionShareVersion(structuredClone(card)));
    expect(collectionShareVersion({ ...card, name: `${card.name} corrected` })).not.toBe(collectionShareVersion(card));
  });

  it('serves thumbnails as WebP at the requested width, clamped to 120 to 750', { timeout: 30_000 }, async () => {
    const card = cardById('person-ivan-sorokin-2026');
    const version = collectionShareVersion(card);
    for (const [asked, got] of [[360, 360], [50, 120], [5000, 750]] as const) {
      const thumb = await renderCardThumb(card, collection, 'front', asked, version);
      expect(await sharp(thumb).metadata()).toMatchObject({ format: 'webp', width: got });
    }
    expect(await renderCardThumb(card, collection, 'front', 360, version)).toBe(await renderCardThumb(card, collection, 'front', 360, version));
    expect(await sharp(await renderCardThumb(card, collection, 'back', 240, version)).metadata()).toMatchObject({ format: 'webp', width: 240 });
  });
});
