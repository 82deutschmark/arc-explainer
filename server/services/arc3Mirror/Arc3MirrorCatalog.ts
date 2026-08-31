/*
Author: Claude Opus 5
Date: 2026-08-30
PURPOSE: Mirrors the ARC-AGI-3 synthetic game catalog from arc3.sonpham.net, which is the
         source of truth for the programme. sonpham-org/arc3 is deployed on Railway as a
         Caddy static server behind oauth2-proxy; its entrypoint marks `^/$` and `^/static/`
         as public (skip-auth) while gating the researcher surfaces, so the manifest and every
         game's Python source are fetchable without credentials. Those assets carry no
         Access-Control-Allow-Origin, so the browser cannot read them cross-origin -- this
         service pulls them server-to-server and re-serves them from our own origin.

         The mirror STRIPS every field that names the mechanic. arc-explainer's job is
         human-baseline collection: a player is meant to infer the rules from the frame, so
         a tile or payload carrying `title` ("Light Bender"), `description`, or `tags`
         ("stealth", "sokoban", "fog-of-war") destroys the data point. Audited 2026-08-30:
         `id`, `src_file` and `class_name` are all slug-derived across all 300 entries
         (`gh14` / `gh14.py` / `Gh14`), so they are safe to keep and are required -- the
         Pyodide worker cannot instantiate a game without `class_name`.

         Known and accepted limit: `sourceCode` executes in the browser and is readable in
         devtools. Opaque metadata raises the bar from "visible on the tile" to "read the
         Python"; it is not a guarantee, and no obfuscation layer is attempted.

         Dependencies: none beyond global fetch (Node 18+). Deliberately no DB -- the
         catalog is Son's, and persisting a copy would recreate the stale-mirror problem
         this service exists to remove.
SRP/DRY check: Pass -- new module; owns fetching/caching/stripping only. Serving is the
         route layer's job (routes/arc3Mirror.ts) and play execution stays in the existing
         Pyodide client hook, whose {sourceCode, className} contract is preserved exactly.
*/

import { logger } from '../../utils/logger';

/** Source of truth. Override for a staging mirror or a local checkout on :8776. */
const UPSTREAM = (process.env.ARC3_UPSTREAM ?? 'https://arc3.sonpham.net').replace(/\/+$/, '');

/** Son's Caddy sets max-age=300 on /static/. Matching it keeps us no staler than his CDN. */
const MANIFEST_TTL_MS = 5 * 60 * 1000;
/**
 * Source TTL. An earlier version cached source forever, reasoning that upstream ids
 * encode a content hash so a changed game arrives under a new id. That is true of the
 * hashed ids (`ab01-63be02fb`) but NOT of the 23 custom games, which use bare slugs
 * (`ac02`, `gh14`, `ws03-v1`) that upstream can edit in place. Caching those forever
 * would reproduce, in memory, exactly the staleness this mirror exists to remove.
 */
const SOURCE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;

/** Upstream manifest entry. Fields we deliberately drop are typed so the strip is explicit. */
interface UpstreamEntry {
  id: string;
  title: string;          // STRIPPED - names the mechanic
  description?: string;   // STRIPPED - names the mechanic
  tags?: string[];        // STRIPPED - names the mechanic
  class_name: string;
  src_file: string;
  category: 'official' | 'custom' | 'redbluepill';
  official?: boolean;
  default_fps?: number;
  tile_scale?: number;
}

/** What we expose. No field here describes play. */
export interface MirroredGame {
  gameId: string;
  className: string;
  category: 'official' | 'custom' | 'redbluepill';
  official: boolean;
  defaultFps: number;
  tileScale: number;
}

interface CacheEntry<T> { value: T; fetchedAt: number; }

let manifestCache: CacheEntry<MirroredGame[]> | null = null;
/** gameId -> upstream src path. Kept out of MirroredGame so the filename never ships. */
let srcPathIndex = new Map<string, string>();
/** gameId -> Python source, with a fetch timestamp so the entry can expire.
 *  ~300 games x ~50KB worst case; bounded by the catalog itself. */
const sourceCache = new Map<string, CacheEntry<string>>();
/** Coalesces concurrent refreshes so a cold start does not fan out N upstream fetches. */
let inFlight: Promise<MirroredGame[]> | null = null;

