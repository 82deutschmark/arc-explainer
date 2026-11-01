/**
 * Author: Claude Sonnet 5.5 Low (rewrites GPT-6 / Codex's tests of 29-Oct-2026)
 * Date: 30-Oct-2026
 * PURPOSE: The route-facing image functions (buildCollectionCardImage / buildCollectionCardThumb): portable 750 x 1050
 *          fronts and backs, both contest teams and the dated standings on a competitor's face, Japanese lettering, a card
 *          with no art, the unchanged source artwork, and the art-address boundary (no URLs, encoded paths, traversal or a
 *          link leaving the public image folder). The set-wide checks are in cardFace.test.ts.
 * SRP/DRY check: Pass. Uses the production collection and the same entry points the routes call.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { CollectionCard } from '../shared/newsCollection';
import { buildCollectionCardImage, buildCollectionCardThumb } from '../server/services/news/newsCollectionImage';
import { cardFaceNode } from '../server/services/news/cardFace';
import { backNode } from '../server/services/news/cardFace/back';
import { cardFaceModel } from '../server/services/news/cardFace';
import { textOf } from '../server/services/news/cardFace/lint';
import { getNewsCollection } from '../server/services/news/newsCollection';

const collection = getNewsCollection();
const drawn = (node: unknown) => textOf(node).join('\n');
const card = (overrides: Partial<CollectionCard> = {}): CollectionCard => ({
  ...collection.cards.find(item => item.id === 'team-turducken-2026')!, id: 'export-test', number: 'T001', name: 'The Test Contenders',
  cardUrl: '/news/cards/export-test', art: null, ...overrides,
});

describe('Card Cabinet PNG export', () => {
  it('renders a 750 by 1050 PNG while leaving the source artwork unchanged', { timeout: 30_000 }, async () => {
    const src = '/news-images/references/2026-10-29-japanese-ensemble-avatar-v1-base.webp';
    const artwork = path.join(process.cwd(), 'client/public', src.slice(1));
    const before = await fs.readFile(artwork);
    const png = await buildCollectionCardImage(card({ art: { src, alt: 'Eight complete avatars', credit: 'Commissioned editorial art' } }), collection);
    expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 750, height: 1050 });
    expect(await fs.readFile(artwork)).toEqual(before);
  });

  it('keeps distinct Japanese names in the lettering and draws a card with no art', { timeout: 30_000 }, async () => {
    const first = await buildCollectionCardImage(card({ name: '復活の混テキスト' }), collection);
    const second = await buildCollectionCardImage(card({ name: '未来の混テキスト' }), collection);
    expect(first.equals(second)).toBe(false);
    expect(await sharp(first).metadata()).toMatchObject({ width: 750, height: 1050 });
  });

  it.each(['mark-barney', 'son-pham'])('draws both contest teams and the dated standings on %s’s face', { timeout: 30_000 }, async personId => {
    const person = collection.cards.find(item => item.personId === personId)!;
    const text = drawn(await cardFaceNode(person, collection));
    expect(text).toContain('Team Turducken');
    expect(text).toContain('ARC Mutants');
    expect(text).toContain('ARC-AGI-3');
    expect(text).toContain('ARC-AGI-2');
    for (const entry of person.entries) {
      expect(text).toContain(`#${entry.rank!.toLocaleString('en-US')}`);
      expect(text).toContain(entry.score!.toFixed(2));
    }
    expect(text).not.toMatch(/\bplayer\b|provisional/iu);
    expect(await sharp(await buildCollectionCardImage(person, collection)).metadata()).toMatchObject({ format: 'png', width: 750, height: 1050 });
  });

  it('draws the reverse with the career, the teammates and the card’s own address', { timeout: 30_000 }, async () => {
    const person = collection.cards.find(item => item.personId === 'mark-barney')!;
    const { model, names } = cardFaceModel(person, collection);
    const text = drawn(await backNode(model, { namesById: names }));
    expect(text).toContain(`arc.markbarney.net${person.cardUrl}`);
    expect(text).toContain('Team Turducken');
    const reverse = await buildCollectionCardImage(person, collection, 'back');
    expect(await sharp(reverse).metadata()).toMatchObject({ format: 'png', width: 750, height: 1050 });
    expect(reverse.equals(await buildCollectionCardImage(person, collection))).toBe(false);
  });

  it('serves a thumbnail through the same entry point', { timeout: 30_000 }, async () => {
    const person = collection.cards[0];
    expect(await sharp(await buildCollectionCardThumb(person, collection, 'front', 300, 'v1')).metadata()).toMatchObject({ format: 'webp', width: 300 });
  });

  it('rejects remote, private and traversal paths and an artwork link escaping the public image directory', { timeout: 30_000 }, async () => {
    for (const src of ['https://example.com/art.png', '/etc/passwd', '/news-images/../private.png', '/news-images/%2e%2e/private.png']) {
      await expect(buildCollectionCardImage(card({ art: { src, alt: 'Rejected source', credit: 'Test' } }), collection)).rejects.toThrow('Invalid collection artwork path');
    }
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'collection-export-outside-'));
    const inside = await fs.mkdtemp(path.join(process.cwd(), 'client/public/news-images', 'collection-export-test-'));
    try {
      const externalImage = path.join(outside, 'private.png');
      await fs.writeFile(externalImage, await sharp({ create: { width: 2, height: 2, channels: 3, background: '#008800' } }).png().toBuffer());
      await fs.symlink(externalImage, path.join(inside, 'escape.png'));
      const src = `/news-images/${path.basename(inside)}/escape.png`;
      await expect(buildCollectionCardImage(card({ art: { src, alt: 'Rejected link', credit: 'Test' } }), collection)).rejects.toThrow('Invalid collection artwork path');
    } finally {
      await fs.rm(inside, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});
