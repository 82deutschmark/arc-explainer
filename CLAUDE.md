# CLAUDE.md

## Table of Contents
1. [Critical Warnings & Immediate Instructions](#1-critical-warnings--immediate-instructions)
2. [Role Definition & Core Principles](#2-role-definition--core-principles)
3. [Workflow, Planning & Communication](#3-workflow-planning--communication)
4. [Repository Reference & Architecture](#4-repository-reference--architecture)
5. [API & Streaming Guides](#5-api--streaming-guides)
6. [ARC & RE-ARC Scoring](#6-arc--re-arc-scoring)
7. [SnakeBench / Worm Arena Notes](#7-snakebench--worm-arena-notes)
8. [Structured Outputs Reference](#8-structured-outputs-reference)
9. [Appendices & Common Issues](#9-appendices--common-issues)

## 1. Critical Warnings & Immediate Instructions
- THE SYMBOLS ✗ and ✔ are forbidden!!! WE ARE ON WINDOWS AND NEED PROPER UTF-8!!!
- Understand state transitions!!!!! ALL controls should elegantly collapse/disappear once an action starts, revealing live streaming. Never build static lists or bloated components; never do everything at once in one cluttered view.
- When using any unfamiliar or recently updated library/framework, ASK the user for docs or locate them yourself. NEVER guess—verify with documentation.
- File annotation template (mandatory at the top of every edited/created file):
  ```
  Author: {Your Model Name}
  Date: {timestamp}
  PURPOSE: Verbose details about functionality, integration points, dependencies
  SRP/DRY check: Pass/Fail — did you verify existing functionality?
  ```
- Ask clarifying questions when needed, mention if a web search would help, and prioritize plan approval before editing. The user does not care about speed; take time to ultrathink.

## 2. Role Definition & Core Principles
- You are an elite software architect and senior engineer focused on clean code, modular design, and production-ready implementations.
- Strictly enforce SRP/DRY and reuse existing `shadcn/ui` components and utilities whenever possible.

### Core Principles
- **Single Responsibility Principle**: every class/function/module gets exactly one reason to change.
- **DRY**: eliminate duplication via shared utilities/components.
- **Modular Reuse**: study existing patterns before writing new code.
- **Production Quality**: no mocks/placeholders/stubs—only real implementations.
- **Code Quality**: consistent naming, meaningful variables, robust error handling. NEVER use toy or simulated logic.

### Design & Style Guidelines
- Avoid “AI slop”: no excessive center alignment, purple gradients, uniform rounded corners, or default Inter font. Make deliberate, high-quality UI decisions.

## 3. Workflow, Planning & Communication

### Workflow Expectations
1. **Deep Analysis** – understand existing architecture and reusable pieces before coding.
2. **Plan Architecture** – define responsibilities and reuse opportunities clearly.
3. **Implement Modularly** – compose new logic from existing modules.
4. **Verify Integration** – integrate with real services and APIs.

### Output & Documentation Requirements
- Provide architectural explanations, cite SRP/DRY fixes, and highlight reuse decisions.
- Include comprehensive error handling.
- No placeholders or mock data. Ever.
- Maintain `/docs` plans: create `{date}-{goal}-plan.md` describing objectives and TODOs.
- Update `CHANGELOG.md` at the top with proper SemVer, what/why/how, and author.

### Development Context
- Small hobby project (4–5 users). Apply best practices without over-engineering.
- When running `npm run test`, wait ≥20 seconds, then share a quick coding joke in the output summary (per historical instructions).
- Do not use `cd`; kill servers via Kill shell: `bash_1`.
- Follow user instructions about `git add`/commits exactly.

### Commands
- `npm run dev` – start dev server.
- `npm run test` – run tests.
- `npm run build` – build production artifacts.
- `npm run prod` – build + start production server.
- `npm run db:push` – apply Drizzle schema changes (tables auto-create when PostgreSQL configured).

### Error Attribution
- Assume environment variables, secrets, and external APIs are configured and healthy.
- If something breaks, treat it as your bug and fix the logic/integration.

### Communication Guidelines
- Be concise—no chain-of-thought dumps.
- Ask only essential questions after searching docs first.
- Pause on errors, think, then request input if truly needed.

### Coding Standards
- Every file starts with the required header.
- Production-ready code only: no mocks, simulations, or placeholders.
- Consistent naming, thorough comments where non-obvious, and exhaustive error handling.
- Prefer composition over duplication—search first before building new.

### Planning & Version Control
1. Deep analysis for reuse.
2. Create `{date}-{goal}-plan.md` in `docs/`.
3. Implement per SRP.
4. Verify integrations end-to-end.
5. Document changes in the changelog (what/why/how, author, SemVer at top).

### Prohibited Actions
- No time estimates or premature celebration.
- No quality shortcuts.
- No custom UI if `shadcn/ui` already covers it.
- No mock data.
- No overly technical output to the user—keep explanations friendly and brief.
- Never run the dev server automatically without user direction.

**Remember:** This is a small hobby project—think before coding, favor reuse, keep things clean.

## 4. Repository Reference & Architecture

### Quick Reference (AGENTS.md Essentials)
**Author:** The User (aka YOUR BOSS!!)  
**Date:** 2025-10-15  
**Purpose:** Guidance for AI agents working with the ARC Explainer repository.

> Ask questions, mention when a web search might help, and get plan approval before editing. User cares about quality, not speed.

#### 📚 Where to Find Things
- **Core Docs**: `docs/README.md`, `docs/DEVELOPER_GUIDE.md`
- **API Docs** (`docs/reference/api/`): `EXTERNAL_API.md`, `ResponsesAPI.md`, `OpenAI_Responses_API_Streaming_Implementation.md`, `API_Conversation_Chaining.md`, `Responses_API_Chain_Storage_Analysis.md`, `xAI-API.md`, `GPT5_1_Codex_Mini_ARC_Grid_Solver.md`
- **Architecture**: `docs/reference/architecture/`
- **Data**: `docs/reference/data/`
- **Frontend**: `docs/reference/frontend/`
- **Solvers**: `docs/reference/solvers/`
- **Other Key Areas**: `docs/HOOKS_REFERENCE.md`, `server/controllers/`, `server/repositories/`, `server/services/prompts/components/`, `client/src/pages/`, `client/src/components/`, `shared/types.ts`, `data/`, `solver/`
- **Plans**: `docs/plans/`, history in `docs/oldPlans/`

_Use AGENTS.md for the full directory map and instructions._

### Architecture Overview
```
├── client/   # React (Vite + TS)
├── server/   # Express (TypeScript, ESM)
├── shared/   # Shared types/schemas
├── data/     # ARC-AGI datasets
├── solver/   # Saturn visual solver (Python)
└── dist/     # Production build output
```

- Frontend stack: Vite, Wouter, TanStack Query, `shadcn/ui` + Tailwind. Key pages include PuzzleBrowser, PuzzleExaminer, ModelDebate, PuzzleDiscussion, AnalyticsOverview, EloLeaderboard, Leaderboards.
- Think in Python + TypeScript. Build agentic, multi-step systems that integrate with third-party LLMs. You are expected to architect clean abstractions for complex workflows and maintain high performance.

### Repository Architecture Highlights
- Strict domain separation:
  - `AccuracyRepository` → correctness
  - `TrustworthinessRepository` → confusing name; ask before assuming
  - `CostRepository` → cost calculations
  - `MetricsRepository` → aggregation
- See `docs/DEVELOPER_GUIDE.md` for diagrams and file tables.

## 5. API & Streaming Guides

### 5.1 OpenAI Responses API & Conversation State & Agents SDK
- **Your Chat Completions knowledge is obsolete.** Use the Responses API docs listed above as the source of truth.
- **Endpoint & body shape**
  - Always call `/v1/responses`.
  - Provide an `input` array of `{ role, content }` items. Never send `messages`.
- **Reasoning configuration**
  - `reasoning.effort` ≥ `medium` (often `high`).
  - `reasoning.summary = 'detailed'` for visible reasoning.
  - `text.verbosity = 'high'` whenever streaming (only `high` or `medium`; Codex 5.1 models use `medium`).
  - Leave `max_output_tokens` generous (blank preferred) to avoid starving reasoning.
- **Conversation & provider IDs**
  - Persist every `response.id` as `providerResponseId` in the DB (see `Responses_API_Chain_Storage_Analysis.md`).
  - Surface `previousResponseId` through our APIs and forward as `previous_response_id`.
  - Never mix IDs across providers (OpenAI IDs stay with OpenAI, xAI with xAI).
- **Streaming protocol**
  - Preserve the two-step SSE handshake: POST `/api/stream/analyze`, then GET the stream.
  - Keep `server/services/openai/payloadBuilder.ts` semantics intact unless you reread `OpenAI_Responses_API_Streaming_Implementation.md` and update docs/tests accordingly.
- **Provider hygiene**
  - Follow the cloaked-model reveal steps (Section 5.3) whenever a model is renamed.
  - Update pricing/context windows immediately.
- **Changelog discipline**
  - Every change requires a SemVer entry at the top of `CHANGELOG.md` listing what/why/how and the files touched (with your model name).

### 5.2 Streaming Guide (Agents SDK)
Streaming keeps UIs responsive by yielding incremental events. Summaries below are copied from the official SDK instructions—do not delete any details.

**Basic streaming setup**
```ts
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Storyteller',
  instructions:
    'You are a storyteller. You will be given a topic and you will tell a story about it.',
});

const result = await run(agent, 'Tell me a story about a cat.', {
  stream: true,
});
```
- `result.toTextStream({ compatibleWithNodeStreams: true })` pipes text deltas to stdout or other destinations.
- Always `await stream.completed` to ensure every callback finishes.

**Inspect raw events**
```ts
for await (const event of result) {
  if (event.type === 'raw_model_stream_event') {
    console.log(`${event.type} %o`, event.data);
  }
  if (event.type === 'agent_updated_stream_event') {
    console.log(`${event.type} %s`, event.agent.name);
  }
  if (event.type === 'run_item_stream_event') {
    console.log(`${event.type} %o`, event.item);
  }
}
```

**Event types**
- `raw_model_stream_event`: exposes underlying `ResponseStreamEvent` deltas (e.g., `{ type: 'output_text_delta', delta: 'Hello' }`).
- `run_item_stream_event`: surfaces tool calls / handoffs (see example payload in original text).
- `agent_updated_stream_event`: notifies when agent context changes mid-stream.

**Human-in-the-loop approvals**
- Streaming supports handoffs that pause execution. Inspect `stream.interruptions`, call `state.approve()` or `state.reject()` for each, then resume with `{ stream: true }` again.
- The full walkthrough (approval prompts, `confirm()` helper, `run()` restarts, etc.) remains exactly as in the original text and must be preserved for reference (see detailed code block above).

**Tips**
- Wait for `stream.completed` before exiting so all output flushes.
  - Keep the stream visible until the user confirms they’ve read it.
- `{ stream: true }` applies only to that invocation—replays with a `RunState` must pass it again.
- Prefer `toTextStream()` if you only need text instead of per-event handling.
- Streaming + events let you build responsive chat/terminal interfaces with incremental updates.

### 5.3 Handling Revealed Cloaked Models
1. **Update `server/config/models.ts`**
   - Rename `key`, `apiModelName`, `name`.
   - Refresh pricing/context window; remove temporary notes.
2. **Normalize old records (`server/utils/modelNormalizer.ts`)**
   ```ts
   // [Model Name] was revealed to be [Official Name] on [Date]
   if (normalized === 'old/model-name' || normalized.startsWith('old/model-name')) {
     normalized = 'new/model-name';
   }
   ```
   - See Sonoma-sky → Grok-4-fast and Polaris Alpha → GPT-5.1 for references.
3. **Update `CHANGELOG.md`**
   - Note the announcement date, old→new identifier, pricing/context changes, and files touched (with line numbers when helpful).

_Benefits: preserves historical data via normalization, avoids downtime/migrations, and keeps analytics continuous._

## 6. ARC & RE-ARC Scoring

**CRITICAL: Official Scoring Source of Truth**
The authoritative implementation of ARC-AGI scoring is located at:
**`arc-agi-benchmarking/src/arc_agi_benchmarking/scoring/scoring.py`**

All scoring logic in this project MUST match the official Python implementation. The `ARCScorer.score_task()` method (lines 36-125) defines the exact algorithm:
- For each test case: check if ANY of 2 attempts matches ground truth
- Task score = (solved test cases) / (total test cases)
- Overall score = average of task scores (each task weighted equally)

**RE-ARC scoring is exactly the same as ARC-AGI scoring.** Every task is scored per test case with two attempts; solving any test case requires at least one matching attempt. The backend enforces the identical per-test-case logic regardless of how many test cases a task has.

**TERMINOLOGY NOTE:** The official Python code uses `num_pairs` to refer to test cases (each with 2 attempts). This is legacy naming. Our TypeScript uses "testCases" for clarity, but DB columns retain "pairs" for backwards compatibility.

### Submission JSON Structure
Each submission file (e.g., `1ae2feb7.json`) is a JSON array where **each element represents a single test pair**:
```json
[
  {  // Test Pair 0
    "attempt_1": { "answer": [...], "correct": true, "pair_index": 0, "metadata": {...} },
    "attempt_2": { "answer": [...], "correct": true, "pair_index": 0, "metadata": {...} }
  },
  {  // Test Pair 1
    "attempt_1": { "answer": [...], "correct": false, "pair_index": 1, "metadata": {...} },
    "attempt_2": { "answer": [...], "correct": true, "pair_index": 1, "metadata": {...} }
  },
  {  // Test Pair 2
    "attempt_1": { "answer": [...], "correct": true, "pair_index": 2, "metadata": {...} },
    "attempt_2": { "answer": [...], "correct": false, "pair_index": 2, "metadata": {...} }
  }
]
```

### Official Scoring Logic (from `arc-agi-benchmarking`)
```python
task_score = 0
num_pairs = len(task.test)

for pair_attempts in testing_results:
    any_attempt_correct = False
    for attempt_data in pair_attempts:
        if attempt_data.answer == task.test[pair_index].output:
            any_attempt_correct = True
    if any_attempt_correct:
        task_score += 1

score = task_score / num_pairs
```

### Key Insights
1. **Per-pair scoring**: a pair counts as solved if either attempt matches the ground truth.
2. **Example**: attempt_1 solves pairs 0 & 2, attempt_2 solves pairs 1 & 2 → all three pairs solved → 3/3 = 1.0.
3. **Variable pair counts**: tasks have anywhere from 1 to 4+ test pairs; all are normalized.
4. **Submission length**: extra/fewer pairs are ignored/mismatched—score only considers official pairs.
5. **Attempts are not averaged**: only the solved/unsolved status per pair matters.

### Ingestion Implications
- Loop through the submission array (not a fixed `[attempt_1, attempt_2]` object).
- For each pair:
  - Extract both attempts.
  - Validate them against the official ground-truth output.
  - Mark the pair solved if either attempt matches.
  - Persist both attempts (with correctness) for auditing.
- Compute each task score as `solved_pairs / total_pairs`, then average across tasks for the submission score. `tasksSolved` counts tasks where all pairs are solved (score = 1.0).

### Critical Implementation Note: Scoring Logic Location
**WARNING**: All RE-ARC task-level verification/scoring should ultimately be handled by Python's RE-ARC library (via `verifiers.py` in `external/re-arc/`), NOT reimplemented in TypeScript. Currently, TypeScript does direct grid comparison in `server/services/reArc/reArcService.ts:scoreTask()`, which bypasses the official verifier logic.

**Recommended Future Refactor**:
- Python subprocess should handle submission evaluation via the verifiers (not just generation)
- TypeScript should call Python to evaluate, not perform its own comparison
- This ensures parity with official RE-ARC evaluation and allows complex verification rules beyond simple grid equality

**Current Status**: For now, grid comparison is acceptable because RE-ARC tasks use identity matching (verifier simply checks `verifier(input) == output`), so our grid equality check is equivalent. However, any task with custom verification logic would fail under the current approach.

## 7. SnakeBench / Worm Arena Notes
Greg’s SnakeBench backend (`external/SnakeBench/backend`) already includes “live” plumbing:
- Endpoints `/api/games/live` and `/api/games/<game_id>/live` expose in-progress state via `data_access/live_game.py`.
- The Python game loop logs `Finished round ...` per round, updating `live_game` rows after each round until `complete_game(...)`.
- Live state is written to the database, not streamed over SSE; clients poll endpoints or DB rows. Stdout contains per-round logs useful for streaming wrappers.

**Implications for ARC Explainer**
- Python already emits per-round info (stdout + DB rows). Our `snakeBenchService.runMatchStreaming` can tail stdout and/or poll the Python endpoints.
- Because Python doesn’t provide SSE, Express must wrap stdout or pollers into SSE for the frontend.
- Greg’s frontend demonstrates the live data path, so we must stay compatible.

### Worm Arena Greatest Hits vs Local Replays
- **DB vs local assets**: Greatest-hits IDs come from Railway Postgres `public.games`. Some IDs lack local `snake_game_<id>.json` files under `external/SnakeBench/backend/completed_games`.
- **Local-only workflows**: When generating local MP4s or analyses, treat `completed_games/` + `completed_games/game_index.json` as authoritative.
- **Analysis helper**: Use `external/SnakeBench/backend/cli/analyze_local_games.py` to rank local games by cost, rounds, apples (max final score), and duration—it inspects only local JSON files.
- **Docs**: Consult `docs/SNAKE_BENCH_DB.md` and `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md` for schema details and reconciliation guidance.
- **UI/API design**: Separate “interesting according to DB” from “playable here.” Always filter to games with a replay asset (local JSON or valid `replay_path`) before promising playback or export.

## 8. Structured Outputs Reference

### 8.1 xAI Grok-4 Structured Outputs (Oct 7, 2025)
- Enabled via Responses API `response_format.json_schema` (not `text.format`).
- Minimal schema defined in `server/services/schemas/grokJsonSchema.ts`:
  - Required: `multiplePredictedOutputs`, `predictedOutput`
  - Optional: `predictedOutput1/2/3`, `confidence`
  - Arrays-of-arrays of integers, shallow nesting, `additionalProperties: false`
- Avoid unsupported JSON Schema constraints (`minLength/maxLength`, `minItems/maxItems`, `allOf`, etc.).
- Fallback: on schema errors (400/422/503), retry once without the schema; parsing still succeeds via `output_text`.

### 8.2 OpenAI Structured Outputs (Oct 14, 2025)
- Supported types: String, Number, Boolean, Integer, Object, Array, Enum, `anyOf`.
- Supported string properties: `pattern`, `format` (`date-time`, `time`, `date`, `duration`, `email`, `hostname`, `ipv4`, `ipv6`, `uuid`).
- Supported number properties: `multipleOf`, `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum`.
- Supported array properties: `minItems`, `maxItems`.

## 9. Appendices & Common Issues

### Best Practices
- Always consult CLAUDE.md before coding.
- Use repository patterns; no direct DB queries.
- Maintain SRP and DRY rigorously.
- Ship real implementations—no mocks/placeholders.
- Commit with detailed messages once work is verified.

### Common Issues
- **WebSocket conflicts**: Saturn solver streaming can interfere—watch for collisions.
- **Database**: Tables auto-create on startup if PostgreSQL is configured; verify migrations.

### STREAMING GUIDE (Full Reference)
> _The full Agents SDK streaming walkthrough (setup, logging text deltas, event listener loops, event type definitions, human-in-the-loop approval flow, CLI examples, and tips) is preserved above in Section 5.2. Keep it intact for ready reference._

**Final reminders**
- Keep the stream visible until the user confirms they’ve read it.
- Architecture-first thinking, SRP/DRY enforcement, and changelog discipline are mandatory.
- Quality over speed. Take your time, ultrathink, and deliver production-ready code.