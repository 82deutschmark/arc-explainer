/*
Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Verify public ID round trips and real catalog/source resolution while
preserving legacy telemetry identities. Uses the shipped local catalog and upstream
catalog, without mocking source responses.
SRP/DRY check: Pass — calls the shared resolver and the production catalog service.
*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { ARC3_PUBLIC_IDS, canonicalGameId, publicGameId } from '../shared/arc3PublicIds.ts';
import { Arc3MirrorCatalog } from '../server/services/arc3Mirror/Arc3MirrorCatalog.ts';
import { usesAuthoredZKey } from '../shared/arc3ContributedControls.ts';

test('all 44 contributed games have permanent names matching the research registry', async () => {
  const registry = JSON.parse(await readFile(new URL('../shared/arc3EvolutionIds.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../server/data/arc3-games/manifest.json', import.meta.url), 'utf8'));
  const contributed = manifest.filter((game: { category: string }) => game.category === 'contributed-glowup');
  assert.equal(contributed.length, 44);
  assert.equal(Object.keys(registry.game_ids).length, 50);
  for (const game of contributed) {
    assert.equal(publicGameId(game.id), registry.published_public_ids[game.id]);
    assert.notEqual(publicGameId(game.id), game.id);
    const oldSource = await Arc3MirrorCatalog.getSource(game.id);
    const renamedSource = await Arc3MirrorCatalog.getSource(publicGameId(game.id));
    assert.ok(oldSource && renamedSource);
    assert.equal(renamedSource.sourceVersion, oldSource.sourceVersion);
    assert.equal(renamedSource.sourceCode, oldSource.sourceCode);
  }
  assert.equal(publicGameId('g512'), 'pm12');
});

test('public IDs resolve both ways without changing storage IDs', () => {
  assert.equal(new Set(Object.values(ARC3_PUBLIC_IDS)).size, Object.keys(ARC3_PUBLIC_IDS).length);
  for (const [legacy, visible] of Object.entries(ARC3_PUBLIC_IDS)) {
    assert.match(visible, /^[a-z]{2}[0-9]{2}$/);
    assert.equal(canonicalGameId(visible.toUpperCase()), legacy);
    assert.equal(canonicalGameId(legacy.toUpperCase()), legacy);
    assert.equal(publicGameId(legacy), visible);
    assert.equal(publicGameId(visible), visible);
  }
  assert.equal(Object.keys(ARC3_PUBLIC_IDS).length, 44);
  assert.equal(publicGameId('g034'), 'g034');
  assert.equal(publicGameId('ls20'), 'ls20');
  assert.equal(canonicalGameId('not-a-game'), 'not-a-game');
});

test('real catalog has no alias collisions and source is identical through old/new URLs', async () => {
  const games = await Arc3MirrorCatalog.listGames();
  assert.ok(games.length >= 94);
  for (const [legacy, visible] of Object.entries(ARC3_PUBLIC_IDS)) {
    assert.ok(!games.some((g) => g.gameId === visible), `${visible} collides with another game`);
    assert.equal((await Arc3MirrorCatalog.getGame(visible))?.gameId, legacy);
  }
  const oldSource = await Arc3MirrorCatalog.getSource('g500');
  const newSource = await Arc3MirrorCatalog.getSource('ks01');
  assert.ok(oldSource && newSource);
  assert.equal(newSource.sourceVersion, oldSource.sourceVersion);
  assert.equal(newSource.sourceCode, oldSource.sourceCode);
  assert.equal(newSource.gameId, 'g500');
});

test('only the four frozen revisions use their printed Z action binding', () => {
  for (const id of ['g500', 'ks01', 'g502', 'ey09', 'g519', 'pc70', 'g542', 'aq93']) {
    assert.equal(usesAuthoredZKey(id), true);
  }
  for (const id of [undefined, 'g034', 'ls20', 'g501', 'yc02', 'g543', 'gv00']) {
    assert.equal(usesAuthoredZKey(id), false);
  }
});
