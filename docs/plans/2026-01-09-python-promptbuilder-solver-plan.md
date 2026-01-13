# Python RE-ARC Solver w/ PromptBuilder Parity

**Author:** Cascade (ChatGPT)  
**Date:** 2026-01-09  
**Purpose:** Design a Python solver that mirrors `server/services/promptBuilder.ts` semantics, calls OpenAI’s Responses API with GPT-5-nano (high reasoning), streams results into `submission.json`, and supports safe resumption without runaway memory usage.

## Goals
1. Reuse PromptBuilder contract so both attempts describe ARC puzzle context correctly (no forgetting puzzle type on attempt 2).
2. Read `2026RealRearc.json` and drive all `(taskId, testIndex)` pairs sequentially or with light concurrency.
3. Use OpenAI Responses API (`responses.create/parse`) with `model=gpt-5-nano`, `reasoning.effort='high'`, and conversation chaining per attempt.
4. Persist `submission.json` immediately after each attempt to enable restart/resume.
5. Maintain compact in-memory state (load dataset once, reuse streaming writes, reuse small metadata map for conversation IDs & progress).

## Constraints & Assumptions
- Script lives under `scripts/solvers/` (e.g., `rearc_promptbuilder_openai.py`).
- Environment: `OPENAI_API_KEY` required. Optional flags `--fresh`, `--limit`, `--concurrency`, `--resume`.
- PromptBuilder is TypeScript; Python script will reimplement essential logic (system/user prompts) referencing the same templates and rules (training/test sections, answer omission, attempt 2 differentiation).
- Attempt 2 must remind model it’s still solving an ARC puzzle and include attempt 1 outputs while demanding alternate reasoning.
- Submission format matches ARC leaderboard expectations: `[taskId][testCaseIndex].attempt_{1|2}` grid arrays.

## Architecture & Flow
1. **Startup**
   - Parse CLI args, ensure dataset + submission paths.
   - Load dataset JSON and optional existing submission file.
   - Build index of pending `(taskId, testIndex)` pairs with statuses (attempt1Done, attempt2Done, convoId).
2. **Prompt Builder Parity Layer**
   - `build_system_prompt(mode='solver')` matching `getSystemPrompt`.
   - `build_user_prompt(task)` replicating `buildUserPromptForTemplate` (training/test sections, instructions, JSON format directions, no answers).
   - `build_attempt2_prompt(task, attempt1_grids)` referencing attempt1 outputs but still showing training/test context + “ATTEMPT 2 - provide alternative grid” instructions.
3. **Solver Loop**
   - For each pending test case:
     - Fire attempt 1 via Responses API (`client.responses.parse` with Zod schema for `grids`).
     - Capture `conversation_id`, grids, reasoning summary.
     - Immediately persist to `submission.json`.
     - Queue attempt 2 using same conversation (passes `conversation=conversation_id` plus attempt2 prompt).
   - Support optional concurrency (asyncio Semaphore).
4. **State & Persistence**
   - Submission stored as nested dict -> JSON.
   - Additional metadata (conversation IDs, attempt completion flags) held in memory; persist via `metadata.json` or embedded inside submission entries (e.g., `__meta`). Keep metadata minimal.
   - After each attempt (success or failure), write entire submission to disk (JSON indent 2). Since dataset ~hundreds tasks, file manageable.
5. **Resumption**
   - On start, load `submission.json`; treat `None` or missing attempts as pending. Attempt 2 reuses stored conversation IDs when available; fallback to new conversation if missing.
   - CLI `--fresh` clears file; `--resume` requires existing file.
6. **Logging & UX**
   - Console logs for dispatch/result per attempt, including execution time + reasoning snippet.
   - Summary at end (counts, output file path).

## Implementation Steps
1. Scaffold script with headers, CLI parsing, dataset/submission loading utilities.
2. Implement prompt builder parity helpers (system, user, attempt2).
3. Wire OpenAI client + Zod schema enforcement via `pydantic` or manual validation (since official Python SDK lacks `zodTextFormat`, parse `response.output` JSON).
4. Build solver loop with concurrency control, per-attempt dispatch, conversation tracking, and immediate submission writes.
5. Add resume logic, metadata handling, and summary output.
6. Test on small subset (`--limit 2`) to verify attempt chaining + resumed run.
7. Update docs + CHANGELOG.

## Risks & Mitigations
| Risk | Mitigation |
| --- | --- |
| Python reimplementation drifts from PromptBuilder spec | Lift text templates directly from TypeScript refs; add inline comments citing sections; keep instructions identical. |
| Frequent writes slow run | Use atomic write helper (temp file + rename) and optionally throttle via timer (but still after each attempt). |
| Conversation IDs missing on resume | Store `conversation` per `(taskId, testIndex)` attempt 1; fallback gracefully. |
| Responses parse differences | Validate JSON output structure manually; retry if parse fails. |

## Status
- Plan created 2026-01-09 (implementation pending).
