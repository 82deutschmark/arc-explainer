<!--
Author: Claude Opus 5 (Bubba)
Date: 01-September-2026
PURPOSE: Handoff plan for inverting the ARC-3 game pipeline. Today the arena repo authors games
         and arc-explainer mirrors them over HTTP; this flips it so arc-explainer is the
         first-party home for our authored catalog and the arena pulls back only the games that
         earn a human baseline. Split by repo and owner for handoff to coding assistants.
SRP/DRY check: Pass -- new plan doc; no existing doc covers the catalog ownership inversion.
                Builds on PR #448 (two-source mirror) rather than redoing it.
-->

# ARC-3 catalog flip — who does what, in which repo

## Why

`arc-explainer` is fully public, no secrets. `sonpham-org/autoresearch-arena` is **private**.
PR #448 made the site read two catalogs — Son's 877 upstream, plus our 50 — but our 50 are
fetched from the private arena repo, so as shipped that source cannot load in production:

- `ARENA_UPSTREAM` defaults to `raw.githubusercontent.com/sonpham-org/autoresearch-arena/master/arc3games/dist`, which 404s while the repo is private. There is a documented `ARC3_ARENA_TOKEN` / `api.github.com/contents` path, but it needs a token on Railway.
- Separately, **`arc3games/dist/manifest.json` does not exist on `master`** (verified 01-Sep-2026 via `git ls-tree -r origin/master`). The 51 `.py` files are there; the manifest the mirror asks for is not.

Both problems disappear if the games simply live in the public repo. That is the flip.

## Blocker to fix first — our filenames name the mechanic

The mirror exists to strip `title`/`description`/`tags` so a human player must infer the rules
from the frame. The audit that justified keeping `id`/`src_file`/`class_name` was run against
**upstream** ids, which are opaque (`gh14` / `gh14.py` / `Gh14`).

Ours are not: every one of ours is `gNNN_<mechanic>.py`, and the mechanic is the answer. PR #448 serves
arena source at `/${entry.src_file}`, so the descriptive slug reaches the client and the strip is
defeated for our 50 games. Moving them into a public repo makes those filenames permanent.

**Rename to opaque ids as part of the migration, and keep the slug→id map out of the public repo.**
This is a prerequisite for task A3, not a nicety.

---

## Repo: `82deutschmark/arc-explainer` (public) — the bulk of the work

**A1. Land PR #448 first.** Everything below depends on its two-source seam and on the telemetry
columns it adds to `community_game_events` / `community_human_sessions`.

**A2. Add a first-party catalog source.** In `server/services/arc3Mirror/Arc3MirrorCatalog.ts`,
the source descriptors are already a parameterised list. Add a third kind that reads from disk in
this repo instead of over HTTP — no fetch, no cache, no TTL, no independent-failure path, because
a local read cannot go stale or fall over. It must emit the exact same stripped entry shape so
`routes/arc3Mirror.ts` and the Pyodide `{sourceCode, className}` contract are untouched.

Acceptance: `/api/arc3-mirror/games` returns upstream + local games; `mirror-status` reports the
local source; killing both remote upstreams still serves our games.

**A3. Import the 50 games** into a directory in this repo, under **opaque ids** (see blocker).
Generate the manifest at build/commit time from the directory rather than hand-maintaining it.

Acceptance: all 50 playable through the existing Pyodide path; no payload field, filename, or
class name names a mechanic.

**A4. Retire the arena remote source.** Once A3 is in, drop `ARENA_UPSTREAM` /
`ARC3_ARENA_TOKEN`. Keep the upstream (Son) source exactly as it is — we do not own that catalog
and it stays a read-only mirror.

**A5. Promotion export.** A read-only endpoint over `HumanPlayRepository` that emits the ids
clearing a human-baseline threshold (completion rate / attempts to first solve — Boss picks the
cut). This is the only place a human baseline exists, so it is the selection signal for the whole
pipeline. JSON, public, no auth.

Acceptance: endpoint returns ids + the stats behind them; empty list when nothing clears.

