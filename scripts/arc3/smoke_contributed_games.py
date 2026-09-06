#!/usr/bin/env python3
"""
Author: Codex
Date: 05-September-2026
PURPOSE: Smoke-test every published contributed glow-up through ARCEngine. A game must
         import, expose 7-12 levels, return a 64x64 reset frame, accept every advertised
         action, and visibly respond to at least one action from its opening state. This
         catches publishable-looking Python modules that the web player cannot actually run.
SRP/DRY check: Pass -- runtime verification only; action and category facts are read from
         the generated mechanic digest rather than reconstructed here.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
GAMES_DIR = REPO / "server" / "data" / "arc3-games"
ENGINE = REPO / "external" / "ARCEngine"
if ENGINE.is_dir():
    sys.path.insert(0, str(ENGINE))
sys.path.insert(0, str(GAMES_DIR))

from arcengine import ARCBaseGame, ActionInput, GameAction  # noqa: E402


def load_game(game_id: str) -> type[ARCBaseGame]:
    """Import one published module and return the class it defines."""
    module_name = f"arc3_smoke_{game_id}"
    path = GAMES_DIR / f"{game_id}.py"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot create an import spec for {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    candidates = [
        value for value in vars(module).values()
        if isinstance(value, type)
        and issubclass(value, ARCBaseGame)
        and value is not ARCBaseGame
        and value.__module__ == module_name
    ]
    if len(candidates) != 1:
        raise RuntimeError(f"expected one game class, found {len(candidates)}")
    return candidates[0]


def last_frame(frame_data) -> np.ndarray:
    """Normalize the last rendered animation frame to a testable array."""
    if not frame_data.frame:
        raise RuntimeError("engine returned no frame")
    frame = np.asarray(frame_data.frame[-1])
    if frame.shape != (64, 64):
        raise RuntimeError(f"expected a 64x64 frame, got {frame.shape}")
    return frame


def check_game(row: dict) -> list[str]:
    """Return every playability failure for one mechanic-digest row."""
    game_id = row["gameId"]
    failures: list[str] = []
    try:
        game_class = load_game(game_id)
        probe = game_class()
        level_count = len(getattr(probe, "_levels", []))
        if not 7 <= level_count <= 12:
            failures.append(f"has {level_count} levels; expected 7-12")
        reset = probe.perform_action(ActionInput(id=GameAction.RESET))
        opening = last_frame(reset)
        advertised = sorted(int(action) for action in reset.available_actions)
        if advertised != row["availableActions"]:
            failures.append(
                f"engine advertises {advertised}, digest publishes {row['availableActions']}"
            )

        visible_response = False
        for action_id in row["availableActions"]:
            game = game_class()
            before = last_frame(game.perform_action(ActionInput(id=GameAction.RESET)))
            data = {"x": 32, "y": 32} if action_id == 6 else {}
            after = last_frame(game.perform_action(ActionInput(
                id=GameAction.from_id(action_id), data=data,
            )))
            visible_response = visible_response or not np.array_equal(before, after)
        if not visible_response:
            failures.append("no advertised action visibly changes the opening state")
        if opening.dtype.kind not in {"i", "u"}:
            failures.append(f"frame has non-integer dtype {opening.dtype}")
    except Exception as exc:  # The failure is reported with its game id below.
        failures.append(f"runtime error: {type(exc).__name__}: {exc}")
    return [f"{game_id}: {failure}" for failure in failures]


def main() -> int:
    rows = json.loads((GAMES_DIR / "mechanics.json").read_text(encoding="utf-8"))
    contributed = [row for row in rows if row.get("category") == "contributed-glowup"]
    failures = [failure for row in contributed for failure in check_game(row)]
    if failures:
        print(f"FAILED: {len(failures)} contributed-game playability problem(s)")
        for failure in failures:
            print(f"  {failure}")
        return 1
    print(
        f"ok   {len(contributed)} contributed games import, expose 7-12 levels, "
        "accept their controls, and visibly respond"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
