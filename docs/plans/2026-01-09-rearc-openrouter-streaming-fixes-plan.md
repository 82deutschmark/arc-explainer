Author: Codex (GPT-5)
Date: 2026-01-09T00:00:00Z
PURPOSE: Plan to fix OpenRouter request parameter usage, add live progress logging,
         and replace deprecated UTC timestamp usage in the RE-ARC streaming solver.
SRP/DRY check: Pass - Focused on solver runtime behavior and logging only.

Scope
- Replace invalid OpenRouter request parameter with supported token budget key.
- Add live progress logging so runs show per-task activity.
- Use timezone-aware UTC timestamps for JSONL logs.

Objectives
- Prevent request failures due to invalid parameters.
- Make long runs visibly active and debuggable.
- Eliminate deprecated datetime usage warnings.

TODOs
- Switch to OpenRouter-supported max token parameter.
- Add per-task attempt start/finish logging with simple counts.
- Use timezone-aware UTC timestamps in JSONL entries.
- Update CHANGELOG.md with what/why/how.

Status
- Approved and implemented on 2026-01-09.
