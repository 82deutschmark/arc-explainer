# Codex ARC Playground Implementation Plan

**Date:** 2026-01-02  
**Author:** Cascade (ChatGPT 5.1 Codex)  
**Status:** Completed – All phases implemented  
**Scope:** Build a Codex-powered ARC-AGI-3 interactive playground that treats the agent as a real-time controller: persistent action-perception loop, streaming trajectory recording, manual handoffs, and Swarm-compatible storage.

---

## 1. Problem Statement
- ARC-AGI-3 is an **interactive reasoning benchmark**: success depends on the *trajectory* of perceptions and actions, not a single grid output.
- Today we only have (a) a production ARC3 playground tied to Claude/Responses API and (b) an out-of-band Codex CLI script that lacks persistence, UI, and streaming instrumentation.
- Without a Codex-native runner that behaves like a **stateful simulator bridge**, researchers cannot compare Codex vs Claude trajectories, intervene mid-run, or upload recordings to ARC Prize tooling.

## 2. Goals & Non-Goals
| Goal | Description |
|------|-------------|
| G1 | Implement a `CodexArc3Runner` that drives a *continuous event loop* (S<sub>t</sub>, A<sub>t</sub>, R<sub>t+1</sub>) via the OpenAI Agents SDK, exposing primitive ARC actions. |
| G2 | Extend SSE streaming to include trajectory-aware events (`game.action_start`, `game.action_result`, `agent.hypothesize`) so the UI visualizes reasoning, not just frames. |
| G3 | Provide a dual-mode UI (Agent ↔ Manual) with “Drive” handoffs so researchers can teach Codex mid-run and resume autonomy. |
| G4 | Persist every turn as an ARC Prize–compatible recording (JSONL) plus our internal DB records for replay and analytics. |
| G5 | Support BYOK/BYOP credentials and Swarm-style multi-agent orchestration for trajectory search. |
| Non-goals | Replacing the Claude runner, redesigning ARC-AGI-3 API itself, or altering ARC Prize scoring rules. |

## 3. Core Shift: Trajectory over Result
1. **Trajectory-first storage**: each turn stores `{state_id, action, reward, observation_delta, reasoning}`.
2. **Delta-driven prompting**: runner feeds Codex only the delta between frames plus the accumulated hypothesis log, mirroring official guidance on fluid intelligence.
3. **Scorecard alignment**: `Arc3ApiClient.openScorecard()` is called at session start, and each turn records the official scorecard fields (`moves`, `efficiency`, `knowledge_gain`) so uploads pass ARC Prize validation without post-processing.

