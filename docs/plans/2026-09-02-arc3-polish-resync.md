<!--
Author: Claude Opus 5 (Bubba)
Date: 02-September-2026
PURPOSE: Handoff for re-syncing hand-authored ARC-3 tasks from the private authoring repo into
         this one after those tasks are revised. Explains why the copies drift, the id-stability
         constraint that makes a careless re-import destructive, the exact commands, what is
         automated versus manual, and what this pass deliberately left undone. Written so another
         assistant can repeat or finish the work without the session that produced it.
SRP/DRY check: Pass -- docs/plans/2026-09-01-arc3-catalog-flip.md covers the one-way ownership
         flip (who owns the catalog); nothing covered the recurring re-sync after that flip, which
         is a different job with a different hazard. That doc is not modified by this work.
-->

# ARC-3 polish re-sync — keeping the published catalog current

> **Note, 03-Sep-2026.** Written before the id rename. Published ids are no longer
> `t<hex>` — a game is `g017` in both repos (commit `226d7ca4`), and
> `import_authored_games.py` no longer hashes. Read `tXXXXXXXX.py` below as `gNNN.py`.
> Everything else — the three-copy chain, and why `--check` reports clean against a stale
> `dist/` — is unchanged and is the reason this doc is on main.

## What this is

The flip (`docs/plans/2026-09-01-arc3-catalog-flip.md`) moved our 50 hand-authored ARC-3 tasks
into this repo, published under opaque ids. That was a one-shot migration. This doc covers what
happens **every time afterwards**: an authored task gets revised upstream, and the copy this repo
serves has to catch up without breaking anything downstream.

This pass re-synced three revised tasks. The mechanics of doing it are five commands; the reason
it needs a document is the id-stability constraint in the next section, which is easy to violate
and expensive to discover.

## Why the copies drift — there are three copies, not two

The framing "two copies drift" undersells it. The chain is:

| # | Where | What it is | Who updates it |
| --- | --- | --- | --- |
| 1 | arena `arc3games/gNNN_*.py` | authoring source, carries full design prose | a human or agent revising a game |
| 2 | arena `arc3games/dist/gNNN_*.py` | publish artifact: prose stripped, legibility gate passed | `make_submission.py`, **run by hand, per file** |
| 3 | this repo `server/data/arc3-games/tXXXXXXXX.py` | what the site serves, renamed to opaque ids | `import_authored_games.py`, run by hand |

**The drift originates at boundary 1→2, not 2→3.** Nothing rebuilds `dist/` as part of authoring.
There is no batch build script and no hook, so revising a game updates copy 1 and silently stops
there. A re-sync that starts from `dist/` therefore faithfully republishes a stale artifact and
reports success.

That is exactly what had happened here. Of four tasks revised upstream since the migration, three
had their `dist/` entries rebuilt and one did not — and the one that did not was invisible to this
repo's own `--check`, because `--check` compares the published copy against an import of `dist/`,
and the published copy *did* match the stale `dist/`. **Check boundary 1→2 first, or the drift you
are fixing is not the drift you will find.**

A fourth task showed up as revised and needed no republish, for a duller reason: its rewrite
landed at 15:03 on 01-Sep and the migration import ran at 16:35 the same day, so the published
copy already carried it. **"Revised recently" is the wrong question; "revised since the last
import commit" is the right one.** Measure against the import commit's timestamp, not against a
calendar date, or you will chase games that are already current.

(Separately and generally: a revision confined to the module docstring produces no `dist/` change
and no re-sync here, because the packager strips docstrings. That is correct behaviour rather than
a missed rebuild — but it was not what happened to any game in this pass.)

## The constraint that makes this dangerous: ids must not churn

Published names are derived, not chosen:

```
published id    = "t" + sha256("arena:" + <authoring id>)[:8]      e.g. from "g026"
published class = "G" + sha256("arena:" + <authoring class>)[:8]
```

`<authoring id>` is the **leading `gNNN` token of the filename only** (`AUTHORED_ID_RE`). The
mechanic suffix is not an input, and neither is file content.

Three consequences, in order of how much damage getting them wrong does:

1. **Ids are stable across revision.** A game can be rewritten from scratch, reskinned, or have
   its boards replaced, and its published id does not move. This is the property that makes
   re-syncing safe at all, and it is why a revision is a content-only diff.
