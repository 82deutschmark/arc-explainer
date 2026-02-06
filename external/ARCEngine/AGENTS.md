# Repository Guidelines

## Project Structure & Module Organization

- `arcengine/`: library source (core modules: `base_game.py`, `level.py`, `camera.py`, `sprites.py`, `enums.py`).
- `tests/`: pytest suite (`tests/test_*.py`).
- `examples/`: runnable sample games and utilities (start with `examples/main.py`).
- Top-level config: `pyproject.toml` (dependencies + mypy/ruff), `.pre-commit-config.yaml` (hooks).

## Build, Test, and Development Commands

Assumes an active virtual environment.

- `uv sync`: install/update dev dependencies from `pyproject.toml`/`uv.lock`.
- `pre-commit install`: install git hooks (runs ruff + mypy on commit).
- `pre-commit run --all-files`: run formatting, linting, and type checking locally.
- `python -m pytest`: run the full test suite.
- `python -m pytest tests/test_level.py -v`: run a single file verbosely.

## Coding Style & Naming Conventions

- Python formatting/linting: `ruff` + `ruff-format` via pre-commit.
- Typing: strict `mypy` (tests are excluded from type checking).
- Line length: 280 characters (sprite pixel data often needs wider lines).
- Naming: modules and functions use `snake_case`; types/classes use `PascalCase`.

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
- Every TypeScript, JavaScript, or Python file you create shouldstart with:

  ```
  Author: {Your Model Name}
  Date: {timestamp}
  PURPOSE: Verbose details about functionality, integration points, dependencies
  SRP/DRY check: Pass/Fail - did you verify existing functionality?
  ```

- If you touch a file, update its header metadata.
- Do not add this header to file types that cannot support comments (e.g., JSON, SQL migrations).

## Code quality expectations
- Naming: meaningful names; avoid one-letter variables except tight loops.
- Error handling: exhaustive, user-safe errors; handle failure modes explicitly.
- Comments: explain non-obvious logic and integration boundaries inline (especially streaming and external API glue).
- Reuse: prefer shared helpers and `shadcn/ui` components over custom one-offs.
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

## Engine Constraints (Keep These Intact)

- Output is always a 64×64 grid with a 16-color palette.
- Gameplay is turn-based; each action can emit 1–N frames (hard cap: 1000 frames/action).
- Game subclasses implement `ARCBaseGame.step()` and must call `complete_action()` when input handling finishes.

