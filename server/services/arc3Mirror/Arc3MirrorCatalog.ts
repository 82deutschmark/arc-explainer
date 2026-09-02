/*
Author: Claude Opus 5
Date: 2026-09-01 (third pass: our own catalog moved in-repo)
PURPOSE: Mirrors the ARC-AGI-3 synthetic game catalogs the play surface serves, from TWO
         independent sources.

         SOURCE 1 (`upstream`, ARC3_UPSTREAM, default arc3.sonpham.net) is the programme's
         source of truth. sonpham-org/arc3 is deployed on Railway as a Caddy static server
         behind oauth2-proxy; its entrypoint marks `^/$` and `^/static/` as public
         (skip-auth) while gating the researcher surfaces, so the manifest and every game's
         Python source are fetchable without credentials. Those assets carry no
         Access-Control-Allow-Origin, so the browser cannot read them cross-origin -- this
         service pulls them server-to-server and re-serves them from our own origin.

         SOURCE 2 (`arena`) is OUR OWN authored catalog, the 50 tasks in
         server/data/arc3-games/ IN THIS REPOSITORY. It is a SECOND source rather than
         rows pushed into Son's manifest, deliberately: the two programmes are competing
         and each side's catalog stays its own.

         Source 2 used to be fetched over HTTP from sonpham-org/autoresearch-arena
         (ARC3_ARENA_UPSTREAM / ARC3_ARENA_TOKEN). That repository is private and is
         staying private, so the fetch could never resolve in production and the source
         served zero games. The games were moved here instead, on 01-Sep-2026, and read
         from disk: no fetch, no cache, no TTL, no independent-failure path, because a
         local read cannot go stale or fall over. See
         docs/plans/2026-09-01-arc3-catalog-flip.md.

         The sources still fail INDEPENDENTLY. Each keeps its own manifest cache,
         source-path index and in-flight refresh, and each falls back to its own last good
         copy; the merge tolerates one side being unreachable and serves the other. Only
         when every source fails does this throw. Upstream going down must never take the
         play surface down, and our own 50 now stay up when it does.

         Ids are assumed disjoint but not trusted to be: on a collision the `upstream`
         entry wins and the loser is logged, because silently overwriting one programme's
         task with another's would corrupt the human-vs-agent comparison at the root.

         NOTHING IS RENAMED AT RUNTIME ANY MORE. The previous version derived opaque
         ids and class names on the way out, because the authoring repo names each task
         for what it does (`gNNN_<mechanic>.py`, `class <Mechanic>`) and the play surface
         prints the game id to the player -- a spoiler before the first move. Now that the
         catalog lives here, the rename happens ONCE, at import, and the descriptive name
         never enters this public repository at all: files are stored as `<gameId>.py` and
         the class they declare is already the published one. See
         scripts/arc3/import_authored_games.py, which owns that derivation
         (`"t" + sha256("arena:" + <authored id>)[:8]`) and which must keep producing the
         same ids -- server/services/arc3Mirror/arc3Triage.json addresses all 50 by them.

         This is still the split between the two sites. arc-explainer runs the human
         experiment, where a name is a spoiler; arc3.sonpham.net is the researcher surface,
         where naming the game is the point. Upstream ids pass through untouched because
         they are the vocabulary the two sites share.

         The mirror STRIPS every field that names the mechanic, for both sources.
         arc-explainer's job is human-baseline collection: a player is meant to infer the
         rules from the frame, so a tile or payload carrying `title` ("Light Bender"),
         `description`, or `tags` ("stealth", "sokoban", "fog-of-war") destroys the data
         point. Audited 2026-08-30: `id`, `src_file` and `class_name` are all slug-derived
         across all upstream entries (`gh14` / `gh14.py` / `Gh14`), so they are safe to keep
         and are required -- the Pyodide worker cannot instantiate a game without
         `class_name`. Our own manifest emits no title/description/tags at all, and its
         ids and class names are opaque by construction.

         Known and accepted limit: `sourceCode` executes in the browser and is readable in
         devtools. Opaque metadata raises the bar from "visible on the tile" to "read the
         Python"; it is not a guarantee, and no obfuscation layer is attempted. The rename
         at import moves the identifiers only -- a constant or helper inside a published
         file still hints at what the game is, and deliberately so: mangling our own source
         to hide it from a player who has opened devtools would break the games for no
         gain.

         Dependencies: global fetch (Node 18+) for the upstream source, fs/path for ours.
         Deliberately no DB -- Son's catalog is not ours to persist, and ours is already
         files under version control, so a stored copy would only recreate the
         stale-mirror problem this service exists to remove.
SRP/DRY check: Pass -- reading/caching/stripping only, parameterised per source
         instead of duplicated: one read path, one strip, one refresh, one cache policy,
         applied to a list of source descriptors. Publishing our catalog belongs to
         scripts/arc3/, not here. Serving stays in routes/arc3Mirror.ts and
         play execution stays in the Pyodide client hook, whose {sourceCode, className}
         contract is unchanged.
*/

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger';

