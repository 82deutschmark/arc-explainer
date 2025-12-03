# 2025-11-30-poetiq-agents-sdk-integration-plan

Author: Codex / GPT-5  
Date: 2025-11-30  
Purpose: Introduce the OpenAI Agents SDK into the Poetiq solver flow (OpenAI-only runs) by mirroring the patterns we already use in the ARC3 stack.

---

## 1. Background & References

- **Current Poetiq stack**  
  - Prompting + LLM calls live in `server/python/poetiq_wrapper.py` and `solver/poetiq/*.py`.  
  - Streaming + websocket updates managed by `server/services/poetiq/poetiqService.ts` and `client/src/hooks/usePoetiqProgress.ts`.  
  - OpenAI calls currently route through the Responses API directly (no Agents abstraction).

-- **Existing OpenAI Agents SDK implementation**  
  - `server/services/arc3/Arc3RealGameRunner.ts` and helpers (`server/services/arc3/utils/*`) show how we configure `Agent`, register tools, stream events, and capture run items.  
  - Documentation:  
    - `docs/reference/arc3/ARC3_Integration_Guide.md` (Agents SDK usage patterns, event handling, `previous_response_id` chaining).  
    - `docs/2025-11-06-arc3-agent-playground-implementation.md` (end-to-end plan we already executed).  
    - `docs/09112025-arc3-conversation-chaining.md` (Responses API + Agents `store/previous_response_id`).  

- **Other must-read guides**  
  - `AGENTS.md` (Responses API contract + streaming handshake).  
  - `docs/reference/api/ResponsesAPI.md`, `OpenAI_Responses_API_Streaming_Implementation.md`, `API_Conversation_Chaining.md`.  

- **Additional reference material**  
  - `docs/PLAN-agents-sdk-poetiq-integration.md` (companion research summary that compares the ARC3 runner, prompt expectations, tooling boundaries, and streaming requirements for Poetiq).  

---

## 2. Goals & Non-Goals

### Goals
1. Allow Poetiq runs that target OpenAI models (GPT-5.x, o-series) to execute via the OpenAI Agents SDK instead of the bare Responses API, so we get first-class streaming, tool orchestration, and `previous_response_id` management.
2. Reuse as much of the existing ARC3 Agents infrastructure as possible (tool helpers, streaming harness, telemetry) to avoid duplicating SDK plumbing.
3. Preserve current Python sandbox behavior (code generation + execution) while letting the Agent manage conversation turns.
4. Keep Gemini/Anthropic/OpenRouter paths untouched—they remain on the Python wrapper.

### Non-Goals
- Rewriting the Poetiq solver entirely in TypeScript.
- Changing the frontend UX beyond what is needed to surface new Agent-specific telemetry (e.g., reasoning frames).  
- Altering database schema or historical entries.

---

## 3. High-Level Architecture

1. **New Poetiq Agents runner (TypeScript)**  
   - Lives beside ARC3’s runner, e.g., `server/services/poetiq/PoetiqAgentsRunner.ts`.  
   - Builds the Poetiq prompt (system + user + feedback) using existing helpers (`solver/poetiq/prompts.py` semantics) but in TS.  
   - Wraps the Python sandbox execution as callable “tools” the Agent can invoke:  
     - `submit_code_and_test` -> pipes candidate Python code into the sandbox (existing `solver/poetiq/solve_parallel_coding`) and returns pass/fail info.  
     - Optional `inspect_history`, `summarize_feedback` tools for structured context reuse.  
   - Uses `@openai/agents` streaming (`run(..., { stream: true })`) exactly like ARC3 to capture reasoning, tool calls, and final output.  
   - Stores `previous_response_id` / `providerResponseId` for continuation runs (see `docs/09112025-arc3-conversation-chaining.md`).  
2. **Python sandbox integration**  
   - Expose a lightweight IPC or HTTP bridge so the TypeScript tool executor can trigger Python evaluations:
     - Option A: keep the existing `server/python/poetiq_wrapper.py` but add a “tool mode” entry point (execute once per tool call, return JSON).  
     - Option B: factor out the evaluation logic into a standalone python module invoked via `python -m solver.poetiq.tool_runner ...`.  
   - Ensure tool results remain deterministic and include:
     - `trainResults`, `testPreview`, `code`, `tokenUsage`, `cost`, `expertId`, etc.

