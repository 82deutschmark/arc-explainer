# 30–31 Aug 2026 — arc3.markbarney.net becomes a blind play surface mirroring arc3.sonpham.net

**Author:** Claude Opus 5
**Status:** Shipped, 30–31 Aug 2026, across nine commits (`6a3b679`…`c0e6025`),
CHANGELOG 8.0.0 → 9.1.2. Open items at the bottom.

**Read this first if you are picking the work up:** the mirror (below) was the easy half.
The hard half was that the play surface did not actually work, for four independent
reasons, three of which were invisible to any test that did not run a real browser
against a real game. They are documented in "The four reasons games were unplayable".

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

> **CORRECTION, 03-Sep-2026.** The repo named below is the WRONG one. The live site
> deploys from **`sonpham-org/arc-3`** — with the hyphen — where the manifest is
> `docs/static/games/manifest.json` (877 rows, byte-identical to what the site serves).
> `sonpham-org/arc3` has not deployed since 27-Jul and carries 298 rows;
> `sonpham-org/arc-agi-3` has not been touched since May. Two PRs went to the wrong
> repo, one of them because this line said so. The rest of this section describes the
> deploy accurately; only the repo name is wrong.

Railway deploy of `sonpham-org/arc3` — Caddy static server on :8081 behind
oauth2-proxy. `entrypoint.sh` marks `^/$` and `^/static/` as skip-auth and gates
everything else. So the catalog (`/static/games/manifest.json`, 300 games) and every
game's Python source are already public; `internal.html`, runs, viewer, harness and
`/data/*` are not. The auth split we needed already existed.

`/Users/macmini/GitHub/arc3-site` is a checkout of the live repo — port 8776 locally.
It used to point at a fork of the wrong one (`82deutschmark/arc3`), which is where the
stranded favicon PR came from; repointed to `sonpham-org/arc-3` on 03-Sep-2026, `origin`
now being the live repo and the stale `fork` remote removed.

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

## Two regressions found and fixed (30 Aug)

Both were pre-existing and had made the play surface non-functional. The second of these
turned out to be only the first of four independent causes — see "The four reasons games
were unplayable" below, written after the remaining three surfaced.

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

## Second pass — 31 Aug 2026, full arc-explainer sweep

**Dead pages removed.** Five arc3 pages were imported into `App.tsx` but never routed —
unreachable code shipping in every bundle: `Arc3GamesBrowser`, `ARC3Browser`,
`Arc3CodexPlayground`, `Arc3HaikuPlayground`, `Arc3OpenRouterPlayground`. Deleting them
orphaned three backend routers with no remaining client or script reference, removed too:
`arc3Codex`, `arc3Haiku`, `arc3OpenRouter` (796 lines). `server/routes/arc3OpenAI.ts` was
already never mounted — left in place, flagged below.

**The spoiler leak path is now labelled at every entrance.** `/arc3` (`Arc3Story`)
publishes a table naming the mechanic of six official games — *Locksmith*, *Functional
Tiles*, *Volume Control*, *Loop and Pull*, *Streaming Purple* — with input scheme,
difficulty, and links into full write-ups at `/arc3/games/:id`. **Five of those six
(`ls20`, `ft09`, `lp85`, `sp80`, `vc33`) are in the mirrored catalog and offered for blind
play.** The new landing footer linked to it as a bare "ARC-AGI-3 reference", so the play
funnel walked people into it.

Not deleted — these are the official ARC Prize preview games, documented publicly on
arcprize.org, and the page is legitimate reference. Instead:
- landing footer link relabelled "Reference (spoilers)"
- nav description now reads "contains spoilers for six official games"
- a prominent amber warning above the game tables on `/arc3`, naming the stakes: play
  first, because reading it makes your attempt useless as baseline data

**Kept deliberately:** `/arc3/playground` (`ARC3AgentPlayground`) — running an LLM agent
against a game is research-side and arguably Son's, but it is a live working page and
removing it is beyond "how we serve games to the public". Flagged, not touched.

## The four reasons games were unplayable

