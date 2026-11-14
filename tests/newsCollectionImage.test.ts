/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Sonnet 5.5 Low (rewrites GPT-6 / Codex's tests of 29-Oct-2026); Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): a dated public reading is labelled "Snapshot", the card lint's wording (W24).
 * 09-Nov-2026 (GPT-6 / Codex): verified story casts and per-contest team card evidence.
 * 09-Nov-2026 (GPT-6 / Codex): contest card evidence and regression checks.
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
  ...collection.cards.find(item => item.id === 'team-turducken-2026')!, id: 'export-test', name: 'The Test Contenders',
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

  it.each(['mark-barney', 'son-pham'])('draws %s’s permanent profile without inventing unavailable current standings', { timeout: 30_000 }, async personId => {
    const person = collection.cards.find(item => item.personId === personId)!;
    const text = drawn(await cardFaceNode(person, collection));
    expect(person.entries.every(entry => entry.status === 'unavailable' && entry.rank == null && entry.score == null)).toBe(true);
    expect(cardFaceModel(person, collection).model.status).not.toBe('final');
    expect(text).not.toMatch(/\b[PT]\d{3}\b/);   // no invented card numbers on the face
    expect(text).not.toMatch(/RANK #|SCORE [0-9]/);
    expect(await sharp(await buildCollectionCardImage(person, collection)).metadata()).toMatchObject({ format: 'png', width: 750, height: 1050 });
  });

  it('draws the competitor ledger with career and teammates while retaining its share address', { timeout: 30_000 }, async () => {
    const person = collection.cards.find(item => item.personId === 'mark-barney')!;
    const { model, names } = cardFaceModel(person, collection);
    const text = drawn(await backNode(model, { namesById: names }));
    expect(model.urlAbsolute).toBe(`https://arc.markbarney.net${person.cardUrl}`);
    expect(text).toContain('KAGGLE COMPETITIONS');
    expect(text).toContain('Team Turducken');
    expect(text).not.toContain('arc.markbarney.net');
    expect(model.pastTeams.some((team: any) => team.team === 'Team Turducken')).toBe(true);
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

it('prints only the matching contest status and date on each Tufa card', async () => {
  const fixtures = [
    { id: 'team-tufa-labs-arc-2-2026', status: 'public' as const, observedAt: '2026-11-10T02:00:00Z', label: 'Snapshot · 10 Nov 2026 UTC', otherContest: 'ARC-AGI-3' },
    { id: 'team-tufa-labs-arc-3-2026', status: 'final' as const, observedAt: '2026-11-11T02:00:00Z', label: 'Final result · 11 Nov 2026 UTC', otherContest: 'ARC-AGI-2' },
  ];
  for (const { id, status, observedAt, label, otherContest } of fixtures) {
    const tufa = collection.cards.find(item => item.id === id)!;
    const fixture = { ...tufa, entries: tufa.entries.map(entry => ({ ...entry, status, observedAt, rank: 1 })) };
    const fixtureCollection = { ...collection, cards: collection.cards.map(item => item.id === id ? fixture : item) };
    const front = drawn(await cardFaceNode(fixture, fixtureCollection));
    const { model, names } = cardFaceModel(fixture, fixtureCollection);
    const reverse = drawn(await backNode(model, { namesById: names }));
    for (const text of [front, reverse]) {
      expect(text).toContain(label);
      expect(text).not.toContain(otherContest);
      expect(text).not.toContain('AS OF');
    }
  }
});
