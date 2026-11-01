/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-27
 * PURPOSE: Feed the existing mirror/player with the lab's current approved originals.
 * Exact-version URLs and SHA-256 checks prevent an old local game replacing approved bytes.
 * A committed, verified snapshot keeps public play available during a lab outage.
 * SRP/DRY check: Pass — the lab owns approval; existing player, telemetry and PNG routes are reused.
 */
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { MirroredGame } from './Arc3MirrorCatalog';
import { logger } from '../../utils/logger';

export interface TrainableVersion {
  gameId: string; versionId: string; sha256: string; sourceUrl: string; srcFile: string;
  className: string; defaultFps: number; thumbUrl: string; finalLabel?: string | null;
}
export interface TrainableManifest {
  apiVersion: number; count: number; snapshotId: string; generatedAt: string; versions: TrainableVersion[];
}
const ORIGIN = (process.env.ARC3_UPSTREAM || 'https://arc3.sonpham.net').replace(/\/+$/, '');
const SNAPSHOT_DIR = path.join(process.cwd(), 'server/data/arc3-trainable-games');
const TTL = 5 * 60 * 1000;
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export const trainablePlayId = (game: TrainableVersion) => `${game.gameId}-${game.sha256.slice(0, 12)}`;

/** Validate public paths before fetching; the feed cannot make the server request another origin. */
export function validateTrainableManifest(value: unknown): TrainableManifest {
  const m = value as TrainableManifest;
  if (!m || m.apiVersion !== 1 || !Array.isArray(m.versions) || m.count !== m.versions.length
      || !/^[a-f0-9]{64}$/.test(m.snapshotId) || !Number.isFinite(Date.parse(m.generatedAt))) {
    throw new Error('Invalid public Trainable manifest');
  }
  const ids = new Set<string>();
  for (const v of m.versions) {
    if (!/^[a-z0-9][a-z0-9_-]{0,45}$/.test(v.gameId) || !/^[a-f0-9]{64}$/.test(v.sha256)
        || v.versionId !== `${v.gameId}@${v.sha256.slice(0, 12)}` || ids.has(v.gameId)
        || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.className)
        || !/^[A-Za-z0-9_.-]+\.py$/.test(v.srcFile)
        || v.sourceUrl !== `/data/_games/${v.gameId}/${v.sha256.slice(0, 12)}/${v.srcFile}`
        || v.thumbUrl !== `/data/_games/${v.gameId}/${v.sha256.slice(0, 12)}/thumb.png`
        || !Number.isFinite(v.defaultFps) || v.defaultFps <= 0
        || (v.finalLabel !== undefined && v.finalLabel !== null && !/^[A-Z]{2}[0-9]{2}$/.test(v.finalLabel))) {
      throw new Error(`Invalid approved game: ${v.gameId}`);
    }
    ids.add(v.gameId);
  }
  const sorted = [...m.versions].sort((a, b) => a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0);
  if (digest(JSON.stringify(sorted.map(v => [v.versionId, v.sha256]))) !== m.snapshotId) {
    throw new Error('Trainable snapshot hash mismatch');
  }
  return m;
}

let current: TrainableManifest | undefined;
let checkedAt = 0;
let pending: Promise<TrainableManifest> | undefined;
const sources = new Map<string, string>();

export class Arc3TrainableCatalog {
  static async manifest(): Promise<TrainableManifest> {
    if (current && Date.now() - checkedAt < TTL) return current;
    if (!pending) pending = (async () => {
      try {
        const res = await fetch(`${ORIGIN}/api/v1/public/games/trainable`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`public Trainable feed returned ${res.status}`);
        current = validateTrainableManifest(await res.json());
        // An empty live selection is authoritative; never revive the bundled selection.
        const active = new Set(current.versions.map(trainablePlayId));
        for (const id of sources.keys()) if (!active.has(id)) sources.delete(id);
      } catch (error) {
        if (!current) current = validateTrainableManifest(JSON.parse(await fs.readFile(path.join(SNAPSHOT_DIR, 'manifest.json'), 'utf8')));
        logger.warn(`arc3Trainable: using last verified snapshot ${current.snapshotId.slice(0, 12)}: ${String(error)}`);
      }
      checkedAt = Date.now();
      return current!;
    })().finally(() => { pending = undefined; });
    return pending;
  }
  static async listGames(): Promise<MirroredGame[]> {
    return (await this.manifest()).versions.map(v => ({
      gameId: trainablePlayId(v), className: v.className, source: 'trainable', category: 'trainable',
      official: false, defaultFps: v.defaultFps, tileScale: 1, isLive: false,
      label: v.finalLabel || v.gameId, approvedVersion: v.versionId,
    }));
  }
  static async version(id: string): Promise<TrainableVersion | undefined> {
    return (await this.manifest()).versions.find(v => trainablePlayId(v) === id);
  }
  static async getSource(id: string) {
    const v = await this.version(id);
    if (!v) return null;
    let source = sources.get(id);
    if (!source) {
      let bytes: Buffer;
      try { bytes = await fs.readFile(path.join(SNAPSHOT_DIR, `${id}.py`)); }
      catch {
        const res = await fetch(`${ORIGIN}${v.sourceUrl}`, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`Approved source returned ${res.status}`);
        bytes = Buffer.from(await res.arrayBuffer());
      }
      if (digest(bytes) !== v.sha256) throw new Error(`Approved source hash mismatch for ${id}`);
      source = bytes.toString('utf8');
      sources.set(id, source);
    }
    return { gameId: id, sourceCode: source, className: v.className, sourceVersion: v.sha256.slice(0, 12) };
  }
  static async thumbnail(id: string, size: number): Promise<string | null> {
    const original = await this.recordedThumbnail(id);
    if (!original || size === 64) return original;
    const dir = path.join(process.cwd(), 'data/arc3-mirror-thumbnails');
    const resized = path.join(dir, `approved-${id}-${size}.png`);
    try { await fs.access(resized); return resized; } catch { /* scale the actual recorded frame */ }
    await fs.mkdir(dir, { recursive: true });
    const temp = `${resized}.${randomUUID()}.tmp`;
    await sharp(original).resize(size, size, { kernel: 'nearest' }).png().toFile(temp);
    await fs.rename(temp, resized);
    return resized;
  }
  static async recordedThumbnail(id: string): Promise<string | null> {
    const v = await this.version(id);
    if (!v) return null;
    const bundled = path.join(SNAPSHOT_DIR, `${id}.png`);
    try { await fs.access(bundled); return bundled; } catch { /* new approval since deploy */ }
    const cacheDir = path.join(process.cwd(), 'data/arc3-mirror-thumbnails');
    const cached = path.join(cacheDir, `approved-${id}.png`);
    try { await fs.access(cached); return cached; } catch { /* fetch the recorded frame */ }
    const res = await fetch(`${ORIGIN}${v.thumbUrl}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return null;
    await fs.mkdir(cacheDir, { recursive: true });
    const temporary = `${cached}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, cached);
    return cached;
  }
}
