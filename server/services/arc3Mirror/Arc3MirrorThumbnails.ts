/*
Author: Claude Opus 5
Date: 2026-08-30
PURPOSE: Renders one mirrored ARC-AGI-3 game's opening frame to a cached PNG. The blind
         gallery shows a frame per task the way arcprize.org does, and the frame is the
         only thing a player is supposed to reason from -- it carries no words, so unlike
         the game's title it is safe to display and is in fact the point.

         Replaces the thumbnail path that lived in the removed CommunityGameStorage: source
         now comes from Arc3MirrorCatalog rather than from a DB row plus a stored file, so
         it is written to a scratch file for the renderer and the PNG is cached on disk
         keyed by gameId + size. Upstream ids already encode a content hash
         (`ab01-63be02fb`), so a changed game arrives under a new id and the cache never
         goes stale under an old one.

         Rendering issues a single RESET and never advances the game, so thumbnails cannot
         pollute human-play telemetry.
         Dependencies: server/python/community_game_thumbnail.py, external/ARCEngine.
SRP/DRY check: Pass -- rendering/caching only; catalog + source fetch stay in
         Arc3MirrorCatalog, and the Python renderer is reused unchanged rather than
         reimplemented.
*/

import { spawn } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { logger } from '../../utils/logger';
import { Arc3MirrorCatalog } from './Arc3MirrorCatalog';

const RENDER_SCRIPT = path.join(process.cwd(), 'server', 'python', 'community_game_thumbnail.py');
const CACHE_DIR = path.join(process.cwd(), 'data', 'arc3-mirror-thumbnails');
const RENDER_TIMEOUT_MS = 20_000;

/**
 * Concurrent python3 renders. Each one imports numpy + pydantic + arcengine and costs
 * ~150MB RSS for ~300-500ms, and a cold gallery page asks for 60 tiles at once -- on
 * Railway's ephemeral disk EVERY redeploy is a cold start, so this is the normal case,
 * not an edge case. Unbounded, the box thrashes, renders fail, and the grid silently
 * degrades to decorative fallback sprites -- losing the one thing on the page that
 * carries meaning. Queueing is slower and correct.
 */
const MAX_CONCURRENT_RENDERS = 3;

let activeRenders = 0;
const renderQueue: (() => void)[] = [];

async function withRenderSlot<T>(job: () => Promise<T>): Promise<T> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    await new Promise<void>((resolve) => renderQueue.push(resolve));
  }
  activeRenders += 1;
  try {
    return await job();
  } finally {
    activeRenders -= 1;
    renderQueue.shift()?.();
  }
}

/** Alpine Docker only ships python3; Windows uses python. Mirrors the old bridge. */
function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function render(sourceFilePath: string, outPath: string, size: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      resolvePythonBin(),
      [RENDER_SCRIPT, '--file', sourceFilePath, outPath, String(size)],
      {
        env: {
          ...process.env,
          PYTHONPATH: [path.join(process.cwd(), 'external', 'ARCEngine'), process.env.PYTHONPATH]
            .filter(Boolean).join(path.delimiter),
        },
      },
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });

    // A game whose reset loops would otherwise hold the request open indefinitely.
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('render timed out')); }, RENDER_TIMEOUT_MS);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`renderer exited ${code}: ${stderr.trim().slice(-300)}`));
    });
  });
}

/** In-flight renders per cache key, so N simultaneous tile requests spawn one process. */
const pending = new Map<string, Promise<string | null>>();

export class Arc3MirrorThumbnails {
  /** Absolute path to a cached PNG, rendering it first if needed. Null if unrenderable. */
  static async getThumbnailPath(gameId: string, size: number): Promise<string | null> {
    const game = await Arc3MirrorCatalog.getGame(gameId);
    if (!game) return null;

    // Keyed on the SOURCE, not just the id. Hashed upstream ids (`ab01-63be02fb`) change
    // when the game changes, but the 23 custom games use bare slugs (`ac02`, `gh14`) that
    // upstream can edit in place -- keying on the id alone would serve their old frame
    // forever, which is the staleness this whole mirror exists to remove.
    const source = await Arc3MirrorCatalog.getSource(gameId);
    if (!source) return null;
    const key = `${createHash('sha1').update(source.sourceCode).digest('hex').slice(0, 16)}-${size}`;
    const cachePath = path.join(CACHE_DIR, `${key}.png`);

    try {
      await fs.access(cachePath);
      return cachePath;
    } catch {
      // Not cached yet - fall through and render.
    }

    const existing = pending.get(key);
    if (existing) return existing;

    const job = (async (): Promise<string | null> => {
      let scratchDir: string | null = null;
      try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arc3-thumb-'));
        // The renderer imports the file, so the module name must be a valid identifier
        // and must not collide with anything importable.
        const scratchFile = path.join(scratchDir, 'mirrored_game.py');
        await fs.writeFile(scratchFile, source.sourceCode, 'utf8');

        await withRenderSlot(() => render(scratchFile, cachePath, size));
        return cachePath;
      } catch (error) {
        logger.warn(`arc3Mirror: thumbnail render failed for ${gameId} - ${error instanceof Error ? error.message : String(error)}`);
        return null;
      } finally {
        pending.delete(key);
        if (scratchDir) await fs.rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
      }
    })();

    pending.set(key, job);
    return job;
  }
}