/** Source of truth. Override for a staging mirror or a local checkout on :8776. */
const UPSTREAM = (process.env.ARC3_UPSTREAM ?? 'https://arc3.sonpham.net').replace(/\/+$/, '');

/**
 * Our own authored catalog, on disk in this repository.
 *
 * Absolute from process.cwd() rather than from import.meta.url, because the server ships
 * as a single esbuild bundle at dist/index.js and a path relative to the bundle points at
 * dist/, not at the source tree. cwd is /app in the container and the repo root in dev.
 *
 * Under server/ and NOT under the root data/ directory: Railway mounts a persistent
 * volume at /app/data, so a repo-tracked file there is shadowed by the mount at runtime
 * and the catalog would be empty in production while looking fine locally.
 */
export const AUTHORED_DIR = path.join(process.cwd(), 'server', 'data', 'arc3-games');

/** Son's Caddy sets max-age=300 on /static/. Matching it keeps us no staler than his CDN. */
const MANIFEST_TTL_MS = 5 * 60 * 1000;
/**
 * Source TTL. An earlier version cached source forever, reasoning that upstream ids
 * encode a content hash so a changed game arrives under a new id. That is true of the
 * hashed ids (`ab01-63be02fb`) but NOT of the 23 custom games, which use bare slugs
 * (`ac02`, `gh14`, `ws03-v1`) that upstream can edit in place. Caching those forever
 * would reproduce, in memory, exactly the staleness this mirror exists to remove. Applies
 * to HTTP sources only: our own files are read from disk on demand and never cached.
 */
const SOURCE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;

/** Manifest entry, as published by both sources. Fields we deliberately drop are typed so
 *  the strip is explicit. The arena manifest simply never emits the stripped three. */
interface UpstreamEntry {
  id: string;
  title?: string;         // STRIPPED - names the mechanic
  description?: string;   // STRIPPED - names the mechanic
  tags?: string[];        // STRIPPED - names the mechanic
  class_name: string;
  src_file: string;
  /** Open string, not a union: upstream adds categories (`ai-generated` appeared with
   *  571 games the day after this shipped) and a closed set here turns that into a
   *  breakage rather than data. Arena entries use `arena`. */
  category: string;
  official?: boolean;
  default_fps?: number;
  tile_scale?: number;
}

/** What we expose. No field here describes play. */
export interface MirroredGame {
  gameId: string;
  className: string;
  /** The catalog this game came from. Not a spoiler -- it names the publisher, not the
   *  mechanic -- and the gallery needs it to say whose task a tile is. */
  source: string;
  /** Upstream's own category slug. Open by design -- see UpstreamEntry.category. */
  category: string;
  official: boolean;
  defaultFps: number;
  tileScale: number;
  /**
   * Real-time game: it ticks on a clock instead of waiting for input, and is unplayable
   * without a tick loop. Derived from upstream's `live` tag rather than shipping the tag
   * itself -- the raw tag list is stripped as spoilers, but "this one moves on its own"
   * is apparent within a second of play and withholding it just breaks the game.
   */
  isLive: boolean;
}