3. **Routing logic**  
   - `server/services/poetiq/poetiqService.ts` decides runtime path:
     - If provider/model is OpenAI + Agents enabled -> call `PoetiqAgentsRunner`.
     - Otherwise -> fall back to legacy Python wrapper streaming (current default).
   - Expose feature flag via controller (`promptStyle` request already present); add `useAgents?: boolean` or auto-enable when `provider === 'openai'`.

4. **Streaming to the UI**  
   - Mirror ARC3 SSE strategy: map Agents stream events to Poetiq websocket payloads.
   - Extend `PoetiqProgressState` to handle:
     - `agentRunItems` (tool calls, reasoning deltas, thinking).  
     - `agentTextStream` (combine `extractAllTextOutput` for summary).  
   - Keep the existing prompt timeline/tokens panels intact by translating Agent events into the same `promptData` structure (system/user/feedback, stats, `providerResponseId`).

5. **Conversation state persistence**  
   - Store `providerResponseId` from Agents responses on each iteration so Poetiq can continue runs without losing context (aligns with existing conversation-state contract in `shared/types.ts`).

---

## 4. Detailed Task Breakdown

### Phase A – Research & scaffolding
1. Re-read ARC3 agent docs and implementation (`server/services/arc3/Arc3RealGameRunner.ts`, `docs/reference/arc3/ARC3_Integration_Guide.md`) to catalog reusable utilities (stream harness, run-item processors, logging norms).  
2. Inventory Python functions we can re-use for evaluations (`solver/poetiq/solve_coding.py`, `_eval_on_train_and_test`, etc.) and define the minimal interface required by the Agents tool.  
3. Draft TypeScript interfaces mirroring the Python prompt data so conversions stay lossless (`PoetiqPromptData`, `PoetiqIterationData`).

### Phase B – Backend runner
4. Create `server/services/poetiq/PoetiqAgentsRunner.ts`:
   - Build Agent instructions by concatenating `SOLVER_PROMPT_ARC*` text and the `$$problem$$` placeholder with runtime puzzle data.
   - Register tools:
     - `submit_python_solver`: accepts `{ code: string, iteration: number }`, invokes the Python sandbox, returns metrics + feedback.
     - `inspect_progress`: returns summary of prior attempts/prompts for the Agent (keeps context small).
   - Implement streaming harness using `run(agent, state, { stream: true })` + `toTextStream()` like ARC3.
   - Map run items to Poetiq events (`promptData`, `reasoning`, `tokenUsage`).

5. Tool execution bridge:
   - Add a Python CL entry (e.g., `server/python/poetiq_tool_runner.py`) that expects JSON payload describing iteration, code, etc., and returns sandbox output.
   - Node runner spawns this script per tool call (similar to how we already spawn the full wrapper), capturing stdout/stderr.
   - Share caching context (prompt history, experiment metadata) via the Agent state rather than long-lived python workers.

6. Persistence & telemetry:
   - Update `shared/types.ts` and Poetiq websocket payloads to include Agent-specific fields (`agentRunId`, `agentModel`, `previousResponseId`).
   - Ensure `providerRawResponse` stored in explanations includes Agents metadata (tools invoked, reasoning frames).

### Phase C – Routing & API surface
7. Update `server/services/poetiq/poetiqService.ts`:
   - Detect when `options.provider === 'openai'` and `useAgents` flag is enabled -> delegate to `PoetiqAgentsRunner`.
   - Normalize responses so the controller/client code doesn’t need to know which runner was used.

8. Update `server/controllers/poetiqController.ts`:
   - Accept `useAgents` boolean (default true for OpenAI provider).  
   - Validate that Agents is only used when `providerResponseId` support exists (OpenAI).  
   - Broadcast new Agent telemetry down the websocket stream.

9. Update client hook/UI:
   - `client/src/hooks/usePoetiqProgress.ts`: handle new websocket payload fields (agent thinking, tool calls, text stream).  
   - UI additions (optional): timeline row for each Agent tool call, badge showing “OpenAI Agents (beta)”.

### Phase D – Validation & documentation
10. Integration tests:  
    - Add a smoke test script in `server/services/poetiq/__tests__/PoetiqAgentsRunner.test.ts` hitting a mock python tool-runner (no actual API keys).  
    - Manual test: run Poetiq with GPT-5.1 via Agents to ensure streaming works and outputs match legacy path.

11. Update docs:  
    - `docs/DEVELOPER_GUIDE.md` + `docs/reference/api/ResponsesAPI.md` (mention Agents runner).  
    - Add instructions to `docs/reference/poetiq/` describing how to toggle Agents vs legacy solver.

