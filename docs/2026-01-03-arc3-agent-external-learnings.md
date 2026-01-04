# ARC3 Agent External Learnings and Integration Notes

## Purpose
Capture grounded lessons from external ARC3 agents (GuidedRandomAgent, TOMAS Engine, ARC-AGI-3-Agents2) and map them to our current ARC Explainer ARC3 playground stack for discussion and prioritization.

## Scope
- External inputs: `external/GuidedRandomAgent`, `external/tomas-engine-arc-agi-3`, `external/ARC-AGI-3-Agents2` (codemap: ARC-AGI-3 Agent Architecture - Multi-Agent Game Playing System).
- Internal focus: ARC3 playground (frontend `client/src/pages/ARC3AgentPlayground.tsx`, streaming hook `client/src/hooks/useArc3AgentStream.ts`, backend runner `server/services/arc3/Arc3RealGameRunner.ts`, route validation `server/routes/arc3.ts`, helpers `server/services/arc3/helpers/runHelpers.ts`).

## Quick map of our current stack (grounded)
- UI: ARC3AgentPlayground renders config (system prompt presets, model, reasoning effort, BYOK), grid, tool timeline, reasoning viewer; normalizes `available_actions` tokens. @client/src/pages/ARC3AgentPlayground.tsx#126-706
- Hook: useArc3AgentStream manages SSE session prep/start, timeline (tool calls/results), frames, continuation, BYOK forwarding. @client/src/hooks/useArc3AgentStream.ts#86-250
- Backend routes: zod validation, default/system prompt endpoints, games listing, stream/real-game run; BYOK enforced. @server/routes/arc3.ts#32-157
- Runner: Arc3RealGameRunner opens scorecard, starts/continues sessions, unpacks animation frames, enforces max turns, logs state/score. @server/services/arc3/Arc3RealGameRunner.ts#171-200
- Helpers: select system prompt (preset/none), combine instructions, map API states, build run summary. @server/services/arc3/helpers/runHelpers.ts#13-88

## External agent takeaways (grounded references)
1) GuidedRandomAgent (heuristic stochastic policy)
- Action bias using change detection and object weights; cheap fallback when LLM is costly/unreliable. (See `external/GuidedRandomAgent` source.)
- Potential reuse: add a low-cost “explore” mode to recover from stalls or probe state cheaply.

2) TOMAS Engine (multi-mind orchestration)
- Distinct perception/learning/strategy modules (AISTHESIS, SOPHIA, LOGOS); rule consolidation and frustration/curiosity signals. (See `external/tomas-engine-arc-agi-3` docs/code.)
- Potential reuse: separate perception → hypothesis → plan stages in our runner, keep modules with single responsibility (SRP), and track confidence/curiosity to decide when to escalate reasoning effort.

3) ARC-AGI-3-Agents2 (codemap references)
- Swarm orchestrator with agent registry/factory; per-game threading. (`agents/swarm.py`)
- Base loop with max-action guard and single `is_done` authority; validates frame data. (`agents/agent.py`)
- ReasoningAgent uses structured tool calls, attaches reasoning metadata to actions. (`agents/templates/reasoning_agent.py`)
- LangGraph agents force tool_choice, use thread IDs for continuity; multi-node pipelines separate analysis and action. (`agents/templates/langgraph_functional_agent.py`, `langgraph_thinking`)
- Potential reuse: enforce structured outputs and attach reasoning metadata to our frames; thread/session IDs per run; constrain actions via tools that honor `available_actions`.

## Gaps in our current implementation (evidence-based)
- Per-action reasoning metadata not persisted with frames; timeline only stores strings. @client/src/pages/ARC3AgentPlayground.tsx#360-380
- UI action validation is permissive (fallback to allow-all on unknown tokens); no schema check on frame structure in frontend. @client/src/pages/ARC3AgentPlayground.tsx#392-425
- Backend state mapping throws on unknown states but lacks detailed frame validation reporting back to UI. @server/services/arc3/helpers/runHelpers.ts#54-68
- No cheap fallback policy; only LLM-driven path in runner/stream service. @client/src/hooks/useArc3AgentStream.ts#115-214

## Proposed discussion items / next steps (non-binding)
1) Reasoning metadata
- Capture structured reasoning/tool-call payloads per action in backend stream events; surface alongside frames for replay/analytics. Align with ReasoningAgent pattern.

2) Action/schema validation
- Add strict frame schema validation and detailed error surfaces (safe fallback to pause with message). Normalize `available_actions` server-side; reject illegal actions client-side instead of allow-all.

3) Fallback policy
- Add optional heuristic/random exploratory mode (inspired by GuidedRandomAgent) for early turns or recovery when progress stalls; expose toggle in config.

4) Pipeline separation
- Explicit perception → delta analysis → plan → act stages in runner; keep SRP/DRY by centralizing shared utilities (action mapping, delta calc, logging). Draw from TOMAS and LangGraph multi-node patterns.

5) Context threading
- Maintain per-session/thread IDs for tool calls and scorecards to preserve continuity and debugging lineage (as in LangGraph agents).

6) BYOK and provider routing
- Keep current BYOK handling; ensure any new fallback/analysis paths also honor BYOK and existing stream/prepare contracts.

## References
- External: `external/GuidedRandomAgent`, `external/tomas-engine-arc-agi-3`, `external/ARC-AGI-3-Agents2` (see codemap: ARC-AGI-3 Agent Architecture - Multi-Agent Game Playing System).
- Internal: ARC3 UI/hook/routes/runner/helpers as cited above.

## Open questions for the team
- Priority: Should we first add reasoning metadata capture or a heuristic fallback? Which yields better short-term win rate vs. complexity?
- Validation surface: Prefer silent auto-fix (normalize/allow) or visible pause + message on unexpected frame/action tokens?
- Data storage: Do we want to persist per-action reasoning/timeline for later analysis, or keep it session-only?
