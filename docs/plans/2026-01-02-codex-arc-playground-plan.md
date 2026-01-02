# Codex ARC Playground Implementation Plan

**Date:** 2026-01-02  
**Author:** Cascade (ChatGPT)  
**Status:** Idiotic and incorrect in almost every conceivable way. 
**Scope:** Introduce a Codex-powered ARC gameplay experience that mirrors the existing ARC3 Agent Playground end-to-end (backend runner, SSE streaming, frontend UI + manual controls + continuations). The author had no idea what Codex was or what they were doing. 

---

## 1. Problem Statement
- We currently have two extremes:
  1. A production-grade ARC3 Playground (Claude/OpenAI Responses API) with streaming, persistence, manual overrides, and continuation chaining.
  2. A standalone Codex CLI script (`play-arc-with-claude.js`) that runs entirely outside the web app with no session management or UI integration.
- Researchers want to drive Codex against the same ARC tasks inside the ARC Explainer interface so they can compare behaviors, record runs, and step in manually.
- Lacking parity means Codex runs are opaque, not persisted, and can’t benefit from existing tooling (BYOK, SSE diagnostics, prompt presets, manual ACTION buttons).

## 2. Goals & Non-Goals
| Goal | Description |
|------|-------------|
| G1 | Provide a Codex ARC backend runner that exposes the same API surface as `Arc3RealGameRunner` (start, stream, manual action, continuation). |
| G2 | Reuse the current SSE streaming/event schemas so the frontend needs minimal changes (provider toggle vs entirely new UI). |
| G3 | Allow BYOK/BYOP (bring-your-own-provider) credentials so Codex usage follows existing key-management flows. |
| G4 | Persist Codex run metadata + frames to our DB for replay + auditing, matching ARC3 logs. |
| G5 | Document the architecture and update CHANGELOG once implementation ships. |
| Non-goals | Replacing the ARC3 runner, building new Codex models, or changing the ARC-AGI-3 API client. No new evaluation metrics beyond what ARC3 already records. |

## 3. High-Level Architecture
1. **CodexArcRunner (server/services/arc3/CodexArcRunner.ts)**
   - Extends the same interfaces used by `Arc3RealGameRunner` but swaps the agent execution core with Codex (likely via OpenAI Responses API or legacy Codex API if still accessible).
   - Responsibilities: orchestrate turn loop, translate tool calls (inspect grid, execute ACTIONs) into Codex-compatible instructions, enforce turn budgeting, emit frame events.
2. **CodexArcStreamService (server/services/arc3/CodexArcStreamService.ts)**
   - Mirrors `Arc3StreamService`: start sessions, bind SSE EventSources, handle continuation, persist run metadata.
3. **Routes (server/routes/arc3Codex.ts)**
   - REST endpoints `/api/arc-codex/stream/:sessionId`, `/manual-action`, `/continue`, `/system-prompts`.
   - Share Zod validators with ARC3 routes where possible (SRP/DRY check).
4. **SSE Manager**
   - Reuse existing `SSEStreamManager`. Each Codex session uses the same event channel structure: `game.frame_update`, `agent.completed`, etc.
5. **Frontend**
   - Option A (preferred): parameterize current ARC3 page via a provider select (ARC3 vs Codex). `useArc3AgentStream` becomes `useArcAgentStream` with configurable endpoints/prompt presets.
   - Option B: new `/arc-codex` route reusing shared hook/components.
6. **BYOK**
   - Use the established BYOK storage for provider keys (likely OpenAI key). Keys never persist server-side; flows identical to Poetiq/SnakeArena.

## 4. Detailed Design
### 4.1 Backend Runner
- **Initialization**: Accepts `game_id`, `agentName`, `maxTurns`, `systemPrompt`, `instructions`, `apiKey`, `providerConfig`.
- **Tool Simulation**:
  - *inspect_game_state*: reuse helper functions (render PNG, color histogram, diff). Response packaged into JSON text for Codex.
  - *ACTION commands*: delegate to existing `Arc3ApiClient` functions; runner simply chooses actions based on Codex output.
