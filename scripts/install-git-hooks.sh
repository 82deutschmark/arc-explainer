#!/bin/sh
# Author: Claude Opus 5
# Date: 12-September-2026
# PURPOSE: Install this repository's git hooks into .git/hooks. Run once per clone:
#
#     sh scripts/install-git-hooks.sh
#
# Installs pre-commit, which renumbers a colliding CHANGELOG.md entry at commit time --
# see scripts/changelog_version_guard.py for why that is needed.
#
# WHY NOT core.hooksPath. That setting REPLACES the hooks directory rather than adding to
# it, and .git/hooks here holds git-lfs's pre-push hook. Pointing hooksPath at a tracked
# directory would silently stop LFS from running on push, which is a much worse problem
# than the one this fixes. Writing one file into .git/hooks leaves everything else alone.
#
# SRP/DRY check: Pass -- installation only. The hook's logic lives in the Python script.

set -e

repo_root=$(git rev-parse --show-toplevel)
hooks_dir=$(git rev-parse --git-path hooks)

if [ -e "$hooks_dir/pre-commit" ] && ! grep -q "changelog_version_guard" "$hooks_dir/pre-commit"; then
  echo "A pre-commit hook already exists and is not ours; leaving it alone." >&2
  echo "Add this line to it by hand if you want the changelog guard:" >&2
  echo "  python3 scripts/changelog_version_guard.py" >&2
  exit 1
fi

cat > "$hooks_dir/pre-commit" <<'HOOK'
#!/bin/sh
# Installed by scripts/install-git-hooks.sh. Do not edit here -- edit the script.
exec python3 scripts/changelog_version_guard.py
HOOK

chmod +x "$hooks_dir/pre-commit"
echo "Installed pre-commit hook into $hooks_dir (repo: $repo_root)"