## 4. Backend: Codex Interactive Bridge
### 4.1 `CodexArc3Runner.ts`
- **Event loop**: maintains a persistent Agents SDK session, subscribes to streaming tokens, and reacts to tool invocations in real time.
- **Primitive action surface**: exposes ARC-AGI-3 primitives (move, push, rotate, use, action6 coordinate pickers, etc.) instead of coarse “solve” tools.
- **Thinking window**: after each observation delta, the runner opens a reasoning window (`agent.hypothesize`) where Codex verbalizes theories. Stored for later playback.
- **State persistence**: writes frame bundles + metadata through existing persistence helpers plus a new `arc3_recordings` table mirroring [official recording format](https://docs.arcprize.org/recordings).
- **Continuation**: holds `providerResponseId` (Agents SDK) so researchers can pause, insert manual moves, and resume with prior context.

### 4.2 `CodexArc3StreamService.ts`
- Wraps runner with session prep, SSE registration, BYOK validation, and Swarm coordination.
- Emits enriched SSE events (see §5) and finalizes JSONL recordings when the game reaches `WON/LOST/ABORTED`.

### 4.3 BYOK & Auth
- BYOK manager forwards user-supplied OpenAI key to the runner, never storing it server-side. Validation mirrors existing Poetiq/SnakeBench logic.
- Configurable provider/model via env (`CODEX_ARC_MODEL`, `CODEX_ARC_BASE_URL`) with sensible defaults but always overridable by BYOK panel.
- Scorecards: same `scorecards.json` semantics as the Claude SDK (`.cache/external/ARC-AGI-3-ClaudeCode-SDK/scorecards.json`) replicated in our DB so the Codex runner can resume games even if the web UI reloads.

## 5. SSE Streaming Schema (Interactive Edition)
Event names (all funneled through `SSEStreamManager`):
1. `agent.starting` – Codex session initialized (includes provider/model, instruction hash).
2. `game.frame_update` – existing payload plus `delta_summary`.
3. `game.action_start` – action Codex is attempting, with hypothesis snippet.
4. `game.action_result` – ARC API response (success, blocked, reward delta).
5. `agent.hypothesize` – streamed reasoning about hidden rules / strategies.
6. `agent.manual_handoff` & `agent.resume` – emitted when researcher toggles control.
7. `agent.completed` – final status plus recording URI.

Schema updates will be documented in `shared/types.ts` and `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`.

## 6. Frontend: Action-Playground UI
1. **Live Viewport** – Canvas showing current board, Codex FOV, and overlays for visited cells; respects animation layers.
2. **Command Log** – Terminal feed listing `action_start/result`, reasoning deltas, and ARC engine textual feedback.
3. **Drive Toggle** – Prominent control to swap between Agent (Codex) and Manual (WASD/buttons). Records handoff timestamps.
4. **Manual Assist** – When manual mode executes moves, the delta is appended to Codex context before resuming to test in-context learning.
5. **Recording Drawer** – Download link for JSONL + timeline scrubber referencing stored frames.
6. **Provider Switcher** – Single playground UI with `runner_type = arc3_claude | codex_interactive`, sharing underlying hook while targeting different endpoints.

## 7. Technical Architecture (“Swarm Implementation”)
| Layer | Component | Responsibility |
|-------|-----------|----------------|
| Logic | `CodexSwarmManager` | Optionally spawn multiple Codex “thoughts” (parallel agent instances) to search trajectory space; picks best via scoring hooks. |
| Environment | `Arc3AgentClient` (existing) | Provides primitive commands + scorecard plumbing; reused verbatim. |
| Storage | `RunDatabase` + JSONL writer | Stores DB rows (sessions, frames, actions) and emits ARC Prize–compatible recordings for upload. |
| Auth | `BYOKManager` | Validates provider, encrypts in-memory key, supplies to runner only while session active. |

Swarm manager is optional at launch (feature flag) but the architecture keeps the seams ready for multi-agent search.

## 8. Implementation Phases
| Phase | Description | Owner |
|-------|-------------|-------|
| P1 | Finalize plan + align on SSE schemas, scorecard metadata, and recording format. Deliver doc-diffs referencing Claude SDK helpers. | Lead dev |
| P2 | Backend foundation: scaffold `CodexArc3Runner` (PNG rendering via `renderArc3FrameToPng`, deltas via `helpers/frame-analysis.js` parity), JSONL persistence, BYOK plumbing, scorecard opening logic. | Backend |
| P3 | Service + routes: build `CodexArc3StreamService`, register `/api/arc3-codex/*` endpoints (start, continue, manual action, cancel), expand `shared/types.ts` for new SSE events, add validators. | Backend |
| P4 | Frontend Action-Playground upgrades (viewport w/ PNG overlay, command log mirroring Claude SDK visualizer, handoff controls, provider toggle + BYOK drawer). | Frontend |
| P5 | QA & docs: run live ARC3 games using Codex, verify manual handoffs, produce sample ARC Prize recording + CLI reproduction steps (reference `.cache/external/ARC-AGI-3-ClaudeCode-SDK/actions`), update README, DEV_ROUTES, Responses API doc, CHANGELOG. | Full-stack |

## 9. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Agents SDK differences vs Claude runner. | Build `CodexAgentClient` shim with identical interface and exhaustive logging; feature flag for fallback. |
| Latency spikes when streaming reasoning + deltas. | Stream minimal diffs, compress large frames, and allow users to lower animation fidelity. |
| Recording format drift. | Unit test JSONL writer against ARC Prize validation scripts; include CI check. |
| Manual handoff bugs. | Add integration tests simulating manual override sequences; log state snapshots before/after handoff. |

## 10. Acceptance Criteria
1. Single ARC playground can launch `runner_type=codex_interactive`, stream real-time trajectories, and store ARC Prize–compatible recordings.
2. SSE channel emits the expanded event set; frontend visualizes action/command log + reasoning feed live.
3. Manual ↔ Agent handoff works without losing context; Codex resumes with updated state and acknowledges manual interventions.
4. BYOK enforcement ensures Codex sessions only run with user-supplied keys; errors surface inline.
5. Documentation (`docs/reference/frontend/DEV_ROUTES.md`, `docs/reference/api/...`, `CHANGELOG.md`) reflects the new runner and SSE schema.

## 11. Claude SDK Alignment & External References
- **Actions parity**: mirror `.cache/external/ARC-AGI-3-ClaudeCode-SDK/actions/` semantics so agent tool calls remain interchangeable; document any discrepancies in `server/services/arc3/README.md`.
- **Frame helpers**: `helpers/frame-analysis.js`, `helpers/grid-analysis.js`, `helpers/grid-visualization.js`, and `serve-visualizer.js` already exist in Claude SDK—note the corresponding TypeScript utilities (`helpers/frameAnalysis.ts`, `helpers/gridAnalyzer.ts`, `arc3GridImageService.ts`). Any missing behavior must be backported to keep Codex + Claude feature-complete.
- **Visualizer**: reference `visualizer.html` when enhancing our React viewport so devs can use the existing CLI visualizer to debug recordings.
- **Storage utilities**: `utils.js` (ensureFile, local JSON stores) maps to our Postgres persistence; document how DB sessions replace the CLI’s JSON storage but maintain the same fields (`sessions.json`, `scorecards.json` analogs).
- **Scorecards**: reiterate that ARC3 API requires `openScorecard()` + `startGame()` handshake before any action—call this out in code comments and this plan so future devs never “fetch state” by issuing actions.


IMPORTANT!!!
It is clear from the [arcprize.org](https://arcprize.org/arc-agi/3/) documentation that your existing implementation plan accurately identifies the "Interactive Reasoning" nature of ARC-AGI-3, but it needs to be strictly aligned with the **ARC-AGI-3 API** standards and the [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) architectural patterns.

Based on the [docs.arcprize.org](https://docs.arcprize.org/agents-quickstart) resources, here is the refined implementation strategy to bridge Codex with ARC-AGI-3.

### 1. Architectural Alignment: Agents SDK vs. ARC-AGI-3
The [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) uses a **Runner loop** that is conceptually identical to the ARC-AGI-3 agent loop. To implement `CodexArc3Runner`, you must map these two loops:

| Agents SDK Concept | ARC-AGI-3 Equivalent | Implementation Detail |
| :--- | :--- | :--- |
| `Agent` | Custom Python Class | Inherit from `Agent` base class in `agents/agent.py`. |
| `Runner.run()` | `main.py` entry point | Use the `uv run main.py` wrapper to handle registration. |
| `function_tool` | `GameAction` | Map SDK tool calls to ARC actions (Move, Rotate, etc.). |
| `Session` | `Scorecard` | Persistent storage via the ARC API `scorecard_id`. |

### 2. Core Implementation: `CodexArc3Runner`
Following the [docs.arcprize.org](https://docs.arcprize.org/agents-quickstart) pattern, your agent should not just "solve" a grid but interact with the environment through the [ARC-AGI-3-Agents repo](https://github.com/arcprize/ARC-AGI-3-Agents) interface.

```python
# agents/codex_interactive_agent.py
from .agent import Agent
from .structs import FrameData, GameAction, GameState

class CodexArc3Agent(Agent):
    """
    Codex-powered agent utilizing the Agents SDK loop for 
    real-time ARC-AGI-3 interaction.
    """
    def is_done(self, frames: list[FrameData], latest_frame: FrameData) -> bool:
        # Game loop terminates on WIN or explicit ABORT
        return latest_frame.state in [GameState.WIN, GameState.GAME_OVER]

    def choose_action(self, frames: list[FrameData], latest_frame: FrameData) -> GameAction:
        # 1. Analyze perception (Percept)
        # 2. Update hypothesis (Plan) - Streamed via SSE 'agent.hypothesize'
        # 3. Execute primitive action (Action)
        
        # Implementation must call the ARC-AGI-3 /actions/ primitive endpoints
        # logic handled by your existing CodexArc3StreamService
        pass
```

### 3. Updated SSE Streaming & Trajectory Recording
To meet your goal of **Trajectory-first storage** (G4), modify the streaming schema to mirror the [ARC-AGI-3 recordings format](https://docs.arcprize.org/recordings). Every turn in the loop should emit:

1. **The Observation ($S_t$):** The current grid frame and the `delta_summary` from the previous state.
2. **The Reasoning ($R_t$):** Captured from the Codex "thinking window."
3. **The Action ($A_t$):** The specific primitive tool call selected.
4. **The Reward ($R_{t+1}$):** Change in score or game state visibility.

### 4. Integration with Swarm Orchestration
As noted in [developers.openai.com](https://developers.openai.com/codex/guides/agents-sdk/), Codex can run as an **MCP (Model Context Protocol) server**. This allows your `CodexArc3Runner` to act as a Project Manager in a "Swarm" configuration:
* **The Navigator:** Specialized in spatial reasoning and grid deltas.
* **The Strategist:** Maintains the long-term hypothesis of the hidden rules.
* **The Executor:** Formats coordinates and move commands into valid `GameAction` objects.

### 5. Deployment Quickstart for Developers
To test this implementation, developers will follow the standard ARC-AGI-3 workflow:
1. **Clone:** `git clone https://github.com/arcprize/ARC-AGI-3-Agents.git`
2. **Setup:** Populate `ARC_API_KEY` (from [three.arcprize.org](https://three.arcprize.org)) and `OPENAI_API_KEY`.
3. **Execute:** 
   ```bash
   uv run main.py --agent=codex_interactive --game=ls20
   ```
4. **View Replay:** Use the URI provided in the output to visualize the trajectory on the official [ARC-AGI-3 website](https://three.arcprize.org).

### 6. Critical Acceptance Criteria (Adjusted)
* **Scorecard Handshake:** The runner must call `openScorecard()` before `startGame()` to ensure the session is tracked globally for ARC Prize.
* **Primitive Parity:** Action tools must match the types in `.cache/external/ARC-AGI-3-ClaudeCode-SDK/actions/`.
* **Playground UI:** The "Manual Handoff" must support `agent.manual_handoff` and `agent.resume` events to allow researchers to provide "few-shot" demonstrations in-situ.

