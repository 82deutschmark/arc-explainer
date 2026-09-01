/*
Author: Claude Opus 5
Date: 2026-09-01
PURPOSE: Mirrors the ARC-AGI-3 synthetic game catalogs the play surface serves, from TWO
         independent sources.

         SOURCE 1 (`upstream`, ARC3_UPSTREAM, default arc3.sonpham.net) is the programme's
         source of truth. sonpham-org/arc3 is deployed on Railway as a Caddy static server
         behind oauth2-proxy; its entrypoint marks `^/$` and `^/static/` as public
         (skip-auth) while gating the researcher surfaces, so the manifest and every game's
         Python source are fetchable without credentials. Those assets carry no
         Access-Control-Allow-Origin, so the browser cannot read them cross-origin -- this
         service pulls them server-to-server and re-serves them from our own origin.

         SOURCE 2 (`arena`, ARC3_ARENA_UPSTREAM) is OUR OWN authored catalog, the 50 gNNN
         tasks in sonpham-org/autoresearch-arena under arc3games/dist, published by
         arc3games/tools/build_dist_manifest.py in the same entry shape. It is a SECOND
         source rather than rows pushed into Son's manifest, deliberately: the two
         programmes are competing and each side's catalog stays its own.

         The two sources fail INDEPENDENTLY. Each keeps its own manifest cache, source-path
         index and in-flight refresh, and each falls back to its own last good copy; the
         merge tolerates one side being unreachable and serves the other. Only when every
         source fails with no cache at all does this throw. One upstream going down must
         never take the play surface down -- and one of them being down is the expected
         case, not the exotic one (see the ARENA_UPSTREAM note below).

         Ids are assumed disjoint but not trusted to be: on a collision the `upstream`
         entry wins and the loser is logged, because silently overwriting one programme's
         task with another's would corrupt the human-vs-agent comparison at the root.

         The mirror STRIPS every field that names the mechanic, for both sources.
         arc-explainer's job is human-baseline collection: a player is meant to infer the
         rules from the frame, so a tile or payload carrying `title` ("Light Bender"),
         `description`, or `tags` ("stealth", "sokoban", "fog-of-war") destroys the data
         point. Audited 2026-08-30: `id`, `src_file` and `class_name` are all slug-derived
         across all upstream entries (`gh14` / `gh14.py` / `Gh14`), so they are safe to keep
         and are required -- the Pyodide worker cannot instantiate a game without
         `class_name`. The arena manifest emits no title/description/tags at all.

         Known and accepted limit: `sourceCode` executes in the browser and is readable in
         devtools. Opaque metadata raises the bar from "visible on the tile" to "read the
         Python"; it is not a guarantee, and no obfuscation layer is attempted.

         Dependencies: none beyond global fetch (Node 18+). Deliberately no DB -- neither
         catalog is ours to persist, and a stored copy would recreate the stale-mirror
         problem this service exists to remove.
SRP/DRY check: Pass -- fetching/caching/stripping only, now parameterised per source
         instead of duplicated: one fetch path, one strip, one refresh, one cache policy,
         applied to a list of source descriptors. Serving stays in routes/arc3Mirror.ts and
         play execution stays in the Pyodide client hook, whose {sourceCode, className}
         contract is unchanged.
*/

import { logger } from '../../utils/logger';

/** Source of truth. Override for a staging mirror or a local checkout on :8776. */
const UPSTREAM = (process.env.ARC3_UPSTREAM ?? 'https://arc3.sonpham.net').replace(/\/+$/, '');

/**
 * Our own catalog's base. Manifest at `<base>/manifest.json`, source at
 * `<base>/<src_file>`.
 *
 * NOTE, and this is load-bearing for anyone reading a mirror-status that shows zero arena
 * games: sonpham-org/autoresearch-arena is a PRIVATE repository, and raw.githubusercontent
 * answers 404 unauthenticated on a private repo. The default below therefore fetches
 * nothing until the repo is made public. That is contained -- the source fails on its own
 * and the upstream catalog serves normally -- and it is fixed either by publishing the
 * repo or by pointing ARC3_ARENA_UPSTREAM at a reachable base. For a private repo that
 * base is the contents API, which does serve raw bytes to a token:
 *   ARC3_ARENA_UPSTREAM=https://api.github.com/repos/sonpham-org/autoresearch-arena/contents/arc3games/dist?ref=master
 * is not usable as-is (the query string breaks path joining); use a raw proxy or publish.
 * ARC3_ARENA_TOKEN, when set, is sent as a bearer token on arena fetches so an
 * authenticating base works without further code changes.
 */