interface CacheEntry<T> { value: T; fetchedAt: number; }

/**
 * One catalog. Everything that used to be a module-level singleton lives here instead,
 * once per source, which is what makes the two fail independently: a refresh that blows
 * up mutates only its own cache and only its own in-flight promise.
 */
interface MirrorSource {
  /** Stable key, reported by status() and used to route a game id back to its origin. */
  key: string;
  /**
   * Where this catalog is read from, and how. `http` is an origin fetched over the
   * network and cached against a TTL; `local` is a directory in this repository, read on
   * demand -- a file on our own disk cannot go stale between reads, so caching it would
   * add a way to serve something the repository does not contain.
   */
  kind: 'http' | 'local';
  base: string;
  /** Manifest location, relative to `base`. */
  manifestPath: string;
  /** Where this source keeps one game's Python, relative to `base`. */
  srcPath: (entry: UpstreamEntry) => string;
  /** Extra request headers, for an `http` source that needs them. */
  headers: Record<string, string>;
  manifestCache: CacheEntry<MirroredGame[]> | null;
  /** Served gameId -> the path its Python lives at, which never ships to the client. */
  srcPathIndex: Map<string, string>;
  /** Coalesces concurrent refreshes so a cold start does not fan out N fetches. */
  inFlight: Promise<MirroredGame[]> | null;
}

/**
 * Order matters: the first source to claim an id keeps it, so `upstream` is listed first
 * and wins a collision.
 */
const SOURCES: MirrorSource[] = [
  {
    key: 'upstream',
    kind: 'http',
    base: UPSTREAM,
    manifestPath: '/static/games/manifest.json',
    srcPath: (entry) => `/static/games/src/${entry.id}/${entry.src_file}`,
    headers: {},
    manifestCache: null,
    srcPathIndex: new Map(),
    inFlight: null,
  },
  {
    // Key kept as `arena` after the games moved in-repo: it is mixed into the published
    // ids (see import_authored_games.py) and it is the value arc3Triage.json's 50 rows
    // and any shared URL already carry. Renaming it would orphan every one of them.
    key: 'arena',
    kind: 'local',
    base: AUTHORED_DIR,
    manifestPath: 'manifest.json',
    srcPath: (entry) => entry.src_file,
    headers: {},
    manifestCache: null,
    srcPathIndex: new Map(),
    inFlight: null,
  },
];

/** gameId -> Python source, with a fetch timestamp so the entry can expire.
 *  ~900 games x ~50KB worst case; bounded by the catalogs themselves. Keyed by game id
 *  alone because ids are unique after the merge -- a collision loser is never served. */
const sourceCache = new Map<string, CacheEntry<string>>();

/** gameId -> the source that published it, rebuilt on every merge. Without it, getSource
 *  would have to guess which base to fetch a game's Python from. */
let ownerIndex = new Map<string, MirrorSource>();

/**
 * One file from a source, as text, whichever kind of source it is.
 *
 * The `local` branch resolves and then checks containment rather than trusting the
 * relative path: those paths come from a manifest, and a manifest is a file -- an entry
 * whose `src_file` walked out of the directory would read anything the process can read
 * and hand it to a browser.
 */
