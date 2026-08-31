# 30 Aug 2026 — arc3.markbarney.net becomes a blind play surface mirroring arc3.sonpham.net

**Author:** Claude Opus 5
**Status:** Implemented (this pass), pending items listed at the bottom.

## The split

Agreed with Son Pham, to be confirmed at the afternoon sync:

| | arc3.sonpham.net | arc3.markbarney.net |
|---|---|---|
| Role | Research side, **source of truth** | Public human-play surface |
| Owns | The task set, submissions, agent harness, run data | Nothing — mirrors the catalog |
| Audience | Researchers | Anyone, no background assumed |
| Auth | Google login on the researcher surfaces | None, ever |
| Purpose | Generate and evaluate synthetic ARC-AGI-3 tasks | Collect an anonymous **human baseline** |

Son's programme superseded ours. This site stops being an authority on what games
exist and becomes the place ordinary people play them blind.

## Where arc3.sonpham.net serves from

Railway deploy of `sonpham-org/arc3` — Caddy static server on :8081 behind
oauth2-proxy. `entrypoint.sh` marks `^/$` and `^/static/` as skip-auth and gates
everything else. So the catalog (`/static/games/manifest.json`, 300 games) and every
game's Python source are already public; `internal.html`, runs, viewer, harness and
`/data/*` are not. The auth split we needed already existed.

`/Users/macmini/GitHub/arc3-site` is a checkout of that repo (port 8776 locally).

## Why a server-side mirror rather than a browser fetch

`/static/` is public but serves **no `Access-Control-Allow-Origin`**, so a browser on
our origin cannot read it. Options were (a) ask Son to add a Caddy header, or (b) mirror
server-to-server. We took (b): it avoids coupling our uptime to his config, survives his
redeploys, and — decisively — gives us a place to **strip** before anything reaches a
browser.

## The no-spoiler rule

A player must infer the rules, the controls and the goal from the frame. Anything naming
the mechanic makes their run worthless as baseline data. `Arc3MirrorCatalog.strip()` is
the single enforcement point and drops:

- `title` — *Light Bender*, *Stealth Hunter*, *Tower Defense*
- `description`
- `tags` — `stealth`, `sokoban`, `fog-of-war`, `whack-a-mole`, `key-door`

Audited across all 300 entries: `id`, `src_file` and `class_name` are slug-derived
(`gh14` / `gh14.py` / `Gh14`), so they leak nothing and are kept. `class_name` is
**required** — the Pyodide worker cannot instantiate a game without it.

Leaks removed from our own UI in this pass:
- the gallery's `title={game.displayName}` **hover tooltip**
- the play page header, which printed the name and the author in bold

**Accepted limit:** `sourceCode` executes in the browser and is readable in devtools.
Opaque metadata raises the bar from "visible on the tile" to "read the Python". No
obfuscation layer is attempted, and this should be stated rather than claimed as
complete.

## Two regressions found and fixed

Both were pre-existing and had made the play surface non-functional.

**1. Pyodide was loading arcengine with micropip.** On 29-Aug the wheel-fetch was
replaced with `micropip.install("arcengine")`, arguing pydantic-core is in the Pyodide
0.27.4 lockfile so nothing would build. Pyodide then broke, and instead of reverting, the
play page was switched to a server-side session path. Reverted to
`arc3.sonpham.net/static/js/games-engine.js`'s recipe: fetch the wheel from PyPI and
extract it into site-packages.

**2. `GameAction(int(id))` instead of `GameAction.from_id(int(id))`.** This is what
actually produced "a board that renders with controls that do nothing". In the published
arcengine wheel each member is declared as a tuple — `ACTION2 = (2, SimpleAction)` — so
by-value lookup rejects a bare action id: `ValueError: 2 is not a valid GameAction`. The
vendored `external/ARCEngine` sets `_value_ = action_id`, so the constructor works there
and the bug is invisible to anything not running the published wheel. `load_game` and
`RESET` never hit that path, so only stepping failed — inside a worker, where nothing
surfaced it.

## What was removed

The DB-backed catalog had drifted to 66 rows covering ~40 games against 300 upstream,
with 13 duplicate rows for one game, `vc33`/`ls20`/`ft09` present twice at different level
counts, and an "ARC Prize Foundation — 3 tasks" section over 3 of 25.

- `server/routes/arc3Community.ts` (22 endpoints; 2 kept, see below)
- `server/repositories/CommunityGameRepository.ts`
- `server/services/arc3Community/*` — runner, python bridge, storage, validator,
  `ArcEngineOfficialGameCatalog`
- `community_games` + `community_game_sessions` table creation and their migration
- `GameSubmissionPage`, `AdminArc3Submissions`, `ValidationGuide`, `CommunityLanding`
- the `/arc3/upload` route and its nav entry, the AdminHub submissions card
- the researcher half of the landing page — how the set is generated, contributing a
  task, consuming the data, release-score table. All of it belongs to Son's side and was
  duplicating it months out of date.

