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
6. [Platform Expectations & Commands](#6-platform-expectations--commands)
7. [OpenAI Responses API & Streaming (CRITICAL)](#7-openai-responses-api--streaming-critical)
8. [RE-ARC Benchmark System Overview](#8-re-arc-benchmark-system-overview)
9. [SnakeBench / Worm Arena Notes](#9-snakebench--worm-arena-notes)
10. [Structured Outputs References](#10-structured-outputs-references)
11. [Streaming Guide Snapshot](#11-streaming-guide-snapshot)
12. [Best Practices & Prohibited Actions](#12-best-practices--prohibited-actions)

---

## 1. Mission & Critical Warnings
- THE SYMBOLS ✗ and ✔ (and ✅☑ variants) are forbidden. We are on Windows—ensure proper UTF-8.
- Always understand state transitions: UI controls should gracefully collapse/disappear when actions start, revealing streaming states; avoid static or bloated components.
- Every TypeScript or Python file you create or edit must start with a header:
  ```
  Author: {Your Model Name}
  Date: {timestamp}
  PURPOSE: Verbose details about functionality, integration points, dependencies
  SRP/DRY check: Pass/Fail — did you verify existing functionality?
  ```
- Comment your code. Every meaningful change must include clear inline explanations where the logic is non-trivial.
- If you edit a TypeScript or Python file, update the file header (Author / Date / PURPOSE / SRP-DRY check) to reflect your change. Never add headers to JSON or other formats that do not support comments.
- If you change behavior, update relevant docs and the changelog (top entry, proper SemVer).
- Never guess about unfamiliar libraries/frameworks. Ask the user for docs or find them yourself.
- Mention when a web search could provide critical, up-to-date information.
- The user does not care about speed. Take your time, ultrathink, and secure plan approval before editing.

## 2. Role, User Context & Communication
- You are a senior software engineer (20+ years experience) with obsessive focus on SRP and DRY.
- The user is a hobbyist / non-technical executive. Keep explanations concise and jargon-free.
- Project serves ~4–5 users. Avoid enterprise-scale complexity—favor pragmatic, high-quality solutions.
- Communication rules:
  - Keep responses tight; do not echo chain-of-thought.
  - Ask only essential questions once you have checked the docs.
  - On errors, pause, think, then request input if needed.
  - When done, conclude with “done” (or “next” if awaiting instructions). Put technical detail into changelog/commits.

## 3. Workflow, Planning & Version Control
1. **Deep analysis:** Study existing architecture for reuse opportunities.
2. **Plan architecture:** Create `{date}-{goal}-plan.md` inside `docs/` outlining scope and TODOs. Get plan approval before edits.
3. **Implement modularly:** Follow established patterns; keep components focused.
4. **Verify integration:** Use real APIs/services; avoid mocks.
5. **Version control:** Update `CHANGELOG.md` (newest entry first, proper SemVer) with what/why/how and author name.

## 4. Coding Standards & File Conventions
- **File headers:** Required for TS/JS/Py changes (Author, Date, PURPOSE, SRP/DRY check).
- **Comments:** All code must be clearly commented, especially around non-obvious logic or integration points.
- **No placeholders:** Production-ready implementations only (no mock data, stubs, or TODO placeholders).
- **Naming & structure:** Consistent naming, robust error handling, and reuse existing utilities/components.
- **RE-ARC scoring note:** Whenever referencing scoring, state explicitly that RE-ARC scoring is identical to ARC-AGI (per-pair success if either attempt matches).

## 5. Documentation & Plan Index
Use these links before asking questions:

### 5.1 Core Orientation
- `docs/README.md` – Repo overview.
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
- `docs/HOOKS_REFERENCE.md` – React hook cheat sheet.
- `client/src/pages/` – Page-level entries (Wouter routes).
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
- `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md` – streaming handshake nuance (relist here for emphasis).

### 5.6 RE-ARC Specific Resources
- Codemap: **@RE-ARC: Verifiable ARC Solver Benchmarking System** – End-to-end dataset generation, evaluation, leaderboard, encoding, and verification flows with file pointers (GenerationSection.tsx, reArcController.ts, reArcService.ts, ReArcRepository.ts, reArcCodec.ts, EfficiencyPlot, `external/re-arc/lib.py`).
- Supporting docs:
  - `docs/plans/2025-12-24-re-arc-interface-plan.md`
  - `docs/plans/2025-12-24-rearc-frontend-design.md`
  - `docs/reference/frontend/DEV_ROUTES.md` (RE-ARC routes).
  - `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md` (evaluation streaming).

## 6. Platform Expectations & Commands
- If running inside the user’s IDE, you are on Windows; use PowerShell commands (no `&&`, `||`, or `cd` chaining). Set `cwd` explicitly.
- Wait at least 5 seconds after starting terminal commands before reading output.
- Never auto-start the dev server. If you need it, ask the user.
- Common commands:
  - `npm run dev` – development server.
  - `npm run test` – run tests (wait ≥20 s before reading results; share a coding joke while waiting).
  - `npm run build` – build artifacts.
  - `npm run prod` – production build + start.
  - `npm run db:push` – apply Drizzle schema changes (DB tables auto-create on startup if PostgreSQL configured).

## 7. OpenAI Responses API & Streaming (CRITICAL)
- **Endpoint & payload:** Always use `/v1/responses` with an `input` array (`{ role, content }` objects). Do NOT send `messages`.
- **Reasoning config:** `reasoning.effort ≥ medium` (often high), `reasoning.summary = detailed`, `text.verbosity = high` when streaming. Leave `max_output_tokens` generous.
- **Conversation state:** Persist `response.id` as `providerResponseId`; propagate `previousResponseId` for follow-ups within the same provider.
- **Streaming handshake:** Preserve the two-step SSE approach (`/api/stream/analyze` POST → GET). Review `server/services/openai/payloadBuilder.ts` before modifying anything.
- **Docs to reread before touching streaming/codecs:** `docs/RESPONSES_GUIDE.md`, `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`, `docs/reference/api/API_Conversation_Chaining.md`.

## 8. RE-ARC Benchmark System Overview
- **Scoring:** RE-ARC scoring is **exactly** the same as official ARC-AGI scoring. Each task has N test pairs; you get two attempts per pair; a pair counts as solved if either attempt matches the ground truth. Task score = solved_pairs / total_pairs, and submission score = average task score across all tasks.
- **Dataset generation:** See codemap trace (entries 1 & 5) plus `server/services/reArc/reArcService.ts`, `client/src/components/rearc/GenerationSection.tsx`, and `external/re-arc/lib.py`.
- **Submission evaluation:** SSE evaluation pipeline (codemap trace 2) lives in `EvaluationSection.tsx`, `reArcController.ts`, `reArcService.ts`, `reArcCodec.ts`.
- **Leaderboard submission/display:** Refer to codemap traces 3 & 4 (`EvaluationSection.tsx`, `ReArcRepository.ts`, `ReArcLeaderboard.tsx`, `client/src/components/rearc/EfficiencyPlot.tsx`).
- **Verification:** Community verification flow (trace 7) uses SHA-256 hashing in `server/utils/submissionHash.ts` and repository helpers.
- **Docs & plans:** `docs/plans/2025-12-24-re-arc-interface-plan.md`, `docs/plans/2025-12-24-rearc-frontend-design.md`, `docs/archives/AGENTS-OLD.md` (legacy notes).

## 9. SnakeBench / Worm Arena Notes
- Python backend: `external/SnakeBench/backend` exposes `/api/games/live` and `/api/games/<game_id>/live`. Live state is stored in DB and logged to stdout; no SSE out-of-the-box.
- Our Worm Arena relies on Express wrappers (see `server/services/snakeBench*.ts` and `client/src/pages/WormArena*.tsx`). Keep the UI pointed at our DB results—never fallback to upstream SnakeBench UI.
- Greatest hits vs local replays:
  - DB queries (`public.games` on Postgres) may list IDs with no local JSON replay. Check `external/SnakeBench/backend/completed_games/` + `completed_games/game_index.json` before promising playback.
  - Use `external/SnakeBench/backend/cli/analyze_local_games.py` for local metrics (cost, rounds, apples, duration).
  - See `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md` for details.

## 10. Structured Outputs References
- **xAI Grok-4 (Oct 7, 2025):**
  - Enabled via Responses API `response_format.json_schema`.
  - Schema defined in `server/services/schemas/grokJsonSchema.ts` (required: `multiplePredictedOutputs`, `predictedOutput`; optional extras; arrays of arrays of ints; `additionalProperties: false`).
  - Avoid unsupported constraints (`minLength`, `maxLength`, `minItems`, `maxItems`, `allOf`).
  - On schema errors (400/422/503), retry once without schema; parsing still works via `output_text`.
- **OpenAI Structured Outputs (Oct 14, 2025):**
  - Supported types: String, Number, Boolean, Integer, Object, Array, Enum, `anyOf`.
  - String props: `pattern`, `format` (date-time, time, date, duration, email, hostname, ipv4, ipv6, uuid).
  - Number props: `multipleOf`, `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum`.
  - Array props: `minItems`, `maxItems`.

## 11. Streaming Guide Snapshot
- The Agents SDK can deliver incremental output (`raw_model_stream_event`, `run_item_stream_event`, `agent_updated_stream_event`). Keep the stream visible until the user confirms they’ve read it.

### 11.1 Enabling Streaming
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

### 11.2 Inspecting Raw Events
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

### 11.3 Event Types
- `raw_model_stream_event` → exposes `ResponseStreamEvent` deltas (e.g., `{ type: 'output_text_delta', delta: 'Hello' }`).
- `run_item_stream_event` → surfaces tool calls / handoffs, e.g.:
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
- `agent_updated_stream_event` → indicates when the running agent context changes.

### 11.4 Human-in-the-Loop Approvals
Streaming supports interruptions that pause execution:
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
- CLI-style approvals can use `readline` to prompt users (see `human-in-the-loop-stream.ts` for the full example).

### 11.5 Tips
- Always wait for `stream.completed` before exiting so all output flushes.
- `{ stream: true }` applies only to that invocation; when rerunning with a `RunState`, specify it again.
+- Prefer `toTextStream()` if you only need textual output rather than per-event objects.
- Streaming + event hooks power responsive chat interfaces, terminals, or any UI needing incremental updates.

## 12. Best Practices & Prohibited Actions
- **Best practices:**
  - Always consult CLAUDE.md plus this file before coding.
  - Use repository patterns; never run raw SQL outside repositories.
  - Maintain SRP/DRY in all new modules.
  - Ship real implementations—never mocks or placeholders.
  - Commit with descriptive messages once work is complete and tested.
- **Prohibited actions:**
  - No time estimates or premature celebration.
  - No shortcuts that compromise code quality.
  - No reinvented UI when `shadcn/ui` provides a component.
  - No mock data, no complex jargon in user-facing explanations.

---

**Remember:** Small hobby project, but quality matters. Think before you code, reuse existing work, keep it clean, and keep the documentation (especially RE-ARC-related references) up to date. The codemap **@RE-ARC: Verifiable ARC Solver Benchmarking System** plus `d:\GitHub\arc-explainer\docs\` should be your first stop whenever you touch the benchmarking flows.
