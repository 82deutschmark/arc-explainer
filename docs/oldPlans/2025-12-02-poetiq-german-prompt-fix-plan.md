# 2025-12-02-poetiq-german-prompt-fix-plan

## Goal
Restore the localized Poetiq ARC prompt set by reintroducing the missing German template so `promptStyle="arc_de"` works again.

## Tasks
1. Inspect `solver/poetiq/prompts.py` to confirm `SOLVER_PROMPT_ARC_DE` is absent and gather the latest structure used by other localized prompts (`SOLVER_PROMPT_ARC_FR`, `SOLVER_PROMPT_ARC_TR`, `SOLVER_PROMPT_ARC_RU`).
2. Add a full German ARC prompt constant that mirrors the guidance of `SOLVER_PROMPT_ARC`, keeping ASCII-safe text and ending with the `$$problem$$` placeholder.
3. Verify the Python wrapper import (`server/python/poetiq_wrapper.py`) sees the new constant so `promptStyle="arc_de"` can be selected without errors; spot-check CHANGELOG requirements once fixes land.
