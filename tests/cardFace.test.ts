/**
 * Author: Claude Sonnet 5.5 Low; Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): cards with a public (not final) standing, before and after the close, print clean wording
 *          (CLOSED stamp, "Snapshot" label); the image version follows teammates' careers and the close; tier counts are per
 *          set and per person; a long set name fits the pennant and long figures fit their columns.
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
import { cardFaceLint, cardFaceModel, cardFaceNode, lookFor, registeredLooks, renderCardFace, renderCardThumb, RENDER_VERSION } from '../server/services/news/cardFace';
import { backNode } from '../server/services/news/cardFace/back';
import { lintNode, careerNames, textOf } from '../server/services/news/cardFace/lint';
import { FONT, textWidth, type Node } from '../server/services/news/cardFace/kit';
import { viewModel } from '../server/services/news/cardFace/model';
import { backModel } from '../server/services/news/cardFace/backModel';
import { setById, setForSeason } from '../server/services/news/cardFace/sets';
import { tierByName } from '../server/services/news/cardFace/tiers';
import { BORDER } from '../server/services/news/cardFace/zones';
import { buildCollectionShareImage, buildCollectionShareNode } from '../server/services/news/newsCollectionShareImage';
import { collectionShareVersion, type CollectionCard } from '../shared/newsCollection';
import { KAGGLE_COMPETITIONS } from '../shared/kaggleCompetitions';

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

  it('draws a 1200 x 630 share preview for a competitor and a team, with clean wording', { timeout: 60_000 }, async () => {
    for (const id of ['person-ivan-sorokin-2026', 'team-turducken-2026']) {
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

/** A card whose every standing is a dated public reading (no final result yet), as the next board snapshot will make them. */
function withPublicStanding(card: CollectionCard): CollectionCard {
  return { ...structuredClone(card), entries: card.entries.map((entry, index) => ({ ...structuredClone(entry), status: 'public' as const,
    observedAt: '2026-11-10T02:00:00Z', rank: 12 + index, score: 0.4166, submissions: 31, peakRank: 9 + index })) };
}
const closeOf = (card: CollectionCard) => Math.max(...card.entries.map(entry => Date.parse(KAGGLE_COMPETITIONS[entry.competition]?.closeAt ?? '')));

describe('public standings and the close', () => {
  const person = cardById('person-ivan-sorokin-2026'), team = cardById('team-turducken-2026');

  it('prints clean wording on a competitor and a team with a public standing (front, back, share preview)', { timeout: 60_000 }, async () => {
    for (const card of [withPublicStanding(person), withPublicStanding(team)]) {
      expect(card.entries.length, card.id).toBeGreaterThan(0);
      expect(await cardFaceLint(card, collection), `${card.id} front`).toEqual([]);
      const { model, names } = cardFaceModel(card, collection);
      expect(lintNode(await backNode(model, { namesById: names }), careerNames(model)), `${card.id} back`).toEqual([]);
      expect(lintNode(await buildCollectionShareNode(card, collection, null), careerNames(model)), `${card.id} share`).toEqual([]);
    }
  });

  it('stamps a public reading LIVE before the close and CLOSED after it, with the off-peak note only under LIVE', () => {
    const { model } = cardFaceModel(withPublicStanding(person), collection);
    const close = closeOf(person);
    expect(Number.isFinite(close)).toBe(true);
    const before = viewModel(model, { now: close - 60_000 }), after = viewModel(model, { now: close + 60_000 });
    expect(before.stamp?.word).toBe('LIVE');
    expect(after.stamp?.word).toBe('CLOSED');
    expect(backModel(before).standings.some(row => /OFF PEAK/.test(row.note ?? ''))).toBe(true);
    expect(backModel(after).standings.some(row => /OFF PEAK|AT PEAK/.test(row.note ?? ''))).toBe(false);
  });

  it('gives a card a new image version when it closes', () => {
    const card = withPublicStanding(person), close = closeOf(person);
    expect(collectionShareVersion(card, collection, close - 1)).not.toBe(collectionShareVersion(card, collection, close + 1));
    expect(collectionShareVersion(card, collection, close + 1)).toBe(collectionShareVersion(card, collection, close + 2));
  });
});