async function fetchUpstream(path: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${UPSTREAM}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`upstream ${path} responded ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Drop every mechanic-naming field. The single place the no-spoiler rule is enforced. */
function strip(entry: UpstreamEntry): MirroredGame {
  return {
    gameId: entry.id,
    className: entry.class_name,
    category: entry.category,
    official: entry.official ?? entry.category === 'official',
    // Upstream omits these on some entries; the player-facing defaults must still be sane.
    defaultFps: entry.default_fps ?? 10,
    tileScale: entry.tile_scale ?? 4,
  };
}

async function refresh(): Promise<MirroredGame[]> {
  const res = await fetchUpstream('/static/games/manifest.json');
  const raw = (await res.json()) as UpstreamEntry[];
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('upstream manifest empty or malformed');

  const games: MirroredGame[] = [];
  const paths = new Map<string, string>();
  for (const entry of raw) {
    if (!entry?.id || !entry.class_name || !entry.src_file) {
      logger.warn(`arc3Mirror: skipping malformed manifest entry ${entry?.id ?? '(no id)'}`);
      continue;
    }
    games.push(strip(entry));
    paths.set(entry.id, `/static/games/src/${entry.id}/${entry.src_file}`);
  }

  srcPathIndex = paths;
  manifestCache = { value: games, fetchedAt: Date.now() };
  logger.info(`arc3Mirror: catalog refreshed from ${UPSTREAM} (${games.length} games)`);
  return games;
}

export class Arc3MirrorCatalog {
  /**
   * The stripped catalog. A refresh failure serves the last good copy rather than an
   * error: an expired cache is not a reason to take the play surface down, and upstream
   * is behind a proxy that returns 5xx during redeploys.
   */
  static async listGames(): Promise<MirroredGame[]> {
    const fresh = manifestCache && Date.now() - manifestCache.fetchedAt < MANIFEST_TTL_MS;
    if (fresh) return manifestCache!.value;

    if (!inFlight) {
      inFlight = refresh().finally(() => { inFlight = null; });
    }

    try {
      return await inFlight;
    } catch (error) {
      if (manifestCache) {
        logger.warn(`arc3Mirror: refresh failed, serving cache from ${new Date(manifestCache.fetchedAt).toISOString()} - ${error instanceof Error ? error.message : String(error)}`);
        return manifestCache.value;
      }
      throw error;
    }
  }

  static async getGame(gameId: string): Promise<MirroredGame | null> {
    const games = await this.listGames();
    return games.find((g) => g.gameId === gameId) ?? null;
  }

  /** Python source for one game. Cached for SOURCE_TTL_MS -- see the note there on why
   *  this is not cached indefinitely. */
  static async getSource(gameId: string): Promise<{ sourceCode: string; className: string } | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;

    const cached = sourceCache.get(gameId);
    if (cached && Date.now() - cached.fetchedAt < SOURCE_TTL_MS) {
      return { sourceCode: cached.value, className: game.className };
    }

    const path = srcPathIndex.get(gameId);
    if (!path) return null;

    let sourceCode: string;
    try {
      const res = await fetchUpstream(path);
      sourceCode = await res.text();
      if (!sourceCode.trim()) throw new Error('upstream source was empty');
    } catch (error) {
      // An expired entry still runs the game; refusing to serve it because the refresh
      // failed would take a playable task offline for no gain.
      if (cached) {
        logger.warn(`arc3Mirror: source refresh failed for ${gameId}, serving cached copy - ${error instanceof Error ? error.message : String(error)}`);
        return { sourceCode: cached.value, className: game.className };
      }
      throw error;
    }

    sourceCache.set(gameId, { value: sourceCode, fetchedAt: Date.now() });
    return { sourceCode, className: game.className };
  }

  /** Ops visibility: is the mirror live, and how stale is it? */
  static status() {
    return {
      upstream: UPSTREAM,
      gameCount: manifestCache?.value.length ?? 0,
      fetchedAt: manifestCache ? new Date(manifestCache.fetchedAt).toISOString() : null,
      ageSeconds: manifestCache ? Math.round((Date.now() - manifestCache.fetchedAt) / 1000) : null,
      sourcesCached: sourceCache.size,
    };
  }
}
