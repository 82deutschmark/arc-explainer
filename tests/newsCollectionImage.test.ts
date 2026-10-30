/**
 * Author: GPT-6 / Codex; GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: Verify portable front/back PNGs, both player teams and dated standings, sourced
 *          Kaggle career records, explicit overflow continuation, CJK lettering and local-only
 *          artwork boundaries using the production layout, without system fonts or a server.
 * SRP/DRY check: Pass — the existing renderer receives the same contract as collection pages.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import satori from 'satori';
import type { CollectionCard } from '../shared/newsCollection';
import { buildCollectionCardImage, buildCollectionCardNode, loadCollectionCardFonts } from '../server/services/news/newsCollectionImage';
import { getNewsCollection } from '../server/services/news/newsCollection';

function drawnText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(drawnText).join('\n');
  if (node && typeof node === 'object' && 'props' in node && node.props && typeof node.props === 'object' && 'children' in node.props) {
    return drawnText(node.props.children);
  }
  return '';
}

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

  it.each(['mark-barney', 'son-pham'])('draws both actual contest teams and dated team standings on %s’s front', async personId => {
    const player = getNewsCollection().cards.find(item => item.personId === personId)!;
    const text = drawnText(await buildCollectionCardNode(player));
    expect(text).toContain('Team Turducken');
    expect(text).toContain('ARC Mutants');
    expect(text).toContain('ARC-AGI-3');
    expect(text).toContain('ARC-AGI-2');
    expect(text).toContain('Player · 2026');
    expect(text).toContain(player.highlights[0].text);
    for (const entry of player.entries) {
      expect(text).toContain(`#${entry.rank!.toLocaleString('en-US')}`);
      expect(text).toContain(entry.score!.toFixed(2));
    }
    expect(text.match(/Public · provisional/gu)).toHaveLength(2);
    expect(text.match(/(?:EDT|EST)/gu)).toHaveLength(2);
    expect(text).toContain('Team rank');
    expect(await sharp(await buildCollectionCardImage(player)).metadata()).toMatchObject({ format: 'png', width: 750, height: 1050 });
  });

  it('draws Mark’s complete concise sourced career and account on an actual reverse PNG', async () => {
    const player = getNewsCollection().cards.find(item => item.personId === 'mark-barney')!;
    const text = drawnText(await buildCollectionCardNode(player, 'back'));
    for (const highlight of player.highlights) expect(text).toContain(highlight.text);
    expect(text).toContain('Team Turducken');
    expect(text).toContain('ARC Mutants');
    expect(text).toContain('Sources · full links in the online record');
    expect(text).toContain('checked Oct');
    expect(text).toContain('www.kaggle.com/markbarney');
    expect(text).toContain(`arc.markbarney.net${player.cardUrl}`);
    const reverse = await buildCollectionCardImage(player, 'back');
    expect(await sharp(reverse).metadata()).toMatchObject({ format: 'png', width: 750, height: 1050 });
    expect(reverse.equals(await buildCollectionCardImage(player))).toBe(false);
  });

  it('draws Son’s complete researched career and own public account on the reverse', async () => {
    const player = getNewsCollection().cards.find(item => item.personId === 'son-pham')!;
    const text = drawnText(await buildCollectionCardNode(player, 'back'));
    for (const highlight of player.highlights) expect(text).toContain(highlight.text);
    expect(text).toContain('Team Turducken');
    expect(text).toContain('ARC Mutants');
    expect(text).toContain('Sources · full links in the online record');
    expect(text).toContain('www.kaggle.com/sonphamorg');
    expect(text).toContain(`arc.markbarney.net${player.cardUrl}`);
    expect(text).not.toContain('Record continues online');
    const reverse = await buildCollectionCardImage(player, 'back');
    expect(await sharp(reverse).metadata()).toMatchObject({ format: 'png', width: 750, height: 1050 });
  });

  it('labels a long reverse as continued online while retaining both teams and its public account', async () => {
    const player = getNewsCollection().cards.find(item => item.personId === 'mark-barney')!;
    const longer = { ...player, highlights: Array.from({ length: 24 }, (_, index) => ({
      text: `Historical competition ${index + 1}: ${'A sourced historical observation with a dated competition result. '.repeat(5)}`,
      sourceTitle: `Public historical competition source ${index + 1}`, sourceUrl: `https://www.kaggle.com/competitions/history-${index + 1}`,
      checkedAt: '2026-10-29T20:00:00Z',
    })) };
    const node = await buildCollectionCardNode(longer, 'back');
    const text = drawnText(node);
    expect(text).toContain('Record continues online');
    expect(text).toContain('Historical competition 1:');
    expect(text).not.toContain('Historical competition 24:');
    expect(text).toContain('Team Turducken');
    expect(text).toContain('ARC Mutants');
    expect(text).toContain(`arc.markbarney.net${player.cardUrl}`);
    expect(text).toContain('www.kaggle.com/markbarney');
    let bodyBottom = 0;
    await satori(node as Parameters<typeof satori>[0], { width: 750, height: 1050, fonts: loadCollectionCardFonts(),
      onNodeDetected: detected => {
        if (detected.props.id === 'collection-back-body') bodyBottom = detected.top + detected.height;
      },
    });
    expect(bodyBottom).toBeGreaterThan(0);
    expect(bodyBottom).toBeLessThanOrEqual(920);
  });

  it('distinguishes an earlier team from a stale observation without inventing a departure date', async () => {
    const dated = { competition: 'arc-3' as const, competitionId: 'arc-prize-2026-arc-agi-3', season: '2026',
      memberHandle: 'test-player', firstObservedAt: '2026-10-01T12:00:00Z', lastObservedAt: '2026-10-02T12:00:00Z',
      sourceUrl: 'https://example.com/saved-test-roster', sourceTitle: 'Saved test roster', profileUrl: '/news/cards' };
    const player = card({ kind: 'person', teamHistory: [
      { ...dated, teamId: '100', teamName: 'Earlier Test Team', status: 'previous' },
      { ...dated, teamId: '200', teamName: 'Unconfirmed Test Team', status: 'last-observed' },
    ] });
    const text = drawnText(await buildCollectionCardNode(player, 'back'));
    expect(text).toContain('Earlier Test Team');
    expect(text).toContain('Earlier team observed Oct 1, 2026–Oct 2, 2026');
    expect(text).toContain('Unconfirmed Test Team');
    expect(text).toContain('Last observed Oct 1, 2026–Oct 2, 2026');
    expect(text).not.toMatch(/joined|departed/u);
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
