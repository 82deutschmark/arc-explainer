Author: Codex / GPT-5  
Date: 2025-11-30  
PURPOSE: Formalize the research-backed plan for wiring the OpenAI Agents SDK into the Poetiq solver so a peer (even a junior developer) can follow the documented decisions, references, and next steps without needing additional code samples.

---

## 1. Research Summary

1. **ARC3 OpenAI Agents reference implementation** – `server/services/arc3/Arc3RealGameRunner.ts` shows the full lifecycle of an Agent: how `Agent`, `run`, and `tool()` from `@openai/agents` are configured, how `tool` executions are validated via Zod schemas, how `run(..., { stream: true })` is consumed, and how line-level events (`run_item_stream_event`, `raw_model_stream_event`) are translated into UI updates via utilities such as `processRunItemsWithReasoning` and the timeline processor modules. This is the most detailed blueprint we have inside the repo.

2. **Documentation that clarifies Responses API expectations** – `docs/reference/arc3/ARC3_Integration_Guide.md`, `docs/09112025-arc3-conversation-chaining.md`, `AGENTS.md`, and the reference API docs (`docs/reference/api/ResponsesAPI.md`, `OpenAI_Responses_API_Streaming_Implementation.md`, `API_Conversation_Chaining.md`) repeatedly emphasize that: (a) only OpenAI models support the Agents SDK, (b) every run must persist and propagate `previous_response_id`/`providerResponseId`, (c) streaming requires `run(..., { stream: true })` and should read `result.toTextStream()` plus raw events, and (d) the `text.verbosity` and reasoning controls should remain “high/detailed” when reasoning models are used. This knowledge drives the new Agents path’s configuration.

3. **Existing Poetiq infrastructure** – `server/services/poetiq/poetiqService.ts`, `server/controllers/poetiqController.ts`, and `server/python/poetiq_wrapper.py` show how Poetiq currently interacts with models (child process, NDJSON), streams progress to WebSocket sessions (via `_emit` + broadcast), and keeps prompt/iteration metadata (`PoetiqPromptData`, `PoetiqIterationData`). These pieces remain the core of the direct-API path and deserve reuse wherever possible.

4. **Streaming / telemetry norms** – The `server/services/poetiq/poetiqService.ts` broadcasting pattern and `client/src/hooks/usePoetiqProgress.ts` describe how prompt history, reasoning summaries, and costs are surfaced. The same DTOs (PoetiqResult, PoetiqBridgeEvent) will be reused, but the new Agents path needs to produce the same data shape (promptData, reasoning, tokenUsage).

5. **Tool orchestration philosophy** – The ARC3 plan docs (`docs/2025-11-06-arc3-agent-playground-implementation.md`, `docs/2025-11-06-fix-arc3-reasoning-streaming.md`) emphasize using multiple tools for chunking work, keeping each tool SRP-compliant, and streaming events out of the Agents runner in a human-friendly order. This informs the new Poetiq tooling (generate/evaluate/select) without needing to rewrite prompt logic.

---

## 2. Path Forward (Guided Steps)

### Step 1: Identify Agents-specific scope

- Target only OpenAI models (gpt-4o, o3, o4, gpt-5.1 variants). Keep Gemini/Anthropic/OpenRouter running through the legacy Python wrapper because Agents is OpenAI-only. Document the supported model list inside `poetiqService` so the controller can route requests deterministically.
- Add a flag (`useAgentsSdk` or `options.useAgents`) to the controller payload so callers decide whether to opt into the new path (default: true for OpenAI).
- Track `previousResponseId` just as ARC3 does—store it in each Agent response’s metadata and pass it to the next continuation. Mirror ARC3’s `response.id` handling (from `Arc3RealGameRunner` and `docs/09112025-arc3-conversation-chaining.md`).

### Step 2: Build Agent tooling & runner

- Draft a TypeScript-friendly version of the prompts currently defined in Python (e.g., `SOLVER_PROMPT_ARC`), referencing `solver/poetiq/prompts.py` and keeping the `$$problem$$` placeholder concept with the same sections (analysis instructions, iterative process, output expectations). Conceptually, the Agent’s system prompt will be a condensed redo of those instructions.
- Define tool interfaces (generate candidate, evaluate candidate, select best, optional apply-to-test). Each tool references an existing Poetiq capability (Python sandbox execution, training evaluation, iteration scoring) instead of implementing new logic. Use `@openai/agents`’s `tool()` helper with Zod validations to keep the command contract explicit; follow the patterns in `Arc3RealGameRunner.ts` where tools log and execute short-lived tasks.
- Tools don’t call the Agents SDK; they simply call whichever provider they need (OpenAI direct + other direct SDKs). The Agents SDK orchestrates these calls but the actual API calls live inside helper modules (can reuse logic from `poetiqService` or `poetiq_wrapper.py`). That keeps multi-provider BYO support intact while giving OpenAI runs the Agents orchestration layer.