2. **Renumbering an authoring file orphans its data.** Rename `gNNN_*` to a different `gNNN` and
   the published id changes. Every triage row, human-play session and feedback row keyed to the
   old id then addresses a game that no longer exists — they will type-check, sort, and point at
   nothing. **If a re-sync ever changes `manifest.json`, stop and find out why.** In a pure
   content re-sync the manifest is byte-identical.
3. **The class name is hashed from the authoring class name.** Renaming the class upstream churns
   `class_name` without churning `id`. That does not orphan telemetry (which is keyed on id) but
   it does move the manifest, so it trips the check in (2) and needs a deliberate look.

The orphan surfaces are `server/services/arc3Mirror/arc3Triage.json` (checkable locally — all 50
published ids must appear in it) and the `community_game_events` / `community_human_sessions`
tables (**not** checkable locally; the guarantee there is the frozen derivation, nothing else).
Because the database cannot be asserted against from a dev box, treat the frozen derivation as
load-bearing: changing the prefix, the `arena` source key, or the hash is not a refactor.

## Two things that must not be "simplified"

- **Import from `dist/`, never from `arc3games/` directly.** `import_authored_games.py` rewrites
  *names* only. The docstring and comment strip — the thing that stops a public source endpoint
  from handing a player the mechanic — lives entirely in the arena's `make_submission.py`.
  Pointing `--source` at the authoring directory produces files that import cleanly, pass every
  check in this repo, and permanently leak the answer to every game. `make_submission.py` also
  refuses to package a game the legibility gate rejects, so skipping it skips that gate too.
- **`--map-out` goes outside this repo and is never committed.** It refuses to write inside the
  repository by design. A committed slug→id table would undo the entire opacity layer in one file.
  For the same reason this document names no `tXXXXXXXX` id and no mechanic suffix: pairing them,
  even in separate lists in the same file, reconstructs the map.

## The procedure

Run from a branch off `origin/main` (the published catalog and the triage file both live there;
confirm with `git ls-tree origin/main server/data/arc3-games/`).

**Step 1 — refresh the arena's publish artifacts (the step that is usually the actual drift).**
In the arena repo, rebuild every game and compare against what is committed:

```bash
cd <arena>/arc3games
cp -r dist /tmp/dist.backup.$(date +%Y%m%d-%H%M%S)
mkdir -p /tmp/dist-rebuild
for f in g*.py; do
  case "$f" in verify_*) continue;; esac
  python3 make_submission.py "$f" /tmp/dist-rebuild/"$f" || echo "GATE FAILED: $f"
done
for f in /tmp/dist-rebuild/*.py; do
  cmp -s "$f" dist/"$(basename "$f")" || echo "dist stale: $(basename "$f")"
done
```

Copy the stale ones into `dist/` and commit that separately in the arena repo. A gate failure is
a real finding — the game is unpublishable until fixed upstream, not something to force past.

**Step 2 — see what would change here, before changing it.**

```bash
cd <arc-explainer>
python3 scripts/arc3/import_authored_games.py \
  --source <arena>/arc3games/dist --map-out /tmp/arc3-map-check.json --check
```

Writes nothing; exits 1 and names the published files that differ. This is also the command that
enumerates the affected published ids, which is why they are not listed in this document.

**Step 3 — import and regenerate the manifest.**

```bash
python3 scripts/arc3/import_authored_games.py \
  --source <arena>/arc3games/dist --map-out /tmp/arc3-authored-map.json
python3 scripts/arc3/build_authored_manifest.py
git status --short -- server/data/arc3-games/
```

The manifest is generated from the directory, never hand-edited.

**Step 4 — verify. `manifest.json` appearing in `git status` is the alarm.**

```bash
python3 - <<'PY'
import json
m={e['id'] for e in json.load(open('server/data/arc3-games/manifest.json'))}
t=json.load(open('server/services/arc3Mirror/arc3Triage.json'))
tid={r['gameId'] for r in t['games']}
print('published:',len(m),'covered by triage:',len(m&tid))
assert m<=tid, sorted(m-tid)
PY
```

Then confirm every published file still parses and declares the class the manifest names, and
that each one instantiates. **Use Python 3.10+** — ARCEngine uses `match`, and the system 3.9 on
the Mini fails with a `SyntaxError` inside the engine that looks like a broken game and is not:

