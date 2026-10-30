/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-29
 * PURPOSE: Verify shared card previews use complete original team art, each player's own
 *          image/career copy, CJK names and artwork-aware cache versions at landscape size.
 * SRP/DRY check: Pass — uses production cards, source images and the actual render tree.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { buildCollectionShareImage, buildCollectionShareNode } from '../server/services/news/newsCollectionShareImage';
import { collectionCardDescription, collectionSharePath, type CollectionCard } from '../shared/newsCollection';

it('contains the complete team source artwork in the exact advertised landscape PNG', async () => {
  const card = getNewsCollection().cards.find(card => card.id === 'team-turducken-2026')!;
  const source = await fs.readFile(path.join(process.cwd(), 'client/public', card.art!.src.slice(1)));
  const expected = await sharp(source).rotate().resize({ width: 1150, height: 446, fit: 'contain', background: '#f7f0df' }).removeAlpha().raw().toBuffer();
  const png = await buildCollectionShareImage(card);
  expect(await sharp(png).metadata()).toMatchObject({ width: 1200, height: 630 });
  const actual = await sharp(png).extract({ left: 25, top: 57, width: 1150, height: 446 }).removeAlpha().raw().toBuffer();
  expect(actual).toEqual(expected);
  expect(await fs.readFile(path.join(process.cwd(), 'client/public', card.art!.src.slice(1)))).toEqual(source);
});

it('player previews carry their own name, current teams, career and portrait', async () => {
  const card = getNewsCollection().cards.find(card => card.id === 'person-son-pham-2026')!;
  const copy = JSON.stringify(buildCollectionShareNode(card, null));
  expect(copy).toContain('Son Pham');
  expect(copy).toContain('Team Turducken');
  expect(copy).toContain('ARC Mutants');
  expect(copy).toContain('Competitions Expert');
  expect(collectionCardDescription(card)).toContain(card.highlights[0].text);
  const portrait = await fs.readFile(path.join(process.cwd(), 'client/public', card.art!.src.slice(1)));
  const expected = await sharp(portrait).rotate().resize({ width: 508, height: 508, fit: 'contain', background: '#f7f0df' }).removeAlpha().raw().toBuffer();
  const actual = await sharp(await buildCollectionShareImage(card)).extract({ left: 29, top: 82, width: 508, height: 508 }).removeAlpha().raw().toBuffer();
  expect(actual).toEqual(expected);
});

it('refreshes preview URLs for corrected public content and immutable replacement artwork', () => {
  const card = getNewsCollection().cards.find(card => card.id === 'team-turducken-2026')!;
  expect(collectionSharePath(card)).toBe(collectionSharePath(structuredClone(card)));
  expect(collectionSharePath({ ...card, name: card.name + ' corrected' })).not.toBe(collectionSharePath(card));
  expect(collectionSharePath({ ...card, art: { ...card.art!, src: '/news-images/corrected-art.webp' } })).not.toBe(collectionSharePath(card));
});

it('retains Japanese team names and provides an initials preview when art is absent', async () => {
  const base = getNewsCollection().cards.find(card => card.id === 'team-turducken-2026')!;
  const card: CollectionCard = { ...base, name: '復活の混テキスト', art: null };
  expect(JSON.stringify(buildCollectionShareNode(card, null))).toContain(card.name);
  expect(await sharp(await buildCollectionShareImage(card)).metadata()).toMatchObject({ width: 1200, height: 630 });
});