describe('what a card prints about other cards', () => {
  it('changes the image version when a teammate\'s tier or medals change', () => {
    const mate = collection.cards.find(card => card.kind === 'person' && card.personId && card.career)!;
    expect(mate, 'a person with a saved career').toBeTruthy();
    const base = collection.cards.find(card => card.kind === 'team' && card.entries.length)!;
    const team: CollectionCard = { ...structuredClone(base), entries: [{ ...structuredClone(base.entries[0]), members: [{ handle: 'teammate-handle', name: mate.name, personId: mate.personId }] }] };
    const cards = collection.cards;
    const before = collectionShareVersion(team, { cards, sets: collection.sets });
    const medals = mate.career!.medals ?? { gold: 0, silver: 0, bronze: 0 };
    const medalled = cards.map(card => card.id === mate.id ? { ...card, career: { ...card.career!, medals: { ...medals, gold: medals.gold + 1 } } } : card);
    expect(collectionShareVersion(team, { cards: medalled, sets: collection.sets })).not.toBe(before);
    expect(collectionShareVersion(team, { cards, sets: collection.sets })).toBe(before);
  });

  it('counts each tier once per person, within the card\'s own set, and names that set', () => {
    for (const card of collection.cards.filter(item => item.kind === 'person' && item.role === 'competitor')) {
      const { model } = cardFaceModel(card, collection);
      const line = (model.facts as { text: string }[]).map(fact => fact.text).find(text => /^One of \d+ /.test(text));
      if (!line) continue;
      const [, count, tier, setName] = /^One of (\d+) (\w+)s in the (.+) set\.$/.exec(line)!;
      const setOf = (item: CollectionCard) => (item.setId ? setById(item.setId) : setForSeason(item.season))?.id;
      const setId = setOf(card);
      expect(setName.startsWith(setById(setId!)!.name), `${card.id}: ${line}`).toBe(true);
      const people = new Set(collection.cards.filter(other => other.kind === 'person' && other.role === 'competitor' && other.personId
        && setOf(other) === setId
        && cardFaceModel(other, collection).model.tier === tier).map(other => other.personId));
      expect(Number(count), `${card.id}: ${line}`).toBe(people.size);
    }
  });
});

describe('measured lettering', () => {
  /** Every text node in a tree with its font family, size and letter spacing (inherited from the nearest styled ancestor). */
  function runs(node: unknown, inherited: Record<string, any> = {}, out: { text: string; style: Record<string, any> }[] = []) {
    if (typeof node === 'string') { out.push({ text: node, style: inherited }); return out; }
    if (Array.isArray(node)) { for (const kid of node) runs(kid, inherited, out); return out; }
    const props = (node as Node | null)?.props;
    if (props?.children !== undefined) runs(props.children, { ...inherited, ...(props.style ?? {}) }, out);
    return out;
  }

  it('fits a long set name on the pennant (one line or two, each within the pennant)', { timeout: 30_000 }, async () => {
    const card = collection.cards.find(item => item.setId?.startsWith('gemma'))!;
    expect(card, 'a card in the Gemma set').toBeTruthy();
    const { model } = cardFaceModel(card, collection);
    const name = String(model.series.name).toUpperCase();
    const tree = await cardFaceNode(card, collection);
    const lines = runs(tree).filter(run => run.text && name.includes(run.text) && String(run.style.fontFamily ?? '').startsWith(FONT.bebas) && run.text.length > 3);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.map(run => run.text).join(' ')).toBe(name);
    for (const run of lines) expect(await textWidth(run.text, FONT.bebas, 400, run.style.fontSize, run.style.letterSpacing ?? 0), run.text).toBeLessThanOrEqual(285);
  });

  it('sizes a long rank and score to their columns on the front', { timeout: 30_000 }, async () => {
    const card = withPublicStanding(cardById('team-turducken-2026'));
    card.entries = card.entries.map(entry => ({ ...entry, rank: 12_345, score: 0.41666666 }));
    const tree = await cardFaceNode(card, collection);
    const figures = runs(tree).filter(run => run.text === '#12,345' || run.text === '0.41666666');
    expect(figures.length).toBeGreaterThan(0);
    for (const run of figures) {
      const family = String(run.style.fontFamily).split(',')[0];
      const width = run.text.startsWith('#') ? 140 : 108;
      expect(await textWidth(run.text, family, run.style.fontWeight ?? 400, run.style.fontSize, run.style.letterSpacing ?? 0), run.text).toBeLessThanOrEqual(width);
    }
    expect(textOf(tree)).toContain('#12,345');
  });
});
