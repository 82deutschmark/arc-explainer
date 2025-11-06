# ARC3 Agent Playground Integration Plan (2025-11-06)

## Objective
Build an interactive ARC-AGI-3 agent testing playground inside ARC Explainer that leverages the OpenAI Agents SDK to let users configure and run a basic agent against a sample ARC3 game experience from the browser.

## Key Tasks & Target Files

1. **Establish backend agent runner with OpenAI Agents SDK**
   - Files: `server/routes/arc3.ts` (new), `server/index.ts`, `server/routes.ts`, `server/services/arc3/Arc3AgentRunner.ts` (new), `server/services/arc3/Arc3GameSimulator.ts` (new), `server/services/arc3/types.ts` (new), `server/config/index.ts` (if env wiring needed)
   - Todos:
     - Model a lightweight ARC3 game simulator (deterministic mini-scenario) that exposes reset, simple actions, coordinate action.
     - Wrap simulator in service that can be driven by tool calls from the OpenAI Agents SDK.
     - Implement runner function that instantiates an agent with user instructions and streams step logs.
     - Add REST endpoint to trigger a run and return aggregated output (logs, frames, score summary).

2. **Expose configuration and results to the frontend**
   - Files: `client/src/pages/ARC3AgentPlayground.tsx` (new), `client/src/App.tsx`, `client/src/components/layout/AppNavigation.tsx`, `client/src/types/arc3.ts` (new), `client/src/lib/api.ts` (if needed), `client/src/hooks/useArc3AgentRun.ts` (new hook)
   - Todos:
     - Create React page with form inputs (agent name, instructions, game selection, step limit) and run controls.
     - Display simulator board snapshots, action history, and textual reasoning returned by backend.
     - Wire up API client + React Query mutation for running agents and handling loading/error states.
     - Update router/navigation to surface the new page under ARC3 section.

3. **Documentation & project hygiene**
   - Files: `CHANGELOG.md`, `docs/README.md` (section link), `README.md` (if top-level mention needed)
   - Todos:
     - Document new ARC3 Agent Playground feature and backend simulator constraints.
     - Ensure instructions for environment variables (OPENAI_API_KEY) are clear.

## Open Questions / Assumptions
- Rely on OPENAI_API_KEY already used elsewhere in the project; no ARC_API_KEY requirement because simulator is local.
- Simulator will mimic a single ARC3-style mini-game (“Color Hunt”) suitable for deterministic evaluation and safe demo runs.
- Initial implementation will return full run output at once (non-streaming) to keep backend simple; future work can leverage streaming events.

