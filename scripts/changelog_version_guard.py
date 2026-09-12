#!/usr/bin/env python3
"""
Author: Claude Opus 5
Date: 12-September-2026
PURPOSE: Renumber a newly-added CHANGELOG.md entry at COMMIT time, so two people writing
         entries in parallel stop colliding on the same version.

         THE PROBLEM THIS SOLVES. The version is chosen when the entry is WRITTEN, which
         can be an hour before it is committed, and main takes pushes from more than one
         session a day. In that hour someone else lands the number. It happened four times
         on 12-Sep-2026 alone (9.62.0 twice, 9.64.0 twice), and the note at the head of
         CHANGELOG.md records three earlier rounds of the same thing -- the numbers in this
         file have been hand-corrected after the fact more often than they have been
         written correctly.

         WHAT IT DOES. On commit, if the staged CHANGELOG.md ADDS a new top entry whose
         version is not strictly greater than the version at the top of HEAD's copy, the
         heading is rewritten to (HEAD's top version) + one minor, in the working tree and
         in the index, and the commit continues. It prints what it changed.

         WHAT IT DOES NOT DO. It does not touch an entry that is already correct, it does
         not reorder anything, and it does not invent an entry for a commit that has none.
         It only ever moves a number UP, so it cannot renumber over a version that already
         exists in the file. The prose is never read or edited.

         WHY REWRITE RATHER THAN REFUSE. A hook that fails the commit turns a mechanical
         renumber into a manual one and leaves a half-made commit; the whole point is that
         nobody should have to think about this. The rewrite is deterministic and printed,
         and `git commit --no-verify` skips it if a deliberate number is ever needed.

         Installed by scripts/install-git-hooks.sh into .git/hooks/pre-commit. Not via
         core.hooksPath: that REPLACES the hooks directory, and this repository's
         .git/hooks holds the git-lfs pre-push hook, which would silently stop running.

SRP/DRY check: Pass -- version arithmetic on one file. It does not lint prose, check
         SemVer semantics, or touch any other file; the hook script only invokes it.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

CHANGELOG = Path("CHANGELOG.md")
HEADING = re.compile(r"^### Version (\d+)\.(\d+)\.(\d+)\b(.*)$")


def top_version(text: str) -> tuple[int, int, int] | None:
    """The version of the first entry in a CHANGELOG body, or None if it has no entries."""
    for line in text.splitlines():
        match = HEADING.match(line)
        if match:
            return int(match.group(1)), int(match.group(2)), int(match.group(3))
    return None


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], capture_output=True, text=True, check=True
    ).stdout


def staged_changelog() -> str | None:
    """The staged CHANGELOG.md content, or None when this commit does not touch it."""
    names = git("diff", "--cached", "--name-only").split("\n")
    if CHANGELOG.name not in [n.strip() for n in names]:
        return None
    return git("show", f":{CHANGELOG.name}")


def head_changelog() -> str:
    """HEAD's CHANGELOG.md, or empty on a repository with no commits yet."""
    try:
        return git("show", f"HEAD:{CHANGELOG.name}")
    except subprocess.CalledProcessError:
        return ""


def main() -> int:
    staged = staged_changelog()
    if staged is None:
        return 0

    staged_top = top_version(staged)
    head_top = top_version(head_changelog())
    # Nothing to compare against: a first entry, or a commit that changed prose only.
    if staged_top is None or head_top is None or staged_top > head_top:
        return 0

    # The staged top is <= HEAD's top, which means someone else's entry landed above the
    # number this one claimed. Take the next minor after whatever is now on top.
    major, minor, _ = head_top
    corrected = f"{major}.{minor + 1}.0"
    claimed = ".".join(str(part) for part in staged_top)

    lines = CHANGELOG.read_text(encoding="utf-8").splitlines(keepends=True)
    for index, line in enumerate(lines):
        match = HEADING.match(line.rstrip("\n"))
        if not match:
            continue
        if (int(match.group(1)), int(match.group(2)), int(match.group(3))) != staged_top:
            # The working tree's top entry is not the one that was staged; leave it alone
            # rather than guess which heading the author meant.
            return 0
        lines[index] = f"### Version {corrected}{match.group(4)}\n"
        break
    else:
        return 0

    CHANGELOG.write_text("".join(lines), encoding="utf-8")
    subprocess.run(["git", "add", CHANGELOG.name], check=True)
    print(
        f"changelog: {claimed} was already taken on HEAD; this entry is now {corrected}.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
