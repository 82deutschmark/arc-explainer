/**
 * Author: GPT-6 / Codex; GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: Verify the collectible export's portable PNG, intact CJK lettering and local-only
 *          artwork boundary using the complete linked-card contract, without system fonts or a server.
 * SRP/DRY check: Pass — the existing renderer receives the same contract as collection pages.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { CollectionCard } from '../shared/newsCollection';
import { buildCollectionCardImage } from '../server/services/news/newsCollectionImage';

const card = (overrides: Partial<CollectionCard> = {}): CollectionCard => ({
  id: 'export-test', number: 'T001', kind: 'team', name: 'The Test Contenders', season: '2026',
  profileUrl: '/news/cards', cardUrl: '/news/cards/export-test', teamHistory: [], art: null, description: '', highlights: [], accounts: [], entries: [],
  honors: [], artNotes: [], ...overrides,
});

describe('Card Cabinet PNG export', () => {
  it('renders a 750 by 1050 PNG while leaving the source artwork unchanged', async () => {
    const src = '/news-images/references/2026-10-29-japanese-ensemble-avatar-v1-base.webp';
    const artwork = path.join(process.cwd(), 'client/public', src.slice(1));
    const before = await fs.readFile(artwork);
    const png = await buildCollectionCardImage(card({ art: { src, alt: 'Eight complete avatars', credit: 'Commissioned editorial art' } }));
    const metadata = await sharp(png).metadata();
    expect(metadata).toMatchObject({ format: 'png', width: 750, height: 1050 });
    expect(await fs.readFile(artwork)).toEqual(before);
  });

  it('keeps distinct Japanese names in the rendered lettering and supports an initials-only card', async () => {
    const first = await buildCollectionCardImage(card({ name: '復活の混テキスト' }));
    const second = await buildCollectionCardImage(card({ name: '未来の混テキスト' }));
    // Equal-length names must not collapse into the same Latin-only or missing-glyph image.
    expect(first.equals(second)).toBe(false);
    expect(await sharp(first).metadata()).toMatchObject({ width: 750, height: 1050 });
  });

  it('rejects remote/private/traversal paths and an artwork symlink escaping the public image directory', async () => {
    for (const src of ['https://example.com/art.png', '/etc/passwd', '/news-images/../private.png', '/news-images/%2e%2e/private.png']) {
      await expect(buildCollectionCardImage(card({ art: { src, alt: 'Rejected source', credit: 'Test' } }))).rejects.toThrow('Invalid collection artwork path');
    }
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'collection-export-outside-'));
    const inside = await fs.mkdtemp(path.join(process.cwd(), 'client/public/news-images', 'collection-export-test-'));
    try {
      const externalImage = path.join(outside, 'private.png');
      await fs.writeFile(externalImage, await sharp({ create: { width: 2, height: 2, channels: 3, background: '#008800' } }).png().toBuffer());
      await fs.symlink(externalImage, path.join(inside, 'escape.png'));
      const src = `/news-images/${path.basename(inside)}/escape.png`;
      await expect(buildCollectionCardImage(card({ art: { src, alt: 'Rejected symlink', credit: 'Test' } }))).rejects.toThrow('Invalid collection artwork path');
    } finally {
      await fs.rm(inside, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});