All four were live simultaneously. Each masked the next, which is why this took four
passes to bottom out — and why the field reports ("none of the buttons work", "Game Over
immediately") stayed identical after fixes that were genuinely correct.

**1. `GameAction(int(id))` instead of `GameAction.from_id(int(id))`** — commit `6a3b679`.
In the published arcengine wheel each member is a tuple, `ACTION2 = (2, SimpleAction)`, so
by-value lookup rejects a bare action id: `ValueError: 2 is not a valid GameAction`. The
vendored `external/ARCEngine` sets `_value_ = action_id`, so the constructor works there
and the bug is invisible to anything not running the published wheel. `load_game` and
`RESET` never hit that path, so only *stepping* failed — inside a worker, where the error
was swallowed. Board renders, controls dead.

**2. Controls were offered that the game rejects** — commit `a6f1e99`. Every game declares
`available_actions` and most accept a subset: `ac02` is click-only (`[6]`), `ar02` is
d-pad-only (`[1,2,3,4]`), `q004-v1` omits ACTION2. The page showed all seven. On a
click-only game the d-pad did nothing; on `q004-v1` one press of Down went straight to
GAME_OVER, measured `NOT_FINISHED -> GAME_OVER` at counter 1. Controls are now built from
`available_actions`, and the dispatcher refuses an unavailable action even if a keypress
evades the UI. RESET is id 0, never appears in `available_actions`, and deliberately
bypasses the gate.

**3. "Click the board" is the wrong affordance for ACTION6** — commit `0e25b34`. Not every
game treats ACTION6 as a spatial click. In `q598-v1` it is a *submit*: arrows build a
command, ACTION5 banks a subgoal, and ACTION6 declares you are finished —
`if progress == len(cmd) and ... else: self.lose()`. A player clicking the board to see
what happens submits an empty answer and dies on move one. Note that fix 2 could not catch
this: `q598` declares `[1,2,3,4,5,6]`, so ACTION6 *is* available. It is available and
fatal. The board is no longer clickable at all; ACTION6 is a labelled CLICK button on the
console deck, as on arcprize.org.

`q598-v1` also explains the other half of that report: it buffers arrow presses without
repainting every time (measured — the second press changes no pixels), so a working game
looked dead. The step readout and button feedback are the only signal an action landed.

**4. The worker was pinned in browser cache for a year** — commit `c0e6025`. THE ONE THAT
MATTERED MOST, and the reason fixes 1–3 appeared not to work. `express.static` set
`max-age=31536000` on every `.js`. Correct for Vite's `/assets/` output, whose filenames
carry a content hash; catastrophic for anything copied verbatim out of `client/public`.
`pyodide-game-worker.js` has a fixed name, so once a browser had a copy **no deploy could
ever reach it**. A Windows machine was still running a worker predating fix 1 — every
button throwing, silently — and would have kept doing so for a year.

Diagnosed from a network trace: it showed the browser fetching the engine from
`pypi.org`/`files.pythonhosted.org` while prod was serving the same-origin version
correctly. The page was current; the worker was not.

Now: the immutable year applies only to `/assets/`; other js/css gets
`max-age=300, must-revalidate`; and the worker URL carries `__BUILD_ID__`, stamped by
Vite `define`, so every deploy requests a URL no cache has seen.

**Lesson worth keeping:** an unhashed asset served with an immutable cache header is not a
performance detail, it is a permanent deploy blocker, and it presents as "your fix did not
work" rather than as a caching problem.

## The player

`CommunityGamePlay.tsx` was rewritten twice on 31-Aug and now renders `Arc3Console`, a
reproduction of the arcprize.org task console: moulded body, inset screen with scanlines,
d-pad, two columns of labelled pills, task id + `LEVEL x / y` chips, START screen.

- Routed **outside** `PageLayout`, which renders `AppHeader` on every route — the page had
  been stacking its own header under the site nav ("double nav bar").
- **Undo**: 50-step stack in the worker (deepcopy of game object and frame, matching Son's
  engine), surfaced as `undo_depth`. A blind player's first move is a guess by
  construction, so one wrong guess should not cost the run.
- **Live mode** for `isLive` tasks, which could not be played turn-based at all. Ticks are
  **not** recorded as actions — at 10–30fps they would swamp the event table and make
  human counts incomparable to agent ones, the same reasoning `HumanPlayRepository`
  applies to RESET.
- **HELP** explains the controls only, never the task, so it cannot leak a mechanic.
- Unavailable controls are dimmed in place rather than removed, so the deck does not
  reflow between tasks.

Not ported from Son's player: the tile-skin and frame-filter bars (researcher
instrumentation), and the game title, which this site must never show.

## Catalog growth, and a bug it exposed

Upstream went from 300 games to **877** overnight, publishing 571 under a new category,
`ai-generated` — the Discord agent pipeline. The gallery had its three categories
hardcoded and silently skipped every one of them: it rendered "1–60 of 877" while drawing
none, and a search for `q00` returned neither tiles nor an empty state.