## What was kept

`HumanPlayRepository` and its two tables (`community_game_events`,
`community_human_sessions`), `humanPlayTelemetry.ts`, `usePyodideGame.ts`. This is the
site's entire job and had no reason to die with the catalog.

## What was added

- `server/services/arc3Mirror/Arc3MirrorCatalog.ts` — fetch, strip, cache. Serves the last
  good copy if upstream 5xxs during a redeploy.
- `server/services/arc3Mirror/Arc3MirrorThumbnails.ts` — renders a game's opening frame
  from mirrored source via the existing `community_game_thumbnail.py`. A frame carries no
  words, so unlike the title it is safe to show, and it is the only thing a blind player
  is meant to reason from.
- `server/routes/arc3Mirror.ts` → `/api/arc3-mirror/*`
- `server/routes/arc3HumanPlay.ts` → `/api/arc3-play/*` (telemetry, extracted verbatim)

`/api/arc3-mirror/games/:gameId/source` deliberately returns the same
`{sourceCode, className}` shape the old catalog served, so `usePyodideGame` and the
telemetry kept working while the store behind them was swapped.

## Verified

- Mirror: 300 games (25 official / 23 custom / 252 community); one game from **each**
  category fetches source and its declared class is present in it; zero stripped fields in
  the payload.
- Thumbnails render from mirrored source for all three categories.
- Gallery renders 300 real opening frames, ids only, no titles.
- **A game plays end to end in a browser**: `ls20-9607627b` boots Pyodide, renders, and
  the action counter advances 0→1→2 in the worker and 0→4 through the real UI d-pad.
- `POST /api/arc3-play/human-events` → 200.
- `npm run build` clean; `tsc` clean for every file touched.

**Not verified:** telemetry *persistence*. There is no `DATABASE_URL` locally, so the
endpoint accepts and returns 200 but writes nothing here. Needs one check against the
Railway DB after deploy.

## Post-review fixes (same pass)

- **Section counts were per-page.** The new gallery sliced to the current page and *then*
  sectioned, so "COMMUNITY CATALOG 12" appeared over a 252-game category — the same defect
  as the old "ARC Prize Foundation — 3 tasks", reborn. Counts now come from the full
  filtered set and render as "12 of 252" when the page truncates a section.
- **Thumbnail render herd.** Each render spawns python3 importing numpy + pydantic +
  arcengine (~150MB, ~300-500ms). A cold gallery asks for 60 at once, and since the cache
  dir is gitignored on Railway's ephemeral disk, *every redeploy is a cold start*. Renders
  are now capped at 3 concurrent; failures fall back to sprites, which would have silently
  replaced every real frame with decorative noise.
- **Source cache was indefinite.** Justified by upstream ids encoding a content hash —
  true for `ab01-63be02fb`, false for the 23 custom games on bare slugs (`ac02`, `gh14`),
  which upstream can edit in place. Now a 1h TTL that serves the stale copy if a refresh
  fails, and the thumbnail disk key is hashed off the **source** rather than the id, so an
  edited game re-renders.

## Pending

1. **Sync with Son** — confirm this split, and whether he wants a CORS header on
   `/static/` as a lighter-weight alternative to the mirror (recommend keeping the mirror
   regardless).
2. **Verify telemetry writes in prod** — the one unverified link in the chain.
3. **Slug collisions are not a safe join key.** Son's manifest has 6: `cr01` is both
   *Crumbling Route* (custom) and *Creek Crossing* (community); `pt01` is both *Pirate
   Seas* and *Pattern Rotation*. We key on the full upstream id and are fine — but any
   future "match on the slug" ingestion will silently merge unrelated games.
4. **Some opening frames are near-blank** (e.g. `ar25`) because that genuinely is the
   game's first frame. Honest, but a poor tile. Consider rendering frame N>0 for those.
5. **`/arc3/games/:gameId` is a spoiler page, and it is two clicks from the play grid.**
   `Arc3GameSpoiler.tsx` documents 6 official games in full — mechanics, action mappings,
   level screenshots — and `Arc3Story` (`/arc3`, linked from the new landing footer as
   "ARC-AGI-3 reference") links straight into it. 5 of those 6 (`ft09`, `lp85`, `ls20`,
   `sp80`, `vc33`) are in the mirrored catalog and offered for blind play. These are the
   official ARC Prize games and are publicly documented on arcprize.org anyway, so this
   may be a deliberate reference section rather than a leak — but on a site whose entire
   thesis is that nothing names the mechanic, it should be a decision. Left untouched:
   it predates this work and is not part of the catalog rip. **Needs a call.**
6. **The two sites still share a visual identity.** The gallery was deliberately styled to
   match `sonpham-org/autoresearch-arena` so the surfaces read as one system. Now that one
   is research and one is a public front door, that is worth revisiting — a near-black
   monospace researcher grid is not aimed at the audience this site is for.