12. Changelog entry + feature flag toggle description.

---

## 5. Risks & Mitigations

- **Tool latency**: Invoking the python sandbox per tool call could be expensive. Mitigation: batch evaluations (allow tool to run multiple iterations) or keep a warm worker process using stdin pipes.  
- **Streaming complexity**: Agents streams include extra event types. Reuse ARC3 `timelineProcessor` patterns to stay consistent.  
- **Conversation drift**: Need to ensure Agents state stays in sync with Python iterations. Keep iteration counters in tool payloads and echo them back into prompt history for deterministic timelines.  
- **Security**: Tools execute arbitrary code. Continue using the existing sandbox restrictions and never expose raw tool outputs to users without filtering.  

---

## 6. Deliverables

1. `PoetiqAgentsRunner` (TypeScript) + supporting utilities.  
2. Python tool-runner entrypoint shared with Agents tools.  
3. Updated Poetiq service/controller/client to route OpenAI requests through Agents and surface new telemetry.  
4. Documentation updates and a top-of-changelog entry once implemented.  

---

## 7. UI/UX for Poetiq Agents (implemented)

### 7.1 Objectives

- Mirror the successful ARC3 Agent Playground UX while staying within the existing Poetiq solver layout.
- Keep non-Agents runs visually identical to the current Python-wrapper path.

### 7.2 Hook & telemetry extensions

- `client/src/hooks/usePoetiqProgress.ts` now:
  - Adds `useAgentsSdk?: boolean` to `PoetiqOptions`, which is forwarded to the backend as `useAgents` in the `POST /api/poetiq/solve/:taskId` body.
  - Tracks Agents-specific telemetry fields on `PoetiqProgressState`: `agentRunId`, `agentModel`, `agentTimeline`, `agentStreamingReasoning`, and `agentUsage` (token counts).
  - Parses WebSocket payloads that include `agentTimelineItem`, `agentReasoningDelta`, `agentRunId`, `agentModel`, and the `agents_usage` token-usage summary, so the UI can render a live agent timeline without altering the legacy Poetiq event stream.

### 7.3 Control surface changes

- `client/src/components/poetiq/PoetiqControlPanel.tsx`:
  - Reads model metadata from `usePoetiqModels()` and only exposes the **OpenAI Agents runtime** switch when the selected model is a direct OpenAI configuration (provider `OpenAI`, routing `direct`).
  - Binds the switch to a local `useAgents` boolean, disabling it while a run is active.
- `client/src/pages/PoetiqSolver.tsx`:
  - Owns the `useAgents` state and threads it into `PoetiqControlPanel`.
  - Passes `useAgentsSdk: useAgents` into `usePoetiqProgress.start()`, which in turn forwards the `useAgents` hint to the Poetiq controller.

### 7.4 New Agents runtime panel

- `client/src/components/poetiq/PoetiqAgentsRuntimePanel.tsx`:
  - Renders only when the current Poetiq session is using the Agents runtime (detected via `currentPromptData.apiStyle === 'openai_agents'` or the presence of `agentModel`).
  - Shows:
    - A status card with runtime label, OpenAI model id, short run id, and Agents-specific token summary.
    - A live reasoning card that auto-scrolls as `agentStreamingReasoning` (or the generic `streamingReasoning`) updates.
    - A sandbox evaluations card that lists tool calls/results derived from `agentTimeline` (e.g. calls to the `submit_python_candidate` tool that delegates to the Python Poetiq evaluator).
    - An agent messages card that surfaces assistant-facing output entries from the same timeline.
- `client/src/components/poetiq/index.ts` exports the panel as `PoetiqAgentsPanel` so the solver page can import it alongside the existing Poetiq components.

### 7.5 Layout integration & behavior

- `client/src/pages/PoetiqSolver.tsx`:
  - Mounts the Agents runtime panel at the top of the right-hand column above the existing training-grid / event-log region.
  - Leaves all non-Agents behavior unchanged:
    - When the runtime is the legacy Python wrapper, the panel does not render and the page looks and behaves exactly as before.
    - When the runtime is `openai-agents`, the panel becomes a compact, ARC3-style "agent HUD" that sits alongside the pre-existing Poetiq dashboards and Python terminal.

This plan keeps scope focused on OpenAI provider parity while allowing other providers to remain on the proven Python wrapper until we prove the Agents path in production.