const ARENA_UPSTREAM = (
  process.env.ARC3_ARENA_UPSTREAM
  ?? 'https://raw.githubusercontent.com/sonpham-org/autoresearch-arena/master/arc3games/dist'
).replace(/\/+$/, '');

const ARENA_TOKEN = process.env.ARC3_ARENA_TOKEN ?? '';

/** Son's Caddy sets max-age=300 on /static/. Matching it keeps us no staler than his CDN. */
const MANIFEST_TTL_MS = 5 * 60 * 1000;
/**
 * Source TTL. An earlier version cached source forever, reasoning that upstream ids
 * encode a content hash so a changed game arrives under a new id. That is true of the
 * hashed ids (`ab01-63be02fb`) but NOT of the 23 custom games, which use bare slugs
 * (`ac02`, `gh14`, `ws03-v1`) that upstream can edit in place -- nor of the arena games,
 * whose ids are permanent and whose files are edited in place by design. Caching those
 * forever would reproduce, in memory, exactly the staleness this mirror exists to remove.
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
  base: string;
  /** Manifest URL, relative to `base`. */
  manifestPath: string;
  /** Where this source keeps one game's Python, relative to `base`. */
  srcPath: (entry: UpstreamEntry) => string;
  /** Extra request headers -- an auth token for a private arena base, when configured. */
  headers: Record<string, string>;
  manifestCache: CacheEntry<MirroredGame[]> | null;
  /** gameId -> src path. Kept out of MirroredGame so the filename never ships. */
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
    base: UPSTREAM,
    manifestPath: '/static/games/manifest.json',
    srcPath: (entry) => `/static/games/src/${entry.id}/${entry.src_file}`,
    headers: {},
    manifestCache: null,
    srcPathIndex: new Map(),
    inFlight: null,
  },
  {
    key: 'arena',
    base: ARENA_UPSTREAM,
    manifestPath: '/manifest.json',
    srcPath: (entry) => `/${entry.src_file}`,
    headers: ARENA_TOKEN ? { Authorization: `Bearer ${ARENA_TOKEN}` } : {},
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

async function fetchFrom(source: MirrorSource, path: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${source.base}${path}`, {
      signal: controller.signal,
      headers: source.headers,
    });
    if (!res.ok) throw new Error(`${source.key} ${path} responded ${res.status}`);
    return res;
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
  const res = await fetchFrom(source, source.manifestPath);
  const raw = (await res.json()) as UpstreamEntry[];
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
    games.push(strip(entry, source));
    paths.set(entry.id, source.srcPath(entry));
  }

  source.srcPathIndex = paths;
  source.manifestCache = { value: games, fetchedAt: Date.now() };
  logger.info(`arc3Mirror: ${source.key} catalog refreshed from ${source.base} (${games.length} games)`);
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
  const fresh = source.manifestCache && Date.now() - source.manifestCache.fetchedAt < MANIFEST_TTL_MS;
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

  /** Python source for one game, fetched from the source that published it. Cached for
   *  SOURCE_TTL_MS -- see the note there on why this is not cached indefinitely. */
  static async getSource(gameId: string): Promise<{ sourceCode: string; className: string } | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;

    const cached = sourceCache.get(gameId);
    if (cached && Date.now() - cached.fetchedAt < SOURCE_TTL_MS) {
      return { sourceCode: cached.value, className: game.className };
    }

    // getGame() ran listGames(), so ownerIndex describes the catalog this game came from.
    const owner = ownerIndex.get(gameId);
    const path = owner?.srcPathIndex.get(gameId);
    if (!owner || !path) return null;

    let sourceCode: string;
    try {
      const res = await fetchFrom(owner, path);
      sourceCode = await res.text();
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

    sourceCache.set(gameId, { value: sourceCode, fetchedAt: Date.now() });
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
        base: s.base,
        gameCount: s.manifestCache?.value.length ?? 0,
        fetchedAt: s.manifestCache ? new Date(s.manifestCache.fetchedAt).toISOString() : null,
        ageSeconds: s.manifestCache ? Math.round((Date.now() - s.manifestCache.fetchedAt) / 1000) : null,
      })),
    };
  }
}