async function readFrom(source: MirrorSource, relPath: string): Promise<string> {
  if (source.kind === 'local') {
    const resolved = path.resolve(source.base, relPath);
    if (resolved !== source.base && !resolved.startsWith(source.base + path.sep)) {
      throw new Error(`${source.key} path ${relPath} escapes ${source.base}`);
    }
    return fs.readFile(resolved, 'utf-8');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${source.base}${relPath}`, {
      signal: controller.signal,
      headers: source.headers,
    });
    if (!res.ok) throw new Error(`${source.key} ${relPath} responded ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Drop every mechanic-naming field. The single place the no-spoiler rule is enforced,
 *  for both sources. */
function strip(entry: UpstreamEntry, source: MirrorSource): MirroredGame {
  return {
    gameId: entry.id,
    className: entry.class_name,
    source: source.key,
    category: entry.category,
    official: entry.official ?? entry.category === 'official',
    // Sources omit these on some entries; the player-facing defaults must still be sane.
    defaultFps: entry.default_fps ?? 10,
    tileScale: entry.tile_scale ?? 4,
    isLive: (entry.tags ?? []).includes('live'),
  };
}

async function refresh(source: MirrorSource): Promise<MirroredGame[]> {
  const raw = JSON.parse(await readFrom(source, source.manifestPath)) as UpstreamEntry[];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${source.key} manifest empty or malformed`);
  }

  const games: MirroredGame[] = [];
  const paths = new Map<string, string>();
  for (const entry of raw) {
    if (!entry?.id || !entry.class_name || !entry.src_file) {
      logger.warn(`arc3Mirror: skipping malformed ${source.key} manifest entry ${entry?.id ?? '(no id)'}`);
      continue;
    }
    const game = strip(entry, source);
    games.push(game);
    paths.set(game.gameId, source.srcPath(entry));
  }

  source.srcPathIndex = paths;
  const changed = source.manifestCache?.value.length !== games.length;
  source.manifestCache = { value: games, fetchedAt: Date.now() };

  // Local sources re-read on every call by design, so an info line per read would drown
  // the log; what matters for them is the first read and any change to what the directory
  // holds, so the steady state drops to debug.
  const line = `arc3Mirror: ${source.key} catalog refreshed from ${source.base} (${games.length} games)`;
  if (source.kind !== 'local' || changed) logger.info(line);
  else logger.debug(line);
  return games;
}

/**
 * One source's catalog, fresh if it can be and last-good if it cannot.
 *
 * A refresh failure serves that source's last good copy rather than an error: an expired
 * cache is not a reason to take the play surface down, and upstream is behind a proxy that
 * returns 5xx during redeploys. Rejects only when the source has never succeeded, which is
 * what lets the caller drop it from the merge.
 */
async function ensure(source: MirrorSource): Promise<MirroredGame[]> {
  // A local source is re-read every time. The read is a few KB off the same disk the
  // process was started from, and skipping the cache means the catalog is exactly what
  // the repository contains rather than what it contained at boot.
  const fresh = source.kind !== 'local'
    && source.manifestCache
    && Date.now() - source.manifestCache.fetchedAt < MANIFEST_TTL_MS;
  if (fresh) return source.manifestCache!.value;

  if (!source.inFlight) {
    source.inFlight = refresh(source).finally(() => { source.inFlight = null; });
  }

  try {
    return await source.inFlight;
  } catch (error) {
    if (source.manifestCache) {
      logger.warn(`arc3Mirror: ${source.key} refresh failed, serving cache from ${new Date(source.manifestCache.fetchedAt).toISOString()} - ${error instanceof Error ? error.message : String(error)}`);
      return source.manifestCache.value;
    }
    throw error;
  }
}

export class Arc3MirrorCatalog {
  /**
   * The merged, stripped catalog.
   *
   * Sources are gathered with allSettled so one being unreachable costs its own entries
   * and nothing else. Throws only if EVERY source failed and none has a cache -- at that
   * point there is genuinely nothing to serve, and answering with an empty catalog would
   * read to the gallery as "the programme has no games" rather than "the mirror is down".
   */
  static async listGames(): Promise<MirroredGame[]> {
    const settled = await Promise.allSettled(SOURCES.map((s) => ensure(s)));

    const merged: MirroredGame[] = [];
    const owners = new Map<string, MirrorSource>();
    let anyOk = false;

    settled.forEach((result, i) => {
      const source = SOURCES[i];
      if (result.status === 'rejected') {
        logger.warn(`arc3Mirror: ${source.key} unavailable and uncached, serving without it - ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        return;
      }
      anyOk = true;
      for (const game of result.value) {
        const incumbent = owners.get(game.gameId);
        if (incumbent) {
          // Keep the first claimant -- SOURCES is ordered so that is `upstream`.
          logger.warn(`arc3Mirror: id collision on ${game.gameId}; keeping ${incumbent.key}, dropping ${source.key}`);
          continue;
        }
        owners.set(game.gameId, source);
        merged.push(game);
      }
    });

    if (!anyOk) {
      const reasons = settled
        .map((r, i) => `${SOURCES[i].key}: ${r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : 'ok'}`)
        .join('; ');
      throw new Error(`arc3Mirror: no catalog source available (${reasons})`);
    }

    ownerIndex = owners;
    return merged;
  }

  static async getGame(gameId: string): Promise<MirroredGame | null> {
    const games = await this.listGames();
    return games.find((g) => g.gameId === gameId) ?? null;
  }

  /** Python source for one game, read from the source that published it. An `http`
   *  source is cached for SOURCE_TTL_MS -- see the note there on why that is not
   *  indefinite; a local file is read every time and never cached. */
  static async getSource(gameId: string): Promise<{ sourceCode: string; className: string } | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;

    // getGame() ran listGames(), so ownerIndex describes the catalog this game came from.
    const owner = ownerIndex.get(gameId);
    const srcPath = owner?.srcPathIndex.get(gameId);
    if (!owner || !srcPath) return null;

    const cached = owner.kind === 'local' ? undefined : sourceCache.get(gameId);
    if (cached && Date.now() - cached.fetchedAt < SOURCE_TTL_MS) {
      return { sourceCode: cached.value, className: game.className };
    }

    let sourceCode: string;
    try {
      sourceCode = await readFrom(owner, srcPath);
      if (!sourceCode.trim()) throw new Error(`${owner.key} source was empty`);
    } catch (error) {
      // An expired entry still runs the game; refusing to serve it because the refresh
      // failed would take a playable task offline for no gain.
      if (cached) {
        logger.warn(`arc3Mirror: source refresh failed for ${gameId}, serving cached copy - ${error instanceof Error ? error.message : String(error)}`);
        return { sourceCode: cached.value, className: game.className };
      }
      throw error;
    }

    if (owner.kind !== 'local') sourceCache.set(gameId, { value: sourceCode, fetchedAt: Date.now() });
    return { sourceCode, className: game.className };
  }

  /** Ops visibility: is the mirror live, and how stale is it? Top-level keys describe the
   *  primary source and are unchanged from the single-source version; `sources` breaks the
   *  same figures out per catalog, which is the only way to see that one side is down
   *  while the play surface is still serving. */
  static status() {
    const primary = SOURCES[0];
    const totalGames = SOURCES.reduce((n, s) => n + (s.manifestCache?.value.length ?? 0), 0);
    return {
      upstream: primary.base,
      gameCount: totalGames,
      fetchedAt: primary.manifestCache ? new Date(primary.manifestCache.fetchedAt).toISOString() : null,
      ageSeconds: primary.manifestCache ? Math.round((Date.now() - primary.manifestCache.fetchedAt) / 1000) : null,
      sourcesCached: sourceCache.size,
      sources: SOURCES.map((s) => ({
        key: s.key,
        // Ops reads this to tell a source that is DOWN from one that simply has no clock.
        // A local source has no fetchedAt because it is never fetched, and a null age on
        // an `http` row means it has never succeeded -- two different things that looked
        // identical before `kind` was reported.
        kind: s.kind,
        base: s.base,
        gameCount: s.manifestCache?.value.length ?? 0,
        fetchedAt: s.manifestCache && s.kind !== 'local' ? new Date(s.manifestCache.fetchedAt).toISOString() : null,
        ageSeconds: s.manifestCache && s.kind !== 'local' ? Math.round((Date.now() - s.manifestCache.fetchedAt) / 1000) : null,
      })),
    };
  }
}