```bash
PYTHONPATH=external/ARCEngine /opt/homebrew/bin/python3.13 - <<'PY'
import json,pathlib,importlib.util
d=pathlib.Path('server/data/arc3-games')
ok=0; bad=[]
for e in json.load(open(d/'manifest.json')):
    spec=importlib.util.spec_from_file_location('pub_'+e['id'], d/e['src_file'])
    mod=importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod); getattr(mod,e['class_name'])(); ok+=1
    except Exception as ex: bad.append((e['id'], type(ex).__name__))
print('instantiated',ok,'/ 50', bad)
PY
```

## What this pass did

Boundary 1→2: one game's `dist/` artifact was stale and was rebuilt (arena side). All 50 games
rebuild through `make_submission.py` and the legibility gate passes on all 50.

Boundary 2→3: three published task files changed, content only. `manifest.json` is byte-identical
— no id churn, no class-name churn. All 50 published ids remain covered by `arc3Triage.json`
(50/50), all 50 parse and declare their manifest class, and all 50 instantiate against ARCEngine
under Python 3.13.

The arena's own verifiers for the three revised games (`verify_gNNN.py`, run with
`PYTHONPATH=<arc-explainer>/external/ARCEngine:.` under 3.13) all report PASS: each game is
chain-solvable to a win across every level, and each one's death/reset behaviour matches the
claims its rebuild commit makes. Run these — they are the difference between "the file loads" and
"the rebuild still does what it says".

Not done: the site was not driven in a browser and no revised game was played by a human. Passing
a verifier proves a game is winnable and behaves as designed, not that it is a *good* game — that
verdict is what the human-baseline pipeline exists to produce.

## Automated vs manual

**Automated:** the name derivation, the manifest generation, the docstring/comment strip, the
legibility gate, and `--check` as a drift detector between copies 2 and 3.

**Manual, every time:** noticing a revision happened at all; running `make_submission.py` per
revised file; running the import; opening both PRs. There is no scheduled job, no hook, and
nothing that fails loudly if a re-sync is simply never run — a revised game just keeps serving its
old version indefinitely, and the site gives no sign of it.

**Manual and unguarded:** the boundary 1→2 check. `--check` in this repo cannot see it. Until
something closes that gap, the loop `revise upstream → forget to rebuild dist → re-sync reports
clean` is open, and it is the failure this pass actually found.

## Left undone

- **No automation of the re-sync.** The obvious fix is a CI check in the arena repo that fails
  when any `dist/` artifact does not match a fresh `make_submission.py` of its source — that
  closes the 1→2 gap at the boundary where it opens, and it is a few lines. It was not built here
  because it is an arena-repo change and this pass was scoped to getting the current content
  correct. It is the highest-value next step.
- **B1–B3 from the flip doc** (repointing the arena generator's publish step at this repo,
  consuming the promotion export, retiring `arc3games/dist` as a publish target) remain untouched.
  Per the flip doc these need Son, and the conversation is the Boss's to have. Anything that
  reduces the three copies to two makes this whole document obsolete, which is the real fix.
- **A5, the promotion export**, is still not built; it is unrelated to re-syncing but is the other
  half of the loop.
- **A slug→id pair for one game is already in this repo's public history.** `CHANGELOG.md` — in
  entries predating this work — names one authoring filename beside its published id, and another
  entry gives a second example id. That is the exact pairing the rest of this document forbids.
  It was left alone deliberately: the lines are already public, so editing the file does not
  unpublish anything, and rewriting published history on a public repo is a worse remedy than the
  leak. Do not "fix" it by rewriting history. What is genuinely open is whether that one game's
  human-baseline data is still usable given the mechanic was discoverable — a judgement call for
  the Boss, not a code change. The rule stands for everything going forward; this is one known
  exception, not a sign the rule is decorative.
- **No check that a revision was intentional.** Nothing here distinguishes a deliberate rebuild
  from an accidental edit upstream. The content diff is reviewed by a human reading the PR, or not
  at all.

## Correction to the flip doc

`docs/plans/2026-09-01-arc3-catalog-flip.md` is deliberately left unmodified, so a correction it
would otherwise need is recorded here instead: that doc's procedure describes `--source` as
`/path/to/authored/dist` without stating that `dist/` is itself hand-maintained and routinely
stale. Read as written, it produces a confident no-op re-sync. The Step 1 above is the missing
half.
