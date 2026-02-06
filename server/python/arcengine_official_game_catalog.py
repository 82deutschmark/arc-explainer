"""
Author: GPT-5 Codex
Date: 2026-02-06T00:00:00Z
PURPOSE: Generate a JSON catalog of ARCEngine "official" games shipped in the repo's
         `external/ARCEngine` git submodule. This is used by the Node.js server to
         dynamically discover newly-added official game files (e.g., ws02/ws03)
         without hardcoded whitelists.

         The catalog is computed by:
         - Adding `external/ARCEngine` to `sys.path`
         - Scanning `external/ARCEngine/games/official/*.py` (excluding __init__.py)
         - Importing each file by path, finding the ARCBaseGame subclass, instantiating it
         - Extracting runtime metadata needed by the app (game_id, level_count, win_score,
           max_actions, action_count from available_actions)
SRP/DRY check: Pass - single responsibility: catalog generation for official games.
"""

from __future__ import annotations

import importlib.util
import io
import json
import sys
import traceback
from contextlib import redirect_stdout
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class OfficialGameRuntimeMeta:
    file_stem: str
    python_file_path: str
    game_id: str
    level_count: int
    win_score: int
    max_actions: Optional[int]
    action_count: int


def _get_repo_root() -> Path:
    # server/python/<this file> -> server/python -> server -> repo root
    return Path(__file__).resolve().parents[2]


def _get_arcengine_root(repo_root: Path) -> Path:
    return repo_root / "external" / "ARCEngine"


def _get_official_games_dir(repo_root: Path) -> Path:
    return _get_arcengine_root(repo_root) / "games" / "official"


def _load_game_class_from_file(python_file: Path):
    """
    Load a Python module from a file path and return the first ARCBaseGame subclass found.
    """
    if not python_file.exists():
        raise FileNotFoundError(f"Game file not found: {python_file}")

    spec = importlib.util.spec_from_file_location(f"arcengine_official_{python_file.stem}", str(python_file))
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from: {python_file}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    from arcengine import ARCBaseGame  # imported after sys.path injection

    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if isinstance(attr, type) and issubclass(attr, ARCBaseGame) and attr is not ARCBaseGame:
            return attr

    raise ValueError("No ARCBaseGame subclass found in file")


def _safe_int(value, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _extract_runtime_meta_from_game(game, file_stem: str, python_file: Path) -> OfficialGameRuntimeMeta:
    game_id = str(getattr(game, "game_id", file_stem))

    # ARCBaseGame stores levels internally as `_levels`; there is no public `levels` attribute.
    levels = getattr(game, "_levels", None)
    level_count = len(levels) if isinstance(levels, list) else 0

    win_score = _safe_int(getattr(game, "win_score", 1), 1)

    max_actions_raw = getattr(game, "max_actions", None)
    max_actions = _safe_int(max_actions_raw, 0) if max_actions_raw is not None else None

    available_actions = getattr(game, "_available_actions", None)
    if isinstance(available_actions, list):
        # Count unique runtime actions exposed by the game (e.g., [1,2,3,4,5,6] -> 6).
        normalized_actions: set[int] = set()
        for action in available_actions:
            try:
                normalized_actions.add(int(action))
                continue
            except Exception:
                pass

            # Some games may store enum entries rather than raw ints.
            value = getattr(action, "value", None)
            if value is not None:
                try:
                    normalized_actions.add(int(value))
                except Exception:
                    pass

        action_count = len(normalized_actions)
    else:
        action_count = 0

    return OfficialGameRuntimeMeta(
        file_stem=file_stem,
        python_file_path=str(python_file),
        game_id=game_id,
        level_count=int(level_count),
        win_score=win_score,
        max_actions=max_actions,
        action_count=action_count,
    )


def main() -> int:
    repo_root = _get_repo_root()
    arcengine_root = _get_arcengine_root(repo_root)
    official_dir = _get_official_games_dir(repo_root)

    # Ensure we can import `arcengine` and (by-path) official game modules.
    sys.path.insert(0, str(arcengine_root))

    try:
        import arcengine  # noqa: F401
    except Exception as e:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "ARCENGINE_IMPORT_FAILED",
                    "message": str(e),
                    "arcengine_root": str(arcengine_root),
                }
            )
        )
        return 1

    if not official_dir.exists():
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "OFFICIAL_DIR_NOT_FOUND",
                    "message": f"Official games dir not found: {official_dir}",
                    "official_dir": str(official_dir),
                }
            )
        )
        return 1

    results: list[dict] = []

    for python_file in sorted(official_dir.glob("*.py"), key=lambda p: p.name.lower()):
        if python_file.name == "__init__.py" or python_file.name.startswith("_"):
            continue

        file_stem = python_file.stem

        try:
            # Some game modules may print during import/initialization; suppress stdout so the
            # catalog output remains valid JSON (stderr logging is preserved).
            with redirect_stdout(io.StringIO()):
                GameClass = _load_game_class_from_file(python_file)
                game = GameClass()
            meta = _extract_runtime_meta_from_game(game, file_stem=file_stem, python_file=python_file)
            results.append(
                {
                    "ok": True,
                    "file_stem": meta.file_stem,
                    "python_file_path": meta.python_file_path,
                    "game_id": meta.game_id,
                    "level_count": meta.level_count,
                    "win_score": meta.win_score,
                    "max_actions": meta.max_actions,
                    "action_count": meta.action_count,
                }
            )
        except Exception as e:
            results.append(
                {
                    "ok": False,
                    "file_stem": file_stem,
                    "python_file_path": str(python_file),
                    "error": str(e),
                    "traceback": traceback.format_exc(limit=20),
                }
            )

    print(
        json.dumps(
            {
                "ok": True,
                "source": "external/ARCEngine/games/official",
                "games": results,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
