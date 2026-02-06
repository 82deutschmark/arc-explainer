# Project knowledge

This file gives Codebuff context about your project: goals, commands, conventions, and gotchas.

## Quickstart
- **Setup (users):** `uv add arcengine` or `pip install arcengine`
- **Dev:** 
  - `uv venv; source .venv/bin/activate` (Windows: `.venv\Scripts\activate`)
  - `uv sync`
  - `pre-commit install`
- **Test:** `pytest` (in tests/)
- **Lint:** `pre-commit run --all-files` (runs ruff lint/format + mypy)

## Architecture
- **Key directories:** `arcengine/` (core: base_game.py, camera.py, level.py, sprites.py); `examples/` (usage demos); `tests/`
- **Data flow:** Subclass `ARCBaseGame` → override `step()` → manage `Level`s of `Sprite`s → `Camera` renders 64x64 frames via `perform_action(ActionInput)`

## Conventions
- **Formatting/linting:** ruff (line-length=280, `--fix`), mypy (strict=true, pydantic plugin)
- **Patterns to follow:** Numpy arrays for pixels; clone sprites/levels; use `try_move`; enums for BlockingMode/InteractionMode; tag sprites; subclass for games
- **Things to avoid:** Scale=0; invalid rotations (not 0/90/180/270); downscale without even division; >1000 frames/action; untyped defs; external contribs (internal only)

## Gotchas
- Always 64x64 output (auto-upscale + letterbox)
- Actions: RESET + ACTION1-7 (turn-based, 1-N frames/action)
- Sprites: -1 pixels transparent/non-blocking; pixel-perfect collisions; layers for z-order
- Dev: pre-commit auto-runs on commit; mypy excludes tests/
