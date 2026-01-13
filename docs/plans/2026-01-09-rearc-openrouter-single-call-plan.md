Author: Codex (GPT-5)
Date: 2026-01-09T00:00:00Z
PURPOSE: Plan to refactor the RE-ARC OpenRouter streaming solver to issue one API call per task and parse multiple test outputs from a single response.
SRP/DRY check: Pass - Focused solver refactor without duplicating other solver flows.

Scope
- Modify the Python OpenRouter streaming solver to send one request per task.
- Parse a list of output grids that matches the task test-case order.
- Record outputs into the submission snapshot for each test case.

Objectives
- Align solver behavior with the intended "one task, one call, one attempt" workflow.
- Preserve existing logging, throttling, and resumable snapshot behavior.
- Keep environment-driven configuration intact.

TODOs
- Update queueing to schedule per-task items instead of per-test attempts.
- Adjust prompts to request an ordered JSON array of output grids.
- Parse the returned list and map each grid to the corresponding test case.
- Update CHANGELOG.md with the change record.

Decisions
- attempt_2 is a second model call per task; outputs map to each test case in order.

Status
- Approved and implemented on 2026-01-09.
