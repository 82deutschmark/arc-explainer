## 2025-12-31 – OpenAI Native RE-ARC Solver Plan

### Scope & Goal
- **Script target**: new solver (e.g., `scripts/solvers/rearc-openai-solver.ts`)
- **Dataset**: `REARC2026.json` in repo root (120 tasks / 246 test cases / 492 attempts)
- **Objective**: replicate `ReArcFS` flow but run against **OpenAI native** API using `gpt-5.1-codex-mini`.

### Functional Requirements
1. Load dataset from CLI `--dataset` (default to REARC2026.json) and create work queue (2 attempts per test).
2. For each attempt:
   - Build prompt identical to `buildPrompt()` in ReArcFS.
   - Call OpenAI SDK (`openai.responses.create` or chat equivalent) with model `gpt-5.1-codex-mini`.
   - Attempt 1: `temperature 0.0`, Attempt 2: `temperature 0.3`.
   - Extract grid output (JSON array or fallback line parsing).
3. Assemble `submission` object in required structure and write `rearc-submission-{timestamp}.json`.
4. Include minimal resilience features:
   - Deterministic queue, retry budget (3), and optional checkpoint (reuse hardened helpers from `rearc-free-solver.ts`).
   - Failure categorization for logging.

### Non-Functional Requirements
- Obey AGENTS.md headers/comments when editing TS files.
- Keep SRP: separate modules/helpers where reused (prompt building, parsing, OpenAI client wrapper).
- Use OpenAI API key (env `OPENAI_API_KEY`), not OpenRouter.
- Logging concise; emit summary (tasks processed, successes/failures, output path).

### Deliverables
1. New solver script with CLI flags `--dataset`, `--checkpoint`, `--fresh`, `--resume`.
2. Reusable parsing/backoff utilities (import from free solver when possible).
3. Updated `CHANGELOG.md` entry (top) describing addition.
4. Optional README/docs blurb if necessary.

### Open Questions / Pending
- Should we dedupe helper modules between free/OpenAI solvers? (default: copy minimal necessary to avoid large refactor).
- Is checkpointing mandatory for first cut? (assume yes; reuse proven flow).
- Need tests? (Manual dry-run instructions + typechecks).

### Next Steps
1. Scaffold script with headers, CLI parsing, dataset loading.
2. Implement OpenAI client + attempt executor.
3. Wire adaptive queue, checkpoint/resume, summary.
4. Verify via `npx tsx ... --dataset REARC2026.json --fresh` (mock/instrument for now).
5. Document + CHANGELOG.
