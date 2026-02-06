# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Setup
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv sync

# Install git hooks (runs ruff + mypy on commit)
pre-commit install

# Run all linting/formatting/type checking
pre-commit run --all-files

# Run tests
python -m pytest                          # All tests
python -m pytest tests/test_base_game.py  # Single file
python -m pytest -v                       # Verbose
```

## Architecture

ARCEngine is a Python 2D sprite game engine designed for ARC-AGI-3. It enforces specific constraints:
- 64×64 pixel output grid with 16 colors
- Turn-based gameplay (6 actions + RESET +UNDO)
- Each action produces 1-N frames

### Core Components

**`ARCBaseGame`** (`base_game.py`) - Abstract game controller that subclasses override:
- Manages multiple `Level` objects (cloned on init)
- Main game loop in `perform_action()` calls `step()` until `complete_action()` is called (max 1000 frames)
- `try_move()` handles collision-aware sprite movement
- Game states: NOT_PLAYED, NOT_FINISHED, WIN, GAME_OVER

**`Level`** (`level.py`) - Sprite container:
- Sprite queries by name, tag, position
- Collision detection via `collides_with()`
- Auto-merges sprites tagged "sys_static" on init for optimization

**`Camera`** (`camera.py`) - Viewport and renderer:
- Always outputs 64×64, auto-scales smaller viewports with letterboxing
- Renders sprites in layer order, then UI interfaces
- `display_to_grid()` converts screen coords to game coords

**`Sprite`** (`sprites.py`) - Visual entity:
- Pixels are palette indices (-1 = transparent)
- Rotation limited to 0°, 90°, 180°, 270°
- Scale: positive = upscale, negative = downscale (-1 = half size)
- BlockingMode: PIXEL_PERFECT, BOUNDING_BOX, NOT_BLOCKED
- InteractionMode: TANGIBLE, INTANGIBLE, INVISIBLE, REMOVED

**Data models** (`enums.py`):
- `GameAction`: RESET (0), ACTION1-7 (ACTION6 uses ComplexAction with x,y coordinates)
- `ActionInput`, `FrameData`, `FrameDataRaw`

### Game Flow

```
ARCBaseGame.perform_action(action_input)
  └── while not complete:
        └── step()        # Your game logic
        └── camera.render() → 64x64 frame
```

Subclasses implement `step()` and call `complete_action()` when done handling input.

### Action Conventions

- ACTION1-4: Up/Down/Left/Right (WASD)
- ACTION5: Spacebar
- ACTION6: Click (has x,y coordinates)
- ACTION7: Undo (Z key)

## Code Style

- Line length: 280 characters (for sprite pixel data)
- Strict mypy type checking (tests excluded)
- Pydantic for data validation
# Mark's Coding Standards

This document summarizes the generally applicable engineering expectations for this repo, distilled from `AGENTS.md` and `CLAUDE.md`. When in doubt, those files are the source of truth.

## Non-negotiables
- Windows and UTF-8: do not use the "X" and "checkmark" glyphs (including emoji variants). Keep files UTF-8 clean.
- No guessing: for unfamiliar or recently changed libraries/frameworks, locate and read docs (or ask for docs) before coding.
- Quality over speed: slow down, think, and get a plan approved before implementation.
- Production-only: no mocks, stubs, placeholders, fake data, or simulated logic shipped in final code.
- SRP/DRY: enforce single responsibility and avoid duplication; search for existing utilities/components before adding new ones.
- Real integration: assume env vars/secrets/external APIs are healthy; if something breaks, treat it as an integration/logic bug to fix.

## Workflow (how work should be done)
1. Deep analysis: understand existing architecture and reuse opportunities before touching code.
2. Plan architecture: define responsibilities and reuse decisions clearly before implementation.
3. Implement modularly: build small, focused modules/components and compose from existing patterns.
4. Verify integration: validate with real services and real flows (no scaffolding).

## Plans (required)
- Create a plan doc in `docs/` named `{DD-Month-YYYY}-{goal}-plan.md` before substantive edits.
- Plan content must include:
  - Scope: what is in and out.
  - Architecture: responsibilities, modules to reuse, and where new code will live.
  - TODOs: ordered steps, including verification steps.
  - Docs/Changelog touchpoints: what will be updated if behavior changes.
- Seek approval on the plan before implementing.

## File headers (required for TS/JS/Py)
- Every TypeScript, JavaScript, or Python file you create should start with:

  ```
  Author: {Your Model Name}
  Date: {timestamp} or DD-Month-YYYY
  PURPOSE: Verbose details about functionality, integration points, dependencies
  
  ```

- If you touch a file, update its header metadata.
- Do not add this header to file types that cannot support comments (e.g., JSON, SQL migrations).

## Code quality expectations
- Naming: meaningful names; avoid one-letter variables except tight loops.
- Error handling: exhaustive, user-safe errors; handle failure modes explicitly.
- Comments: explain non-obvious logic and integration boundaries inline (especially streaming and external API glue).
- Reuse: prefer shared helpers and components over custom one-offs.
- Architecture discipline: prefer repositories/services patterns over raw SQL or one-off DB calls.
- Pragmatism: fix root causes; avoid unrelated refactors and avoid over-engineering (small hobby project).

## UI/UX expectations (especially streaming)
- State transitions must be clear: when an action starts, collapse/disable prior controls and reveal live streaming states.
- Avoid clutter: do not render huge static lists or "everything at once" views.
- Streaming: keep streams visible until the user confirms they have read them.
- Design: avoid "AI slop" (default fonts, random gradients, over-rounding). Make deliberate typography, color, and motion choices.

## Docs, changelog, and version control
- Any behavior change requires:
  - Updating relevant docs.
  - Updating the top entry of `CHANGELOG.md` (SemVer; what/why/how; include author/model name).
- Commits: do not commit unless explicitly requested; when asked, use descriptive commit messages and follow user instructions exactly.
- Keep technical depth in docs/changelog rather than dumping it into chat.

## Communication style
- Keep responses tight and non-jargony; do not dump chain-of-thought.
- Ask only essential questions after consulting docs first.
- Mention when a web search could surface important, up-to-date information.
- Call out when docs/plans are unclear (and what you checked).
- Pause on errors, think, then request input if truly needed.
- End completed tasks with "done" (or "next" if awaiting instructions).

## Platform and command conventions
- We are on Windows 11 locally.  Docker, Git, and Node.js are installed.  WSL2 is available.  


## Prohibited habits
- No time estimates.
- No premature celebration. Nothing is completed or fixed until the user tests it.
- No shortcuts that compromise code quality.
- No overly technical explanations to the user.
