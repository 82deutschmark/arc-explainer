/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-27
 * PURPOSE: Check real approved payloads, recorded thumbnails, and rejected corrupt manifest entries.
 * SRP/DRY check: Pass — use the shipped snapshot, public router and production catalog.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import router from '../../server/routes/arc3Mirror';
import { Arc3TrainableCatalog, trainablePlayId, validateTrainableManifest } from '../../server/services/arc3Mirror/Arc3TrainableCatalog';
import { Arc3MirrorCatalog } from '../../server/services/arc3Mirror/Arc3MirrorCatalog';
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express(); app.use('/api/arc3-mirror', router);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); });
describe('public approved games', () => {
  it('serves exactly the approved bytes, not an older local game under the same seed ID', async () => {
    const manifest = await Arc3TrainableCatalog.manifest();
    const response = await fetch(`${base}/api/arc3-mirror/games?collection=trainable`);
    const catalog = await response.json();
    expect(catalog.data.games.map((g: { gameId: string }) => g.gameId)).toEqual(manifest.versions.map(trainablePlayId));
    for (const version of manifest.versions) {
      const game = await Arc3MirrorCatalog.getSource(trainablePlayId(version));
      expect(game, version.gameId).not.toBeNull();
      expect(createHash('sha256').update(game!.sourceCode).digest('hex'), version.gameId).toBe(version.sha256);
      expect(game!.className).toBe(version.className);
    }
    const id = trainablePlayId(manifest.versions[0]);
    const source = await (await fetch(`${base}/api/arc3-mirror/games/${id}/source`)).json();
    expect(source.data.sourceVersion).toBe(manifest.versions[0].sha256.slice(0, 12));
    const image = await fetch(`${base}/api/arc3-mirror/games/${id}/thumbnail?size=512`);
    expect(image.status).toBe(200);
    const metadata = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
    expect([metadata.width, metadata.height]).toEqual([512, 512]);
  });
  it('rejects corrupted selection hashes and off-origin source paths', async () => {
    const seed = JSON.parse(await fs.readFile('server/data/arc3-trainable-games/manifest.json', 'utf8'));
    expect(validateTrainableManifest(seed).count).toBe(seed.count);
    const corrupt = structuredClone(seed);
    corrupt.snapshotId = '0'.repeat(64);
    expect(() => validateTrainableManifest(corrupt)).toThrow('snapshot hash mismatch');
    const remote = structuredClone(seed);
    remote.versions[0].sourceUrl = 'https://example.com/other.py';
    expect(() => validateTrainableManifest(remote)).toThrow('Invalid approved game');
  });
});
