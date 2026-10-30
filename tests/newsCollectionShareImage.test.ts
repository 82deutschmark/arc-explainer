/**
 * Author: Claude Sonnet 5.5 Low (rewrites GPT-6 / Codex's tests of 29-Oct-2026)
 * Date: 30-Oct-2026
 * PURPOSE: The 1200 x 630 link preview in the Topps look: exact size, the real front render at the left (not a re-draw),
 *          the name, tier line, lead contest rank and score and the single AS OF date at the right, Japanese names, a card
 *          with no art, and image addresses that change with the content.
 * SRP/DRY check: Pass. Production cards and the actual render tree.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { buildCollectionShareImage, buildCollectionShareNode } from '../server/services/news/newsCollectionShareImage';
import { renderCardFace } from '../server/services/news/cardFace';
import { textOf } from '../server/services/news/cardFace/lint';
import { collectionCardDescription, collectionSharePath, type CollectionCard } from '../shared/newsCollection';

const collection = getNewsCollection();
const byId = (id: string) => collection.cards.find(card => card.id === id)!;

it('advertises the exact landscape PNG and draws the card’s real front at the left', { timeout: 30_000 }, async () => {
  const card = byId('team-turducken-2026');
  const png = await buildCollectionShareImage(card, collection);
  expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
  // The left picture is the front render scaled to 433 x 606; compare it with the same scaling done here.
  const front = await sharp(await renderCardFace(card, collection, 'front', { flatten: '#f7f0df' })).resize(433, 606, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  const actual = await sharp(png).extract({ left: 12, top: 12, width: 433, height: 606 }).removeAlpha().raw().toBuffer();
  let off = 0;
  for (let i = 0; i < front.length; i += 97) off += Math.abs(front[i] - actual[i]);
  expect(off / Math.ceil(front.length / 97)).toBeLessThan(6);
  const source = path.join(process.cwd(), 'client/public', card.art!.src.slice(1));
  expect((await fs.stat(source)).isFile()).toBe(true);
});

it('competitor previews carry the name, tier line, lead rank and score and the as-of date', async () => {
  const card = byId('person-ivan-sorokin-2026');
  const text = textOf(await buildCollectionShareNode(card, collection, null)).join('\n');
  expect(text).toContain('Ivan Sorokin');
  expect(text).toContain('KAGGLE GRANDMASTER');
  expect(text).toContain('RANK');
  expect(text).toContain('SCORE');
  expect(text).toMatch(/AS OF [A-Z]{3} \d{1,2}/u);
  expect(text).toContain('ARC.MARKBARNEY.NET');
  expect(collectionCardDescription(card)).toContain('Ivan Sorokin');
});

it('refreshes preview URLs for corrected public content and replacement artwork', () => {
  const card = byId('team-turducken-2026');
  expect(collectionSharePath(card)).toBe(collectionSharePath(structuredClone(card)));
  expect(collectionSharePath({ ...card, name: card.name + ' corrected' })).not.toBe(collectionSharePath(card));
  expect(collectionSharePath({ ...card, art: { ...card.art!, src: '/news-images/corrected-art.webp' } })).not.toBe(collectionSharePath(card));
});

it('retains Japanese names and previews a card with no art', { timeout: 30_000 }, async () => {
  const card: CollectionCard = { ...byId('team-turducken-2026'), name: '復活の混テキスト', art: null };
  expect(textOf(await buildCollectionShareNode(card, collection, null)).join('\n')).toContain(card.name);
  expect(await sharp(await buildCollectionShareImage(card, collection)).metadata()).toMatchObject({ width: 1200, height: 630 });
});
