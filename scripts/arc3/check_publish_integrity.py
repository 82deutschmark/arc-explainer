#!/usr/bin/env python3
"""
Author: Claude Opus 5 (Bubba)
Date: 05-September-2026
PURPOSE: The one gate standing between a push to main and arc.markbarney.net. Asserts that
         server/data/arc3-games/ is internally consistent: every published id is one this
         project allocated, no published module still carries the prose that names its own
         mechanic, and every derived artifact matches what its generator would produce from
         the .py files sitting beside it. Runs in the Docker build (see Dockerfile) BEFORE
         `npm run build`, so a bad push fails the image and Railway keeps serving the last
         good deploy -- the failure costs a deploy, not the data.

         WHY A GATE AND NOT A DOCUMENT. server/data/arc3-games/CONTRIBUTING.md says all of
         this in prose, and prose is what we had on 05-Sep-2026 when 48 of 50 games were
         found published from stale bytes with 24 of their frames never re-rendered. The
         site served code and metadata describing different programs, with no error
         anywhere. Two people now push to a branch with no protection, so the invariant
         needs teeth.

         THE THREE CHECKS, AND WHY EACH IS SHAPED THE WAY IT IS.

         1. ID OWNERSHIP reads authored-ids.json, which import_authored_games.py writes
            from the AUTHORING repo's ledger. It cannot be derived from this directory:
            regenerating a manifest from whatever .py files are present agrees with itself
            by construction, so an unauthorised id would pass its own check. The list has
            to come from somewhere a pusher does not control by adding a file. Ids outside
            it are legal only inside a range declared in `reserved`.

         2. SPOILER PROSE is checked as an idempotency, not a wordlist: a published module
            must satisfy strip_authoring_text(src) == src. Games imported through
            import_authored_games.py already went through that strip, so they are fixed
            points. A .py copied straight into this directory is not. No wordlist to keep
            current and no false positives.

         3. DERIVED ARTIFACTS are regenerated in a scratch tree -- the four generators are
            run against a temp copy, never against the working tree -- and compared. JSON
            is compared byte for byte because it is json.dumps output and deterministic.
            PNGs are compared as PIXEL ARRAYS, never as bytes: render_authored_frames.py
            saves with optimize=True, so the bytes depend on the Pillow and zlib versions,
            and local python3.13 vs Alpine's pillow would disagree on identical images and
            redden a clean tree.

         Exit 0 clean, 1 on any violation, and every violation names the file.
         Usage:  PYTHONPATH=external/ARCEngine python3 scripts/arc3/check_publish_integrity.py
SRP/DRY check: Pass -- verification only. It owns no generation logic: it shells out to the
         four real generators in a scratch tree, so a rule can never drift from the script
         that enforces it. The spoiler rule imports strip_authoring_text rather than
         restating what it strips.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from strip_authoring_text import strip_authoring_text  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
GAMES_DIR = REPO / "server" / "data" / "arc3-games"
ALLOCATIONS = GAMES_DIR / "authored-ids.json"

#: Published game modules are `gNNN.py` and nothing else.
PUBLISHED_RE = re.compile(r"^g\d+$")

#: Derived JSON in the games directory, compared byte for byte.
DERIVED_JSON = ("manifest.json", "frames.json", "mechanics.json")

#: Derived markdown outside the games directory.
DERIVED_DOCS = ("docs/arc3-games-registry.md",)

#: The generators, in dependency order: frames feed frames.json, mechanics feeds the
#: registry. Each is `(argv-after-the-script, script name)`.
GENERATORS = (
    ("render_authored_frames.py", []),
    ("build_authored_manifest.py", []),
    ("mechanic_digest.py", ["--write"]),
    ("build_games_registry.py", []),
)


def published_ids() -> list[str]:
    return sorted(p.stem for p in GAMES_DIR.glob("*.py") if PUBLISHED_RE.match(p.stem))


def support_names() -> list[str]:
    """Shared modules published beside the games because the games import them."""
    if not ALLOCATIONS.is_file():
        return []
    doc = json.loads(ALLOCATIONS.read_text(encoding="utf-8"))
    return sorted(doc.get("support", []))


def check_ids(failures: list[str]) -> None:
    """Every published id is one this project allocated, or sits in a reserved range."""
    if not ALLOCATIONS.is_file():
        failures.append(
            f"{ALLOCATIONS.relative_to(REPO)} is missing. It is written by "
            "import_authored_games.py from the authoring ledger; without it no id can be "
            "checked against anything a pusher does not control."
        )
        return

    doc = json.loads(ALLOCATIONS.read_text(encoding="utf-8"))
    authored = set(doc.get("authored", []))
    reserved = doc.get("reserved", {})

    def owner_of(game_id: str) -> str | None:
        if game_id in authored:
            return "authoring pipeline"
        n = int(game_id[1:])
        for who, span in reserved.items():
            if span["from"] <= n <= span["to"]:
                return who
        return None

    for game_id in published_ids():
        if owner_of(game_id) is None:
            ranges = ", ".join(
                f"{who} g{span['from']:03d}-g{span['to']:03d}" for who, span in reserved.items()
            )
            failures.append(
                f"server/data/arc3-games/{game_id}.py: id {game_id} is not in "
                f"authored-ids.json and not in a reserved range ({ranges}). Reusing or "
                "inventing an id silently overwrites a game and reassigns its telemetry."
            )

    # Anything else that is not a game and not a declared support module has no business
    # being served from this directory.
    known = set(published_ids()) | set(support_names())
    for path in sorted(GAMES_DIR.glob("*.py")):
        if path.stem.startswith("__") or path.stem in known:
            continue
        failures.append(
            f"server/data/arc3-games/{path.name} is neither a published game nor a "
            "support module declared in authored-ids.json. Publish through "
            "scripts/arc3/import_authored_games.py."
        )


#: import_authored_games.py:219 stamps this line onto the stripped body, so a published
#: file is `header + strip(source)` and is a fixed point only once the header is off.
PUBLISHED_HEADER = "# ARC-AGI-3 candidate task {game_id}.\n\n"


#: import_authored_games.py stamps this on a shared module it publishes beside the games.
SUPPORT_HEADER = "# ARC-AGI-3 authoring support module.\n\n"


def _published_modules() -> list[tuple[str, str]]:
    """Every .py this directory is allowed to hold, with the header it must carry."""
    mods = [(gid, PUBLISHED_HEADER.format(game_id=gid)) for gid in published_ids()]
    mods += [(name, SUPPORT_HEADER) for name in support_names()]
    return mods


def check_spoilers(failures: list[str]) -> None:
    """A published module must already be a fixed point of the authoring-text strip.

    The strip is what stands between the authoring prose -- which names the mechanic the
    player is meant to deduce -- and a public endpoint. Anything published through
    import_authored_games.py has been through it and cannot change under a second pass; a
    .py copied straight into this directory has not. Comparing the file against its own
    re-strip catches exactly that, with no wordlist to keep current.
    """
    for name, header in _published_modules():
        path = GAMES_DIR / f"{name}.py"
        src = path.read_text(encoding="utf-8")
        if not src.startswith(header):
            failures.append(
                f"server/data/arc3-games/{name}.py does not start with the published "
                f"header {header.strip()!r}, so it did not come through "
                "scripts/arc3/import_authored_games.py and its authoring prose was never "
                "stripped. These files are served from a public endpoint."
            )
            continue
        body = src[len(header):]
        if strip_authoring_text(body) != body:
            failures.append(
                f"server/data/arc3-games/{name}.py still carries authoring prose "
                "naming its own mechanic. These files are served from a public endpoint. "
                "Publish through scripts/arc3/import_authored_games.py, which strips it."
            )


def scratch_tree(root: Path) -> Path:
    """A minimal repo skeleton the generators can write into instead of the working tree.

    They resolve their paths from `__file__.parents[2]`, so the layout has to be real:
    scripts/arc3 beside server/data/arc3-games, with a docs/ to land the registry in.
    """
    (root / "scripts").mkdir(parents=True)
    shutil.copytree(REPO / "scripts" / "arc3", root / "scripts" / "arc3",
                    ignore=shutil.ignore_patterns("__pycache__"))
    (root / "server" / "data").mkdir(parents=True)
    shutil.copytree(GAMES_DIR, root / "server" / "data" / "arc3-games",
                    ignore=shutil.ignore_patterns("__pycache__"))
    # The renderer parses the palette out of the app's own colour table rather than
    # keeping a second copy, so the scratch tree needs it too.
    shutil.copytree(REPO / "shared" / "config", root / "shared" / "config",
                    ignore=shutil.ignore_patterns("__pycache__"))
    # mechanic_digest.py JOINS the triage verdicts in; without them every row's `triage`
    # comes back null and the regenerated digest differs from the committed one for a
    # reason that has nothing to do with the games.
    triage = REPO / "server" / "services" / "arc3Mirror" / "arc3Triage.json"
    if triage.is_file():
        (root / "server" / "services" / "arc3Mirror").mkdir(parents=True)
        shutil.copy2(triage, root / "server" / "services" / "arc3Mirror" / triage.name)
    (root / "docs").mkdir()
    for rel in DERIVED_DOCS:
        src = REPO / rel
        if src.is_file():
            shutil.copy2(src, root / rel)
    return root


def regenerate(root: Path, failures: list[str]) -> bool:
    env = dict(os.environ)
    engine = REPO / "external" / "ARCEngine"
    if engine.is_dir():
        env["PYTHONPATH"] = os.pathsep.join(
            [str(engine)] + ([env["PYTHONPATH"]] if env.get("PYTHONPATH") else [])
        )
    for script, extra in GENERATORS:
        proc = subprocess.run(
            [sys.executable, str(root / "scripts" / "arc3" / script), *extra],
            cwd=root, env=env, capture_output=True, text=True,
        )
        if proc.returncode != 0 or "FAILED" in proc.stdout or "FAILED" in proc.stderr:
            tail = (proc.stderr or proc.stdout).strip().splitlines()[-6:]
            failures.append(
                f"scripts/arc3/{script} could not run against a copy of the published "
                "games, so the artifacts cannot be verified:\n    " + "\n    ".join(tail)
            )
            return False
    return True


def check_derived(failures: list[str]) -> None:
    """Regenerate every derived artifact in a scratch tree and compare it to the committed one."""
    import numpy as np
    from PIL import Image

    with tempfile.TemporaryDirectory() as tmp:
        root = scratch_tree(Path(tmp) / "repo")
        if not regenerate(root, failures):
            return

        fresh_games = root / "server" / "data" / "arc3-games"

        for name in DERIVED_JSON:
            want, got = fresh_games / name, GAMES_DIR / name
            if not want.is_file():
                continue
            if not got.is_file():
                failures.append(f"server/data/arc3-games/{name} is missing; its generator produces it.")
            elif want.read_bytes() != got.read_bytes():
                failures.append(
                    f"server/data/arc3-games/{name} is stale -- it does not match what its "
                    "generator produces from the .py files beside it. Re-run the generators "
                    "and commit their output in the same commit as the .py change."
                )

        for rel in DERIVED_DOCS:
            want, got = root / rel, REPO / rel
            if want.is_file() and (not got.is_file() or want.read_bytes() != got.read_bytes()):
                failures.append(f"{rel} is stale; re-run scripts/arc3/build_games_registry.py.")

        for png in sorted((fresh_games / "frames").glob("g*.png")):
            got = GAMES_DIR / "frames" / png.name
            if not got.is_file():
                failures.append(f"server/data/arc3-games/frames/{png.name} is missing.")
                continue
            # Pixels, not bytes: optimize=True makes the encoding Pillow/zlib dependent.
            if not np.array_equal(np.array(Image.open(png)), np.array(Image.open(got))):
                failures.append(
                    f"server/data/arc3-games/frames/{png.name} does not match the opening "
                    f"frame {png.stem}.py actually renders. The game was changed and the "
                    "frame was not re-rendered; the site would describe a different program."
                )


def main() -> int:
    failures: list[str] = []
    check_ids(failures)
    check_spoilers(failures)
    check_derived(failures)

    if failures:
        print(f"arc3 publish integrity: {len(failures)} problem(s)\n", file=sys.stderr)
        for f in failures:
            print(f"  - {f}\n", file=sys.stderr)
        print(
            "See server/data/arc3-games/CONTRIBUTING.md. Nothing was deployed; the last "
            "good build is still live.", file=sys.stderr,
        )
        return 1

    print(f"arc3 publish integrity: {len(published_ids())} games, ids owned, no authoring prose, artifacts current")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