### Step 3: Streaming + telemetry mirroring

- Agents runs emit two kinds of payloads: textual deltas and run-item events. Mirror `Arc3RealGameRunner` streaming design: call `run(agent, initialState, { stream: true })`, convert `result.toTextStream()` to user-visible text, and iterate over `for await (const event of result)` to feed the WebSocket/SSE. Common event types (tool calls, reasoning updates, handoffs) should be mapped into the existing Poetiq event shape (phase, iteration, message, promptData, reasonings, tokens).
- Extend `PoetiqPromptData` (and its TypeScript definition in `shared/types.ts`) to accept `agentRunItems` or `agentReasoning` when Agents is used, so the UI timeline and prompt inspector can display the same content as before. `usePoetiqProgress` should treat these extra fields as additional events rather than replacing existing ones.
- Continue emitting token/cost info for each tool iteration by hooking into the Agent’s tool results (each tool should return `tokenUsage`, cost, iteration stats). This ensures the cost dashboard remains accurate.

### Step 4: Controller / service integration

- `poetiqController.solve()` decides whether to spawn the Agents runner or the legacy Python path. If Agents is used, it should still broadcast the same initial state (sessionId, config); all progress events come from the Agents runner’s callbacks. If not, the existing flow (child process + NDJSON) remains unchanged.
- `poetiqService` should expose a new method such as `solveWithAgents()` that wraps `runPoetiqAgent`. It should accept the same options structure as `solvePuzzle`, call the new runner, and handle lifecycle events (emit progress, finalize the explanation, save prompt history). Keep the existing `solvePuzzle()` method untouched for fallback scenarios.
- For Agents runs, the final `PoetiqResult` or explanation must include the agent timeline (tool calls, reasoning). Use similar storage logic as `Arc3RealGameRunner` (persist summary to DB with iteration metadata).

### Step 5: Testing & documentation

- Build a lightweight test harness similar to `Arc3AgentRunner` tests; mock the Python tool runner and ensure the Agents runner can exercise multiple tools and stream events. The test should verify that events map to Poetiq progress updates and that fallback to legacy path occurs when a non-OpenAI model is requested.
- Write documentation (update `docs/2025-11-30-poetiq-agents-sdk-integration-plan.md` plus a dedicated section in `docs/reference/poetiq/`) describing how to enable the Agents path, which models are supported, and what telemetry the UI expects.
- Add changelog entries once implementations land to note the new Agents runner and any feature flags or doc updates.

---

## 3. Key Milestones & Reference Points

1. **Use ARC3 code as a live example** – when building each part (tool definitions, streaming harness, run result parsing), look at `server/services/arc3/Arc3RealGameRunner.ts` and `server/services/arc3/utils/timelineProcessor.ts` to see event translation and logging structure.
2. **Respect Responses API guidance** – re-read `docs/09112025-arc3-conversation-chaining.md` before wiring `previous_response_id`; the same handshake rules apply in Poetiq (Agents can't leak IDs cross-provider).
3. **Preserve existing prompts** – keep the `SOLVER_PROMPT_*` contract (ARC English, German, etc.) even when the Agent is orchestrating, as front-end users expect the same textual guidance in the prompt inspector. The Agent runner can reference these files for accurate instructions.
4. **Stream updates to UI** – ensure `PoetiqPromptData` (the web-facing schema) still contains `systemPrompt`, `userPrompt`, `problemSection`, `feedbackSection`, `stats`, and `messages`. Add optional `agentRunItems` within that object so the UI can display Agent-specific logs without refactoring the whole hook.

---

## 4. Success Criteria

- The OpenAI Agents path solves the same puzzles (train/test accuracy) as the legacy path while providing richer streaming output.  
- The controller/service/client stack can switch between Agents vs. legacy routes without code duplication or new schema changes.  
- Documentation references the ARC3 runner and relevant API docs so future maintainers easily understand why the Agents SDK was introduced.  
- The plan includes research links such that another developer can continue with minimal knowledge transfer; no code samples required because the repo already contains the necessary references (`Arc3RealGameRunner.ts`, prompt files, Response API docs).

