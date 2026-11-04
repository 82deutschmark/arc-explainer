/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 03-November-2026
 * PURPOSE: Check that the approved re card uses separate front and back pictures and
 * retains the complete dated career table over an uncropped picture on its reverse.
 * SRP/DRY check: Pass — exercise the real wiki projection and existing card renderer.
 */
import { expect, it } from 'vitest';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { cardFaceModel, renderCardFace } from '../server/services/news/cardFace';
import { backNode } from '../server/services/news/cardFace/back';
import { textOf } from '../server/services/news/cardFace/lint';

it('keeps both selected pictures and the complete career on re’s art-led card', async () => {
  const collection = getNewsCollection();
  const card = collection.cards.find(item => item.id === 'person-refv00-2026')!;
  expect(card.art?.src).toContain('refv00-solo-v2.webp');
  expect(card.backArt?.src).toContain('refv00-solo-v5.webp');
  expect(card.career?.rows).toHaveLength(8);
  const { model, names } = cardFaceModel(card, collection);
  const node: any = await backNode(model, { namesById: names, backPicture: card.backArt!.src });
  const background = node.props.children[0];
  expect(background.type).toBe('img');
  const image = Buffer.from(background.props.src.split(',')[1], 'base64');
  expect(await sharp(image).metadata()).toMatchObject({ width: 750, height: 1050 });
  const source = await readFile('client/public' + card.backArt!.src);
  const uncropped = await sharp(source).resize(750, 1050, { fit: 'contain', background: '#c9c5b8' }).jpeg({ quality: 90 }).toBuffer();
  expect(image.equals(uncropped)).toBe(true);
  const words = textOf(node).join(' ');
  expect(words).toContain('NeuroGolf');
  expect(words).toContain('Nemotron');
  expect(words).toContain('8 CONTESTS');
  expect(await sharp(await renderCardFace(card, collection, 'back')).metadata()).toMatchObject({ width: 750, height: 1050 });
}, 30_000);