## Repo: `sonpham-org/autoresearch-arena` (private) — small, and needs Son

**B1. Repoint the generator's publish step** at the arc-explainer directory (PR per batch) instead
of writing into `arc3games/`. Generator and eval harness stay here; the artifacts leave.

**B2. Consume A5.** The eval/bench set pulls the promoted ids rather than sweeping every game
authored locally.

**B3. Delete `arc3games/dist` as a publish target** after A3 verifies. Keep the sources until then.

**Decision for the Boss, not a work item:** this repo is under `sonpham-org`. Moving our catalog
out of it is a conversation with Son first — the two programmes are deliberately competing
catalogs and he should hear it from the Boss, not discover it in a diff.

## Status — 01-Sep-2026, evening

A2, A3 and A4 are **done** and are what this branch contains. The 50 tasks live at
`server/data/arc3-games/<gameId>.py`, published under their opaque ids by
`scripts/arc3/import_authored_games.py`; the manifest is generated from that directory by
`scripts/arc3/build_authored_manifest.py`; the `arena` source now reads from disk and
`ARC3_ARENA_UPSTREAM` / `ARC3_ARENA_TOKEN` are gone. A5 (promotion export) and A6
(attribution — shipped separately in 9.11.0) are not part of it.

Two corrections to what is written above:

- **`arc3games/dist/manifest.json` does exist on `master`.** It was committed at 16:17 ET
  on 01-Sep, in the merge of that repo's PR #19, after this plan was written. The
  verification recorded above was true when it was run. It does not change the decision —
  the repository is private and staying private, so the fetch could not resolve either way.
- **`data/` was the obvious home for the games and would have been a production bug.**
  `railway.json` mounts a persistent volume at `/app/data`, so anything committed under the
  root `data/` directory is shadowed by the mount at runtime: the catalog would have been
  empty in production and full locally. They live under `server/data/` for that reason.

## Sequence

A1 → (blocker rename) → A2 → A3 → A4, with A5 in parallel after A1. B1–B3 only after A3 is
verified live. `webgames/` (10 entries) is a separate, smaller set — decide it after the 50 land.

---

## A6. Attribution for the `redbluepill` community catalog (arc-explainer, independent of the flip)

**The source is `theredbluepill/arc-interactive`** — public, MIT, 54 stars, "A collection of
community game environments for the ARC-AGI-3 benchmark." Son's site already credits it at the
root of arc3.sonpham.net; we serve 252 of its games with no link at all. Under MIT the copyright
and licence notice has to travel with the work, so this is an obligation, not a courtesy.

**The mapping is deterministic and was verified against the full repo tree on 01-Sep-2026:
252 of 252 ids resolve exactly, no misses.** Split the manifest id on its last hyphen — slug and
version — and the source directory is:

```
https://github.com/theredbluepill/arc-interactive/tree/main/environment_files/<slug>/<version>
```

e.g. `ab01-v1` → `environment_files/ab01/v1`, `as01-63be02fb` → `environment_files/as01/63be02fb`.
Both id shapes occur (81 `-vN`, 171 `-<8 hex>`); both follow the same rule. Do not hardcode a
table — derive it, and fall back to the repo root rather than emitting a broken deep link if a
future id ever fails the pattern.

Work: derive the URL for any game whose `category` is `redbluepill`, render it on the gallery
tile and the game's detail surface, and put a standing credit line + MIT notice in the
`Community catalog` section header (`SECTION_LABELS`, `CommunityGallery.tsx:75`), whose note is
currently just "Contributed tasks."

**Spoiler note:** the linked directory holds a `metadata.json` carrying the `title`,
`description` and `tags` the mirror deliberately strips. The *path* is opaque, so the link leaks
nothing on its own — but it is one click from a full spoiler. Same accepted class as "the Python
is readable in devtools." Put the link on the gallery tile and post-game surfaces; keep it off
the live play frame.

Acceptance: every `redbluepill` tile links to a URL that resolves (spot-check both id shapes);
no `redbluepill` game renders without a credit; the section header names the repo and MIT.
