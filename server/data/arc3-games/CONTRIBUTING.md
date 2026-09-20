<!--
Author: Claude Opus 5 (Bubba)
Date: 05-September-2026
PURPOSE: The rules for adding or changing a game in server/data/arc3-games/, written for a
         second person with push access to main. Covers id allocation, which files in this
         directory are generated, the spoiler-stripping step a direct file drop bypasses,
         and the Python version the frame renderer needs. Exists because main auto-deploys
         to arc.markbarney.net with no CI and no branch protection.
SRP/DRY check: Pass -- the publish PROCEDURE, in the directory it governs. The scripts keep
         their own docstrings; this does not restate them, it says which to run and when.
-->

# Adding a game to this directory

`main` auto-deploys to <https://arc.markbarney.net> on push. There is no CI and no branch
protection, so nothing here is enforced by a machine. Read it.

## 1. Ids are permanent, and collisions are silent

A game is `gNNN` — the same string in this repo, in the authoring repo, and in
conversation. The id is the primary key for `arc3Triage.json`, the human-play telemetry
and the feedback rows. **Reusing an id does not error; it overwrites a game and reassigns
somebody else's play data to it.**

| Range | Owner |
|---|---|
| `g001`–`g303` | the authoring pipeline (`autoresearch-arena/arc3games/game-ideas/ledger.jsonl`) — do not take ids from here |
| `g500`–`g599` | **reserved for sonpham-org** |

`ls server/data/arc3-games/*.py` before you pick one.

## 2. Five files in this directory are generated. Do not hand-edit them.

`manifest.json`, `frames.json`, `mechanics.json`, `mechanics-notes.json` and every
`frames/gNNN.png` are derived from the `.py` files. Hand-editing them means the site
serves metadata describing a program that is not the one running — no error, no missing
tile, just wrong. After adding or changing any `.py`, run all four:

```bash
PYTHONPATH=external/ARCEngine /opt/homebrew/bin/python3.13 scripts/arc3/render_authored_frames.py
python3 scripts/arc3/build_authored_manifest.py
python3 scripts/arc3/mechanic_digest.py --write
python3 scripts/arc3/build_games_registry.py
```

Commit their output **in the same commit** as the `.py` change.

Without `--write` the digest prints to stdout and writes nothing, so `mechanics.json` stays
stale and the integrity gate fails on it — which reads like a generator problem and is a
missing flag.

Re-running them is *mostly* a no-op. The frame renderer can rewrite PNGs whose pixels are
identical, depending on the image library on your machine, so a dirty tree afterwards is not
proof that something changed. Decode and compare before you commit a frame you did not mean
to touch.

`categories.json` is the exception: it is hand-edited on purpose, one line per game.

## 3. The frame renderer needs Python 3.13

`external/ARCEngine/arcengine/base_game.py` uses a `match` statement. The system
`python3` is 3.9 and fails with `SyntaxError` at `base_game.py:492`, which reads like a
broken engine and is not. Use `/opt/homebrew/bin/python3.13`.

## 4. A game's prose must not name its own mechanic

These files are served from a public endpoint, and a player is meant to infer the rules
from the frame. Games authored in `autoresearch-arena/arc3games` come in through
`scripts/arc3/import_authored_games.py --source <dir>`, which runs
`strip_authoring_text.py` to cut the docstrings and comments that name the mechanic.

**Copying a `.py` straight into this directory bypasses that strip.** If your game is not
coming through the importer, then before you commit: no docstring and no comment may state
what the player is supposed to figure out.

### Class names ARE allowed to be descriptive

`class WeighStation` is fine, and is better than `class G021`. This repository is where the
work on these games happens, and naming everything `GNNN` costs every reader for no gain.
Six games are already named this way: `g008`, `g021`, `g043`, `g045`, `g050`, `g162`.

The rule is about the UI, and only the UI. A player meeting a task for the first time must
not be **shown** what it is, because the experiment is whether a person can infer the rules
from the frame. That is a statement about what the play surface renders — not about what
strings exist in this repository, in a JSON payload, or in the Python a browser can read in
devtools. Today nothing in the client renders `className` at all: it is read by the Pyodide
hook to instantiate the class, and the play page shows no game title.

Two rules used to be written down here and both were wrong:

- **"Class names must be derived (`g007_tumble_block.py` → `class G007`)."** Banned a
  harmless thing, and the importer enforced it by renaming every class on the way in.
  `import_authored_games.py` no longer does this.
- **"The catalog masks `class_name` on the way out."** Briefly true on 2026-09-12, then
  removed — it was machinery for a leak that never reached a player.

If a name ever does need keeping off a screen, fix the component that would render it.

## 5. Before you push

```bash
git pull --rebase origin main   # frames/*.png are binary; a conflict here is not mergeable
git status                      # must be clean after the four generators
```

Two people push to this branch. Rebase first, every time.
