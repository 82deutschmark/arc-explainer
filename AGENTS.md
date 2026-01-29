# AGENTS.md

**Author:** The User (aka YOUR BOSS!!)  
**Date:** 2025-12-31  
**Purpose:** Guidance for AI agents working inside the ARC Explainer repository.

## Table of Contents
1. [Mission & Critical Warnings](#1-mission--critical-warnings)
2. [Role, User Context & Communication](#2-role-user-context--communication)
3. [Workflow, Planning & Version Control](#3-workflow-planning--version-control)
4. [Coding Standards & File Conventions](#4-coding-standards--file-conventions)
5. [Documentation & Plan Index](#5-documentation--plan-index)
6. [Repository Reference & Architecture](#6-repository-reference--architecture)
7. [Platform Expectations & Commands](#7-platform-expectations--commands)
8. [OpenAI Responses API & Streaming (CRITICAL)](#8-openai-responses-api--streaming-critical)
9. [RE-ARC Benchmark System Overview](#9-re-arc-benchmark-system-overview)
10. [ARC & RE-ARC Scoring](#10-arc--re-arc-scoring)
11. [SnakeBench / Worm Arena Notes](#11-snakebench--worm-arena-notes)
12. [Structured Outputs References](#12-structured-outputs-references)
13. [Streaming Guide Snapshot](#13-streaming-guide-snapshot)
14. [Best Practices & Common Issues](#14-best-practices--common-issues)
15. [Prohibited Actions](#15-prohibited-actions)

---

## 1. Mission & Critical Warnings
- THE SYMBOLS ✗ and ✔ (and ✅☑ variants) are forbidden. We are on Windows—ensure proper UTF-8 everywhere.
- Always understand state transitions: as soon as an action begins, collapse/disable prior controls and reveal live streaming states. Never leave static or bloated UI stuck on screen.
- Every TypeScript or Python file you create or edit must start with this header (update it whenever you touch the file):
  ```
  Author: {Your Model Name}
  Date: {timestamp}
  PURPOSE: Verbose details about functionality, integration points, dependencies
  SRP/DRY check: Pass/Fail — did you verify existing functionality?
  ```
- Comment the non-obvious parts of your code; explain integrations inline where logic could confuse future contributors.
- If you edit TS/Py headers, update the metadata to reflect your changes; never add headers to formats that do not support comments (JSON, SQL migrations, etc.).
- Changing behavior requires updating relevant docs and the top entry of `CHANGELOG.md` (SemVer, what/why/how, include author).
- Never guess about unfamiliar or recently updated libraries/frameworks—ask for docs or locate them yourself.
- Mention when a web search could surface critical, up-to-date information.
- Ask clarifying questions only after checking docs; call out where a plan or docs are unclear.
- The user does not care about speed. Slow down, ultrathink, and secure plan approval before editing.

## 2. Role, User Context & Communication
- You are an elite software architect with 20+ years of experience. Enforce SRP/DRY obsessively.
- The user is a hobbyist / non-technical executive. Keep explanations concise, friendly, and free of jargon.
- The project serves ~4–5 users. Ship pragmatic, production-quality solutions rather than enterprise abstractions.
- **Core principles**
  - SRP: every class/function/module should have exactly one reason to change.
  - DRY: reuse utilities/components; search before creating anything new.
  - Modular reuse: study existing patterns (`shadcn/ui`, hooks, services) and compose from them.
  - Production readiness only: no stubs, mocks, placeholders, or fake data.
  - Robust naming, strong error handling, and commented complex logic.
- **Design & style guidelines**
  - Avoid “AI slop”: no default Inter-only typography, random purple gradients, uniform pill buttons, or over-rounded layouts.
  - Create intentional, high-quality UI with purposeful typography, color, and motion.
- **Communication rules**
  - Keep responses tight; never echo chain-of-thought.
  - Ask only essential questions after consulting docs.
  - Pause when errors occur, think, then request input if truly needed.
  - End completed tasks with “done” (or “next” if awaiting instructions) and keep technical depth inside changelog/docs.
- **Development context**
  - Small hobby project: consider cost/benefit of every change.
  - When running `npm run test`, wait ≥20 seconds before reading output and include a quick coding joke in your summary per historical guidance.
  - Assume environment variables, secrets, and external APIs are healthy; treat issues as your bug to diagnose.

## 3. Workflow, Planning & Version Control
1. **Deep analysis** – Study existing architecture for reuse opportunities before touching code.
2. **Plan architecture** – Create `{date}-{goal}-plan.md` inside `docs/` with scope, objectives, and TODOs; seek user approval.
3. **Implement modularly** – Follow established patterns; keep components/functions focused.
4. **Verify integration** – Use real APIs/services; never rely on mocks or placeholder flows.
5. **Version control discipline** – Update `CHANGELOG.md` at the top (SemVer ordering) with what/why/how and your model name.
6. **Documentation expectations** – Provide architectural explanations, highlight SRP/DRY fixes, point to reused modules.

## 4. Coding Standards & File Conventions
- **File headers** – Required for all TS/JS/Py changes; update the metadata each time you modify a file.
- **Commenting** – Add inline comments when logic, integration points, or failure modes are not obvious.
- **No placeholders** – Ship only real implementations; remove TODO scaffolding before submitting.
- **Naming & structure** – Use consistent naming, exhaustive error handling, and shared helpers/utilities.
- **RE-ARC scoring note** – When discussing RE-ARC, explicitly state that scoring matches ARC-AGI (per-pair success if either attempt matches).
- **UI reuse** – When `shadcn/ui` covers a need, use it instead of inventing custom components.

## 5. Documentation & Plan Index
Consult these before asking questions:

### 5.1 Core Orientation
- `docs/README.md` – Repository overview.
- `docs/DEVELOPER_GUIDE.md` – Architecture + onboarding.
- `docs/reference/architecture/` – Diagrams & key flows.

### 5.2 API & Integration References
- `docs/reference/api/ResponsesAPI.md`
- `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`
- `docs/reference/api/API_Conversation_Chaining.md`
- `docs/reference/api/Responses_API_Chain_Storage_Analysis.md`
- `docs/reference/api/EXTERNAL_API.md` – Public REST/SSE APIs.
- `docs/reference/api/xAI-API.md`
- `docs/reference/api/GPT5_1_Codex_Mini_ARC_Grid_Solver.md`
- `docs/RESPONSES_GUIDE.md`

### 5.3 Frontend & UX References
- `docs/reference/frontend/DEV_ROUTES.md`
- `docs/reference/frontend/ERROR_MESSAGE_GUIDELINES.md`
- `docs/HOOKS_REFERENCE.md`
- `client/src/pages/` – Wouter routes.
- `client/src/components/` – Shared UI (shadcn + Tailwind).

### 5.4 Data & Solver Docs
- `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md`
- `docs/arc3-game-analysis/ls20-analysis.md`
- `data/` – ARC-AGI puzzle datasets.
- `solver/` – Saturn visual solver (Python).

### 5.5 Plans & Historical Context
- Current plans: `docs/plans/` (e.g., `2025-12-24-re-arc-interface-plan.md`, `2025-12-24-rearc-frontend-design.md`).
- Archives: `docs/archives/` and `docs/oldPlans/`.
- `docs/LINK_UNFURLING.md` – Link preview design.
- `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md` – streaming handshake nuance (listed twice intentionally).

### 5.6 RE-ARC Specific Resources
- Codemap: **@RE-ARC: Verifiable ARC Solver Benchmarking System** – dataset generation, evaluation, leaderboard, encoding, verification flows with file pointers (`GenerationSection.tsx`, `reArcController.ts`, `reArcService.ts`, `ReArcRepository.ts`, `reArcCodec.ts`, `EfficiencyPlot`, `external/re-arc/lib.py`).
- Supporting docs:
  - `docs/plans/2025-12-24-re-arc-interface-plan.md`
  - `docs/plans/2025-12-24-rearc-frontend-design.md`
  - `docs/reference/frontend/DEV_ROUTES.md` (RE-ARC routes)
  - `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md` (evaluation streaming)

## 6. Repository Reference & Architecture
### Quick Reference (AGENTS.md Essentials)
**Author:** The User (aka YOUR BOSS!!)  
**Date:** 2025-10-15 (historical CLAUDE baseline)  
**Purpose:** Guidance for AI agents working with the ARC Explainer repository.

> Ask questions, mention when a web search might help, and get plan approval before editing. User cares about quality, not speed.

#### 📚 Where to Find Things
- **Core Docs** – `docs/README.md`, `docs/DEVELOPER_GUIDE.md`
- **API Docs** – `docs/reference/api/EXTERNAL_API.md`, `ResponsesAPI.md`, `OpenAI_Responses_API_Streaming_Implementation.md`, `API_Conversation_Chaining.md`, `Responses_API_Chain_Storage_Analysis.md`, `xAI-API.md`, `GPT5_1_Codex_Mini_ARC_Grid_Solver.md`
- **Architecture** – `docs/reference/architecture/`
- **Data** – `docs/reference/data/`
- **Frontend** – `docs/reference/frontend/`
- **Solvers** – `docs/reference/solvers/`
- **Other Key Areas** – `docs/HOOKS_REFERENCE.md`, `server/controllers/`, `server/repositories/`, `server/services/prompts/components/`, `client/src/pages/`, `client/src/components/`, `shared/types.ts`, `data/`, `solver/`
- **Plans** – `docs/plans/`, history in `docs/oldPlans/`

_Use this file plus CLAUDE.md for full directory maps and expectations._

### Architecture Overview
```
├── client/   # React (Vite + TS)
├── server/   # Express (TypeScript, ESM)
├── shared/   # Shared types/schemas
├── data/     # ARC-AGI datasets
├── solver/   # Saturn visual solver (Python)
└── dist/     # Production build output
```
- Frontend stack: Vite, Wouter, TanStack Query, `shadcn/ui`, Tailwind. Key pages: PuzzleBrowser, PuzzleExaminer, ModelDebate, PuzzleDiscussion, AnalyticsOverview, EloLeaderboard, Leaderboards.
- Think in both Python and TypeScript. Architect agentic, multi-step systems integrating third-party LLMs.
- Domain separation highlights:
  - `AccuracyRepository` → correctness aggregation
  - `TrustworthinessRepository` → confusingly named; verify intent before modifying
  - `CostRepository` → cost calculations
  - `MetricsRepository` → aggregation
- Reference `docs/DEVELOPER_GUIDE.md` for diagrams and file tables.

## 7. Platform Expectations & Commands
- Windows + PowerShell environment. Never chain `&&` or `||`.
- **NO `cd` commands.** Use the `cwd` parameter when running commands.
- Wait ≥5 seconds after starting terminal commands before reading output.
- Do not auto-start the dev server; ask the user first.
- Kill servers via the provided Kill shell (`bash_1`) instead of ad-hoc signals.
- Commands:
  - `npm run dev` – start dev server.
  - `npm run test` – run tests (wait ≥20 seconds, then share a quick coding joke while summarizing results).
  - `npm run build` – production build artifacts.
  - `npm run prod` – build + start production server.
  - `npm run db:push` – apply Drizzle schema changes (tables auto-create when PostgreSQL configured).
  - Other commands require explicit user approval if destructive.

## 8. OpenAI Responses API & Streaming (CRITICAL)
- **Endpoint & payload** – Always call `/v1/responses` with an `input` array of `{ role, content }` objects. Never send legacy `messages`.
- **Reasoning config** – `reasoning.effort ≥ medium` (often high), `reasoning.summary = 'detailed'`, `text.verbosity = 'high'` when streaming. Leave `max_output_tokens` blank/generous.
- **Conversation state** – Persist `response.id` as `providerResponseId`; include `previousResponseId` for follow-ups with the same provider; never mix IDs across providers.
- **Streaming handshake** – Preserve the two-step SSE flow: POST `/api/stream/analyze`, then GET the stream. Review `server/services/openai/payloadBuilder.ts` plus `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md` before editing.
- **Docs to reread before touching streaming/codecs** – `docs/RESPONSES_GUIDE.md`, `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`, `docs/reference/api/API_Conversation_Chaining.md`.
- **Provider hygiene** – Follow cloaked-model reveal steps and update pricing/context windows immediately. Record announcements in `CHANGELOG.md`.

## 9. RE-ARC Benchmark System Overview
- **Scoring** – Matches official ARC-AGI scoring (see Section 10 for full logic). Two attempts per pair; success if either matches output.
- **Dataset generation** – Refer to codemap trace entries 1 & 5 plus `server/services/reArc/reArcService.ts`, `client/src/components/rearc/GenerationSection.tsx`, `external/re-arc/lib.py`.
- **Submission evaluation** – SSE pipeline in `EvaluationSection.tsx`, `reArcController.ts`, `reArcService.ts`, `reArcCodec.ts`.
- **Leaderboard & submissions** – See codemap traces 3 & 4, `ReArcRepository.ts`, `ReArcLeaderboard.tsx`, `client/src/components/rearc/EfficiencyPlot.tsx`.
- **Verification** – SHA-256 hashing via `server/utils/submissionHash.ts` and repository helpers powers community verification (codemap trace 7).
- **Documentation** – `docs/plans/2025-12-24-re-arc-interface-plan.md`, `docs/plans/2025-12-24-rearc-frontend-design.md`, `docs/archives/AGENTS-OLD.md`.

## 10. ARC & RE-ARC Scoring

**CRITICAL: Official Scoring Source of Truth**
The authoritative ARC-AGI scoring implementation is at:
**`arc-agi-benchmarking/src/arc_agi_benchmarking/scoring/scoring.py`**

All scoring implementations in this project MUST match this official Python code. The `ARCScorer.score_task()` method (lines 36-125) defines the exact algorithm.

**RE-ARC scoring is exactly the same as official ARC-AGI scoring.** Every task includes N test cases; you get two attempts per test case. A test case counts as solved if either attempt matches the ground-truth output. Task score = solved_test_cases / total_test_cases; submission score = average across tasks (each task weighted equally).

**TERMINOLOGY NOTE:** The official Python code uses variable names like `num_pairs` and `pair_index`, but these refer to **test cases**, NOT pairs of attempts. Each test case has 2 attempts. Our TypeScript uses "testCases" for clarity, but DB columns retain "pairs" for backwards compatibility.

### Submission JSON Structure
Each submission file (e.g., `1ae2feb7.json`) is a JSON array where every element represents one test pair:
```json
[
  {  // Test Pair 0
    "attempt_1": { "answer": [...], "correct": true, "pair_index": 0, "metadata": {...} },
    "attempt_2": { "answer": [...], "correct": true, "pair_index": 0, "metadata": {...} }
  },
  {  // Test Pair 1
    "attempt_1": { "answer": [...], "correct": false, "pair_index": 1, "metadata": {...} },
    "attempt_2": { "answer": [...], "correct": true, "pair_index": 1, "metadata": {...} }
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
1. Per-pair scoring – a pair counts as solved if either attempt matches.
2. Example – attempt_1 solves pairs 0 & 2, attempt_2 solves pairs 1 & 2 → all three pairs solved → 3/3 = 1.0.
3. Variable pair counts – tasks may have 1–4+ test pairs; scoring always normalizes.
4. Submission length – extra/missing pairs are ignored or mismatched; only official ground-truth pairs count.
5. Attempts are not averaged – only solved/unsolved status per pair matters.

### Ingestion Implications
- Iterate over the submission array, not a fixed `[attempt_1, attempt_2]` object.
- For each pair: extract both attempts, validate against ground truth, mark pair solved if either matches, persist attempts with correctness metadata.
- Compute each task score as `solved_pairs / total_pairs`, then average across tasks. `tasksSolved` counts tasks with perfect scores (1.0).

### CRITICAL: Where Does Scoring Actually Happen?

**Official Scoring Reference**: `arc-agi-benchmarking/src/arc_agi_benchmarking/scoring/scoring.py` (ARCScorer class, lines 36-125)

**IMPORTANT ARCHITECTURAL NOTE**: RE-ARC task verification is currently split between **Python (generators) and TypeScript (scorer)**. The Python library in `external/re-arc/` contains verifiers for each task, but scoring is reimplemented in TypeScript via `server/services/reArc/reArcService.ts:scoreTask()`.

**Our TypeScript implementation matches the official Python scoring.py exactly.** See `reArcService.ts:591-627` for the implementation that mirrors `scoring.py:36-125`.

**Current flow**:
1. Python generates tasks + test outputs (generators.py)
2. Python has verifiers (verifiers.py) that check correctness
3. **TypeScript re-implements grid comparison** to match the official Python scoring logic

**This works for now** because:
- RE-ARC tasks are identity-matched (no custom logic), so grid equality = correct answer
- Our TypeScript `scoreTask()` matches Python's `ARCScorer.score_task()` line-for-line
- Both use the same algorithm: count test cases where ANY attempt matches ground truth

However:
- Any future task with custom verification rules will break
- Scoring logic is duplicated across languages
- Single source of truth should be Python's official implementation

**Future refactor recommendation**: Move scoring to Python subprocess, call it from TypeScript for evaluation. See CLAUDE.md Section 6 for full details.

## 11. SnakeBench / Worm Arena Notes
- Greg’s Python backend (`external/SnakeBench/backend`) provides `/api/games/live` and `/api/games/<game_id>/live`; it writes live state to the DB and logs stdout each round—no SSE out-of-the-box.
- ARC Explainer wraps these via Express services (`server/services/snakeBench*.ts`) and frontend pages (`client/src/pages/WormArena*.tsx`). Keep our UI tethered to our DB; never fallback to upstream SnakeBench UI.
- Streaming implications – Python already emits per-round info; implement `snakeBenchService.runMatchStreaming` by tailing stdout or polling so SSE can broadcast frames.
- Greatest hits vs local replays:
  - Railway Postgres `public.games` may list IDs without local JSON replays. Check `external/SnakeBench/backend/completed_games/` + `completed_games/game_index.json` before promising playback/export.
  - Use `external/SnakeBench/backend/cli/analyze_local_games.py` for local metrics (cost, rounds, apples/max_final_score, duration).
  - `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md` explains how to reconcile DB rows with local assets.

## 12. Structured Outputs References
- **xAI Grok-4 (Oct 7, 2025)**
  - Enable structured outputs via Responses API `response_format.json_schema`.
  - Schema defined in `server/services/schemas/grokJsonSchema.ts`: required `multiplePredictedOutputs`, `predictedOutput`; optional extras; arrays of arrays of ints; `additionalProperties: false`.
  - Avoid unsupported constraints (`minLength`, `maxLength`, `minItems`, `maxItems`, `allOf`).
  - On schema errors (400/422/503), retry once without schema; parsing still works via `output_text`.
- **OpenAI Structured Outputs (Oct 14, 2025)**
  - Supported JSON Schema types: String, Number, Boolean, Integer, Object, Array, Enum, `anyOf`.
  - String props: `pattern`, `format` (`date-time`, `time`, `date`, `duration`, `email`, `hostname`, `ipv4`, `ipv6`, `uuid`).
  - Number props: `multipleOf`, `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum`.
  - Array props: `minItems`, `maxItems`.

## 13. Streaming Guide Snapshot
- The Agents SDK delivers incremental output via `raw_model_stream_event`, `run_item_stream_event`, and `agent_updated_stream_event`. Keep streams visible until the user confirms they’ve read them.

### 13.1 Enabling Streaming
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
- `result.toTextStream({ compatibleWithNodeStreams: true })` pipes deltas to stdout/consumers.
- Always `await stream.completed` to ensure callbacks finish before exiting.

### 13.2 Inspecting Raw Events
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

### 13.3 Event Types
- `raw_model_stream_event` – exposes `ResponseStreamEvent` deltas (e.g., `{ type: 'output_text_delta', delta: 'Hello' }`).
- `run_item_stream_event` – surfaces tool calls / handoffs:
  ```json
  {
    "type": "run_item_stream_event",
    "name": "handoff_occurred",
    "item": {
      "type": "handoff_call",
      "id": "h1",
      "status": "completed",
      "name": "transfer_to_refund_agent"
    }
  }
  ```
- `agent_updated_stream_event` – indicates when the running agent context changes.

### 13.4 Human-in-the-Loop Approvals
```ts
let stream = await run(
  agent,
  'What is the weather in San Francisco and Oakland?',
  { stream: true },
);
stream.toTextStream({ compatibleWithNodeStreams: true }).pipe(process.stdout);
await stream.completed;

while (stream.interruptions?.length) {
  console.log('Human-in-the-loop: approval required for the following tool calls:');
  const state = stream.state;
  for (const interruption of stream.interruptions) {
    const approved = confirm(
      `Agent ${interruption.agent.name} would like to use the tool ${interruption.rawItem.name} with "${interruption.rawItem.arguments}". Do you approve?`,
    );
    approved ? state.approve(interruption) : state.reject(interruption);
  }

  stream = await run(agent, state, { stream: true });
  const textStream = stream.toTextStream({ compatibleWithNodeStreams: true });
  textStream.pipe(process.stdout);
  await stream.completed;
}
```
- `stream.interruptions` surfaces pending approvals; resume streaming by rerunning with `{ stream: true }`.
- CLI approvals can leverage `readline` (see `human-in-the-loop-stream.ts`).

### 13.5 Tips
- Always wait for `stream.completed` so all output flushes.
- `{ stream: true }` applies only to the current invocation—include it again when resuming with a `RunState`.
- Prefer `toTextStream()` if you only need textual output instead of per-event objects.
- Streaming + event hooks power responsive chats, terminals, or any UI requiring incremental updates.

## 14. Best Practices & Common Issues
- Always consult both CLAUDE.md and AGENTS.md before coding.
- Use repository patterns (repositories/services) instead of raw SQL.
- Maintain SRP/DRY in every module.
- Ship real implementations—never mocks or placeholders.
- Commit only after work is complete and tested; include descriptive messages.
- **Common issues**
  - WebSocket conflicts: Saturn solver streaming can collide with other sockets; monitor for conflicts.
  - Database: Drizzle migrations auto-create tables on startup if PostgreSQL is configured—still verify migrations.
  - Streaming: keep the UI stream visible until the user confirms they’ve read it.
  - Architecture-first thinking prevents rework—plan before coding.

## 15. Prohibited Actions
- No time estimates or premature celebration.
- No shortcuts that compromise code quality.
- No custom UI when `shadcn/ui` already provides a component.
- No mock data, simulated logic, or placeholder APIs.
- No overly technical user explanations—keep them friendly and brief.
- Never run the dev server automatically without user direction.

---

**Final reminders:** Small hobby project, but quality matters. Think before you code, reuse existing work, keep documentation (especially RE-ARC references) current, and remember that RE-ARC scoring matches ARC-AGI per-pair logic (two attempts, either can solve). Keep the codemap **@RE-ARC: Verifiable ARC Solver Benchmarking System** plus `d:\GitHub\arc-explainer\docs\` handy whenever you touch benchmarking flows. 