- **Codex Invocation Strategies** (decide during implementation):
  1. Use OpenAI Responses API with `model: "o3-codex"` (if available) and supply tool definitions.
  2. If Codex requires the older `completions` API, wrap it via a thin helper that converts tool requests into structured prompts (document this in code + README).
- **Safety**: enforce max turns, detect invalid action suggestions, and log mis-specified tool calls.

### 4.2 Streaming + Persistence
- `CodexArcStreamService.startStreaming()` replicates the sequence: save session payload, spawn runner, pipe events into SSE, flush final frame to DB.
- Continue flow uses `previousResponseId` equivalent (if Codex supports). If not, describe fallback (e.g., pass transcript text). Document limitations.
- Manual actions reuse same route handler logic; only difference is session lookup table key (Codex vs ARC3) to fetch stored `guid`/`gameId`.

### 4.3 Frontend Updates
- Introduce `ArcAgentProvider` enum: `"arc3" | "codex"`.
- Hook adjustments:
  - Accept `provider` + `endpointBase` props.
  - Map to correct API paths and prompt presets.
  - Display provider badge in UI so operators know which agent is driving.
- UI controls: include BYOK panel for Codex provider, preserving manual buttons, timeline, continuation composer.

### 4.4 Configuration & Secrets
- Add `.env` variables (example) `CODEX_API_BASE`, `CODEX_DEFAULT_MODEL`. Document in README + `.env.example`.
- BYOK: rely on user-supplied OpenAI key; fallback to server key disabled to avoid cost surprises.

## 5. Implementation Phases
| Phase | Description | Owner |
|-------|-------------|-------|
| P1 | Planning approval + architecture review (this doc). | Lead dev |
| P2 | Backend scaffolding: Codex runner, stream service, new routes, validators, DB session wiring. | Backend dev |
| P3 | Frontend provider toggle + hook refactor + BYOK integration for Codex runs. | Frontend dev |
| P4 | Manual action + continuation parity tests; ensure SSE events identical. | Full-stack |
| P5 | QA, docs (`docs/reference/frontend/DEV_ROUTES.md`, README, CHANGELOG). | Dev + reviewer |

## 6. Dependencies & References
- Existing ARC3 files: `server/services/arc3/Arc3RealGameRunner.ts`, `Arc3StreamService.ts`, `arc3.ts` routes.
- Codemap: *ARC3 Interactive Agent Playground – Full System Flow* for event tracing.
- BYOK reference: `docs/reference/api/EXTERNAL_API.md`, `PoetiqControlPanel.tsx`, `SnakeArena` components.
- CLI baseline: `.cache/external/ARC-AGI-3-ClaudeCode-SDK/play-arc-with-claude.js` for Codex tool behaviors.

## 7. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Codex API differences (tools vs plain prompts). | Encapsulate Codex calls behind `CodexAgentClient`. Add feature flag to fall back to Claude runner if Codex unavailable. |
| Higher latency / cost. | Enforce max turns, expose stats in UI, allow users to cancel sessions quickly. |
| Manual actions diverging. | Share Zod schemas + controller logic; add regression tests for `/manual-action`. |
| Continuation limitations (no previousResponseId). | Document limitation, emulate via conversation transcript until Codex adds official support. |

## 8. Acceptance Criteria
1. Operators can launch Codex ARC sessions from UI, see live frames, and fetch final summaries.
2. Manual action buttons and continuation composer work identically for Codex provider.
3. SSE payloads conform to existing schemas so frontend components stay reusable.
4. BYOK gating prevents runs without user-provided Codex/OpenAI key.
5. Docs (plan, README, CHANGELOG) updated; tests cover runner/service basics.

## 9. Next Steps
1. Await approval of this plan (per AGENTS.md workflow).
2. Once approved, branch `feature/codex-arc-playground`, implement Phases P2–P5.
3. Run relevant tests, update CHANGELOG, and request review.