Fixed in `e8d8f34`: unknown categories render under their own slug, and `category` is an
open string end to end. Both public surfaces now lead with the pipeline set — gallery
sections ordered Fresh off the pipeline → Built in-house → Community catalog → ARC Prize
Foundation, with filter chips so the official 25 stay one click away rather than ten pages
deep; landing hero, preview strip and the "nobody has played this one" callout all prefer
unplayed pipeline tasks.

## Landed since, from the other branch (PR #447, 31-Aug)

Recorded here so this doc stays the single handoff. Full detail in CHANGELOG 9.3.0–9.5.0.

- **Half the generated set is broken at one end or the other.** 20 of 50 audited games
  cannot be lost, which makes brute-forcing every action the winning strategy — the one
  thing machines beat people at. Four ended the run on a single mistake. All four had
  tests *requiring* that behaviour, which is why nothing caught it.
- **The official 25 were obtained as Python source** (via the official toolkit, not
  GitHub) and contradict a fix shipped hours earlier: every one of the 25 ends the run on
  failure and none restarts a level, so changing four of ours to restart was a regression.
  It is recorded rather than reverted so the audit decides. **It does not reach our
  players** — `g010`/`g020`/`g021`/`g023` are arena-repo only and are not in the mirrored
  catalog (checked 01-Sep). Their median game is ~2,100 lines against our 440.
- **A ranked review queue** at `/arc3/review`, with `Next` walking the 328 worth a human's
  time instead of the raw catalog, and a "Review 17 / 328" readout. 66 of the 571
  generated tasks are near-duplicates on consecutive ids; 177 more lose a level to random
  input. Culled tasks are still served with their reason so a cull can be overruled.

## Open

1. **Verify telemetry actually writes in prod.** Still the one unverified link, and it is
   the reason the site exists. There is no local `DATABASE_URL`, so
   `POST /api/arc3-play/human-events` returns 200 and stores nothing here. Play one game,
   then check `/api/arc3-play/human-stats` is not `{"games":[],"levels":[]}`.
2. **Existing telemetry rows are not trustworthy.** Two independent reasons to discard
   anything collected before 31-Aug: a player who pressed an unavailable key on a game
   like `q004-v1` recorded a **fabricated loss**, and machines on a stale cached worker
   recorded sessions that started and never moved. Both are indistinguishable from real
   rows.
3. **Sync with Son** — confirm the split, and whether he wants a CORS header on `/static/`
   as a lighter alternative to the mirror (recommend keeping the mirror regardless: it is
   where stripping happens).
4. ~~There is still no feedback mechanism on the play surface.~~ **Shipped 31-Aug**
   (CHANGELOG 9.2.0): six checkboxes, a notes scratchpad and Next, on the game-over screen
   and on the console's NOTES control. Whether it *writes* is covered by item 1 — it has
   the same unverified-persistence caveat as the event stream.
5. **Triage goes stale silently.** `arc3Triage.json` covers exactly the 571 generated
   tasks that exist today (verified complete, 01-Sep). The next pipeline batch will have
   no verdict and will fall through to the fallback ordering with nothing saying so.
   Regenerate with `arc3games/{probe_one,funnel}.py` in the arena repo when a batch lands,
   or teach the endpoint to report untriaged tasks so the gap is visible.
6. **Slug collisions are not a safe join key.** Son's manifest has 6: `cr01` is both
   *Crumbling Route* and *Creek Crossing*; `pt01` is both *Pirate Seas* and *Pattern
   Rotation*. We key on the full upstream id and are fine — any future "match on the slug"
   ingestion will silently merge unrelated games.
7. **Some opening frames are near-blank** (e.g. `ar25`) because that genuinely is the first
   frame. Honest, but a poor tile. Consider rendering frame N>0 for those.
8. **`server/routes/arc3OpenAI.ts`** (120 lines) is not mounted and never was. Dead.
9. **`/arc3/playground` is agent tooling on the human-play site.** Works, left in place.
   Belongs on Son's side if the split is taken literally. **Needs a call.**
10. **The two sites still share a visual identity** outside the play page. The gallery was
   styled to match `sonpham-org/autoresearch-arena` so the surfaces read as one system.
   Now that one is research and one is a public front door, a near-black monospace
   researcher grid is not aimed at the audience this site is for.
11. ~~`/arc3/games/:gameId` is a spoiler page two clicks from the play grid.~~ **Handled
    31-Aug** (`37ff253`): content kept — these are official ARC Prize games documented on
    arcprize.org — but every entrance is labelled, and `/arc3` carries a warning above the
    tables.
