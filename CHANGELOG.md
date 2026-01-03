# New entries at the top, use proper SemVer!

### Version 6.25.0  Jan 3, 2026

- **Arc3RealGameRunner Refactoring – Scorecard Fix + Tool Factory** (Author: Cascade)
  - **What**: Fixed critical scorecard bug (never closed) and created tool factory to eliminate duplication.
  - **Why**: Per audit (`docs/audits/2026-01-03-arc3-agents-sdk-audit.md`), scorecards must be closed when game reaches WIN or GAME_OVER. The 1,295-line file had ~400 lines of duplicated tool definitions between `run()` and `runWithStreaming()`.
  - **How**:
    - **Bug Fix**: Added `closeScorecard()` to `Arc3ApiClient.ts` and calls in both `run()` and `runWithStreaming()` when game state is WIN or GAME_OVER
    - **Tool Factory**: Created `server/services/arc3/tools/Arc3ToolFactory.ts` with context-based tool creation functions
    - **Context Pattern**: Tools receive `Arc3ToolContext` object with mutable game state, services, and optional streaming harness
    - **Plan Document**: Created `docs/plans/2026-01-03-arc3-real-game-runner-refactor-plan.md` with full audit and remaining tasks
  - **Files Created**: `Arc3ToolFactory.ts`, `tools/index.ts`, refactor plan document
  - **Files Modified**: `Arc3ApiClient.ts` (+closeScorecard), `Arc3RealGameRunner.ts` (+scorecard close calls)
  - **Remaining Work**: Integration of tool factory into Arc3RealGameRunner (tools still defined inline, factory ready for use)

### Version 6.24.1  Jan 3, 2026

- **OpenRouter Playground – Fixes and Improvements** (Author: Cascade)
  - **What**: Fixed OpenRouter Playground to use dynamic model fetching from `/api/models` (from project's OpenRouter catalog), mirror Arc3AgentPlayground structure with `Arc3ConfigurationPanel`, and add proper scorecard handling.
  - **Why**: Initial implementation used hardcoded outdated models from training data instead of the project's mature OpenRouter model catalog. Page structure diverged from the main playground, missing system prompt presets and configuration panel.
  - **How**:
    - **Dynamic Models**: Fetch from `/api/models` and filter by `provider === 'OpenRouter'` (matches project's `openrouterModels.ts` catalog)
    - **Arc3ConfigurationPanel**: Reuse the same configuration component as Arc3AgentPlayground (system prompts, reasoning effort, etc.)
    - **System Prompt Presets**: Added support for `twitch`, `playbook`, `none` presets via `/api/arc3/system-prompts`
    - **Scorecard Fix**: Added `close_scorecard()` method to Python runner and call it after WIN/GAME_OVER (per audit findings)
  - **Files**: `Arc3OpenRouterPlayground.tsx`, `arc3_openrouter_runner.py`

### Version 6.24.0  Jan 3, 2026

- **OpenRouter Playground – Dedicated Frontend Page** (Author: Cascade)
  - **What**: Created dedicated ARC3 playground page for OpenRouter models at `/arc3/openrouter-playground`, separate from the OpenAI-focused playground.
  - **Why**: The existing playground uses OpenAI's Responses API (Agents SDK). OpenRouter requires different scaffolding (Python LangGraph runner via `/api/arc3-openrouter`). Separate pages maintain clarity and allow each to be optimized for its provider.
  - **How**:
    - **Frontend Page**: Created `Arc3OpenRouterPlayground.tsx` reusing all Arc3 UI components (GamePanel, ReasoningViewer, ToolTimeline, etc.)
    - **Provider Routing**: Always passes `provider: 'openrouter'` to `useArc3AgentStream`, routing to `/api/arc3-openrouter` backend
    - **BYOK Card**: OpenRouter API key input (amber styling, session-only, never stored)
    - **Model Selection**: Dynamic model list from project's OpenRouter catalog via `/api/models`
    - **Route**: Added `/arc3/openrouter-playground` route in `App.tsx`
    - **Navigation**: Added amber-styled "OpenRouter Playground" button on ARC3 landing page
  - **Pattern**: Follows LLM-Council approach (Python subprocess + TypeScript bridge + BYOK)
  - **Files**: `Arc3OpenRouterPlayground.tsx`, `App.tsx`, `ARC3Browser.tsx`

### Version 6.23.0  Jan 2, 2026 (Late Evening)

- **ARC3 OpenRouter Integration – LangGraph Python Agent** (Author: Cascade)
  - **What**: Added OpenRouter as a third provider option for ARC3 Agent Playground using LangGraph-style Python agent with model `xiaomi/mimo-v2-flash:free`.
  - **Why**: Enables users to play ARC-AGI-3 games with free/low-cost models via OpenRouter. Follows the LangGraph thinking agent pattern from `external/ARC-AGI-3-Agents2/` for rule discovery and exploration gameplay.
  - **How**:
    - **Python Runner**: Created `server/python/arc3_openrouter_runner.py` - LangGraph-style agent using LangChain's ChatOpenAI with OpenRouter base URL. Emits NDJSON events to stdout matching frontend expectations (`agent.starting`, `agent.tool_call`, `agent.tool_result`, `game.frame_update`, `agent.completed`).
    - **TypeScript Bridge**: Created `server/services/arc3/Arc3OpenRouterPythonBridge.ts` - spawns Python subprocess, parses NDJSON events line-by-line via readline, forwards to SSE. Pattern from `SnakeBenchPythonBridge.ts`.
    - **Stream Service**: Created `server/services/arc3/Arc3OpenRouterStreamService.ts` - session management, SSE emission coordination. Pattern from existing `Arc3StreamService.ts`.
    - **Routes**: Created `server/routes/arc3OpenRouter.ts` - endpoints `POST /stream/prepare`, `GET /stream/:sessionId`, `POST /stream/cancel/:sessionId`, `GET /health`.
    - **Route Registration**: Added `arc3OpenRouterRouter` import and `app.use("/api/arc3-openrouter", ...)` in `server/routes.ts`.
    - **Frontend**: Updated `useArc3AgentStream.ts` to route to `/api/arc3-openrouter` when provider is `'openrouter'`. Added `'openrouter'` to provider type union.
    - **Plan Document**: Created `docs/plans/2026-01-02-arc3-openrouter-integration-plan.md` with architecture diagram, event flow, and implementation phases.
  - **Architecture**: Frontend → TypeScript routes → Python subprocess (NDJSON) → LangChain/OpenRouter → ARC3 API
  - **Model**: Default `xiaomi/mimo-v2-flash:free` (configurable via payload)
  - **Files**: `arc3_openrouter_runner.py`, `Arc3OpenRouterPythonBridge.ts`, `Arc3OpenRouterStreamService.ts`, `arc3OpenRouter.ts`, `routes.ts`, `useArc3AgentStream.ts`

### Version 6.22.1  Jan 2, 2026 (Evening)

- **ARC3 Architecture Clarification – Critical Documentation Update** (Author: Claude Haiku 4.5)
  - **What**: Comprehensive clarification of Arc3RealGameRunner event types vs Arc3OpenAIRunner, with corrected implementation guidance for future OpenRouter support.
  - **Why**: Previous audit recommended copying Arc3OpenAIRunner for OpenRouter, which would have silent UI failures due to event type mismatches. Streaming already works perfectly; no urgent work needed. Documentation was misleading.
  - **How**:
    - **Key Finding**: Arc3RealGameRunner emits correct events (`agent.starting`, `agent.tool_call`, `agent.reasoning`, etc.) while Arc3OpenAIRunner emits incomplete set (`stream.init`, `game.action_start`, `game.action_result`) causing silent UI failures.
    - **Decision**: Streaming architecture is complete and functional. Arc3RealGameRunner with OpenAI Agents SDK works perfectly. No work needed on Arc3OpenAI routes.
    - **Future Path**: If OpenRouter support is added later, must emit Arc3RealGameRunner event types (not copy Arc3OpenAIRunner pattern). Two options documented: (A) Refactor Arc3OpenAIRunner to fix events first, or (B) Lightweight HTTP implementation like Python agents.
    - **Documentation**: Completely rewrote "OpenRouter Implementation Strategy" section in `docs/reference/arc3/KNOWN_ISSUES.md` with event comparison table, two implementation options, and why Arc3OpenAIRunner pattern is incorrect.
    - **Tests**: Verified streaming works end-to-end via `/api/arc3/stream/*` routes. Build passes. No functionality changed.
  - **Files changed**: `docs/reference/arc3/KNOWN_ISSUES.md`
  - **Impact**: Prevents future developer from making critical mistake (copying Arc3OpenAIRunner). Clarifies that streaming is complete. Reduces scope of future work.

### Version 6.22.0  Jan 2, 2026

- **Codex ARC Playground – Interactive Trajectory Runner** (Author: Cascade (ChatGPT 5.1 Codex))
  - **What**: Added a Codex-powered ARC-AGI-3 interactive runner alongside the existing Claude runner. Users can toggle between providers in the ARC3 Playground UI.
  - **Why**: ARC-AGI-3 is a trajectory-based benchmark requiring real-time action-perception loops. A Codex-native runner enables researchers to compare Codex vs Claude trajectories, test different reasoning approaches, and record sessions for ARC Prize submission.
  - **How**:
    - **Backend**: Created `server/services/arc3/CodexArc3Runner.ts` implementing the event loop with OpenAI Agents SDK, PNG rendering for multimodal prompts, scorecard integration, and JSONL persistence.
    - **Backend**: Created `server/services/arc3/CodexArc3StreamService.ts` for session management and SSE streaming coordination.
    - **Backend**: Created `server/routes/arc3Codex.ts` with endpoints: `POST /api/arc3-codex/stream/prepare`, `GET /api/arc3-codex/stream/:sessionId`, `POST /api/arc3-codex/manual-action`, `POST /api/arc3-codex/stream/:sessionId/continue`, `GET /api/arc3-codex/stream/:sessionId/continue-stream`, `POST /api/arc3-codex/stream/:sessionId/cancel`, `GET /api/arc3-codex/health`.
    - **Shared types**: Added `CodexArc3Provider`, `CodexArc3ActionStartEvent`, `CodexArc3ActionResultEvent`, `CodexArc3HypothesizeEvent`, `CodexArc3FrameUpdateEvent`, `CodexArc3CompletedEvent`, `CodexArc3StreamPayload` to `shared/types.ts`.
    - **Frontend**: Updated `client/src/pages/ARC3AgentPlayground.tsx` with provider toggle (Claude/Codex) in header.
    - **Frontend**: Updated `client/src/hooks/useArc3AgentStream.ts` to route to correct backend based on provider selection.
  - **SSE Events**: Extended streaming schema with trajectory-aware events (`game.action_start`, `game.action_result`, `agent.hypothesize`) for real-time visualization.
  - **Files**: `CodexArc3Runner.ts`, `CodexArc3StreamService.ts`, `arc3Codex.ts`, `routes.ts`, `shared/types.ts`, `ARC3AgentPlayground.tsx`, `useArc3AgentStream.ts`, `docs/plans/2026-01-02-codex-arc-playground-plan.md`

### Version 6.21.0  Jan 2, 2026

- **Council UI – Non-Streaming Execution** (Author: Cascade (ChatGPT))
  - **What**: Disabled SSE mode on the `/council` page and reverted to the blocking `/api/council/assess` flow. The UI now keeps the latest assessment visible with timestamped metadata and surfaces failures inline.
  - **Why**: Streaming UX was wiping logs/results when runs errored, leaving no trace of costly API calls. The product owner approved a non-stream experience to keep evidence on screen.
  - **How**:
    - Simplified `LLMCouncil.tsx` state to `runStatus`/`runError`, removed event-log rendering, and guarded controls with a single `isRunning` flag.
    - Added completion timestamp display plus amber BYOK validation messaging that blocks runs without a key when required.
    - Documented the strategy in `docs/plans/2026-01-02-llm-council-non-stream-plan.md`.

- **BYOK Integration for Council** (Author: Grok_Codefast1)
  - **What**: Applied Bring Your Own Key (BYOK) enforcement to Council assessment endpoints, following established patterns from other services.
  - **Why**: Council was inconsistent with other services (Poetiq, SnakeBench, streamController) that already enforce BYOK in production. Users were incurring API costs without control over their budgets.
  - **How**: 
    - **Backend**: Updated `councilController.ts` to validate BYOK requirements and return 400 error when production requires key but none provided. Modified `councilService.ts` to accept and resolve `apiKey`/`provider` parameters. Updated `councilBridge.ts` to accept resolved API key and set `OPENROUTER_API_KEY` environment variable. Added health check log muting (5-minute cooldown).
    - **Frontend**: Updated `LLMCouncil.tsx` to show BYOK input card only in production (amber styling matching PuzzleExaminer pattern), added client-side validation, included `apiKey`/`provider` in API requests, implemented dynamic health check polling (30s healthy, 5min unhealthy).
    - **Pattern compliance**: Follows exact `streamController` validation pattern, uses established `environmentPolicy` utilities (`requiresUserApiKey()`, `getEffectiveApiKey()`), maintains backward compatibility (dev mode uses server key fallbacks).
  - **Security**: API keys never logged or stored server-side, only used for session execution. Production blocks without user keys, development allows server fallbacks.
  - **Files changed**: `councilController.ts`, `councilService.ts`, `councilBridge.ts`, `LLMCouncil.tsx`, `2026-01-02-byok-system-integration-plan.md`

- **LLM Council Integration** (Author: Claude Sonnet 4 / Fixed by Claude Haiku)
  - **What**: Integrated llm-council submodule for multi-model consensus evaluation of ARC puzzles. New `/council` route with full 3-stage deliberation UI.
  - **Why**: The llm-council submodule was added but never wired up. Users can now have multiple LLMs independently solve puzzles, rank each other's work, and produce a synthesized consensus answer.
  - **How** (subprocess pattern like Saturn/Grover/Beetree):
    - Created `server/python/council_wrapper.py` - Python wrapper that imports llm-council modules
    - Created `server/services/council/councilBridge.ts` - Spawns Python subprocess, NDJSON protocol
    - Created `server/services/council/councilService.ts` - ARC puzzle formatting and orchestration
    - Created `server/controllers/councilController.ts` - API endpoints for council operations
    - Added routes: `GET /api/council/health`, `GET /api/council/unsolved-puzzles`, `GET /api/council/puzzle/:taskId/explanations`, `POST /api/council/assess`, `POST /api/council/assess/stream`
    - Created `client/src/pages/LLMCouncil.tsx` - Full UI for puzzle selection, mode selection (solve/assess), and 3-stage result display
    - Added frontend routes `/council` and `/council/:taskId`
  - **Bug fixes & completion**:
    - Fixed type errors in `streamAssessment()` endpoint by removing non-existent `createConversation()` and `streamMessage()` calls
    - Removed duplicate mode validation in controller (line 179)
    - Modified `councilService.assessPuzzle()` to accept optional `onEvent` callback and forward to `councilBridge.runCouncil()`
    - Streaming endpoint now properly pipes council events to client via SSE
    - **Frontend completions**:
      - Rewired component to use `/api/council/assess/stream` endpoint instead of blocking request
      - Added URL parameter support (`:taskId`) to pre-select puzzle from direct links
      - Implemented live event stream display showing real-time progress through 3 stages with visual indicators
      - Added proper UI validation preventing assess mode submission without explanation selection
      - Disabled controls during streaming to prevent race conditions
      - Added stream error handling and display
  - **Requirements**: Python installed, `llm-council` submodule checked out, `OPENROUTER_API_KEY` env var set
  - **Council Result Persistence** (Phases 2-4 complete):
    - **What**: Council deliberation results now automatically save to database as "explanations" with full 3-stage audit trail.
    - **Why**: Results previously streamed to UI then disappeared. Now they persist, can be queried, scored against ground truth, and voted on in ELO system.
    - **Implementation**:
      - Added 8 columns to explanations table for council metadata (mode, 3-stage results, rankings, assessed IDs, prompt)
      - Updated `ExplanationRepository.ts` - council columns in INSERT, all SELECT queries, and JSONB parsing
      - Created transformation pipeline in `councilService.ts`:
        - `extractPredictedGridFromSynthesis()` - regex extraction of output grids from stage3 text
        - `deriveConfidenceFromRankings()` - calculates 0-100 confidence from aggregate rankings
        - `transformCouncilResult()` - converts CouncilAssessmentResult to ExplanationData
        - `saveCouncilResult()` - persists to DB and scores prediction vs ground truth
      - `assessPuzzle()` auto-saves results after completion
    - **Edge cases**: assess mode (no prediction), missing grids, confidence parse failures, assessed explanation tracking
  - **Usage**: Visit `/council`, run assessment. Results auto-persist. Queryable as explanations with `councilMode IS NOT NULL`.
  - **TODO**: ELO integration, council voting system, council leaderboards
  - **Files changed**: `DatabaseSchema.ts`, `IExplanationRepository.ts`, `ExplanationRepository.ts`, `councilService.ts`, `2026-01-02-council-persistence-plan.md`

### Version 6.20.0  Jan 1, 2026 23:39

- **Efficiency + Analyst UX Polish** (Author: ChatGPT)
  - **What**: Made the Efficiency leaderboard denser and easier to scan; removed duplicate counts in Analyst header.
  - **Why**: Users saw redundant badges and cramped columns (Think column, tiny fonts, no scroll cue).
  - **How**:
    - Replaced the top stats bar with meaningful spread comparisons (fastest→slowest, cheapest→expensive with multipliers).
    - Enlarged typography and widened columns; removed the Think column to give models more room.
    - Added horizontal scrollbar styling for overflow on small screens.
    - Removed duplicate count badges from the PuzzleAnalyst header.
  - **Files changed**: `TaskEfficiencyLeaderboard.tsx`, `PuzzleAnalyst.tsx`

### Version 6.19.10  Jan 1, 2026

- **BYOK Dialog Prompt for Puzzle Examiner** (Author: Claude Sonnet 4)
  - **What**: Added an API key dialog that prompts users when they try to analyze a puzzle without providing a key in production. Also added a private "test" Easter egg bypass.
  - **Why**: Previously, users in production would see an error when clicking analyze without an API key, but no dialog to enter one. Now the dialog intercepts the action and prompts for the key before proceeding.
  - **How**:
    - **Frontend**: Added `isApiKeyDialogOpen` and `pendingModelForApiKey` state; `handleAnalyzeWithModel` now checks if key is missing and shows dialog; dialog includes key input with Enter support and provider links.

  - **Files changed**: `PuzzleExaminer.tsx`, `streamController.ts`

### Version 6.19.9  Jan 1, 2026

- **Task Efficiency - Major Improvements** (Author: ChatGPT)
  - **What**: Fixed all cost/time/token calculations, added #correct URL hash support, simplified efficiency page, made leaderboard header clickable.
  - **Why**: Costs weren't showing (DB returns strings), highlight wasn't expanding cards, efficiency page was bloated.
  - **How**:
    - Added `toNum()` helper throughout TaskEfficiencyLeaderboard for consistent string-to-number parsing.
    - Support `#correct` in URL (e.g., `/task/b5ca7ac4#correct`) to auto-filter to correct solutions.
    - Removed blue ring from highlight - just expand card and scroll.
    - Made leaderboard header clickable to open `/task/:id/efficiency` in new tab.
    - Rewrote TaskEfficiency page to embed TaskEfficiencyLeaderboard with a comparison summary.
  - **Files changed**: `TaskEfficiencyLeaderboard.tsx`, `PuzzleAnalyst.tsx`, `TaskEfficiency.tsx`

### Version 6.19.8  Jan 1, 2026

- **Task Efficiency Leaderboard - Bug Fixes & Highlight Support** (Author: ChatGPT)
  - **What**: Fixed TypeError crash when cost/time/tokens are strings from DB. Added highlight=ID deep linking to PuzzleAnalyst.
  - **Why**: Page was crashing with "b.toFixed is not a function" because DB sometimes returns numeric strings. Also, `/task/:id?highlight=:explanationId` URLs were not working (card didn't auto-expand or scroll into view).
  - **How**:
    - Added string-to-number parsing in formatCost/formatTime/formatTokens before calling toFixed/toLocaleString.
    - Added useEffect to parse `highlight` query param on mount and auto-expand the row.
    - Added second useEffect to scroll to highlighted row once summaries load, with temporary blue ring highlight.
  - **Files changed**: `TaskEfficiencyLeaderboard.tsx`, `PuzzleAnalyst.tsx`

### Version 6.19.7  Jan 1, 2026

- **Task Efficiency Leaderboard - Major Fixes** (Author: ChatGPT)
  - **What**: Fixed multiple issues with the Task Efficiency Leaderboard: 50/50 layout split, correct cost/time/token display, working column sorting, exact token counts.
  - **Why**: Previous version had crammed layout (420px fixed width), stats bar showing incorrect values, sorting not visually working, rounded token counts.
  - **How**:
    - Changed layout from `lg:grid-cols-[1fr_420px]` to `lg:grid-cols-2` for equal 50/50 split.
    - Fixed stats calculation to properly check for null/undefined vs zero values.
    - Added bidirectional sorting (click header to toggle asc/desc) with visual arrows.
    - Show exact token counts with commas (e.g., "45,231") instead of rounded "45.2k".
    - Show 4 decimal places for cost (e.g., "$0.0934") for precision.
    - Proper grid layout with sortable column headers.
  - **Files changed**: `TaskEfficiencyLeaderboard.tsx` (rewritten), `PuzzleAnalyst.tsx`

### Version 6.19.6  Jan 1, 2026

- **Shareable Task Efficiency Page** (Author: ChatGPT)
  - **What**: New dedicated page at `/task/:taskId/efficiency` showing top 3 in each category: Fastest, Slowest, Cheapest, Most Expensive, Fewest Tokens. One shareable link that proves efficiency matters.
  - **Why**: Previously needed 3+ separate links to share efficiency comparisons on Twitter. Now one URL shows all rankings with clickable links to each solution.
  - **How**:
    - Created `client/src/pages/TaskEfficiency.tsx` with category cards showing top 3 entries.
    - Each entry links to `/task/:taskId?highlight=:id` for direct solution viewing.
    - Quick comparison section shows multipliers (e.g., "11x slower", "12x more expensive").
    - Dark theme, tweet-friendly design with medal rankings.
  - **Files changed**: `TaskEfficiency.tsx` (new), `App.tsx` (route)

### Version 6.19.5  Jan 1, 2026

- **Task Efficiency Leaderboard - Compact Redesign** (Author: ChatGPT)
  - **What**: Completely redesigned `TaskEfficiencyLeaderboard` to be compact and punchy. Shows time, cost, and total tokens with sortable columns. Default sorts by fastest. Removed redundant "CORRECT" status (we're already filtering by correct). Zero-cost entries excluded from "Cheapest" stats.
  - **Why**: Original design wasted space showing redundant status badges and had poor metric alignment. Users want to quickly see which models are fastest, cheapest, and most token-efficient.
  - **How**:
    - Compact single-line rows with rank number, model name (truncated), thinking badge (Hi/Med/Lo), and right-aligned metrics (time, cost, tokens).
    - Sort buttons (Time/Cost/Tokens) in header - click to sort ascending (best first).
    - Quick stats bar showing fastest time, cheapest cost, fewest tokens at a glance.
    - Notable badges: Zap icon for fastest, $ icon for cheapest.
    - Max height with scroll for long lists.
    - Side-by-side layout in PuzzleAnalyst when filtering to "Correct".
  - **Files changed**: `TaskEfficiencyLeaderboard.tsx` (rewritten), `PuzzleAnalyst.tsx`

### Version 6.19.4  Jan 1, 2026

- **Task Examiner correctness filtering** (Author: ChatGPT)
  - **What**: Added correctness filter controls (All/Correct/Incorrect) with live counts to the Task Examiner (`PuzzleAnalyst`) so users can match Puzzle Examiner filtering behavior.
  - **Why**: The Task Examiner page previously showed all explanations without a way to focus on correct or incorrect runs, making review cumbersome.
  - **How**:
    - Wired `CorrectnessFilter` state into `usePaginatedExplanationSummaries` to request filtered summaries.
    - Added dark-themed filter buttons with lucide icons and badges showing per-filter counts.

### Version 6.19.3  Jan 1, 2026

- **BYOK Production Enforcement (Poetiq + Worm Arena + Global Config)** (Author: Claude Sonnet 4)
  - **What**: Ensured Bring Your Own Key is always required in production across Poetiq solver UI/streaming and Worm Arena run controls; added a global `/api/config` endpoint plus a React hook to surface environment-aware BYOK requirements to the client.
  - **Why**: In production the BYOK prompt was not shown and some flows could silently fall back to server keys, violating cost-control expectations.
  - **How**:
    - **Backend**: `/api/poetiq/models` now marks all models `requiresBYO` in production and returns `requiresUserApiKey`; `solveWithStream` uses the same environment-aware BYOK check as `solve`; added `/api/config` exposing `{ requiresUserApiKey, isProduction, environment }`.
    - **Frontend**: New `useAppConfig` hook with `useRequiresUserApiKey`; Poetiq Control Panel and Poetiq Community pages now gate API key entry on global BYOK (production) plus model flag; Worm Arena run controls auto-open the API key section in production, block starts without a key, and show prominent required messaging.

### Version 6.19.2  Jan 1, 2026

- **Move DatasetViewer access to navigation misc dropdown** (Author: Claude Sonnet 4)
  - **What**: Removed the dataset button from the RE-ARC page header; added a “DatasetViewer” link to the Misc dropdown in AppNavigation pointing to `/re-arc/dataset`.
  - **Why**: Collaborator requested a cleaner RE-ARC landing page while keeping dataset viewing available for any dataset, not just RE-ARC.
  - **How**:
    - `ReArc.tsx`: removed remaining button import so header stays minimal
    - `AppNavigation.tsx`: added Misc link to `/re-arc/dataset` labeled “DatasetViewer” with Database icon and a generic dataset description

### Version 6.19.1  Jan 1, 2026

- **RE-ARC UI Cleanup and Chart Fix** (Author: Claude Sonnet 4)
  - **What**: Removed "View submissions" and "Official scoring" buttons from RE-ARC page header; fixed efficiency chart Y-axis scaling from 111% to 100%.
  - **Why**: Collaborator feedback requested cleaner RE-ARC page matching original design. The efficiency chart's dynamic Y-axis with 10% padding was showing 111% max which is misleading since no score can exceed 100%.
  - **How**:
    - Removed button group containing "View submissions", "Official scoring", and "View dataset" links from `ReArc.tsx` header
    - Changed `EfficiencyPlot.tsx` Y-axis domain from dynamic `[0, Math.ceil(maxScore * 1.1)]` to fixed `[0, 100]`
    - Routes remain intact at `/re-arc/submissions` and `/scoring` - only UI buttons removed
  - **Files changed**:
    - `client/src/pages/ReArc.tsx` - Removed button group, removed unused Link import
    - `client/src/components/rearc/EfficiencyPlot.tsx` - Fixed Y-axis to 0-100%

### Version 6.19.0  Jan 1, 2026

- **BYOK Enforcement for ARC3 Agent Playground and Grover Controller** (Author: Claude Sonnet 4)
  - **What**: Extended Bring Your Own Key (BYOK) enforcement to ARC3 Agent Playground and Grover iterative solver endpoints. Production environment now requires user-provided API keys for all model-calling features.
  - **Why**: The BYOK system was implemented for Poetiq solver, Worm Arena, and Puzzle Examiner but was missing from ARC3 and Grover endpoints, allowing unexplained API calls in production.
  - **How**:
    - **Backend**: Added `requiresUserApiKey()` validation to:
      - `server/routes/arc3.ts`: `/api/arc3/stream/prepare` and `/api/arc3/real-game/run` endpoints
      - `server/controllers/groverController.ts`: `analyze` and `streamAnalyze` methods
    - **Frontend**: Added BYOK UI card to `ARC3AgentPlayground.tsx` with amber-themed styling matching existing BYOK patterns
    - **Hook**: Updated `useArc3AgentStream.ts` to accept and pass `apiKey` in `Arc3AgentOptions`
    - All endpoints return 400 with clear message: "Production requires your API key. Your key is used for this session only and is never stored."
  - **Files changed**:
    - `server/routes/arc3.ts` - Added BYOK validation and apiKey to schemas
    - `server/controllers/groverController.ts` - Added BYOK validation to both methods
    - `client/src/pages/ARC3AgentPlayground.tsx` - Added BYOK UI card and validation
    - `client/src/hooks/useArc3AgentStream.ts` - Added apiKey to options interface and API calls
  - **BYOK Coverage Summary**: All model-calling endpoints now enforce BYOK in production:
    - Puzzle Examiner (stream analysis)
    - Poetiq solver
    - Worm Arena / SnakeBench
    - ARC3 Agent Playground (NEW)
    - Grover iterative solver (NEW)

### Version 6.18.9  Jan 1, 2026

- **Document Official ARC-AGI scoring.py as Source of Truth** (Author: Claude Sonnet 4)
  - **What**: Established `arc-agi-benchmarking/src/arc_agi_benchmarking/scoring/scoring.py` as the authoritative reference for all ARC-AGI scoring logic. Fixed undefined variable bug in leaderboard submission. Updated terminology from "test pairs" to "test cases" for clarity.
  - **Why**: The official Python scoring implementation is the single source of truth. Users and developers need clear documentation linking to it. The Python code uses legacy naming (`num_pairs`) that refers to test cases (each with 2 attempts), which was causing terminology confusion.
  - **How**:
    - **Bug fix**: Fixed undefined `totalPairs`/`solvedPairs` variables in `reArcController.ts:submitToLeaderboard()` - now correctly uses `totalTestCases`/`solvedTestCases`
    - **Terminology update**: Renamed `EvaluationResult.solvedPairs` to `solvedTestCases` in `reArcService.ts` for clarity (DB columns retain "pairs" for backwards compatibility)
    - **Frontend**: Added "Official scoring" button to RE-ARC landing page header linking to `/scoring` page
    - **Scoring page**: Added expandable Accordion in `UnionAccuracyExplainers.tsx` displaying official Python `score_task()` implementation with explanatory notes
    - **Documentation**: Updated CLAUDE.md Section 6 and AGENTS.md Section 10 to explicitly reference `scoring.py` as source of truth with terminology notes
  - **Official Scoring Reference**: `arc-agi-benchmarking/src/arc_agi_benchmarking/scoring/scoring.py:36-125` (ARCScorer.score_task method)
  - **Files changed**:
    - `server/controllers/reArcController.ts` - Fixed undefined vars, added terminology comments
    - `server/services/reArc/reArcService.ts` - Renamed `solvedPairs` to `solvedTestCases` in type and implementation
    - `client/src/pages/ReArc.tsx` - Added "Official scoring" button in header
    - `client/src/components/huggingFaceUnionAccuracy/UnionAccuracyExplainers.tsx` - Added official Python code Accordion
    - `CLAUDE.md` - Added official scoring.py reference to Section 6
    - `AGENTS.md` - Added official scoring.py reference to Section 10
  - **Terminology clarification**: The official Python uses `num_pairs` to mean "test cases" (each with 2 attempts). Our TypeScript uses "testCases" for clarity, but DB columns retain "pairs" for backwards compatibility.

### Version 6.18.8  Jan 1, 2026

- **Critical Fix: RE-ARC Scoring Validation Bug** (Author: Claude Haiku 4.5)
  - **What**: Fixed inaccurate `solvedPairs` metric calculation in RE-ARC submission scoring. The validator was using `Math.round(score * totalPairs)` which caused rounding errors and mismatches between displayed pair counts and actual correctness.
  - **Why**: The overall submission score is the average of task scores (not the overall pair ratio), so multiplying back and rounding resulted in incorrect pair counts. This could differ from the true count of pairs that matched the ground truth.
  - **How**:
    - Modified `scoreTask()` function to return both `{ score, solvedCount }` instead of just the score ratio.
    - Updated `evaluateSubmission()` to accumulate the actual count of solved pairs during evaluation instead of calculating it afterward.
    - Changed `EvaluationResult` type to include `solvedPairs: number` in the score result.
    - Updated `reArcController.submitToLeaderboard()` to use the returned `solvedPairs` value directly instead of recalculating with rounding.
  - **Files changed**: `server/services/reArc/reArcService.ts`, `server/controllers/reArcController.ts`
  - **Impact**: Users now see accurate `Pairs: X/Y` metrics that reflect the true number of test pairs matching ground truth across all tasks.

### Version 6.18.7  Jan 1, 2026

- **GPT-5-Nano RE-ARC Solver with Corrected Submission Format** (Author: Claude Haiku 4.5)
  - **What**: Created `scripts/solvers/rearc-gpt5-mini.ts`, a clean batch-processing RE-ARC solver using OpenAI's Responses API with GPT-5-nano and Conversations API for multi-turn state management. Fixed submission format to match validator requirements (no null grids, fallback `[[0]]` for unparseable attempts).
  - **Why**: Needed a production-ready solver that correctly outputs RE-ARC submission format expected by the validator: `{ taskId: [{ attempt_1: Grid[], attempt_2: Grid[] }, ...] }` with both attempts as valid 2D arrays.
  - **How**:
    - Built two-phase batch execution: Phase 1 dispatches all 120 attempt-1s with 2-second spacing, Phase 2 chains all attempt-2s via Conversations API for context preservation.
    - Implemented grid parsing with regex extraction and validation, using fallback grid `[[0]]` instead of null for unparseable attempts to satisfy validator schema.
    - Updated types to use `Grid[]` instead of `(Grid | null)[]` to enforce type safety and ensure every submission element has valid arrays.
    - Handles variable test case counts (1-5 per task) dynamically via `parseMultipleGrids(text, expectedCount)`.
    - Configured reasoning: `high` effort with `auto` summary; `medium` text verbosity.
    - Generates timestamped submission JSON files compatible with `/api/rearc/evaluate` and leaderboard submission endpoints.

### Version 6.18.6  Jan 1, 2026

- **RE-ARC Synthetic Dataset Viewer** (Author: Cascade (ChatGPT))
  - **What**: Added `/re-arc/dataset` page for uploading and visualizing any RE-ARC dataset JSON. Purely client-side—no backend involved.
  - **Why**: Users need to inspect their generated synthetic datasets visually, with grids rendered exactly like Puzzle Examiner.
  - **How**:
    - Rewrote `client/src/pages/ReArcDataset.tsx` as a drag-and-drop upload viewer using `PuzzleGridDisplay` for grid rendering.
    - Accordion-style task list with expand/collapse all, search by task ID, and summary stats.
    - Removed unused backend endpoint, hook, and card component that were incorrectly scoped.

### Version 6.18.5  Dec 31, 2025

- **ARC3 Claude Code SDK Banner** (Author: Cascade (ChatGPT))
  - **What**: Added a Claude Code SDK highlight banner to the ARC3 landing page with updated metadata header.
  - **Why**: Surfaces Anthropic's official ARC3 partner template so visitors can quickly access the Claude Code SDK resources.
  - **How**:
    - Updated `client/src/pages/ARC3Browser.tsx` header metadata and layout to inject a gradient card linking to https://docs.arcprize.org/partner_templates/anthropic.
    - Styled the banner using existing shadcn primitives and Lucide Sparkles icon so it feels native to the page while remaining prominent.

### Version 6.18.4  Dec 31, 2025

- **OpenAI Native RE-ARC Solver** (Author: Cascade (ChatGPT))
  - **What**: Added `scripts/solvers/rearc-openai-solver.ts`, a checkpoint-aware solver that drives `REARC2026.json` using OpenAI's `gpt-5.1-codex-mini` via the Responses API. Includes CLI flags, adaptive backoff, failure taxonomy, and deterministic submission exports.
  - **Why**: Needed a first-party solver that talks to OpenAI directly (no OpenRouter) so researchers can evaluate GPT-5-class models on RE-ARC tasks.
  - **How**:
    - Created `docs/plans/2025-12-31-openai-native-solver-plan.md` outlining scope/objectives.
    - Ported ReArcFS queue/checkpoint architecture to the new script, swapping in OpenAI SDK usage, dual attempt temperatures, and response parsing helpers.
    - Emitted detailed run summaries plus timestamped submission artifacts for benchmarking parity.

### Version 6.18.3  Dec 31, 2025

- **RE-ARC Submissions: Remove Competitive Framing, Auto-Save Evaluations** (Author: Claude Opus 4.5)
  - **What**: Renamed "leaderboard" to "submissions", removed public promotion, auto-save all evaluations
  - **Why**: Previous framing was too competitive; submissions page exists for reference but is not advertised
  - **How**:
    - **File/Route Rename**: `ReArcLeaderboard.tsx` -> `ReArcSubmissions.tsx`, route `/re-arc/leaderboard` -> `/re-arc/submissions`
    - **Removed public link**: No longer linking to submissions page from main RE-ARC page
    - **Auto-save evaluations**: All evaluations with score > 0 are automatically saved (no opt-in UI)
    - **Optional label input**: Understated input field for users to label their submissions (for their own reference)
    - **Language cleanup**: Removed all "community" and competitive language from disclaimer and UI
    - **Code cleanup in EvaluationSection.tsx**:
      - Removed unused `handleSubmitToLeaderboard` function
      - Removed unused `isSubmitting` and `currentSubmission` state
      - Removed unused `Link` and `ExternalLink` imports
      - Fixed solverName closure issue using ref
  - **Files Modified**:
    - `client/src/pages/ReArcSubmissions.tsx` (renamed from ReArcLeaderboard.tsx): Updated function name, removed subtitle, updated disclaimer to factual language
    - `client/src/App.tsx`: Updated import and route
    - `client/src/pages/ReArc.tsx`: Removed "View Submissions" button and unused imports
    - `client/src/components/rearc/EvaluationSection.tsx`: Auto-save, optional label input, dead code removal, closure fix

### Version 6.18.2  Dec 31, 2025

- **RE-ARC Submission Board: Non-Competitive Redesign** (Author: Claude Haiku 4.5)
  - **What**: Reframed as exploratory "submission board" and removed all competitive imagery to emphasize research and transparency over competition
  - **Why**: Design inadvertently suggested competitive ranking; intent is community exploration and research, not competition
  - **How**:
    - **Terminology shift**: "RE-ARC Leaderboard" → "RE-ARC Submissions"; "RE-ARC solver results" → "Community solver results"; "About This Leaderboard" → "About These Submissions"
    - **Removed all competitive imagery and language**:
      - Removed Trophy icon from page header
      - Removed Medal icons for rank 1/2/3; now shows plain rank numbers
      - Removed Trophy icon from "Highest Score" sort option
      - Removed Trophy icon from empty state message
      - Removed references to "rankings" and "competitive" framing
    - **UI clarity improvements**:
      - Removed redundant "View:" label from view toggle
      - Conditional display: "Sort by" dropdown now only shows in table view (not efficiency plot)
      - Added elapsed time explanation in both views
      - **Comprehensive "About These Submissions" disclaimer** (amber-styled):
        - Key limitations section explicitly stating: "not reliable, not fair, and not legitimate"
        - Clear statement: "for community analysis and fun only"
        - "Why This Board Has These Limitations" section explaining:
          - No verification infrastructure; self-reported submissions prone to errors or misrepresentation
          - Unfair comparison due to different computational resources, optimization budgets, code maturity
          - No legitimacy guarantees; impossible to verify honesty or correct dataset usage
          - Community-driven exploratory effort, not official competition
        - Guidance: Use for learning and fun, not for real-world decisions or quality conclusions
    - **Efficiency Plot improvements**:
      - Removed confusing "Submissions" legend dot
      - Removed quadrant interpretation boxes (assumed data viz literacy)
      - Implemented log scale for X-axis with 5-minute minimum
      - Implemented dynamic Y-axis scaling to highest score
      - Added explanations of log scale and elapsed time
  - **Terminology updates across codebase**:
    - Changed all references from "leaderboard" to "submission board" or "submissions" in user-facing text
    - Updated button labels and success messages to use non-competitive language
    - Updated component documentation/comments for consistency
  - **Files Modified**:
    - `client/src/pages/ReArcLeaderboard.tsx`: Removed Trophy/Medal imports and icons, updated PURPOSE comment, changed page title/subtitle, consolidated disclaimer text, removed duplicate content, made sort controls conditional, added explanations
    - `client/src/pages/ReArc.tsx`: Changed "Leaderboard" button to "View Submissions"
    - `client/src/components/rearc/EvaluationSection.tsx`: Updated PURPOSE comment, changed success message from "Submitted to leaderboard!" to "Submission added to board!", updated link text to "View submissions"
    - `client/src/components/rearc/EfficiencyPlot.tsx`: Removed Legend component and interpretation boxes, implemented log/dynamic axes

### Version 6.18.1  Dec 31, 2025

- **RE-ARC UI Refinement: Analysis-First Leaderboard** (Author: Claude Haiku 4.5)
  - Removed non-official metrics: Pairs, Verified, Tasks columns (not in ARC-AGI Prize scoring)
  - Kept official metrics: Score, Time, Date
  - File dropper always visible, disabled/greyed during evaluation
  - Moved matching submissions note into Submit to Leaderboard card
  - Added leaderboard intention copy: "community analysis and just-for-fun benchmarking"
  - Fixed tooltips: Tasks (clarified scoring), added Time explanation
  - Default leaderboard view: changed from table to Efficiency plot
  - Removed bottom info section (explanations consolidated to main page)
  - **Files Modified**: `client/src/components/rearc/EvaluationSection.tsx`, `client/src/pages/ReArcLeaderboard.tsx`


### Version 6.18.0  Dec 31, 2025

- **RE-ARC Leaderboard Opt-In UX Redesign** (Author: Claude Opus 4.5)
  - **Core Changes**: Made leaderboard submission explicitly opt-in AFTER seeing evaluation results
  - **UX Flow**:
    - Old: Enter name upfront → Upload → Auto-submit to leaderboard
    - New: Upload → See score → If score > 0%, optional "Submit to Leaderboard" card appears
  - **Removed Trophy Icons**: Eliminated competitive imagery for neutral benchmarking experience
    - Removed from leaderboard button in main page (client/src/pages/ReArc.tsx:55)
    - Removed from evaluation section header (client/src/components/rearc/EvaluationSection.tsx:554)
    - Removed "Added to leaderboard!" trophy icon
  - **Backend Split**:
    - `POST /api/rearc/evaluate` - Now ONLY evaluates, does NOT save to leaderboard
    - `POST /api/rearc/submit` - NEW endpoint for opt-in leaderboard submission (server/controllers/reArcController.ts:400-485)
  - **Opt-In UI**: New card component appears after successful evaluation when score > 0%
    - Name input with shuffle button (appears post-evaluation, not upfront)
    - "Submit to Leaderboard" button with loading state
    - Success confirmation with leaderboard link
  - **Cache Performance**: Submit endpoint re-evaluates submission (cache hit for fast response)
  - **Files Modified**:
    - `client/src/pages/ReArc.tsx` (line 55): Removed Trophy icon from leaderboard button
    - `client/src/components/rearc/EvaluationSection.tsx` (lines 19, 93-104, 106-132, 285-286, 442-512, 554-557): Removed upfront name input, added opt-in submission UI
    - `server/controllers/reArcController.ts` (lines 160-237, 388-485): Split evaluate/submit endpoints
    - `server/routes.ts` (line 315): Added submit route
  - **Build Status**: All TypeScript checks passing

### Version 6.17.3  Dec 31, 2025

- **RE-ARC Leaderboard Bug Fix & Scoring Clarifications** (Author: Claude Opus 4.5)
  - **Bug Fixes**:
    - Fixed Tasks column showing "/120" with no actual value - `tasksSolved` was missing from API response
    - Fixed Time column showing "NaNd NaNh" - `elapsedMs` and `generatedAt` were missing from API response
    - Root cause: Controller response mapping at `server/controllers/reArcController.ts:476-492` was not including
      three fields that the repository already calculated correctly
  - **Scoring Clarification UI**:
    - Added tooltip on "Tasks" column header explaining: fully solved tasks (all test pairs correct)
    - Added tooltip on "Pairs" column header explaining: each task has 1-3 test pairs, partial solves contribute
    - Added "Tasks vs Pairs" explanation in info section clarifying the scoring relationship
    - Key insight for users: ARC tasks can have 1-3 test pairs; solving 1/3 pairs = 33% task score, not a full solve
  - **Files Modified**:
    - `server/controllers/reArcController.ts` (line 484, 488-489): Added `tasksSolved`, `generatedAt`, `elapsedMs` to response
    - `client/src/pages/ReArcLeaderboard.tsx` (lines 33-38, 238-267, 344-349): Added Tooltip imports, column tooltips, info text
  - **Build Status**: All changes compile successfully

### Version 6.17.2  Dec 31, 2025

- **RE-ARC Efficiency Visualization** (Author: Claude Sonnet 4.5)
  - **Core Features**:
    - Elapsed time tracking: calculates time from dataset generation to submission evaluation
    - Scatter plot visualization: score vs elapsed time showing solver efficiency patterns
    - View toggle: switch between traditional table view and efficiency plot
    - Interactive tooltips: hover over plot points to see detailed submission info
  - **Backend Changes**:
    - `server/repositories/ReArcRepository.ts` (lines 57-68, 290-337):
      - Added `generatedAt: Date` field to `LeaderboardEntry` interface (derived from seed_id Unix timestamp)
      - Added `elapsedMs: number` field to `LeaderboardEntry` interface (calculated as evaluated_at - generated_at)
      - Updated SQL query to convert seed_id to timestamp: `to_timestamp(d.seed_id::bigint) as generated_at`
      - Calculate elapsed time in milliseconds during result mapping
  - **Frontend Components**:
    - New `client/src/components/rearc/EfficiencyPlot.tsx` - Scatter plot component using recharts:
      - X-axis: Elapsed time in minutes
      - Y-axis: Score as percentage (0-100%)
      - Custom tooltips showing solver name, score, time, tasks solved, and pairs solved
      - Quadrant interpretation guide (top-left = efficient, top-right = thorough but slow, etc.)
      - Styled with shadcn/ui theming for consistency
    - Updated `client/src/pages/ReArcLeaderboard.tsx`:
      - Added `generatedAt` and `elapsedMs` to `LeaderboardEntry` interface (lines 46-47)
      - New `formatElapsedTime()` helper function (lines 66-76) with human-readable formatting (< 1s, Xs, Xm Ys, Xh Ym, Xd Yh)
      - Added "Time" column to leaderboard table showing formatted elapsed time (line 208, 235-237)
      - View toggle buttons with Table/Efficiency options using Lucide icons (lines 131-154)
      - Conditional rendering: table view shows paginated rankings, plot view shows scatter chart (lines 230-324)
      - Dynamic card header/description based on active view
  - **Visualization Insights**:
    - Top-left quadrant: High score + fast time = ideal efficient solver
    - Top-right quadrant: High score + slow time = thorough but slow approach
    - Bottom-left quadrant: Low score + fast time = quick but ineffective
    - Bottom-right quadrant: Low score + slow time = struggling solver
  - **Technical Implementation**:
    - No database migrations required: seed_id already stored as Unix timestamp
    - Elapsed time calculated from existing timestamps (generation time embedded in seed_id)
    - Recharts already installed as dependency (confirmed via package.json)
    - Fully type-safe with TypeScript interfaces
  - **Files Modified**: 3 files, +~250 insertions
    - Modified: `server/repositories/ReArcRepository.ts` (added fields to interface and query)
    - Modified: `client/src/pages/ReArcLeaderboard.tsx` (added view toggle and elapsed time column)
    - New file: `client/src/components/rearc/EfficiencyPlot.tsx` (scatter plot component)
  - **Build Status**: All builds passing, no TypeScript errors

### Version 6.17.1  Dec 31, 2025

- **RE-ARC Result Persistence & Public Leaderboard** (Author: Claude Haiku 4.5)
  - **Core Features**:
    - Leaderboard persistence: all evaluations automatically saved with solver name
    - Public leaderboard with multi-sort support (by score, latest, most verified)
    - Submission verification: identical submissions trigger match detection via SHA-256 hashing
    - Two distinct user flows: "Evaluate Your Own Solution" (saves) vs "Verify Someone Else's" (checks only)
    - Anonymous submissions: no login required, just solver name (with optional auto-generation)
    - Verification tracking: external uploads increment verification_count on matching submissions
  - **Backend Architecture**:
    - `server/repositories/ReArcRepository.ts` - Domain repository with SRP methods for leaderboard operations
    - `server/utils/submissionHash.ts` - Deterministic SHA-256 hashing of submission JSON (sorted keys, no whitespace)
    - `server/utils/nameGenerator.ts` - Fun random name generation (adjectives + animals) with input validation
    - `server/repositories/database/DatabaseSchema.ts` - New tables: `rearc_datasets`, `rearc_submissions` with verification tracking
    - **Three New Endpoints**:
      - `POST /api/rearc/evaluate` - Evaluate submission, save to leaderboard, find matching entries
      - `POST /api/rearc/verify` - Verify someone else's submission, increment verification_count on matches (no save)
      - `GET /api/rearc/leaderboard?sort=score&limit=25&offset=0` - Paginated leaderboard with sorting
      - `GET /api/rearc/submissions/:id` - Submission detail view with matching entries
  - **Frontend Components**:
    - Updated `client/src/components/rearc/EvaluationSection.tsx` - Solver name input with shuffle button for auto-generation
    - New `client/src/pages/ReArcLeaderboard.tsx` - Full leaderboard page with table, medals for top 3, verification badges
    - Updated `client/src/pages/ReArc.tsx` - Added "Leaderboard" button in header linking to `/re-arc/leaderboard`
    - Updated `client/src/App.tsx` - New route for leaderboard page
  - **Database Schema** (`rearc_submissions` table):
    - `solver_name` - User-provided or auto-generated name (255 chars max)
    - `submission_hash` - SHA-256 hash of normalized JSON (indexed for duplicate detection)
    - `score`, `solved_pairs`, `total_pairs` - Evaluation results
    - `verification_count` - Tracks how many times this submission was verified by others
    - `pair_results` - JSONB for detailed per-pair correctness data
    - Indexes on: hash, score (DESC), evaluated_at (DESC), solver_name, rearc_dataset_id
  - **Updated API Event Format**:
    - SSE completion event now includes `submissionId` and `matchingSubmissions` array
    - Matching entries show id, solverName, score, and evaluatedAt timestamp
    - Allows frontend to display verification warnings immediately on evaluation
  - **UX Enhancements**:
    - Success screen shows "Added to leaderboard!" with link to view rankings
    - Yellow warning box displays matching submissions if hash collision detected
    - Leaderboard shows rank with medal icons for gold/silver/bronze
    - Verification count displayed as shield badge
    - 25 entries per page with Previous/Next pagination
    - Sort dropdown with Trophy/Clock/Shield icons for visual clarity
  - **Files Modified**: 11 files, +~1200 insertions
    - New files: ReArcRepository.ts, submissionHash.ts, nameGenerator.ts, ReArcLeaderboard.tsx
    - Modified: DatabaseSchema.ts, reArcController.ts, EvaluationSection.tsx, ReArc.tsx, App.tsx, routes.ts, shared/types.ts
  - **Implementation Notes**:
    - Hashing uses deterministic JSON.stringify with sorted task IDs for consistent matching
    - Verification flow doesn't save to leaderboard but increments verification_count on matches
    - No authentication: "anyone can upload anyone else's submission to verify they're being truthful" (credit: conundrumer)
    - Both evaluate and verify flows find and report matching entries for transparency
  - **Special Thanks**:
    - Credit to [conundrumer](https://github.com/conundrumer) for creating RE-ARC and the core concept of verification-by-submission

### Version 6.17.0  Dec 30, 2025 21:43

- **RE-ARC Bench: Self-Service Dataset Generation and Evaluation Platform** (Author: Claude Sonnet 4.5, integration by Claude Haiku 4.5)
  - **Core Features**:
    - Stateless 120-task evaluation set generation with XOR-based seed recovery
    - HMAC-SHA256 seed derivation (RE_ARC_SEED_PEPPER) prevents dataset regeneration without server access
    - Real-time SSE streaming evaluation with live progress updates
    - LRU cache for 100x speedup on repeated evaluations (~100ms vs ~10s)
  - **Backend Architecture**:
    - `server/utils/reArcCodec.ts` - XOR seed recovery, SimplePRNG, steganographic message encoding
    - `server/services/reArc/reArcService.ts` - Python subprocess integration, dataset generation, scoring
    - `server/controllers/reArcController.ts` - HTTP endpoints with rate limiting (2 gen/5min, 20 eval/5min)
    - `server/middleware/metaTagInjector.ts` - Link unfurling for Discord/Twitter/Slack previews
    - `server/utils/sseHelpers.ts` - Generic type-safe SSE event streaming
  - **Frontend Components** (`client/src/pages/ReArc.tsx`):
    - Single-page interface with generation and evaluation sections
    - Reusable components: GenerationSection, EvaluationSection, ErrorDisplay, ProgressDisplay
    - Client-side validation with 13+ error types and UX writing guidelines compliance
    - Collapsible format guides and scoring explanations
  - **Testing**:
    - `tests/reArcCodec.test.ts` (484 lines) - XOR seed recovery, steganography, edge cases
    - `tests/reArcService.test.ts` (669 lines) - dataset generation, evaluation, cache behavior
    - `tests/reArcController.test.ts` (402 lines) - HTTP streaming, SSE, validation, rate limiting
    - `tests/metaTagInjector.test.ts` (184 lines) - meta tag injection, HTML preservation
    - **All 63 tests passing**
  - **Documentation**:
    - `docs/LINK_UNFURLING.md` - Link unfurling architecture and usage
    - `docs/plans/2025-12-24-re-arc-interface-plan.md` - Backend implementation plan
    - `docs/plans/2025-12-24-rearc-frontend-design.md` - Frontend UX design spec
    - `docs/reference/frontend/DEV_ROUTES.md` - Dev-only route patterns
    - `docs/reference/frontend/ERROR_MESSAGE_GUIDELINES.md` - Error message standards
  - **Configuration**:
    - Added `RE_ARC_SEED_PEPPER` environment variable (32+ character secret for seed derivation)
    - Updated `.env.example` with pepper configuration
    - Docker support with re-arc submodule initialization
  - **Navigation**:
    - Added "Testing" link in AppNavigation after "Official Scoring"
    - Beaker icon for easy identification
  - **Files Modified**: 41 files, +6,455/-74 insertions
    - New submodule: `external/re-arc` (conundrumer/re-arc)
  - **Security Notes**:
    - Pepper must be 32+ characters and kept secret (controls task patterns and Python RNG)
    - Solutions inaccessible without server pepper
    - Production pepper managed separately for security

### Version 6.16.19  Dec 30, 2025

- **Tooling: Added local npm script for build+dev combo** (Author: Cascade)
  - Added `local` npm script so `npm run local` executes a production build followed by the dev server for a single-command local run loop.

### Version 6.16.18  Dec 30, 2025

- **TypeScript compile fixes for ARC3 Spoiler + SnakeBench service** (Author: Cascade)
  - Annotated all callback parameters in `Arc3GameSpoiler.tsx` so `noImplicitAny` stays satisfied.
  - Corrected `frameUnpacker.ts` predicate signature to align with the union it narrows.
  - Patched `snakeBench.ts` to use the right shared-type import paths, new `MODELS` helper, and a typed OpenRouter allowlist Set.
  - Extended `GameIndexEntry` with optional camelCase properties for legacy rows so filename lookups stay typed.
  - Result: `npm run check` now passes with zero TypeScript errors.

### Version 6.16.17  Dec 30, 2025

- **Model Insights Dashboard Enhancement: Real TrueSkill Metrics and Visualizations** (Author: Claude Code using Opus 4.5)
  - **Part 1 - Header Bar Badges (WormArenaModels.tsx)**:
    - Removed fake StreakBadge component and calculateStreak function
    - Added useWormArenaTrueSkillLeaderboard hook for real TrueSkill rankings
    - Display 5 real TrueSkill metric badges:
      - Rank (amber) - actual leaderboard position, not array index
      - Skill mu (blue) - skill estimate value
      - Uncertainty sigma (green/gray) - stability indicator (<3 = stable)
      - Win Rate (emerald) - calculated from decided games
      - Placement progress (green/yellow) - games played toward 9-game placement
  - **Part 2 - Report Visualizations (WormArenaModelInsightsReport.tsx)**:
    - Added TrueSkill metrics visualization after timestamp using WormArenaSkillMetrics
    - Added Skill Comparison accordion with bell curve chart vs toughest opponent
    - Added Game Length Distribution accordion filtered to current model only
    - Wired up useWormArenaTrueSkillLeaderboard for opponent TrueSkill lookup
    - Pre-filter distribution data to show only selected model
  - **Files Modified**:
    - `client/src/pages/WormArenaModels.tsx` (86 additions, 98 deletions)
    - `client/src/components/wormArena/WormArenaModelInsightsReport.tsx` (103 additions, 3 deletions)

### Version 6.16.16  Dec 30, 2025

- **Distributions Page: Min-Rounds Filtering and Chart Enhancements** (Author: Gemini 3 Flash High, bugfix by Claude Code using Opus 4.5)
  - **Page Controls (WormArenaDistributions.tsx)**:
    - Added slider for minimum rounds threshold (default 50, range 0-120)
    - Added toggle to include/exclude models without games at threshold
    - Forwarded minRounds and includeLowModels props to chart component
  - **Chart Updates (WormArenaRunLengthChart.tsx)**:
    - Added minRounds bucketing - games below threshold grouped into "<N" bucket
    - Default inclusion: only models with games >= minRounds shown by default
    - Optional inclusion of low-round-only models via toggle
    - Click-to-detail on bars shows round-specific breakdown
    - **Bugfix**: Fixed ModelFilterPopover referencing out-of-scope `modelPool` variable (changed to `allModels` prop)
  - **Files Modified**:
    - `client/src/pages/WormArenaDistributions.tsx`
    - `client/src/components/wormArena/stats/WormArenaRunLengthChart.tsx`

### Version 6.16.15  Dec 30, 2025

- **UI: Fixed Worm Arena Match Card layout and model name truncation** (Author: Cascade)
  - Removed "Champion" and "Challenger" labels from `WormArenaMatchCard` to save horizontal space.
  - Removed truncation from model names in `WormArenaMatchCard` to ensure full slugs are visible.
  - Improved layout flow for long model names in "Greatest Hits" and search results.
  - **Files Modified**:
    - `client/src/components/wormArena/WormArenaMatchCard.tsx`
    - `client/src/components/WormArenaGreatestHits.tsx` (header update)

### Version 6.16.14  Dec 30, 2025

- **Enhanced Run Length Distribution Chart with Interactive Filtering and Metrics** (Author: Cascade)
  - **Phase I - Interactive Model Filtering**:
    - Added searchable multi-select filter popover with "Select All" / "Clear All" buttons
    - All models shown by default - chart remains fully populated on load
    - Filter badge shows "X of Y models" when filtering is active
    - Clear affordance with "Tip:" message showing users they can filter
  - **Phase II - Enhanced Chart Interactivity**:
    - Clickable legend items: click to toggle visibility, Shift+click to solo a model
    - Bar hover highlighting: hovering a model dims all other models (opacity 0.25)
    - Enhanced tooltip showing win rate %, % of model's total games, and comparison to average
  - **Phase III - View Mode Toggle and Reference Lines**:
    - Three-mode toggle: Count (default stacked bars), Win Rate (line overlay), Cumulative (% completed by round)
    - Global average reference line (dashed) always visible
    - Selected model average reference line when single model filtered
  - **Technical Changes**:
    - Migrated from `BarChart` to `ComposedChart` for line overlay support
    - Added `ReferenceLine` component for average markers
    - Expanded color palette from 8 to 12 colors for better model differentiation
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaRunLengthChart.tsx` (complete rewrite, 856 lines)
  - **Files Added**:
    - `docs/plans/2025-12-30-run-length-chart-enhancements-plan.md` (implementation plan)
  - **Impact**: Significantly improved data exploration UX while maintaining backward compatibility

### Version 6.16.13  Dec 30, 2025

- **Streaming: Default enablement + OpenAI handler flags** (Author: Cascade - ChatGPT)
  - Guarded puzzle fetch in `analysisStreamService` so streaming proceeds even when puzzles are unavailable in test harnesses; validation now skips when puzzle is missing.
  - For non-streaming models, emit `STREAMING_UNAVAILABLE` instead of falling back, matching tests and intent.
  - OpenAI streaming `json.done` events now include `expectingJson` and `fallback` flags alongside metadata.
  - **Tests:** `analysisStreamService.test.ts`, `analysisStreamService.streaming.test.ts`, `openaiStreamingHandlers.test.ts`.
  - **Files Modified:** `server/services/streaming/analysisStreamService.ts`, `server/services/openai/streaming.ts`.

### Version 6.16.12  Dec 30, 2025

- **UI Polish: Model Insights Report Text Sizing and Twitter Share Improvements** (Author: Claude Sonnet 4)
  - **Text Size Adjustments**:
    - Reduced title from `text-5xl` to `text-2xl` (was too dominant)
    - Increased main summary insight text from `text-sm` to `text-base` (more readable)
    - Made subtitle smaller and muted for visual hierarchy
  - **Button Improvements**:
    - Reduced button gap from `gap-3` to `gap-1` (tighter grouping)
    - Changed to smaller `size="sm"` buttons with shorter labels (Copy, Save .md, Share on X)
    - Added dark styling for Share on X button (`bg-black text-white`)
  - **Twitter/X Share Updates**:
    - Changed hashtag from #WormArena to #SnakeBench
    - Added @arcprize mention and #arcagi3 hashtag
    - Included model page URL in tweet for easy navigation
    - Updated character limit from 260 to 280 (X's current limit)
  - **Files Modified**:
    - `client/src/components/wormArena/WormArenaModelInsightsReport.tsx` (UI styling)
    - `server/services/wormArena/WormArenaReportService.ts` (tweet format)
  - **Impact**: Improved visual hierarchy, more compact buttons, better Twitter engagement with proper hashtags and attribution

### Version 6.16.11  Dec 30, 2025

- **DRY: Consolidate Specialized Formatters to Shared Utilities** (Author: Claude Sonnet 4.5)
  - **New Shared Formatters**:
    - Added `formatCostSmart()` to `shared/utils/formatters.ts` - Smart unit conversion for very small costs (millicents/cents/dollars)
    - Added `formatUsdLocale()` to `shared/utils/formatters.ts` - Locale-aware Intl.NumberFormat currency formatting
    - Both include comprehensive JSDoc with examples and parameter descriptions
  - **Eliminated Duplicate Code**:
    - Removed local `formatCost` from `ModelComparisonPage.tsx:380-391` (12 lines) → replaced with `formatCostSmart` (2 call sites)
    - Removed local `formatUsdPerM` from `AdminOpenRouter.tsx:105-113` (9 lines) → replaced with `formatUsdLocale` (4 call sites)
  - **Behavior Improvements**:
    - AdminOpenRouter now shows 'N/A' instead of null for missing pricing (consistent with shared formatter pattern)
    - Updated conditional checks from `!value` to `value === 'N/A'` for explicit null handling
  - **Intentionally Kept Local**:
    - Simple 2-4 decimal formatters in BeetreeSolver, Leaderboards, PoetiqSolver remain local (context-specific variations)
  - **Files Modified**:
    - `shared/utils/formatters.ts` (added formatCostSmart, formatUsdLocale with JSDoc)
    - `client/src/pages/ModelComparisonPage.tsx:27,380-391,712,716` (import shared formatter, remove local, update usages)
    - `client/src/pages/AdminOpenRouter.tsx:18,106-113,107-109,112-113,119-121,124-125` (import shared formatter, remove local, update conditional checks)
  - **Impact**: Reduced formatter duplication, centralized specialized logic, maintained backward compatibility

### Version 6.16.10  Dec 30, 2025

- **Build Fix: Resolved Missing Import Path for Shared Formatters** (Author: Claude Sonnet 4.5)
  - **Critical Build Failure Fix**:
    - Fixed broken import path in `WormArenaModelInsightsReport.tsx` that was preventing production build
    - Changed import from non-existent `@/lib/utils/formatters` to correct `@shared/utils/formatters`
    - Added missing shadcn/ui component imports (Card, Button, Separator, Accordion, Table, Badge)
    - Added missing TypeScript interface `WormArenaModelInsightsReportProps`
  - **Root Cause**:
    - Previous assistant moved formatters to shared folder but failed to update import path in component
    - Missing component imports and type definition prevented build from completing
  - **Files Modified**:
    - `client/src/components/wormArena/WormArenaModelInsightsReport.tsx` (fixed import paths, added missing imports and types)
  - **Impact**: Production build now succeeds, resolving deployment blocker to staging environment

### Version 6.16.9  Dec 29, 2025

- **Code Quality: Fixed Critical Maintainability Issues in Worm Arena Refactor** (Author: Claude Sonnet 4.5)
  - **Critical Bug Fixes**:
    - Fixed catch block bug in `WormArenaReportService.ts:60-66` that was injecting duplicate performance metrics into markdown output instead of handling JSON parse errors properly.
    - Removed excessive `as any` type assertions - reduced from double-cast `(as any) as any` to single cast with explanatory comments.
    - Fixed parse-and-discard logic in `requestInsightsSummary` - removed pointless JSON.parse that validated then discarded the result.
  - **DRY Improvements**:
    - Created `SQL_TRUESKILL_EXPOSED()` helper in `snakebenchSqlHelpers.ts` to consolidate TrueSkill formula `COALESCE(trueskill_exposed, trueskill_mu - 3 * trueskill_sigma)`.
    - Updated `AnalyticsRepository.ts` and `LeaderboardRepository.ts` to use shared helper, eliminating formula duplication.
  - **Documentation**:
    - Added comprehensive error handling strategy documentation to `WormArenaReportService` class explaining when to throw vs return null.
    - Added JSDoc for `SQL_TRUESKILL_EXPOSED` explaining the conservative skill estimate formula.
  - **Cleanup**:
    - Removed unused `WormArenaModelInsightsLLMOutput` import.
    - Removed unnecessary `await` on stream initialization.
  - **Files Modified**:
    - `server/services/wormArena/WormArenaReportService.ts` (bug fixes, type safety, error handling docs)
    - `server/repositories/snakebenchSqlHelpers.ts` (new SQL_TRUESKILL_EXPOSED helper)
    - `server/repositories/AnalyticsRepository.ts` (use shared TrueSkill helper)
    - `server/repositories/LeaderboardRepository.ts` (use shared TrueSkill helper)
  - **Impact**: Eliminated production-breaking bug, improved code readability, reduced technical debt for future developers.

### Version 6.16.8  Dec 30, 2025

- **Insights: Enhanced Performance Metrics & UI Consistency** (Author: Cascade)
  - **Metric Expansion**:
    - Added p25 (25th percentile) score calculation to `AnalyticsRepository.ts` for full quartile analysis (p25, p50, p75).
    - Integrated leaderboard rank and total model count into model insights reports.
  - **UI/UX Polish**:
    - Updated `WormArenaModelInsightsReport.tsx` to display 'Rank X of Y' in summary tiles.
    - Integrated full score distribution (avg, p25, p50, p75) into the Cost and Efficiency section.
    - Cleaned up stale local formatting helpers in favor of centralized `shared/utils/formatters.ts`.
    - Switched UI to use `formatUsd` for currency consistency.
  - **Code Quality**:
    - Consolidated streaming report finalization in `WormArenaReportService.ts` to use `buildReportObject` as a single source of truth.
    - Standardized all 7 modified file headers to strictly comply with `AGENTS.md` (Author/Date/PURPOSE/SRP-DRY).
    - Verified clean delegation in `snakeBenchService.ts` as a thin facade.
  - **Files Modified**: 
    - `server/repositories/AnalyticsRepository.ts`
    - `server/services/wormArena/WormArenaReportService.ts`
    - `server/services/prompts/wormArenaInsights.ts`
    - `server/services/snakeBenchService.ts`
    - `client/src/components/wormArena/WormArenaModelInsightsReport.tsx`
    - `shared/utils/formatters.ts`
    - `shared/types.ts`

### Version 6.16.7  Dec 29, 2025

- **Architecture: Refactored SnakeBenchService & Fixed Responses API Conflicts** (Author: Cascade)
  - **SRP Refactor**: 
    - Extracted prompt building logic to `server/services/prompts/wormArenaInsights.ts`.
    - Extracted report generation and LLM orchestration to `server/services/wormArena/WormArenaReportService.ts`.
    - Reduced `snakeBenchService.ts` size by ~50%, transforming it into a clean delegation facade.
  - **Responses API Fix**: 
    - Resolved conflicting instructions in the model insights payload.
    - Separated narrative instructions (commentator style) from data context in the user prompt.
    - Aligned payload with `json_schema` requirements for more reliable structured output.
  - **Insights Audit Enhancement**: 
    - Updated `AnalyticsRepository.ts` to include missing metrics (ties, unknown losses) in the insights summary.
    - Enhanced prompts to include leaderboard rank and detailed cost efficiency metrics (cost per game/win/loss).
  - **Files Created**: `server/services/prompts/wormArenaInsights.ts`, `server/services/wormArena/WormArenaReportService.ts`, `docs/plans/2025-12-29-worm-arena-refactor-plan.md`
  - **Files Modified**: `server/services/snakeBenchService.ts`, `server/repositories/AnalyticsRepository.ts`

### Version 6.16.6  Dec 29, 2025

- **Worm Arena Model Insights: Streaming fixes, loading state, and UI polish** (Author: Claude Code using Haiku)
  - **Streaming Foundation**:
    - Fixed critical event routing bug in `snakeBenchService.ts` where `emitEvent` callback was ignoring event type and routing all events to `onStatus` handler, causing SSE stream mismanagement and premature connection closure.
    - Corrected callback to properly route `'stream.status'` and `'stream.chunk'` events to appropriate handlers.
  - **Frontend UX Improvements**:
    - Added immediate loading spinner ("Preparing analysis...") that displays during the `'requested'` state, before first OpenAI stream events arrive, providing instant visual feedback to users.
    - Expanded all accordion sections by default (Failure Modes, Cost & Efficiency, Opponent Pain Points, Data Quality) for better content discoverability.
    - Increased section heading sizes from `text-sm` to `text-base` with bold weight for better visual hierarchy.
    - Redesigned Data Quality badges as minimal, colorful pill-shaped elements with vibrant background colors (green for loss coverage, red for unknowns, orange for early losses) and improved spacing.
  - **Content Clarity**:
    - Removed confusing "Generated by [model]" attribution lines that conflicted with the meta-feature nature of the insights.
  - **Meta Feature Note**: This is a very cool meta feature—LLMs play Snake games, then a different LLM analyzes how those LLMs played. The streaming insights report showcases this self-reflective AI analysis pipeline.
  - **Files Modified**: `server/services/snakeBenchService.ts`, `client/src/components/wormArena/WormArenaModelInsightsReport.tsx`

### Version 6.16.5  Dec 29, 2025

- **Fix: Worm Arena Model Insights report generation and streaming** (Author: Claude Code using Haiku)
  - Fixed Responses API request format in `text.format` structure
  - Refactored streaming to use `handleStreamEvent` helper for consistent event processing
  - Improved response parsing to handle multiple output formats
  - Report generation now resilient to LLM summary API failures

### Version 6.16.4  Dec 28, 2025

- **Fix: Robust Model Aggregation & Visibility Restoration** (Author: Cascade)
  - **Purpose**: Fix empty model list on Worm Arena Models page caused by overly restrictive SQL filtering and grouping issues.
  - **Issues Fixed**:
    - Restored visibility of models by removing the restrictive `g.status = 'completed'` filter from `GameReadRepository.ts`.
    - Implemented a more robust "Hybrid Aggregation" approach: SQL handles initial grouping by name/slug to ensure results return, while JavaScript handles final deduplication and stat aggregation by normalized slug.
    - This hybrid approach solves the `model-item-undefined` React warning without the risk of empty results from complex SQL `MAX()` aggregations on join-heavy tables.
    - Preserved URL persistence and auto-selection logic for a seamless "Combat Dossier" experience.
  - **Files Modified**:
    - `server/repositories/GameReadRepository.ts` (Implemented JS-side aggregation and removed status filter)
    - `client/src/pages/WormArenaModels.tsx` (Final logic verification and cleanup)
  - **Impact**: All models with played games are now correctly visible, and the page is resilient to database inconsistencies like model renames.

### Version 6.16.3  Dec 28, 2025

- **Fix: Worm Arena Models page display and navigation completeness** (Author: Claude Haiku 4.5)
  - **Purpose**: Fix broken model name display in Worm Arena Models page and ensure all Worm Arena subitems are accessible from main navigation.
  - **Issues Fixed**:
    - Fixed SelectItem structure in WormArenaModels.tsx that caused malformed dropdown display ("Choose a model_openai/gpt-5-nano" concatenation bug).
    - Added missing `modelName` field to `WormArenaModelWithGames` type for proper display names.
    - Updated backend SQL query to fetch `models.name` field for model name display.
    - Corrected page label from "Select Combatant" to "Select Model".
    - Updated navigation to include all 8 Worm Arena pages under SnakeBench dropdown (was missing Models, Skill Analysis, Distributions, Rules).
    - Updated Stats page navigation title to "Worm Arena (Stats & Placement)" for accuracy.
  - **Files Modified**:
    - `client/src/pages/WormArenaModels.tsx` (fixed SelectItem structure, corrected label, added modelName display)
    - `client/src/components/layout/AppNavigation.tsx` (added 4 missing Worm Arena pages to dropdown menu)
    - `server/repositories/GameReadRepository.ts` (added `m.name` to SQL query and result mapping)
    - `shared/types.ts` (added `modelName: string` to `WormArenaModelWithGames` interface)
  - **Impact**: Worm Arena Models page now renders correctly with friendly model names, and full navigation suite is accessible from main menu.

### Version 6.16.1  Dec 27, 2025

- **Insights: Comprehensive local game analysis and record-breaking matches** (Author: Gemini 3 Flash High)
  - **Purpose**: Deep-dive into local SnakeBench history to extract performance records and fix directory blindness in the UI.
  - **Local Records Found**:
    - Discovered **30-apple record** (104 rounds) by `openai/gpt-5.1-codex-mini` vs `nvidia/nemotron-3-nano-30b-a3b:free`.
    - Promoted top local matches to the "Greatest Hits" Hall of Fame.
  - **Tooling Enhancements**:
    - Upgraded `analyze_local_games.py` with CSV/Markdown reporting, model/winner extraction, and date-range filtering.
    - Generated `docs/local-game-insights-dec-2025.md` with architectural recommendations for the frontend stats engine.
  - **Backend Fixes**:
    - Fixed `SnakeBenchReplayResolver` to scan both `completed_games` and `completed_games_local`, resolving missing replay links in the UI.
    - Fixed broken relative import paths across 7 SnakeBench services (`shared/types.js` level traversal).
    - Aligned `SnakeBenchLlmPlayerPromptTemplate.ts` with new Python source (added web search prohibition).
  - **Author Updates**: Refreshed headers in 8 files to reflect **Gemini 3 Flash High** authorship.
  - **Files Created**:
    - `docs/local-game-insights-dec-2025.md`
    - `external/SnakeBench/local_game_analysis_dec_2025.csv`
  - **Files Modified**:
    - `server/services/snakeBench/SnakeBenchReplayResolver.ts`
    - `server/services/snakeBench/SnakeBenchMatchRunner.ts`
    - `server/services/snakeBench/SnakeBenchStreamingRunner.ts`
    - `server/services/snakeBench/SnakeBenchLlmPlayerPromptTemplate.ts`
    - `server/services/snakeBench/helpers/replayFilters.ts`
    - `server/services/snakeBench/helpers/validators.ts`
    - `server/services/snakeBench/persistence/persistenceCoordinator.ts`
    - `server/services/snakeBenchHallOfFame.ts`
    - `client/src/components/WormArenaGreatestHits.tsx`
    - `client/src/pages/WormArenaDistributions.tsx`
    - `client/src/hooks/useWormArenaGreatestHits.ts`
    - `external/SnakeBench/backend/cli/analyze_local_games.py`

### Version 6.16.0  Dec 27, 2025

- **Architecture: Modularize Arc3Games into per-game files for 100+ game scalability** (Author: Claude Haiku 4.5)
  - **Purpose**: Transform monolithic `shared/arc3Games.ts` (383 lines) into modular, extensible architecture where each game has its own self-contained file. Designed to scale to 100+ games with zero merge conflicts.
  - **Problem Solved**: Monolithic file caused merge conflicts, unclear ownership, poor scalability. Adding game #100 required editing central file.
  - **Solution**: Per-game files with central registry maintaining backward compatibility.
  - **Architecture Changes**:
    - Extracted all TypeScript interfaces to `shared/arc3Games/types.ts`
    - Created per-game files: `ls20.ts`, `as66.ts`, `ft09.ts`, `lp85.ts`, `sp80.ts`, `vc33.ts`
    - Central registry in `shared/arc3Games/index.ts` (maintains 100% backward compatibility)
    - Deleted original monolithic file
  - **New Features**:
    - Added `'replay'` type to `GameResource` interface for expert playthroughs
    - Added Zanthous grandmaster replays:
      - **LP85**: 92 moves completion (https://three.arcprize.org/replay/lp85-d265526edbaa/dcae645c-3fec-4388-b805-7427f8cdb318)
      - **AS66**: 415 moves completion (https://three.arcprize.org/replay/as66-821a4dcad9c2/515e3de3-0b2a-4199-b268-4b1f84d75e10)
  - **UI Enhancements**:
    - Updated `Arc3GameSpoiler.tsx` with new "Notable Playthroughs" section
    - Replays displayed separately from general resources with gradient background styling
    - Replays get visual prominence to highlight expert gameplay
  - **Documentation**:
    - Added `docs/arc3-game-analysis/ls20-analysis.md` - detailed frame-by-frame analysis of LS20 grid patterns and mechanics
    - LS20 game page now includes analysis resource link
  - **Backward Compatibility**: 100% maintained - all existing imports work unchanged
  - **Future Extensibility**: Adding game #100 requires only:
    1. Create `shared/arc3Games/game100.ts`
    2. Add 1 import line in `shared/arc3Games/index.ts`
  - **Files Modified**:
    - `client/src/pages/Arc3GameSpoiler.tsx` (+Notable Playthroughs section, +replay filtering)
    - `shared/arc3Games/` (new directory with 8 files: types, index, 6 games)
    - `docs/arc3-game-analysis/` (new analysis documentation)
  - **Files Deleted**:
    - `shared/arc3Games.ts` (monolithic file replaced by directory structure)
  - **Build Status**: No errors, full production build succeeds

### Version 6.15.0  Dec 27, 2025

- **Architectural Refactor: Monolithic SnakeBench Repository Split** (Author: Gemini 3 Flash High)
  - **Purpose**: Refactored the 2.5k-line monolithic `SnakeBenchRepository.ts` into six focused modules to improve SRP (Single Responsibility Principle), testability, and maintainability.
  - **Terminology Clarification**: Explicitly documented that "Game" and "Match" are used interchangeably across the codebase (DB vs. Frontend) and preserved this parity for compatibility.
  - **External Compatibility**: Maintained 100% compatibility with the original `SnakeBench` database schema and JSON structures.
  - **Key Modules Created**:
    1. `GameWriteRepository.ts`: Handles match recording, replay ingestion, and rating updates (TrueSkill/Elo).
    2. `GameReadRepository.ts`: Handles match search, recent games, global stats, and model history.
    3. `LeaderboardRepository.ts`: Handles TrueSkill/Elo leaderboards and pairing history.
    4. `CurationRepository.ts`: Handles "Greatest Hits" multi-dimension logic.
    5. `AnalyticsRepository.ts`: Handles model insights data and run-length distributions.
    6. `snakebenchSqlHelpers.ts`: Centralizes shared SQL fragments, constants (TrueSkill/Elo), and utility functions.
  - **Integration Changes**:
    - Updated `RepositoryService` to manage the new repository instances and removed the deprecated monolithic reference.
    - Updated `SnakeBenchService`, `SnakeBenchIngestQueue`, `ReplayResolver`, and other consumers to use domain-specific repositories.
    - Updated `adminController` and `backfill` scripts to use split write/read paths.
  - **Maintenance**: Cleaned up the `docs/` folder by moving older implementation plans to `docs/oldPlans/`.
  - **Files Removed**:
    - `server/repositories/SnakeBenchRepository.ts` (Legacy monolith deleted)
  - **Files Created**:
    - `server/repositories/GameWriteRepository.ts`
    - `server/repositories/GameReadRepository.ts`
    - `server/repositories/LeaderboardRepository.ts`
    - `server/repositories/CurationRepository.ts`
    - `server/repositories/AnalyticsRepository.ts`
    - `server/repositories/snakebenchSqlHelpers.ts`
  - **Files Modified**:
    - `server/repositories/RepositoryService.ts`
    - `server/services/snakeBenchService.ts`
    - `server/services/snakeBench.ts`
    - `server/services/snakeBenchIngestQueue.ts`
    - `server/services/snakeBench/SnakeBenchReplayResolver.ts`
    - `server/services/snakeBench/helpers/replayFilters.ts`
    - `server/services/snakeBench/helpers/modelAllowlist.ts`
    - `server/controllers/adminController.ts`
    - `server/routes/models.ts`
    - `server/scripts/snakebench-backfill.ts`

### Version 6.14.0  Dec 27, 2025

- **Data Quality: Exclude invalid zero-round games from all Worm Arena statistics** (Author: Cascade)
  - **Problem**: Games with `rounds = 0` are invalid (failed to start or errored immediately) and were polluting statistics, causing "Most Common: Round 0" in distributions and skewing leaderboards.
  - **Solution**: Added `COALESCE(g.rounds, 0) > 0` filter to all SQL queries that aggregate completed games.
  - **Affected queries** (all in `SnakeBenchRepository.ts`):
    1. `searchMatches` - match search results
    2. `getWormArenaGreatestHits` - duration query
    3. `getPairingHistory` - matchup suggestions
    4. `getBasicLeaderboard` - both winRate and gamesPlayed sorts
    5. `getModelsWithGames` - TrueSkill leaderboard data
    6. `getModelMatchHistoryUnbounded` - per-model match history
    7. `getModelInsightsData` - summary, failure modes, and opponent queries
    8. `getRunLengthDistribution` - game length distribution chart
  - **Impact**: All Worm Arena pages now show accurate statistics excluding invalid matches.
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts` - Added round > 0 filter to 12 SQL queries

- **Simplify: Worm Arena Run Length Chart shows all models by default** (Author: Cascade)
  - Removed per-model selection UI and limits; chart now renders all models simultaneously with stacked wins/losses.
  - Updated empty state copy to reflect data absence rather than thresholds.
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaRunLengthChart.tsx`
    - `client/src/pages/WormArenaDistributions.tsx`

### Version 6.13.4  Dec 27, 2025

- **Simplify: Worm Arena Run Length Chart shows all models by default** (Author: Cascade)
  - Removed per-model selection UI and limits; chart now renders all models simultaneously with stacked wins/losses.
  - Updated empty state copy to reflect data absence rather than thresholds.
  - Header comment refreshed to match new behavior.

### Version 6.13.3  Dec 27, 2025

- **Refactor: Worm Arena Models Page - Modular Sortable Match History** (Author: Claude Sonnet 4)
  - **Purpose**: Remove redundant WormArenaRecentMatches component; create reusable sortable match history table
  - **Changes**:
    1. **Removed**: `WormArenaRecentMatches` from Models page - was duplicating Match History with inferior layout
    2. **Created**: `WormArenaMatchHistoryTable` - new modular, reusable component with rich metrics
    3. **Added sorting**: All columns sortable (Opponent, Date, Duration, Outcome, Score, Rounds, Cost)
    4. **Sortable headers**: Click column headers to sort asc/desc with visual indicators
  - **Component Features** (`WormArenaMatchHistoryTable`):
    - Accepts `history`, `modelSlug`, `isLoading`, `error`, `onOpponentClick` props
    - Optional `showCard` prop to render with/without Card wrapper
    - Clickable opponents to switch model selection
    - Default sort: Date descending (most recent first)
  - **Files Created**:
    - `client/src/components/wormArena/WormArenaMatchHistoryTable.tsx` - Modular sortable table
  - **Files Modified**:
    - `client/src/pages/WormArenaModels.tsx` - Removed inline table, uses new component
  - **Note**: `WormArenaRecentMatches.tsx` still exists but is no longer used on Models page

- **Planning: SnakeBench repository split migration map & test coverage** (Author: Cascade)
  - Added detailed migration map for breaking `SnakeBenchRepository` into GameWrite/GameRead/Leaderboard/Curation/Analytics repos plus shared SQL helpers.
  - Documented helper inventory (slug normalization, limit clamps, date parsing, common WHERE fragments, replay path resolution).
  - Defined unit, golden, and integration test fixtures (parseReplayJson edge cases, TrueSkill/Elo goldens, search/leaderboard/greatest-hits/insights/run-length matrices).
  - Outlined wiring/rollout, backfill/recompute, and rollback plans; listed expected file impacts.
  - **Files Modified**:
    - `docs/2025-12-27-snakebench-repo-refactor-plan.md`

### Version 6.13.2  Dec 27, 2025

- **Fix & Enhancement: Worm Arena Run Length Distribution Chart** (Author: Claude Sonnet 4)
  - **Purpose**: Fix histogram not rendering due to chart design issues; add model selection and summary statistics
  - **Root Cause**: Original chart tried to show all 44 models with 88 bar series (wins+losses each), making bars invisibly thin. Also used per-model stackId which created grouped bars instead of proper stacked histogram.
  - **Fixes**:
    1. **Chart rendering**: Switched from ChartContainer wrapper to direct Recharts ResponsiveContainer to avoid height conflicts
    2. **Proper stacking**: Changed to single `stackId="stack"` so all bars stack together correctly
    3. **Model limiting**: Default to top 5 models (max 8) to prevent bar overcrowding
  - **New Features**:
    1. **Model selection UI**: Collapsible picker with checkboxes to choose which models to visualize
    2. **Quick select buttons**: Top 3, Top 5, Top 8, Clear All for fast model selection
    3. **Summary statistics row**: 6 stat cards showing Models count, Avg Length, Most Common round, Range, Top Win Rate model, Longest Average model
    4. **Distinct color palette**: 8 distinct colors for models with lighter variants for losses
    5. **Improved tooltip**: Shows breakdown per model at each round with color indicators
    6. **Custom legend**: Cleaner display with win/loss color boxes per model
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaRunLengthChart.tsx` - Complete rewrite with proper stacking and model selection
    - `client/src/pages/WormArenaDistributions.tsx` - Added stats row, improved layout with icons, computed statistics
  - **Testing**: Chart now renders correctly with top 5 models visible by default; users can select/deselect models to compare

### Version 6.13.1  Dec 27, 2025

- **Fix: Worm Arena Run Length Distribution page** (Author: Claude Code Haiku 4.5)
  - **Purpose**: Resolve SQL parsing error and low default threshold preventing data display
  - **Issues Fixed**:
    1. SQL query had incorrect JOIN ordering causing "missing FROM-clause entry for table "gp"" error
       - Reorganized FROM clause to start with game_participants (primary data source)
       - Made ORDER BY more explicit using full expressions instead of aliases
    2. Tied games were miscounted as losses in distribution aggregation
       - Now explicitly checks for 'won' vs 'lost' results
       - Tied games excluded from distribution (don't fit binary win/loss model)
    3. Default minimum games threshold was too high (10), preventing data display
       - Lowered default from 10 to 5 games per model
       - Makes page more useful with limited data while still being meaningful
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts` - Fixed SQL query structure, result classification, default threshold
    - `server/services/snakeBenchService.ts` - Updated default minGames parameter
    - `client/src/hooks/useWormArenaDistributions.ts` - Updated default minGames parameter
    - `client/src/pages/WormArenaDistributions.tsx` - Updated default minGames threshold
  - **Testing**: Distribution page now returns data when models have 5+ completed games


### Version 6.13.0  Dec 27, 2025

- **Feature: Worm Arena Tweet Kit & Share Buttons** (Author: Cascade)
  - **Purpose**: Enable easy sharing of Worm Arena matches to Twitter/X with pre-filled tweet text and replay links.
  - **Behavior**:
    - Added `WormArenaShareButton` component with dropdown options: Share on Twitter/X, Copy tweet text, Copy replay link
    - Tweet text auto-generates from match metadata using smart templates (tie, high score, long/expensive, default)
    - Share button added to Greatest Hits card entries and main replay viewer header
    - CLI script `scripts/worm-arena-tweet-kit.ts` for batch tweet generation with optional MP4 video creation
    - Script fetches greatest hits, downloads replays if needed, generates tweet blurbs, and outputs to `tmp/tweet-kit/`
    - npm script: `npm run worm:tweets -- --limit 5 [--video]`
  - **Files Created**:
    - `client/src/components/WormArenaShareButton.tsx` - Reusable share button component
    - `scripts/worm-arena-tweet-kit.ts` - CLI tool for batch tweet generation
  - **Files Modified**:
    - `client/src/components/WormArenaGreatestHits.tsx` - Added share buttons to game entries
    - `client/src/pages/WormArena.tsx` - Added share button to match header
    - `package.json` - Added `worm:tweets` npm script

### Version 6.12.3  Dec 27, 2025

- **Feature: Greatest Hits include monster apple hauls** (Author: Cascade)
  - **Purpose**: Surface memorable matches where a single player collected 25+ apples.
  - **Behavior**:
    - Added apples-haul leaderboard dimension (25+ apples by any player) to greatest-hits query and highlight messaging.
    - Greatest Hits card copy now mentions monster apple hauls.
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts`
    - `client/src/components/WormArenaGreatestHits.tsx`

### Version 6.12.2  Dec 27, 2025

- **Fix: Worm Arena live status strip correctness & UX** (Author: Cascade)
  - **Purpose**: Make live streaming status readable and accurate: apples, alive list, timers, names, and session copying.
  - **Behavior**:
    - Added copy-to-clipboard button for session ID; keeps layout tidy with truncation and spacing.
    - Alive/scores duplicated data removed from the strip; strip now focuses on round, wall clock, since-last-move, phase, and session copy.
    - Alive list still derives from live alive-map (with fallbacks) and scores parse from frames/status text for other components (scoreboard).
    - Wall clock and since-last-move timers computed from frame timestamps to populate timing fields (shared with scoreboard).
    - Player rows removed from the strip to prevent overlap; scoreboard holds names/scores.
  - **Files Modified**:
    - `client/src/components/WormArenaLiveStatusStrip.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/components/WormArenaLiveScoreboard.tsx`

### Version 6.12.1  Dec 27, 2025

- **Feature: Worm Arena Greatest Hits Enhanced Ranking Dimensions** (Author: Claude Code Sonnet 4.5)
  - **Purpose**: Extend greatest-hits ranking with 3 new dimensions (duration, total score, close matches) to surface more types of interesting games.
  - **Behavior**:
    - Added 3 new SQL queries to repository: duration (wall-clock time), total score (combined apples from both players), close matches (score delta ≤ 2, min 5 apples)
    - All 6 queries run in parallel via `Promise.all()` for optimal performance
    - Updated deduplication logic to handle 6 dimensions and assign category-specific highlight reasons
    - New highlight reasons include: "Marathon duration (Xh Ym)", "Epic combined score (X apples)", "Perfect tie", "Photo finish (1 apple difference)", "Neck-and-neck (X apple difference)"
    - Frontend component now displays duration badges ("Duration: 2h 15m") and total score badges ("32 total apples") when data is available
    - Optional fields added to `WormArenaGreatestHitGame` interface: `endedAt`, `sumFinalScores`, `durationSeconds`, `category` (all backward-compatible)
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts:706-1072` - Added 3 new SQL queries, updated deduplication logic
    - `shared/types.ts:903-921` - Added 4 new optional fields to `WormArenaGreatestHitGame` interface
    - `client/src/components/WormArenaGreatestHits.tsx:150-227` - Added duration and total score badges
    - `server/services/snakeBenchHallOfFame.ts:1-24` - Updated header comment documenting new optional fields
  - **Files Deleted**:
    - `external/SnakeBench/backend/cli/generate_greatest_hits_report.py` - Functionality integrated into database-driven system
  - **Performance Note**: If queries are slow (>200ms), consider adding database indexes:
    ```sql
    CREATE INDEX IF NOT EXISTS idx_games_duration ON public.games(end_time, start_time) WHERE status = 'completed' AND end_time IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_game_participants_score ON public.game_participants(game_id, score);
    ```

### Version 6.12.0  Dec 27, 2025

- **Feature: ARC3 Auto-Discovered Level Screenshots** (Author: Cascade)
  - **Purpose**: Automatically discover and include PNG level screenshots for ARC-AGI-3 games without manual hardcoding.
  - **Behavior**:
    - Scans `client/public` folder for PNG files matching pattern `{gameId}-lvl{levelNumber}.png` or `{gameId}-lvl{levelNumber}{suffix}.png`
    - Automatically generates level screenshot metadata with proper sorting and variant handling (e.g., `as66-lvl6a.png` becomes "Variant A")
    - Provides new API endpoints: `/api/arc3/metadata/games`, `/api/arc3/metadata/games/:gameId`, `/api/arc3/metadata/games/:gameId/screenshots`
    - Supports all existing games: ls20, as66, ft09, lp85, sp80, vc33
  - **Files Modified**:
    - `server/services/arc3ScreenshotService.ts` (NEW)
    - `server/routes/arc3.ts` (added metadata endpoints)
    - `shared/arc3Games.ts` (reverted hardcoded arrays to manual entries for now)

### Version 6.11.1  Dec 25, 2025

- **UI: Worm Arena Greatest Hits pinned matches** (Author: Cascade)
  - **Purpose**: Highlight recent standout Worm Arena battles for quick replay access.
  - **Behavior**:
    - Added pinned replays for Grok 4.1 Fast vs GLM 4.7 (24-21, 94 rounds, high cost), GPT-5 Nano vs GPT-5.1 Codex Mini (21-20, 90 rounds), Nemotron 3 Nano vs GPT-5.1 Codex Mini (11-10, 53 rounds), DeepSeek v3.2 vs GPT-5 Nano (15-15 tie, 77 rounds), and Gemini 2.5 Flash vs DeepSeek v3.2 (18-11, 58 rounds).
    - Pinned entries are merged with fetched greatest hits and surface at the top of the list with replay links.
  - **Files Modified**:
    - `client/src/components/WormArenaGreatestHits.tsx`

### Version 6.11.0  Dec 25, 2025

- **Feature: BYOK Production Enforcement** (Author: Claude Sonnet 4)
  - **Purpose**: Enforce Bring Your Own Key (BYOK) policy in production - users must provide their own API keys for all paid AI providers.
  - **Behavior**:
    - Production: ALL models require user-provided API keys (no server key fallback)
    - Dev/staging: Existing behavior preserved (server keys allowed as fallback)
  - **Backend Changes**:
    - Created `server/utils/environmentPolicy.ts` - environment detection utility with `requiresUserApiKey()`, `isProduction()`, `isDevelopment()` helpers
    - Updated `poetiqController.ts` - environment-aware BYOK enforcement
    - Updated `snakeBenchController.ts` - production API key requirement for matches
    - Updated `streamController.ts` - production API key requirement for puzzle analysis
  - **Frontend Changes**:
    - Created `client/src/lib/environmentPolicy.ts` - client-side environment detection
    - Updated `client/src/lib/streaming/analysisStream.ts` - added `apiKey` to `AnalysisStreamParams`
    - Updated `client/src/hooks/useAnalysisResults.ts` - pass `apiKey` through to streaming
    - Updated `client/src/pages/PuzzleExaminer.tsx` - added BYOK API key input card (production only)
  - **Security**: User keys are used for session only, never stored persistently

### Version 6.10.13  Dec 25, 2025

- **Fix: Worm Arena Live score display disconnected from streaming data** (Author: Claude Haiku 4.5)
  - **Purpose**: Fix score showing "0" across all UI panels despite correct data in streaming output.
  - **Root Cause**: Snake ID extraction prioritized `playerNameBySnakeId`/`reasoningBySnakeId` (populated from chunks) over `frame.state.scores` (source of truth). When chunk metadata used different keys than frame state, scores failed to resolve.
  - **Behavior**:
    - Prioritize `frame.state.scores` keys as primary source for snake IDs (ensures we extract scores from the correct keys)
    - Move score display from bottom of reasoning panels to header (inline with player name and worm icon)
    - Removed duplicate score section at panel bottom
  - **Files Modified**:
    - `client/src/pages/WormArenaLive.tsx` (snakeIds extraction logic, lines 445-470)
    - `client/src/components/WormArenaReasoning.tsx` (score repositioned to header, removed bottom score panel)

### Version 6.10.12  Dec 25, 2025

- **Fix: GPT-5/o-series models must route directly to OpenAI in Worm Arena** (Author: Claude Sonnet 4)
  - **Purpose**: Fix "OpenRouter response missing output field" error for GPT-5 and o-series models.
  - **Root Cause**: OpenRouter's Responses API proxy returns empty `output=[]` for GPT-5/o-series models. These models require the Responses API which OpenRouter does not properly proxy.
  - **Behavior**: Added `_requires_responses_api()` helper to detect GPT-5/o-series models. Factory now routes these models directly to OpenAI regardless of explicit `provider: openrouter` config. Raises clear error if OPENAI_API_KEY is missing.
  - **Mixed Matchups**: GPT-5.1-Codex-Mini vs Minimax 2.1 now works correctly - each player gets appropriate provider (OpenAI direct vs OpenRouter).
  - **Files Modified**:
    - `external/SnakeBench/backend/llm_providers.py` - Added routing fix and helper function

### Version 6.10.11  Dec 25, 2025

- **Fix: Worm Arena OpenRouter transforms routing** (Author: Codex (GPT-5))
  - **Purpose**: Stop OpenRouter-only `transforms` from breaking OpenAI SDK calls while preserving Worm Arena defaults.
  - **Behavior**: Routes OpenRouter `transforms` via `extra_body`, strips them for OpenAI direct, and documents the Worm Arena integration note.
  - **Files Modified**:
    - `external/SnakeBench/backend/llm_providers.py`
    - `external/SnakeBench/README.md`
    - `external/SnakeBench/CHANGELOG.md`

### Version 6.10.10  Dec 24, 2025

- **UI: Improve grid size label readability on analysis cards** (Author: Cascade)
  - **Purpose**: Keep grid dimension badges and titles legible against warm gradients and dark shells.
  - **Behavior**: Forced black text on puzzle grid titles and size badges with a white badge background and dark border for reliable contrast.
  - **Files Modified**:
    - `client/src/components/puzzle/PuzzleGrid.tsx`

### Version 6.10.9  Dec 24, 2025

- **Ops: OpenRouter tournament script for new Seed/GLM/Minimax models** (Author: Cascade)
  - **Purpose**: Queue WormArena matches round-robin among new models and against baselines with optional async and completion logging.
  - **Behavior**: Runs both-direction pairings for seed 1.6 variants, minimax m2.1, glm 4.7, and “oops” slug versus each other and baselines (GPT-5.1 Codex Mini, GPT-5 Mini, GPT-5 Nano, Grok 4.1 Fast, Devstral 2512, DeepSeek v3.2). Adds async job tracking and completion summary.
  - **Files Modified**:
    - `scripts/worm-arena-tournaments/run-paid-devstral-matches.ps1`

### Version 6.10.7  Dec 24, 2025

- **Chore: Root cleanup for legacy scripts and media** (Author: Cascade)
  - **Purpose**: Reduce clutter by grouping Johan_Land verification scripts, archival docs, and media blobs into scoped folders.
  - **Work**:
    - Created `scripts/legacy-johan-land/README.md` and relocated all Johan_Land DB check `.mjs` utilities there.
    - Added `docs/archives/` and moved historical docs (AGENTS-OLD.md, oldCLAUDE.md) plus misc temp notes into purpose-built directories.
    - Introduced `media/reference/` and moved multi-GB MP3/MP4 recordings out of the repo root.
  - **Impact**: Root directory now surfaces only actively maintained assets; legacy tooling remains available under a documented folder.

### Version 6.10.6  Dec 24, 2025

- **UI: Dark theme analysis cards and larger Puzzle Analyst typography** (Author: Codex (GPT-5))
  - **Purpose**: Make expanded analysis cards blend into the dark Puzzle Analyst view and improve readability.
  - **Behavior**:
    - Added a dark theme option to `AnalysisResultCard` and applied it within Puzzle Analyst.
    - Added dark theme variants to analysis card subcomponents and feedback sections.
    - Increased header and row font sizes in Puzzle Analyst for easier scanning.
  - **Files Modified**:
    - `client/src/components/puzzle/AnalysisResultCard.tsx` - Theme wrapper and dark palette for the card shell.
    - `client/src/components/puzzle/AnalysisResultHeader.tsx` - Dark variants for badges and controls.
    - `client/src/components/puzzle/AnalysisResultContent.tsx` - Dark variants for reasoning, prompts, and alerts.
    - `client/src/components/puzzle/AnalysisResultActions.tsx` - Dark variants for feedback panel text.
    - `client/src/components/puzzle/AnalysisResultMetrics.tsx` - Dark variants for Saturn metrics panels.
    - `client/src/components/ExplanationFeedback.tsx` - Dark variants for feedback form styling.
    - `client/src/components/feedback/FeedbackViewer.tsx` - Dark variants for feedback list cards.
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Larger row typography and dark card theme usage.
    - `client/src/pages/PuzzleAnalyst.tsx` - Larger typography and updated column widths.
    - `client/src/types/puzzle.ts` - Added the AnalysisResultCard theme prop.
    - `docs/2025-12-24-puzzle-analyst-layout-plan.md` - Documented the dark card and typography update.

### Version 6.10.5  Dec 24, 2025

- **Layout: Remove sticky headers and render PNG thumbnails in Puzzle Analyst** (Author: Codex (GPT-5))
  - **Purpose**: Eliminate header overlap while making grid previews smaller, more zoomed out, and consistently rendered on black mats.
  - **Behavior**:
    - Removed sticky header layers so the column header and page header no longer overlay rows.
    - Generated client-side PNG thumbnails with extra padding for a zoomed-out grid preview.
    - Tightened row typography and spacing to keep metadata dense but readable.
  - **Files Modified**:
    - `client/src/pages/PuzzleAnalyst.tsx` - Removed sticky header logic and tightened column header spacing.
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Added canvas-based PNG thumbnails and reduced row padding.
    - `docs/2025-12-24-puzzle-analyst-layout-plan.md` - Recorded sticky header removal and PNG thumbnail approach.

### Version 6.10.4  Dec 24, 2025

- **Fix: Restore multi-test grid previews and expected outputs in Puzzle Analyst** (Author: Codex (GPT-5))
  - **Purpose**: Ensure multi-test explanations show stacked previews and expanded cards always include expected outputs with working mismatch toggles.
  - **Behavior**:
    - Added stacked grid previews that fall back to multi-test predictions when single grids are missing.
    - Passed puzzle test cases into `AnalysisResultCard` so expected outputs and mismatch diffs render.
    - Added the missing `multiTestPredictionGrids` type so stacked previews compile cleanly.
    - Tightened padding, clarified token/time labels, and reduced thumbnail size on black backgrounds.
    - Solidified the column header background and moved the grid container closer to the sticky header.
  - **Files Modified**:
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Stacked preview selection and test case wiring for expanded cards.
    - `client/src/pages/PuzzleAnalyst.tsx` - Supplies test cases from puzzle data to each row.
    - `docs/2025-12-24-puzzle-analyst-layout-plan.md` - Documented the multi-test grid handling update.

### Version 6.10.3  Dec 24, 2025

- **Layout: Refresh Puzzle Analyst grid density** (Author: Codex (GPT-5))
  - **Purpose**: Tighten the Puzzle Analyst presentation to match the high-density reference: align column widths, show cost/tokens/latency in a single header, and keep the details tucked behind expandable rows.
  - **Behavior**:
    - Added summary badges to the sticky header so analysts immediately see all/correct/incorrect counts.
    - Rebuilt `ExplanationGridRow` to show the grid thumbnail, model metadata, cost, latency, tokens, and Badges for status/reasoning without overlapping content.
    - Updated column headers and container styling so the grid lines match the row layout and the page keeps a compact, futuristic feel.
    - Adjusted sticky offsets so the Puzzle Analyst header respects the global AppHeader height and does not overlap row content.
  - **Files Modified**:
    - `docs/2025-12-24-puzzle-analyst-layout-plan.md` - Documented the layout refresh approach and file responsibilities before coding.
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Dense metadata header, status badges, tokens/cost formatting, and revised expand region.
    - `client/src/pages/PuzzleAnalyst.tsx` - Sticky header counts, new column widths, and heavier dark styling around the grid container.

### Version 6.10.2  Dec 21, 2025

- **Fix: Handle malformed boolean data in multiplePredictedOutputs field** (Author: Cascade)
  - **Root Cause**: Existing database records contained boolean values for `multiplePredictedOutputs` instead of expected array/object/null
  - **Symptom**: "[WARN][utilities] Unexpected type for multiplePredictedOutputs: boolean" warnings on puzzle explanations API calls
  - **Solution**: Enhanced `safeJsonParse()` in `CommonUtilities.ts` to gracefully handle boolean values by treating them as malformed data and returning null
  - **Impact**: Eliminates warnings and prevents potential crashes when reading legacy malformed data
  - **Backwards Compatible**: System continues functioning normally with existing bad data
  - **Files Modified**:
    - `server/utils/CommonUtilities.ts` - Added boolean handling in safeJsonParse function
  - **Prevention**: Future writes now properly sanitize boolean values in explanationService.ts

### Version 6.10.1  Dec 21, 2025

- **Fix: Complete navigation URL migration from /puzzle/ to /task/** (Author: Claude Code using Sonnet 4.5)
  - **Purpose**: Finalize URL migration to ensure all internal navigation uses new /task/ routes
  - **Files Updated**:
    - `client/src/components/puzzle/PuzzleTradingCard.tsx` - Trading card "View Details" link
    - `client/src/components/model-examiner/ExaminerActivity.tsx` - Activity log puzzle navigation
    - `client/src/components/poetiq/PuzzleProgressGrid.tsx` - Grid cell window.open navigation
    - `client/src/pages/BeetreeSolver.tsx` - Back button navigation
    - `client/src/pages/GroverSolver.tsx` - Back button navigation  
    - `client/src/pages/ModelDebate.tsx` - "Generate First Explanation" navigation
    - `client/src/pages/PuzzleDiscussion.tsx` - Multiple navigation links (2 locations)
    - `client/src/pages/FeedbackExplorer.tsx` - Puzzle and explanation navigation links (2 locations)
    - `client/src/components/puzzle/AnalysisResultHeader.tsx` - Copy link share feature
  - **Impact**: All internal navigation now consistently uses /task/ routes, completing the migration

### Version 6.10.0  Dec 21, 2025

- **Feature: Puzzle Analyst - New high-density grid page for analyzing explanations** (Author: Claude Code using Haiku 4.5)
  - **Purpose**: Read-only, analysis-focused interface for browsing and comparing hundreds of AI-generated explanations for a single puzzle
  - **Design**: Dark futuristic theme with high-information-density grid layout (contrasts with warm PuzzleExaminer)
  - **Behavior**:
    - Default puzzle navigation now routes to `/task/:taskId` (Puzzle Analyst) instead of `/puzzle/:taskId` (PuzzleExaminer)
    - Shows all explanations for a puzzle in compact rows with: predicted grid thumbnail, model name, status badge, cost, timestamp, reasoning indicator, token count
    - Clicking a row expands inline to show full `AnalysisResultCard` with detailed analysis
    - Lazy-loads full explanation data on first expand via `fetchExplanationById`
    - Supports scrolling through hundreds of explanations (no pagination)
  - **Architectural Notes**:
    - New page component with dedicated row component (`ExplanationGridRow`)
    - Reuses existing `TinyGrid`, `AnalysisResultCard`, and `usePaginatedExplanationSummaries` hook
    - SRP/DRY: Page handles layout; row handles single row rendering; data fetching via existing APIs
    - No model selection or prompt controls (read-only mode)
  - **Breaking Change**: All puzzle navigation links now point to `/task/:taskId` (new Puzzle Analyst) by default
    - PuzzleExaminer still accessible via direct URL `/puzzle/:taskId` if needed
    - Updated 10+ navigation components across the codebase
  - **Files Created**:
    - `client/src/pages/PuzzleAnalyst.tsx` - Main page component
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Row renderer with expand/collapse
  - **Files Modified**:
    - `client/src/App.tsx` - Added import and route for PuzzleAnalyst
    - `client/src/components/ui/ClickablePuzzleBadge.tsx` - Navigation route change
    - `client/src/components/overview/PuzzleList.tsx` - Navigation route change
    - `client/src/components/analytics/DifficultPuzzlesSection.tsx` - Navigation route change
    - `client/src/components/feedback/FeedbackSummary.tsx` - Navigation route change
    - `client/src/components/puzzle/CompactPuzzleCard.tsx` - Navigation route change
    - `client/src/components/puzzle/ChallengePuzzleCard.tsx` - Navigation route change
    - `client/src/pages/PuzzleBrowser.tsx` - Navigation route change
    - `CHANGELOG.md`

### Version 6.9.22  Dec 21, 2025

- **Fix: Worm Arena context overflow for reasoning models** (Author: Claude Haiku 4.5)
  - **Problem**: OpenRouter models hitting 400k token context limit (461,156 tokens requested)
  - **Root Cause**: Reasoning models generate extremely verbose rationales (400k+ tokens), which get included in next turn's prompt, causing exponential growth per turn
  - **Solution**: Multi-layered approach:
    1. **OpenRouter middle-out transform**: Enables OpenRouter's automatic prompt compression feature (intelligently compresses prompts on their side)
    2. **Output token limits**: Set `max_output_tokens: 16000` for reasoning models to prevent explosive rationale generation
    3. **Rationale truncation**: Truncates rationales to 10,000 chars for prompts (80/20 split preserves context), but preserves full text in `move_history` for replay files
    4. **Prompt monitoring**: Warns when prompts exceed 100k tokens for early detection
  - **Impact**: Games that previously crashed mid-match with context errors will now complete successfully
  - **Data Preservation**: Full verbose rationales still saved to replay JSON files for post-game analysis
  - **Backwards Compatible**: All features opt-in/enabled by default, can be disabled via config
  - **Files Modified**:
    - `external/SnakeBench/backend/llm_providers.py` (lines 183-186, 222-225) - Added middle-out transform and output token limits
    - `external/SnakeBench/backend/players/llm_player.py` (lines 107-131, 163, 50-53) - Added truncation method and prompt monitoring
    - `external/SnakeBench/backend/players/llm_player_a.py` (lines 114-138, 171, 53-56) - Same changes for variant A player

### Version 6.9.21  Dec 20, 2025

- **Fix: OpenRouter Responses API max_output_tokens requirement** (Author: Claude Code)
  - **Issue**: OpenRouter updated Responses API proxy to require explicit `max_output_tokens` for reasoning models
  - **Symptom**: gpt-5.1-codex-mini returned empty `output=[]` array despite input being processed
  - **Root Cause**: `max_output_tokens` was never set in player config for OpenAI/xAI models
  - **Fix**: Added `config["max_output_tokens"] = 16000` for models starting with "openai/" or "x-ai/"
  - **Impact**: SnakeBench/Worm Arena matches with gpt-5.1-codex-mini will now generate output
  - **Files Modified**:
    - `server/python/snakebench_runner.py` (line 112)
    - `CHANGELOG.md`

### Version 6.9.20  Dec 20, 2025

- **Worm Arena: Add OpenAI summary paragraph to the model insights report** (Author: Codex (GPT-5))
  - **Behavior**: Report now calls OpenAI Responses API (gpt-5-nano-2025-08-07) to write a short summary
  - **Fallback**: Report still renders stats if the LLM summary fails
  - **Fix**: Summary request now matches Responses API input block format with instruction text and
    reasoning summary fallback parsing
  - **UI**: Inline summary block added to the Models page report card
  - **Docs**: Updated `docs/reference/data/WormArena_Model_Insights_Report.md`
  - **Files Created**:
    - `docs/plans/2025-12-20-worm-arena-model-insights-llm-summary-plan.md`
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `shared/types.ts`
    - `client/src/components/wormArena/WormArenaModelInsightsReport.tsx`
    - `docs/reference/data/WormArena_Model_Insights_Report.md`
    - `CHANGELOG.md`

### Version 6.9.19  Dec 20, 2025

- **Worm Arena: Add per-model actionable insights report with copy, save, and Twitter share actions** (Author: Codex (GPT-5))
  - **New API**: `GET /api/snakebench/model-insights?modelSlug=...` for full-history insights per model
  - **UI**: Inline report on `/worm-arena/models` with failure modes, cost efficiency, and opponent pain points
  - **Docs**: Added `docs/reference/data/WormArena_Model_Insights_Report.md`
  - **Files Created**:
    - `client/src/components/wormArena/WormArenaModelInsightsReport.tsx`
    - `docs/reference/data/WormArena_Model_Insights_Report.md`
    - `docs/plans/2025-12-20-worm-arena-model-insights-report-plan.md`
  - **Files Modified**:
    - `client/src/pages/WormArenaModels.tsx`
    - `client/src/hooks/useWormArenaModels.ts`
    - `server/controllers/snakeBenchController.ts`
    - `server/services/snakeBenchService.ts`
    - `server/repositories/SnakeBenchRepository.ts`
    - `server/routes.ts`
    - `shared/types.ts`
    - `CHANGELOG.md`

### Version 6.9.18  Dec 20, 2025

- **SnakeBench: Add player variant system for A/B testing different LLM prompts** (Author: Cascade)
  - **Purpose**: Enable experimentation with different prompt strategies to improve LLM snake performance
  - **Architecture**: Modular registry pattern - add new variants by creating `llm_player_x.py` and registering in `variant_registry.py`
  - **New variant**: `LLMPlayerA` with tactical "cheat sheet" prompt featuring:
    - Structured decision checklist (safety-first elimination process)
    - Clearer turn context section
    - Same rules and output contract as baseline (verbatim)
  - **Status**: Variant support is present but currently **not enabled** in ARC Explainer runtime (baseline prompt remains in use)
  - **Files Created**:
    - `external/SnakeBench/backend/players/llm_player_a.py` - Variant A player class
    - `external/SnakeBench/backend/players/variant_registry.py` - Registry mapping variant keys to classes
  - **Files Modified**:
    - `external/SnakeBench/backend/players/__init__.py` - Export new classes and registry
    - `external/SnakeBench/backend/main.py` - (Dormant) wiring kept off; baseline `LLMPlayer` remains active
    - `server/python/snakebench_runner.py` - (Dormant) no playerVariant fields passed to Python
    - `server/services/snakeBench/helpers/validators.ts` - (Dormant) no playerVariant fields in payload
    - `shared/types.ts` - (Dormant) no playerVariant fields in request types
  - **Extensibility**: To add variant B/C/D: create `llm_player_b.py`, add entry to `PLAYER_VARIANT_LOADERS` in registry

### Version 6.9.17  Dec 20, 2025

- **Worm Arena: Add Rules & LLM prompt transparency page + API endpoint** (Author: Cascade)
  - **New UI**: `/worm-arena/rules` page that shows:
    - Human-readable rules summary
    - Canonical TypeScript prompt template with placeholders (B2)
    - Live-extracted Python prompt builder block and raw source (B1)
  - **New public API**: `GET /api/snakebench/llm-player/prompt-template`
    - Returns both B1 and B2 representations so the UI is always truthful
    - Includes `APPLE_TARGET` parsed from SnakeBench Python constants when available
  - **Verification**: Added a drift-detection test that fails if the canonical fixed rules lines stop matching `llm_player.py`
  - **Files Created**:
    - `client/src/pages/WormArenaRules.tsx`
    - `server/services/snakeBench/SnakeBenchLlmPlayerPromptTemplate.ts`
    - `tests/snakeBenchLlmPlayerPromptTemplate.test.ts`
  - **Files Modified**:
    - `client/src/App.tsx`
    - `client/src/pages/WormArena.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/pages/WormArenaMatches.tsx`
    - `client/src/pages/WormArenaModels.tsx`
    - `client/src/pages/WormArenaStats.tsx`
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `server/controllers/snakeBenchController.ts`
    - `server/routes.ts`
    - `shared/types.ts`

### Version 6.9.16  Dec 20, 2025

- **SnakeBench: Enable GitHub replay auto-publish workflow** (Author: Claude Haiku 4.5)
  - **Problem**: Replay publishing to GitHub was implemented but missing required environment variables, so games never pushed to VoynichLabs/SnakeBench repo
  - **Solution**: Added explicit environment variable configuration for GitHub publishing (token, owner, repo, branch, replay directory)
  - **Context**: Completed games are written locally to `external/SnakeBench/backend/completed_games_local`, then published to public `VoynichLabs/SnakeBench/backend/completed_games` via GitHub API for Railway and other deployments
  - **Files Modified**:
    - `.env` - Added `SNAKEBENCH_GITHUB_OWNER`, `SNAKEBENCH_GITHUB_REPO`, `SNAKEBENCH_GITHUB_BRANCH`, `SNAKEBENCH_GITHUB_REPLAY_DIR` configuration
    - `README.md` - Added 30-40 word explanation of replay publishing pipeline
  - **Going Forward**: All new games will auto-publish to GitHub; existing unpushed games from Dec 15-20 remain local

### Version 6.9.15  Dec 20, 2025

- **Worm Arena: Improve navigation to Model Match History + add direct API JSON links** (Author: Claude Sonnet 4)
  - **UX**: Added "Models" tab to Worm Arena header nav across Replay/Live/Matches/Stats/Skill pages
  - **API navigation**: Models page now includes one-click links to open:
    - `/api/snakebench/models-with-games`
    - `/api/snakebench/model-history-full?modelSlug=...`
  - **Files Modified**:
    - `client/src/pages/WormArena.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/pages/WormArenaMatches.tsx`
    - `client/src/pages/WormArenaStats.tsx`
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/pages/WormArenaModels.tsx`

### Version 6.9.14  Dec 19, 2025

- **Reference Material: Add Patrick Spencer's minireason project** (Author: Claude Haiku 4.5)
  - **Added**: Link to minireason symbolic reasoning benchmark (https://github.com/pwspen/minireason/tree/main)
  - **Context**: Simple, extensible symbolic reasoning benchmark with configurable difficulty knobs
  - **Files Modified**:
    - `client/src/components/browser/ReferenceMaterial.tsx` - Added minireason link alongside existing objarc entry in Tools & Solvers section

### Version 6.9.13  Dec 19, 2025

- **Worm Arena: Add Model Match History page** (Author: Claude Sonnet 4)
  - **Feature**: New `/worm-arena/models` page to browse every game a specific model has played
  - **Mirrors**: External SnakeBench `/models/[id]` page functionality
  - **Key behavior**: Model picker only lists models that have actually played games (no empty results)
  - **Backend**:
    - `GET /api/snakebench/models-with-games` - Returns only models with games played
    - `GET /api/snakebench/model-history-full?modelSlug=...` - Returns ALL matches (unbounded)
  - **Frontend**:
    - Model selector dropdown with games count and win rate
    - Stats header (total matches, win rate, rating, apples eaten, total cost)
    - Full match history table with opponent, date, duration, outcome, death reason, score, cost
    - Click opponent to switch to their match history
    - "View Replay" link to watch any game
  - **Files Created**:
    - `client/src/pages/WormArenaModels.tsx` - Main page component
    - `client/src/hooks/useWormArenaModels.ts` - Data fetching hooks
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts` - Added `getModelsWithGames()` and `getModelMatchHistoryUnbounded()`
    - `server/services/snakeBenchService.ts` - Added service methods
    - `server/controllers/snakeBenchController.ts` - Added controller endpoints
    - `server/routes.ts` - Added routes
    - `client/src/App.tsx` - Added route and import
    - `shared/types.ts` - Added `WormArenaModelWithGames` type

### Version 6.9.12  Dec 19, 2025

- **Worm Arena Greatest Hits: Fix refresh and add dynamic ranking** (Author: Claude Haiku 4.5)
  - **Problem**: Greatest hits matches weren't refreshing with new interesting games; users saw stale curated list from Dec 11
  - **Solution**:
    1. Added 5 new dynamically-discovered high-interest games to curated hall of fame (Dec 18, 2025 matches)
    2. Implemented dynamic DB-driven ranking with graceful fallback to curated list
  - **New Games Added** (Dec 18, 2025):
    - `5a632478-e6c5-45df-9f6e-c5981f1eb66e` - Epic marathon duel (93/150 rounds, decisive 21-12 finish)
    - `d51f5e45-b148-4adc-b8e1-ab97ec34d8a0` - Highest-scoring match (23 apples with competitive 4-apple finish)
    - `fc95a52a-ecbb-4332-868f-e0810e3afd26` - Photo finish Gemini vs GPT-5.2 (21-20 with high cost signal ~$1.79)
    - `d24ac1c2-d4eb-42f8-8064-11dab8cc705a` - Kimi-K2 vs Gemini with extreme 3.7+ hour replay duration
    - `cdb63849-9ad8-48f0-8548-ae8fb4e80953` - Zero-cost duel (88 rounds, 18-16 apples)
  - **Architecture**: Service now tries dynamic DB ranking first via `SnakeBenchRepository.getWormArenaGreatestHits()`, falls back to curated list if DB unavailable
  - **Files Modified**:
    - `server/services/snakeBench/snakeBenchHallOfFame.ts` - Added 5 new games with meaningful highlight reasons
    - `server/services/snakeBench/helpers/replayFilters.ts` - Implemented two-tier strategy (dynamic DB + curated fallback)
  - **Verification**: Build and server startup successful; endpoint logic maintains backward compatibility

### Version 6.9.11  Dec 19, 2025

- **Worm Arena: Improve live board worm head visualization** (Author: Claude Haiku 4.5)
  - **Problem**: Live board always showed right arrow (➡️) for worm head, regardless of actual movement or lack of direction data
  - **Solution**: Updated head emoji logic to show direction arrows only before worm has body, then 🐛 once body grows
  - **Behavior**:
    - Just a head (no body): Directional arrows (⬆️ ⬇️ ⬅️ ➡️) based on movement
    - Has a body: Worm emoji (🐛) for clear worm identification
  - **Files Modified**:
    - `client/src/components/WormArenaGameBoard.tsx` - Updated `getHeadEmoji()` logic and call sites

### Version 6.9.10  Dec 19, 2025

- **Worm Arena: Fix suggested matchups refresh issue** (Author: Cascade)
  - **Problem**: Suggested matchups showed stale "unplayed pairing" results for days despite hundreds of matches played
  - **Root Cause**: Key normalization mismatch between database query and matchup suggestions logic
    - Database query uses `LEAST()`/`GREATEST()` functions with `:free` suffix removal
    - Matchup suggestions used simple alphabetical comparison without suffix removal
    - This created different keys for the same model pair, preventing proper filtering
  - **Fix**: Updated `pairKey()` function in `matchupSuggestions.ts` to match database normalization
  - **Additional**: Added `/api/snakebench/ingest-queue-status` endpoint for debugging queue delays
  - **Files Modified**:
    - `server/services/snakeBench/helpers/matchupSuggestions.ts` - fixed key normalization
    - `server/controllers/snakeBenchController.ts` - added ingest queue status endpoint
    - `server/routes.ts` - added route for ingest queue status
    - `client/src/hooks/useWormArenaSuggestMatchups.ts` - fixed useEffect dependency

### Version 6.9.9  Dec 19, 2025

- **SnakeBench Service: Complete modular refactoring** (Author: Cascade)
  - **Accomplishment**: Transformed monolithic 1687-line service into 14 focused modules
  - **Architecture**: Main `snakeBenchService.ts` now serves as thin orchestrator
  - **Benefits**: Improved maintainability, testability, and separation of concerns
  - **Preservation**: All 19 public methods maintain identical signatures and behavior
  - **Quality**: Comprehensive headers, JSDoc, and comments throughout all modules
  - **Status**: Code refactoring complete, testing and deployment pending
  - **Files Modified**:
    - `server/services/snakeBenchService.ts` - rewritten as orchestrator
    - `server/services/snakeBench/` - 14 new focused modules created
  - **Documentation**: See `docs/2025-12-19-snakebench-service-refactor.md` for full details

### Version 6.9.8  Dec 19, 2025

- **Worm Arena: Simplify replay loading - server always returns data directly** (Author: Claude Sonnet 4)
  - **Problem**: Complex client-side URL fetching with CORS fallbacks was unreliable
  - **Solution**: Server now ALWAYS fetches replay data server-side and returns `{data}` directly
    - Matches how the Python SnakeBench project serves replays - simple and direct
    - No more client-side URL fetching or CORS issues
  - **Resolution order in getGame()**:
    1. Local file from database replay_path
    2. Local file at standard path (completed_games/snake_game_<id>.json)
    3. Remote URL from database replay_path (fetched server-side)
    4. Railway backend fallback (fetched server-side)
    5. GitHub raw fallback (fetched server-side)
  - **Files Modified**:
    - `server/services/snakeBenchService.ts` - getGame() always fetches server-side
    - `server/controllers/snakeBenchController.ts` - simplified response format
    - `client/src/hooks/useSnakeBench.ts` - removed complex fallback logic
  - **Note**: VoynichLabs/SnakeBench is our fork with 1244 replay JSONs committed

### Version 6.9.7  Dec 19, 2025

- **Worm Arena: Fix replay existence check to accept HTTP URLs from database** (Author: Claude Sonnet 4)
  - **Root Cause**: Commit `c3b3379a` broke replays by "simplifying" `replayExists()` to ignore HTTP URLs
    - The bug was line: `if (dbReplay?.replayPath && !dbReplay.replayPath.startsWith('http'))`
    - This explicitly skipped all remote replay URLs stored in the DB
    - Games with remote replays (most of them) were filtered out as "non-existent"
  - **Fix**: `replayExists()` now returns `true` for HTTP/HTTPS URLs in the DB
    - `getGame()` already had proper logic to fetch remote URLs
    - The mismatch meant `replayExists()` said "no replay" but `getGame()` could load it fine
  - **Files Modified**: `server/services/snakeBenchService.ts`
  - **Impact**: Greatest Hits and replay filtering now correctly include games with remote replay URLs

### Version 6.9.6  Dec 19, 2025

- **Worm Arena: Fix replay loading to use Greg's Railway backend (root cause fix)** (Author: Claude Sonnet 4)
  - **Root Cause**: Previous code used wrong/stale upstream URL for fetching replays from upstream SnakeBench
    - Was trying: `snakebench.com/api/matches/{id}` (frontend domain, not backend)
    - Should use: `backend-production-fc22.up.railway.app/api/matches/{id}` (Greg's actual Railway backend)
  - **Architecture clarification**: Greg uses Next.js SSR - his server fetches from Supabase Storage and embeds 
    data in HTML. Browser sees no Supabase requests because they happen server-side. Our backend-to-backend 
    approach (fetching from his Flask API) is correct and equivalent.
  - **Fix**: Updated `snakeBenchService.getGame()` and `getGameProxy()` to use Greg's Railway backend directly
    - Primary fallback: `https://backend-production-fc22.up.railway.app/api/matches/{gameId}`
    - Secondary fallback: GitHub raw for older games
  - **New env var**: `SNAKEBENCH_UPSTREAM_BACKEND_URL` - override Greg's backend URL if it changes
    - Default: `https://backend-production-fc22.up.railway.app`
  - **Fallback order**: Local file -> DB replay_path -> Greg's Railway backend -> GitHub raw
  - **Files Modified**: `server/services/snakeBenchService.ts`

### Version 6.9.5  Dec 19, 2025

- **Worm Arena: Restore fallback when greatest hits unavailable + simplify replay loading** (Author: Claude Haiku 4.5)
  - **UI Fix**: Fixed regression from v6.9.3 where replays appeared broken due to blank page when greatest-hits endpoint returns empty
    - Restored cascade logic: prefer greatest hits → fall back to recent games (filtered by ≥20 rounds) → show any recent game
    - Dependency array now includes `games` so fallback logic re-evaluates when recent games load
  - **Backend Fix**: Simplified `replayExists()` to check local bundled files only
    - Removed slow remote URL fallbacks (GitHub raw, snakebench.com) that were timing out
    - All replay JSONs are bundled in `external/SnakeBench/backend/completed_games/` and deployed to Railway
    - Direct `fs.existsSync()` check is fast, reliable, and works in both dev and production
    - Removed unnecessary `SNAKEBENCH_REPLAY_RAW_BASE` env var dependency (optional in .env)
  - **Files Modified**: `client/src/pages/WormArena.tsx`, `server/services/snakeBenchService.ts`
  - **Impact**: Greatest hits now always return playable games (fast local checks) + page shows fallback replays if needed

### Version 6.9.4  Dec 19, 2025

- **Worm Arena Console & Model Selector UI Refinement** (Author: Claude Haiku 4.5)
  - Reduced excessive padding in model selector list for more compact, terminal-like appearance
  - Changed model selector buttons from `px-3 py-2` to `px-2 py-1` with reduced text sizes (`text-xs`)
  - Replaced row spacing (`space-y-2`) with subtle `border-b` dividers for cleaner look
  - Moved win/loss/tie stats inline with model name instead of right-aligned (like trading terminal ticker)
  - Changed console view layout from stacked (vertical) to side-by-side (horizontal)
  - Python ASCII console now on left, event stream on right with equal horizontal space
  - Reduced event stream text sizes and padding for denser display
  - Improved space efficiency on live match pages by eliminating whitespace
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaModelListCard.tsx`
    - `client/src/components/WormArenaConsoleMirror.tsx`

### Version 6.9.3  Dec 19, 2025 14:30 

- **Worm Arena: Default to greatest hits match on page load** (Author: Cascade)
  - Fixed blank screen issue on `/worm-arena` by defaulting to load the first greatest hits match instead of showing no content
  - Added `useWormArenaGreatestHits` hook usage to main WormArena component
  - Changed default selection logic from recent games to curated greatest hits games
  - Users now see an interesting match immediately instead of a blank page
  - **Files Modified**:
    - `client/src/pages/WormArena.tsx`
    - `CHANGELOG.md`

### Version 6.9.2  Dec 19, 2025

- **Worm Arena: Free model preference and normalization** (Author: Cascade)
  - Fixed issue where free and paid versions of same model (e.g., `mistralai/devstral-2512` vs `mistralai/devstral-2512:free`) were treated as separate models
  - Modified pairing history query to normalize model slugs by removing `:free` suffix
  - Updated suggest-matchups logic to prefer free versions over paid versions when both exist
  - Fixed model rating lookups (`/api/snakebench/model-rating`) to return data for free/paid variants
  - Fixed model history lookups (`/api/snakebench/model-history`) to include matches for both variants
  - Fixed match filtering (`/api/snakebench/matches`) to include results for free/paid variants
  - Fixed TrueSkill leaderboards (`/api/snakebench/leaderboard`) to group by normalized slugs instead of showing duplicates
  - Fixed basic leaderboards (`/api/snakebench/leaderboard/basic`) to group by normalized slugs instead of showing duplicates
  - Ensures free models appear in suggestions instead of paid equivalents
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts`
    - `server/services/snakeBenchService.ts`
    - `CHANGELOG.md`

### Version 6.9.1  Dec 19, 2025

- **Worm Arena: Persistent live-link resolution** (Author: Cascade)
  - Fixed issue where old `/worm-arena/live/:sessionId` links would show "Session unavailable" after server restarts
  - Added `worm_arena_sessions` Postgres table to persist `sessionId -> gameId` mappings
  - Old live links now reliably redirect to exact replays even after server restarts
  - Added `WormArenaSessionRepository` for DB operations
  - Updated `wormArenaStreamController` to persist completed sessions to DB
  - **New files created**:
    - `server/repositories/WormArenaSessionRepository.ts`
    - `migrations/0005_worm-arena-sessions.sql`
    - `docs/plans/2025-12-19-worm-arena-persistent-live-links.md`
  - **Files modified**:
    - `server/controllers/wormArenaStreamController.ts`
    - `server/repositories/RepositoryService.ts`
    - `server/repositories/database/DatabaseSchema.ts`
    - `shared/schema.ts`
    - `CHANGELOG.md`

### Version 6.8.2  Dec 19, 2025

- **Worm Arena: Replay viewer reliability fix (CORS-proof replay loading)** (Author: Cascade)
  - Fixed replay loading failures where the browser attempted to fetch remote replay JSON directly (often blocked by CORS)
  - Server now fetches remote replay JSON (DB replay_path, snakebench.com upstream, GitHub raw fallback) and returns it as same-origin `{ data }`
  - Restores replay viewing (including Console View) in both local dev and production
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `CHANGELOG.md`

### Version 6.8.1  Dec 19, 2025

- **Worm Arena: Production crash fix + friendlier live link handling** (Author: Cascade)
  - Fixed a **blank page crash** in Worm Arena Matches caused by an invalid Radix Select item (`SelectItem value=""`)
    - Replaced empty-string select values with a non-empty sentinel and mapped it back to “no filter” internally
  - Improved **Live link UX** when a sessionId is expired/unknown in production
    - Added a preflight gate using `/api/wormarena/resolve/:sessionId` before attempting SSE connect
    - If the match already finished, users are redirected to the replay automatically
    - If the link is expired/unknown, the page stays usable with a clear message (no hard crash)
  - **Files Modified**:
    - `client/src/pages/WormArenaMatches.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `CHANGELOG.md`

### Version 6.8.0  Dec 18, 2025

- **Worm Arena: Console Mirror View - Raw Python Terminal Experience** (Author: Claude Sonnet 4)
  - Added **view mode toggle** to both Live and Replay pages
  - Users can now switch between "Cartoon View" (default emoji canvas) and "Console View" (raw Python terminal)
  - **Console View features**:
    - ASCII board matching Python's `GameState.print_board()` format exactly
    - Symbols: `.` = empty, `A` = apple, `0`/`1` = snake heads, `T` = body
    - Y-axis labels on left (high to low), X-axis labels at bottom
    - Dark terminal theme with green text
    - Live event stream log (live page only) with auto-scroll
    - Event type badges: init, status, frame, chunk, complete, error
  - **New files created**:
    - `client/src/lib/wormArena/renderPythonAsciiBoard.ts` - Python-accurate ASCII renderer
    - `client/src/components/WormArenaConsoleMirror.tsx` - Console view component
    - `docs/plans/2025-12-18-worm-arena-console-mirror-improved.md` - Implementation plan
  - **Files modified**:
    - `client/src/hooks/useWormArenaStreaming.ts` - Added `eventLog` state for chronological SSE event collection
    - `client/src/pages/WormArenaLive.tsx` - Added render mode toggle, console view integration
    - `client/src/pages/WormArena.tsx` - Added render mode toggle, console view integration
    - `CHANGELOG.md`
  - **Educational purpose**: Shows users what the Python SnakeBench engine actually outputs, bridging the gap between the friendly UI and the underlying mechanics

### Version 6.7.0  Dec 18, 2025

- **Worm Arena: Major UX improvements across all pages** (Author: Cascade)
  - **Compact headers everywhere**: All Worm Arena pages now use compact header mode (~1/3 original size)
    - Title + nav pills inline on single row
    - Reduced from text-4xl/5xl to text-xl
    - Cleaner, less overwhelming first impression
  - **Fixed OpenRouter model availability bug**: "Run" button on suggested matchups was incorrectly showing "models not available" error
    - Root cause: React state updates are async; old code checked stale state in setTimeout
    - Fix: Check model availability directly with passed parameters, build payload inline
  - **Redesigned Live Scoreboard** (`WormArenaLiveScoreboard.tsx`):
    - Compact single-row layout (~1/3 original height)
    - Consistent worm emoji: now uses `\uD83D\uDC1B` for both players (was using snail for one)
    - Added TrueSkill stats display: exposed rating, sigma (uncertainty), games played
    - Stats fetched via `useModelRating` hook, shown below model name
    - Smaller apple score pills, cleaner VS divider
  - **Files Modified**:
    - `client/src/pages/WormArena.tsx` - added `compact` prop to header
    - `client/src/pages/WormArenaLive.tsx` - compact header, fixed matchup run bug, TrueSkill stats wiring
    - `client/src/pages/WormArenaStats.tsx` - added `compact` prop to header
    - `client/src/pages/WormArenaSkillAnalysis.tsx` - added `compact` prop to header
    - `client/src/components/WormArenaLiveScoreboard.tsx` - complete redesign with TrueSkill integration
    - `CHANGELOG.md`

### Version 6.6.9  Dec 18, 2025

- **Worm Arena Matches: Robust advanced search with death reason filter** (Author: Cascade)
  - Added **death reason** filter: head_collision, body_collision, wall, survived
  - Added **score range** filters (min/max score)
  - Added **cost range** filters (min/max cost in $)
  - Added **max rounds** filter (was only min before)
  - Added **myScore** sort option
  - Model filter is now **optional** - can search across all models
  - Search results table now shows: Model, Death Reason columns
  - Quick presets row with "Clear ranges" button
  - Better human-readable labels (e.g., "Head Collision" vs "head_collision")
  - **Backend changes**:
    - `shared/types.ts`: Added `SnakeBenchDeathReason` type, enhanced `SnakeBenchMatchSearchQuery`
    - `server/controllers/snakeBenchController.ts`: Parse new query params
    - `server/repositories/SnakeBenchRepository.ts`: Add filters for deathReason, maxRounds, score range, cost range
  - **Files Modified**:
    - `shared/types.ts`
    - `server/controllers/snakeBenchController.ts`
    - `server/repositories/SnakeBenchRepository.ts`
    - `client/src/pages/WormArenaMatches.tsx`
    - `CHANGELOG.md`

### Version 6.6.8  Dec 18, 2025

- **Worm Arena Matches: Redesigned as "Greatest Hits" showcase** (Author: Cascade)
  - Page now leads with curated Greatest Hits matches prominently at top
  - Advanced search filters moved to collapsible accordion for power users
  - Uses compact header (~50% smaller footprint)
  - Search results table is cleaner with better column sizing
  - **Files Modified**:
    - `client/src/pages/WormArenaMatches.tsx`
    - `CHANGELOG.md`

- **WormArenaHeader: Added compact mode** (Author: Cascade)
  - New `compact` prop for ~50% smaller header footprint
  - Compact mode: single-row layout with title + nav inline
  - Title reduced from 4xl to xl, nav pills from text-sm to text-xs
  - Standard mode unchanged (stacked, centered, large)
  - **Files Modified**:
    - `client/src/components/WormArenaHeader.tsx`

### Version 6.6.7  Dec 18, 2025

- **Worm Arena Live: Enlarged game board by reducing padding/margins** (Author: Cascade)
  - **WormArenaLiveBoardPanel.tsx**: Reduced container padding (px-4 py-4 -> px-2 py-2), tighter title margin
  - **WormArenaGameBoard.tsx**: 
    - Reduced border from 8px to 4px
    - Reduced internal padding from 16px to 8px
    - Reduced label margins for more board space
    - Increased max board height (520px -> 600px) and cell size limits (56px -> 64px)
    - Minimum cell size increased (16px -> 18px) for better visibility
  - Result: Same page footprint but significantly larger visible game grid
  - **Files Modified**:
    - `client/src/components/WormArenaLiveBoardPanel.tsx`
    - `client/src/components/WormArenaGameBoard.tsx`
    - `CHANGELOG.md`

- **Worm Arena: TrueSkill Stats Integration Plan** (Author: Cascade)
  - Created comprehensive implementation plan for enhancing Live page with TrueSkill data
  - Documents existing architecture, data flow, and reusable components
  - Outlines 3-phase approach: pre-match stats strip, live scoreboard enhancement, post-match context
  - Written as developer-to-developer handoff document
  - **Files Created**:
    - `docs/plans/2025-12-18-worm-arena-live-stats-integration-plan.md`

### Version 6.6.6  Dec 18, 2025

- **Worm Arena: Redesigned header and scoreboard with stacked/centered layout** (Author: Cascade)
  - **WormArenaHeader.tsx**: Complete redesign with:
    - Stacked, centered layout instead of left-aligned
    - Larger typography (4xl/5xl title)
    - Pill-style navigation buttons with clear affordances
    - Active state: solid background, inactive: transparent with border
    - Hover effect: lift + shadow for better UX feedback
  - **WormArenaLiveScoreboard.tsx**: Enhanced scoreboard with:
    - Larger apple score pills with winning player scale animation
    - Model names displayed prominently with color coding (green/blue)
    - Worm emoji icons for visual appeal
    - Centered three-column layout (Player A / VS / Player B)
  - **index.css**: Added new CSS classes for pill-style nav buttons:
    - `.worm-header-title-text` for centered title
    - `.worm-header-nav-active` for active nav pill
    - `.worm-header-nav-inactive` for inactive nav pill with hover states
  - **Files Modified**:
    - `client/src/components/WormArenaHeader.tsx`
    - `client/src/components/WormArenaLiveScoreboard.tsx`
    - `client/src/index.css`
    - `CHANGELOG.md`

### Version 6.6.5  Dec 18, 2025

- **Worm Arena: Upstream replay URL pattern with snakebench.com fallback** (Author: Cascade)
  - Changed `GET /api/snakebench/games/:gameId` to match upstream SnakeBench pattern:
    - Returns `{ data }` when local file available (local dev)
    - Returns `{ replayUrl, fallbackUrls }` when replay must be fetched remotely (deployment)
  - **Fallback URL chain** (client tries in order until one succeeds):
    1. DB `replay_path` URL (if stored)
    2. `https://snakebench.com/api/matches/<id>` (upstream site, for old games)
    3. GitHub raw (`VoynichLabs/SnakeBench/main/backend/completed_games/`)
  - Frontend `useSnakeBenchGame` hook now tries multiple URLs until one succeeds
  - **This eliminates server-side JSON proxy truncation issues** that caused "Invalid JSON response" errors in Railway deployment
  - Configurable via env vars: `SNAKEBENCH_UPSTREAM_URL`, `SNAKEBENCH_REPLAY_RAW_BASE`
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `server/controllers/snakeBenchController.ts`
    - `client/src/hooks/useSnakeBench.ts`
    - `shared/types.ts`
    - `CHANGELOG.md`

### Version 6.6.4  Dec 18, 2025

- **Worm Arena: Improved remote replay fetching diagnostics/robustness** (Author: Cascade)
  - Improved remote replay fetching for Worm Arena replays with better diagnostics and robustness.
  - Added User-Agent headers, support for redirects, and a configurable timeout to improve fetching reliability.
  - Enhanced error reporting to provide more informative error messages when fetching fails.
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `CHANGELOG.md`

### Version 6.6.3  Dec 18, 2025

- **Worm Arena: Deployment replay fallback fix** (Author: Cascade)
  - Updated `GET /api/snakebench/games/:gameId` replay loading so a bad/unreadable local replay file no longer blocks fallback to remote replay sources (DB URL and GitHub raw).
  - This resolves deployment cases where a replay exists (e.g. upstream GitHub raw), but the server had a stale/broken `replay_path` on disk.
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `CHANGELOG.md`

### Version 6.6.2  Dec 18, 2025

- **VS Code chatSessions proposed API enablement** (Author: Codex)
  - Added `enabledApiProposals: ["chatSessionsProvider"]` to `package.json` so `chatSessions/newSession` is exposed when the workspace is opened normally.
  - Documented the requirement and fallback flag in `docs/README.md`.
  - **Files Modified**:
    - `package.json`
    - `docs/README.md`
    - `CHANGELOG.md`

### Version 6.6.1  Dec 18, 2025

- **Worm Arena: Replay + Suggested Matchups fixes** (Author: Cascade)
  - Moved match-wide totals out of per-player reasoning cards into a single Match totals card on the replay page.
  - Fixed dev-mode routing so `/api/*` never falls back to `index.html` (prevents "Unexpected token '<'" in Suggested Matchups).
  - **Files Modified**:
    - `client/src/pages/WormArena.tsx`
    - `server/vite.ts`
    - `CHANGELOG.md`

### Version 6.6.0  Dec 17, 2025

- **Worm Arena: Suggested Matchups - discover interesting unplayed pairings** (Author: Cascade)
  - New feature that identifies the **most interesting matches that haven't been run yet** from the model pool.
  - Two scoring modes with toggle button:
    - **Ladder Quality**: Prioritizes matches that will improve ranking accuracy (high uncertainty models, close ratings)
    - **Entertainment**: Prioritizes exciting matches to watch (close fights, high-stakes top models, upset potential)
  - Each suggestion shows:
    - Both models with their TrueSkill exposed ratings and games played
    - Explanation tags (e.g., "Unplayed pairing", "Expected nail-biter", "High-stakes (top-tier model)")
    - One-click **Run** button to start the match
  - Only includes models with >= 3 games (placement complete) and pairs that have **never competed**.
  - Variety penalty ensures no model appears more than 3 times in suggestions.
  - **Backend**: 
    - New `GET /api/snakebench/suggest-matchups?mode=ladder|entertainment&limit=20` endpoint
    - `getPairingHistory()` repository query computes all model pair match counts
    - Scoring algorithm in `snakeBenchService.suggestMatchups()` with clear mode separation
  - **Frontend**:
    - New `WormArenaSuggestedMatchups` component with mode toggle and run buttons
    - New `useWormArenaSuggestMatchups` hook for data fetching
    - Integrated into main Worm Arena page (alongside Greatest Hits)
    - Integrated into Stats & Placement page (alongside Greatest Hits)
  - **New Types**: `WormArenaSuggestMode`, `WormArenaPairingHistory`, `WormArenaModelSummary`, `WormArenaSuggestedMatchup`, `WormArenaSuggestMatchupsResponse`
  - **Files Created**:
    - `client/src/components/WormArenaSuggestedMatchups.tsx`
    - `client/src/hooks/useWormArenaSuggestMatchups.ts`
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts` (added `getPairingHistory()`)
    - `server/services/snakeBenchService.ts` (added `suggestMatchups()`)
    - `server/controllers/snakeBenchController.ts` (added `suggestMatchups` handler)
    - `server/routes.ts` (added `/api/snakebench/suggest-matchups` route)
    - `shared/types.ts` (added suggested matchup types)
    - `client/src/pages/WormArena.tsx` (integrated component)
    - `client/src/pages/WormArenaStats.tsx` (integrated component)
    - `CHANGELOG.md`

### Version 6.5.18  Dec 18, 2025

- **Worm Arena Live: durable share links and single-match architecture** (Author: Cascade)
  - **Durable share links**: Visiting a `/worm-arena/live/:sessionId` URL after the match ends now automatically redirects to the replay page instead of showing an error.
  - **Share button improvements**: Copy button now copies a **replay URL** when the match is complete (gameId-based), or the live URL while running.
  - **Removed batch mode**: One session = one match. Deleted unused batch logic from frontend hook and backend controller.
  - **Deleted dead code**: Removed unused `WormArenaSetup.tsx` component.
  - Added `GET /api/wormarena/resolve/:sessionId` endpoint that maps sessionId to gameId for completed matches (30-day TTL).
  - **Files Modified**:
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/hooks/useWormArenaStreaming.ts`
    - `server/controllers/wormArenaStreamController.ts`
    - `server/routes.ts`
    - `CHANGELOG.md`
  - **Files Deleted**:
    - `client/src/components/WormArenaSetup.tsx`

### Version 6.5.17  Dec 18, 2025

- **Worm Arena Live: model dropdown shows full catalog** (Author: Cascade)
  - Fixed the model combobox list being capped (it could stop early and hide many configured models).
  - Dropdown is now explicitly scrollable and will show the full configured model catalog.
  - **Files Modified**:
    - `client/src/components/WormArenaRunControls.tsx`
    - `CHANGELOG.md`

### Version 6.5.16  Dec 17, 2025 🜟 20:42

- **Worm Arena Live: OpenRouter-only configured model slugs** (Author: Cascade)
  - Live match setup now clearly indicates **OpenRouter models only**.
  - Model selection is restricted to the configured model catalog (no custom typed model slugs).
  - **Files Modified**:
    - `client/src/components/WormArenaRunControls.tsx`
    - `CHANGELOG.md`

### Version 6.5.15  Dec 17, 2025

- **Worm Arena: Match duration display and per-round timestamps** (Author: Claude)
  - Added **match duration** display to live results panel (calculated from `startedAt`/`completedAt`)
  - Shows total duration (e.g., "1m 23s") and average time per round (e.g., "4.2s/round avg")
  - Added `durationSeconds` and `avgSecondsPerRound` fields to `WormArenaFinalSummary` type
  - **SnakeBench Python backend**: Added `timestamp` field to each frame in `record_frame()` for per-round timing
  - Future games will now have per-round timestamps stored in the JSON for detailed analysis
  - **Files Modified**:
    - `client/src/components/WormArenaLiveResultsPanel.tsx`
    - `shared/types.ts`
    - `external/SnakeBench/backend/main.py`
    - `CHANGELOG.md`

### Version 6.5.14  Dec 17, 2025

- **Worm Arena Live: Champion vs Challengers batch mode** (Author: Claude)
  - Redesigned match queue to **Champion vs Challengers** pattern:
    - Set Model A as your "champion"
    - Add multiple Model B entries as "challengers" using the + button
    - Click "Run All" to open each match in a **new browser tab**
  - Each match is prepared via `/api/snakebench/stream/prepare` and opens independently
  - Searchable combobox retained - type to filter models instead of scrolling through dropdown
  - Users can still type custom model names if not in the list
  - **Note**: Per-round timestamps not yet available in game JSON (only game-level `started_at`/`ended_at`)
  - **Files Modified**:
    - `client/src/components/WormArenaRunControls.tsx`
    - `CHANGELOG.md`

### Version 6.5.13  Dec 17, 2025

- **Worm Arena Live: searchable model selector and match queue** (Author: Claude)
  - Replaced dropdown selects with **searchable combobox** - type to filter models instead of scrolling
  - Users can now type custom model names directly if not in the list
  - Added **match queue** feature - queue multiple matchups and run them sequentially
  - Queue shows pending matches with remove buttons; "Start Queue" runs all queued matches
  - Exported `QueuedMatchup` interface and added `onStartQueue` callback prop for queue support
  - **Files Modified**:
    - `client/src/components/WormArenaRunControls.tsx`
    - `CHANGELOG.md`

### Version 6.5.12  Dec 17, 2025

- **Worm Arena Skill Analysis: sorting, Dr. Budd credit, and TrueSkill link** (Author: Claude)
  - Compare model list now sorted by **games played** (most to least)
  - Baseline model list now sorted by **win rate** (highest to lowest)
  - Card titles now display the actual model slug instead of generic labels
  - Added `sortBy` prop to `WormArenaModelListCard` supporting `'gamesPlayed'` or `'winRate'`
  - Updated sigma explanation to clarify that low sigma means **consistent performance**, not just many games
  - Added Microsoft Research TrueSkill documentation link in the "Why TrueSkill?" accordion
  - Added **human-verified badge** crediting Dr. Jeremy Budd for proofreading and statistical guidance, with link to Hall of Fame
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelListCard.tsx`
    - `CHANGELOG.md`

### Version 6.5.11  Dec 17, 2025

- **Worm Arena: Baseline color + UI readability improvements** (Author: Claude Sonnet 4)
  - Changed baseline model color from red to **green** across all components (role colors, snapshot cards, pills)
  - Changed pessimistic/optimistic confidence interval pills from red/green to **gray/black** scheme for better clarity
  - Added "Click a dot to select that model" instruction text above scatter plot
  - Increased scatter plot axis labels from tiny gray to **bold black text** for readability
  - Added `worm-pill-baseline` CSS class with green styling
  - **Files Modified**:
    - `client/src/utils/wormArenaRoleColors.ts`
    - `client/src/components/wormArena/DataNumber.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelSnapshotCard.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillScatterPlot.tsx`
    - `client/src/index.css`
    - `CHANGELOG.md`

### Version 6.5.10  Dec 17, 2025

- **Worm Arena: Win Probability calculation + UI improvements** (Author: Claude Sonnet 4)
  - Added win probability calculation for TrueSkill model comparisons using the normal distribution formula: P = Phi((mu1 - mu2) / sqrt(sigma1^2 + sigma2^2))
  - Created new utility module `wormArenaWinProbability.ts` with `erf`, `erfc`, `normalCDF`, and `calculateWinProbability` functions (Abramowitz & Stegun approximation, accurate to +/-1.5e-7)
  - Created new component `WormArenaWinProbability.tsx` for displaying statistical comparison between compare and baseline models
  - Win probability section positioned directly below bell curve for visual prominence
  - Formula styling increased to text-base bold black for better visibility
  - Fixed confidence interval labeling to clarify it applies to the compare model only
  - Stats boxes (Games/Wins/Losses/Ties/Cost) now labeled "Compare Model Stats" to clarify they refer to the compare model
  - Changed baseline model color from red to **green** for better visual distinction
  - **Files Created**:
    - `client/src/utils/wormArenaWinProbability.ts`
    - `client/src/components/wormArena/WormArenaWinProbability.tsx`
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `client/src/utils/wormArenaRoleColors.ts`
    - `CHANGELOG.md`

### Version 6.5.9  Dec 17, 2025

- **Worm Arena: Stats panel now sortable + links into deeper model analysis** (Author: Cascade)
  - Worm Arena replay page Stats panel now shows all models (scrollable) and supports sorting by win rate, games played, wins, losses, and ties.
  - Added a direct link to the deeper Stats & Placement page, and model names now link to that page with the model preselected.
  - **Files Modified**:
    - `client/src/components/WormArenaStatsPanel.tsx`
    - `client/src/hooks/useWormArenaStats.ts`
    - `CHANGELOG.md`

### Version 6.5.8  Dec 17, 2025

- **Worm Arena: only show replayable matches + fix Greatest Hits truncation** (Author: Cascade)
  - `/api/snakebench/games` now filters out DB-only matches that do not have an available replay asset, preventing broken replay clicks.
  - Improved remote replay fetch diagnostics to include HTTP status and a short response snippet.
  - Fixed the Worm Arena Greatest Hits list being cut off by switching to a simple overflow container and increasing the scroll region height.
  - Greatest Hits "View replay" now opens in a new tab/window.
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `client/src/components/WormArenaGreatestHits.tsx`
    - `docs/reference/api/SnakeBench_WormArena_API.md`
    - `CHANGELOG.md`

### Version 6.5.5  Dec 17, 2025

- **Worm Arena: DB-discovered OpenRouter models now runnable + duplicate dropdown cleanup + Gemini 3 Flash tournament script** (Author: Cascade)
  - Updated SnakeBench model allowlist to include **active, DB-discovered OpenRouter slugs** (in addition to curated config) so newly discovered models can be run immediately.
  - Canonicalized OpenRouter model IDs before de-duping in Worm Arena Live so aliases do not appear multiple times.
  - Rewrote the tournament script to run `google/gemini-3-flash-preview` vs the champion roster **both directions**, **localhost**, **one match at a time** (rate-limit safe).
  - Updated SnakeBench/Worm Arena API docs to reflect the expanded allowlist behavior.
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `client/src/pages/WormArenaLive.tsx`
    - `scripts/worm-arena-tournaments/underrepresented-models-roundrobin.ps1`
    - `docs/reference/api/SnakeBench_WormArena_API.md`
    - `CHANGELOG.md`

# New entires at the top, use proper SemVer!

# New entires at the top, use proper SemVer!

### Version 6.5.7  Dec 19, 2025

- **Worm Arena Live: restore tall reasoning columns + reinstated stats strip + clearer reconnect errors** (Author: Codex (GPT-5))
  - Reasoning columns are tall again (≈46rem) with scrollable bodies so the layout matches the live board height, while the top apple scoreboard is now about half its previous height.
  - The under-board status strip brings back the round/score/alive grid and shows session IDs plus live phase, so users still see the classic streaming telemetry beneath the board.
  - If a user opens `/worm-arena/live/:sessionId` after the single-use session handshake expires, the page now stays in “live” mode and explains that current sessions cannot be rejoined mid-match.
  - **Files Modified**:
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/hooks/useWormArenaStreaming.ts`
    - `client/src/components/WormArenaReasoning.tsx`
    - `client/src/components/WormArenaLiveScoreboard.tsx`
    - `client/src/components/WormArenaLiveStatusStrip.tsx`
    - `docs/2025-12-19-worm-arena-live-refresh-plan.md`
    - `CHANGELOG.md`

### Version 6.5.6  Dec 19, 2025

- **Worm Arena Live: restore worm emoji in reasoning panels** (Author: Codex (GPT-5))
  - Replaced the mojibake `ĐY?>` placeholder with the requested 🐛 emoji so headers look correct on Windows browsers.
  - Updated the component header to document the icon change.
  - **Files Modified**: `client/src/components/WormArenaReasoning.tsx`, `CHANGELOG.md`

### Version 6.5.5  Dec 19, 2025

- **Worm Arena Live: scoreboard-first layout + inline match summary** (Author: Codex (GPT-5))
  - Apple scoreboard now pins above the live board while all other controls collapse under the board, matching the requested hierarchy.
  - Reasoning columns keep a fixed height with scrollbars, the status strip now only shows streaming context, and the match ID has a dedicated copy-able control under the board.
  - Final summaries render inline next to the final frame so viewers stay on the Live page when a match completes.
  - **Files Modified**:
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/components/WormArenaLiveScoreboard.tsx`
    - `client/src/components/WormArenaLiveStatusStrip.tsx`
    - `client/src/components/WormArenaReasoning.tsx`
    - `client/src/components/WormArenaLiveBoardPanel.tsx`
    - `client/src/components/WormArenaLiveResultsPanel.tsx`
    - `docs/2025-12-19-worm-arena-live-refresh-plan.md`
    - `CHANGELOG.md`

### Version 6.5.4  Dec 17, 2025

- **Worm Arena Skill Analysis: Comparison overlay matches poster view** (Author: CodexGPT5.1 Low)
  - Replaced the stacked bell-curve cards with a single shared SVG that overlays up to five models using the same axis math as Poster View, including dashed μ markers and color-matched fills.
  - Added an interactive legend that mirrors selection ordering, displays mu/sigma/win-loss stats, and keeps hover/focus state synchronized with the scatter plot.
  - Updated the Worm Arena stats plan to record the new progress milestone and refreshed next steps.
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaMultiCurveOverlay.tsx`
    - `docs/plans/WormArenaStatsPlan.md`
    - `CHANGELOG.md`

### Version 6.5.3  Dec 17, 2025

- **Worm Arena Skill Analysis: role-based color normalization** (Author: GPT-5.2-Medium-Reasoning)
  - Color coordinated the entire Skill Analysis flow so compare model UI is blue and baseline model UI is red.
  - Model lists, snapshot cards, and the TrueSkill leaderboard picker now highlight selections using the correct role color (no green selection state).
  - Poster View hero now renders the baseline curve in red and shows both models' skill estimate and uncertainty values in role colors.
  - **Files Modified**:
    - `client/src/index.css`
    - `client/src/utils/wormArenaRoleColors.ts`
    - `client/src/components/wormArena/DataNumber.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelListCard.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelSnapshotCard.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `client/src/components/WormArenaTrueSkillLeaderboard.tsx`
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `package.json`
    - `CHANGELOG.md`

### Version 6.5.2  Dec 17, 2025

- **Worm Arena Skill Analysis: Comparison View polish + regression hardening** (Author: GPT-5.2-Medium-Reasoning)
  - Comparison View now has stable scatter plot axes while searching (domains are computed from the full leaderboard and reused while filtering).
  - Comparison View now shows a skeleton loading state during initial leaderboard load.
  - Fixed encoding issues in comparison-view headers so mu/sigma labels render cleanly.
  - Restored and hardened the baseline selector UX so the baseline picker remains visible and the baseline snapshot does not disappear.
  - Poster View: left Compare model column now includes a Model snapshot card, and the bell curve graphic is rendered immediately under the view tabs.
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillComparison.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillScatterPlot.tsx`
    - `client/src/components/wormArena/stats/WormArenaMultiCurveOverlay.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelListCard.tsx`
    - `docs/plans/WormArenaStatsPlan.md`
    - `package.json`
    - `CHANGELOG.md`

### Version 6.5.1  Dec 18, 2025

- **Worm Arena Skill Analysis: UI polish + baseline selection improvements** (Author: Cascade)
  - Removed the busy top-of-page stats strip and moved the TrueSkill leaderboard below the main 3-column analysis grid.
  - Moved the "Why TrueSkill?" explainer into a thin, centered strip at the top of the page (expandable), instead of a large block at the bottom.
  - TrueSkill leaderboard now supports sticky headers reliably and allows row-click selection to set the baseline (highlighted selection).
  - Hero graphic now uses Worm Arena typography, shows a clear "Model Snapshot [model]" heading, adds Games/Wins/Losses/Ties/Cost stat boxes, and tightens the x-axis bounds to roughly align with the 99.7% interval story.
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/components/WormArenaTrueSkillLeaderboard.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `CHANGELOG.md`

- **Gemini 3 Flash Preview routing parity** (Author: Codex)
  - Added the native `gemini-3-flash-preview` key to the Gemini service map and primary model catalog so the low-latency thinking tier is exposed to prompt selection and analytics.
  - Mirrored the slug across the shared model list, OpenRouter builder, and catalog (plus metadata) so BYO paths can reach the same fast reasoning model with up-to-date context/pricing data.
  - **Files Modified**:
    - `server/services/gemini.ts`
    - `server/config/models.ts`
    - `server/config/openrouterModels.ts`
    - `server/config/openrouter-catalog.json`
    - `CHANGELOG.md`

### Version 6.5.0  Dec 17, 2025

- **Worm Arena Skill Analysis: baseline picker + layout refresh** (Author: Cascade)
  - The reference model slug in the top-right snapshot is now a button: click it to clear the baseline and re-open the baseline model picker list (sorted by games played).
  - Widened the Skill Analysis layout so the left-side Models list card has enough room and no longer looks clipped.
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaModelSnapshotCard.tsx`
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `CHANGELOG.md`

### Version 6.4.11  Dec 17, 2025

- **Worm Arena Skill Analysis: bell curve chart containment + layout fixes (match reference)** (Author: Cascade)
  - Bell curve SVG now reserves top/bottom margins so curves, labels, and axis ticks stay inside the poster.
  - Uses a wider ±4σ range and stable integer axis bounds so tails taper naturally instead of feeling clipped.
  - Adds a dashed vertical line at the selected model's μ and offsets labels to avoid overlap when models are close.
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `CHANGELOG.md`

### Version 6.4.10  Dec 17, 2025

- **Worm Arena Skill Analysis: include ALL games (stop filtering by game_type) so model graph populates** (Author: Cascade)
  - Fixes the Skill Analysis page appearing empty when replays are labeled `ladder` (or other upstream types).
  - SnakeBench analytics queries (stats/TrueSkill leaderboard/model rating) now count all games, regardless of `public.games.game_type`.
  - Replay ingest supports a `gameTypeOverride` so ARC Explainer can standardize the stored `game_type` going forward.
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts`
    - `CHANGELOG.md`

### Version 6.4.9  Dec 17, 2025

- **Worm Arena Skill Analysis: reuse Stats & Placement components (global stats, leaderboard, reference placement)** (Author: Cascade)
  - Skill Analysis page now reuses the same shared stats modules as the Stats & Placement page:
    - Adds `WormArenaGlobalStatsStrip` and `WormArenaTrueSkillLeaderboard` above the existing 3-column skill analysis layout.
    - When a reference model is selected, the right column now shows `WormArenaPlacementCard` beneath the reference snapshot.
  - Fixes Skill Analysis header total games to use global stats instead of a hardcoded `0`.
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `CHANGELOG.md`

### Version 6.4.8  Dec 17, 2025

- **Worm Arena Skill Analysis: unified hero graphic matching TikZ reference design** (Author: Cascade)
  - Created `WormArenaSkillHeroGraphic.tsx` — a single unified "poster" component that draws:
    - Top row: "Skill estimate μ" and "Uncertainty σ" headers with large blue pills and descriptive text
    - Middle: "99.7% Confidence Interval" with red (pessimistic) and green (optimistic) pills connected by a dash, plus explanatory KaTeX formula
    - Bottom: Overlapping SVG bell curves — gray filled reference curve behind, blue filled current curve in front, with model labels positioned above peaks
  - Removed separate `WormArenaSkillMetrics` and `WormArenaSkillDistributionChart` from center column.
  - Center column is now borderless (no Card chrome) — reads as one clean poster graphic.
  - Typography uses Georgia serif for headers matching the reference.
  - **Files Created**:
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `CHANGELOG.md`

### Version 6.4.7  Dec 17, 2025

- **Worm Arena Skill Analysis: finished wiring + chart polish (URL selection, KaTeX math, visible axis/ticks)** (Author: Cascade)
  - Skill Analysis page (`/worm-arena/skill-analysis`) now drives selected model + reference model via URL query params (`?model=...&reference=...`).
  - Ratings on the Skill Analysis page now reliably load by explicitly calling `useModelRating().refresh()` when selection changes.
  - KaTeX math rendering (`InlineMath`) is used consistently for μ/σ/± copy, with KaTeX CSS loaded on the page.
  - Bell curve chart no longer clips tick labels; adds axis label and displays hover readout as density (not a misleading percent).
  - Worm Arena navigation now includes a "Skill Analysis" tab on Replay/Live/Matches/Stats pages.
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillDistributionChart.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillMetrics.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillSelector.tsx`
    - `client/src/pages/WormArena.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/pages/WormArenaMatches.tsx`
    - `client/src/pages/WormArenaStats.tsx`
    - `CHANGELOG.md`

### Version 6.4.6  Dec 17, 2025

- **HuggingFace union accuracy SRP/DRY refactor (shared compare service + auto-fetch hook + shared union UI)** (Author: Cascade)
  - `/scoring` refactored from a 1000+ line page into a small orchestration component composed of focused sections.
  - Introduced a shared `/api/metrics/compare` client service to centralize request-building, fetch, and error parsing.
  - Added a dedicated `useAttemptUnionComparison` hook using `@tanstack/react-query` so `/scoring` auto-fetches on dataset/model pair change.
  - Extracted `AttemptUnionCard` into a shared component and added a `variant` to preserve both dialog and `/scoring` presentations.
  - Centralized dataset display-name mapping into `client/src/constants/datasets.ts` and updated consumers.
  - **Files Created**:
    - `client/src/services/metrics/compareService.ts`
    - `client/src/hooks/useAttemptUnionComparison.ts`
    - `client/src/components/analytics/AttemptUnionCard.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/UnionAccuracyHeader.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/UnionAccuracyControls.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/UnionAccuracyExplainers.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/ProviderSystemPromptsPanel.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/HarnessDetailsAccordion.tsx`
    - `client/src/constants/datasets.ts`
  - **Files Modified**:
    - `client/src/pages/HuggingFaceUnionAccuracy.tsx`
    - `client/src/pages/ModelComparisonPage.tsx`
    - `client/src/components/analytics/ModelComparisonDialog.tsx`
    - `client/src/components/analytics/ModelPerformancePanel.tsx`
    - `client/src/pages/AnalyticsOverview.tsx`
    - `client/src/pages/ModelBrowser.tsx`
    - `client/src/components/analytics/AttemptUnionCard.tsx`
    - `CHANGELOG.md`

### Version 6.4.5  Dec 16, 2025

- **Union accuracy UI: stable denominators for “Puzzles solved” and “Test pairs”** (Author: Cascade)
  - `/scoring` and related comparison UIs now use dataset-level totals (total puzzles and total test pairs) as denominators.
  - Fixes confusing displays like `1 of 1 fully correct` by showing `… of 120` for ARC2-Eval, and `… of <all test pairs>`.
  - Dataset totals are computed once (cached in-memory) from the dataset JSON files.
  - **Files Modified**: `server/repositories/ModelDatasetRepository.ts`, `server/repositories/MetricsRepository.ts`, `client/src/pages/HuggingFaceUnionAccuracy.tsx`, `client/src/pages/ModelComparisonPage.tsx`, `client/src/components/analytics/ModelComparisonDialog.tsx`, `client/src/pages/AnalyticsOverview.tsx`, `CHANGELOG.md`

### Version 6.4.4  Dec 16, 2025

- **Worm Arena Live: model dropdowns sort newest-first (DB discovered_at + releaseDate fallback)** (Author: Cascade)
  - Live match setup model dropdowns now prefer models we most recently added/discovered (SnakeBench DB `discovered_at`), then fall back to `releaseDate`, then A–Z.
  - Prevents the Live setup panel from overriding the intended ordering by re-sorting everything alphabetically.
  - **Files Modified**: `server/repositories/SnakeBenchRepository.ts`, `server/routes/models.ts`, `client/src/pages/WormArenaLive.tsx`, `client/src/components/WormArenaRunControls.tsx`, `CHANGELOG.md`

### Version 6.4.3  Dec 16, 2025

- **/scoring: add explicit union scoring explanation (task/puzzle/test-pair definitions + worked examples)** (Author: Cascade)
  - Replaced the minimal "Understanding the three metrics" blurb with a detailed, union-centric explanation.
  - Clearly defines: puzzle vs task (same thing), training pairs vs test pairs, and how the two-attempt union rule works.
  - Adds a worked 3-test-pair example showing Attempt 1, Attempt 2, and the union result per pair.
  - Adds a concrete example explaining why the official harness score (average of puzzle scores) can differ from the pair-weighted test-pairs rate (e.g., 117/166).
  - Progress bar label now explicitly states it reflects the pair-weighted rate.
  - **Files Modified**: `client/src/pages/HuggingFaceUnionAccuracy.tsx`, `CHANGELOG.md`

### Version 6.4.2  Dec 16, 2025

- **Build reliability: OpenRouter catalog sync now merges remote into local snapshot** (Author: Cascade)
  - Prevents deploy failures when OpenRouter temporarily omits a model ID that is already referenced by our `OPENROUTER_MODEL_KEYS`.
  - Sync is now best-effort: if OpenRouter fetch fails, the build keeps the existing local catalog snapshot instead of overwriting it.
  - **Files Modified**: `server/scripts/sync-openrouter-catalog.ts`, `CHANGELOG.md`

### Version 6.4.1  Dec 16, 2025

- **Build fix: Missing closing brace in adminController.ts** (Author: Cascade)
  - Fixed syntax error at line 746 where `syncOpenRouterConfig` function was missing closing brace.
  - **Files Modified**: `server/controllers/adminController.ts`

### Version 6.4.0  Dec 16, 2025

- **ARC-AGI multi-test-pair scoring: harness-aligned accuracy + clearer UI metrics** (Author: Cascade)
  - **Critical scoring fix**: dataset score is the average of per-puzzle scores (each puzzle weighted equally), not a pair-weighted ratio.
  - **Backend**:
    - Added public `GET /api/accuracy/harness` endpoint returning harness-aligned accuracy for `{baseModelName}-attempt1/-attempt2`.
    - Added `AccuracyRepository.getHarnessAlignedAccuracyStats()` returning both harness score and pair-weighted transparency metrics.
    - Added pure scoring utilities `server/utils/harnessScoring.ts` to keep math testable and DRY.
    - Extended `MetricsRepository.computeAttemptUnionStats()` to return `puzzlesCounted`, `puzzlesFullySolved`, and `puzzlesFullySolvedIds`.
  - **Database**:
    - Added `num_test_pairs` column (plus index + backfill) to support multi-test-pair scoring and aggregation.
    - Updated `ExplanationRepository.saveExplanation()` to persist `num_test_pairs` on insert.
  - **Frontend**:
    - Removed client-side attempt-union scoring fallback (cannot compute harness score without per-pair data).
    - All three metrics now displayed side-by-side: **Harness Score** (official), **Puzzles Solved** (fully correct), **Test Pairs** (pair-weighted).
    - Three-metric grid layout on `/scoring`, `ModelComparisonPage`, and `ModelComparisonDialog`.
    - Added `computePuzzlePassFailRate()` helper in `modelComparison.ts` for puzzle-level pass/fail rate.
  - **Documentation Audit**:
    - Updated `AccuracyRepository` header to clarify two accuracy concepts (puzzle-level vs harness-aligned).
    - Updated `AccuracyLeaderboard` and `Leaderboards` descriptions to clarify puzzle-level accuracy is NOT harness score.
  - **Tests**:
    - Added unit tests demonstrating harness score differs from pair-weighted accuracy when puzzles have different numbers of test pairs.
    - Added controller test for `GET /api/accuracy/harness` input validation + delegation.
  - **Files Created**: `server/controllers/accuracyController.ts`, `server/utils/harnessScoring.ts`, `tests/harnessScoring.test.ts`, `tests/accuracyHarnessEndpoint.test.ts`
  - **Files Modified**: `server/routes.ts`, `server/repositories/AccuracyRepository.ts`, `server/repositories/MetricsRepository.ts`, `server/repositories/database/DatabaseSchema.ts`, `server/repositories/ExplanationRepository.ts`, `client/src/pages/HuggingFaceUnionAccuracy.tsx`, `client/src/pages/ModelComparisonPage.tsx`, `client/src/pages/AnalyticsOverview.tsx`, `client/src/pages/Leaderboards.tsx`, `client/src/components/analytics/ModelComparisonDialog.tsx`, `client/src/components/overview/leaderboards/AccuracyLeaderboard.tsx`, `client/src/utils/modelComparison.ts`, `CHANGELOG.md`

### Version 6.3.2  Dec 16, 2025 (PENDING TESTING)

- **SnakeBench: prevent local replays from blocking pulls** (Author: Cascade)
  - Local SnakeBench runs now write replay JSONs to `external/SnakeBench/backend/completed_games_local/` by default (configurable via `SNAKEBENCH_COMPLETED_GAMES_DIR`).
  - This prevents untracked local replay files from colliding with tracked files under `external/SnakeBench/backend/completed_games/` and breaking `git pull`.
  - Local video tooling now defaults to `external/SnakeBench/backend/completed_games_videos_local/` (also aligned with `SNAKEBENCH_COMPLETED_GAMES_DIR`).
  - **Files Modified**: `external/SnakeBench/backend/main.py`, `external/SnakeBench/backend/app.py`, `external/SnakeBench/backend/services/video_generator.py`, `external/SnakeBench/backend/cli/analyze_local_games.py`, `external/SnakeBench/backend/cli/generate_video.py`, `external/SnakeBench/backend/cli/generate_videos_local.py`, `external/SnakeBench/backend/cli/backfill_videos.py`, `external/SnakeBench/backend/tests/test_main.py`, `external/SnakeBench/backend/generate_videos.sh`, `external/SnakeBench/.gitignore`, `CHANGELOG.md`

### Version 6.3.1  Dec 16, 2025 (PENDING TESTING)

- **Johan_Land community solver visibility + cost metrics on all comparison pages** (Author: Claude Code using Sonnet 4.5)
  - **Johan_Land Integration**: Johan_Land community solver results now visible across all model comparison pages (/scoring, /analytics, /model-comparison)
  - **Cost Metrics Display**: Added comprehensive cost and performance metrics to /scoring page showing total cost, cost per puzzle, cost per correct answer, and average processing time
  - **Model Origin Detection**: Created centralized `modelOriginDetection.ts` utility to distinguish between HuggingFace official, community solvers, and ARC Explainer platform results
  - **Origin Badges**: Added visual badges across all pages to clearly identify data source (HF Official, Community, Platform)
  - **Page Scope Update**: Renamed /scoring page from "Official Scoring" to "Multi-Attempt Solver Results" to reflect inclusion of community-submitted evaluations
  - **DRY Compliance**: Eliminated duplicate origin detection logic across pages by centralizing in shared utility
  - **Files Created**: `client/src/utils/modelOriginDetection.ts`
  - **Files Modified**: `client/src/pages/HuggingFaceUnionAccuracy.tsx` (cost metrics, title, badges), `client/src/pages/AnalyticsOverview.tsx` (utility integration), `client/src/pages/ModelComparisonPage.tsx` (origin badges), `CHANGELOG.md`

### Version 6.2.2  Dec 16, 2025 (PENDING TESTING)

- **Worm Arena: align replay score text with player palettes** (Author: Codex (GPT-5))
  - Switches the control bar score labels from warning colors to the existing green/blue worm palette so the UI matches the reasoning columns.
  - Keeps the visual language consistent during replay streaming by using the palette tokens already defined in `client/src/index.css`.
  - **Files Modified**: `client/src/components/WormArenaControlBar.tsx`, `CHANGELOG.md`

### Version 6.2.1  Dec 16, 2025 (PENDING TESTING)

- **Worm Arena: Greatest Hits #1 marathon + reliable replay links + show more entries** (Author: Cascade)
  - Promoted the marathon replay `97c1dad4-3905-4d29-a781-f7a9691f063d` to the top of the curated Worm Arena Hall of Fame.
  - Greatest-hits endpoint now scans the curated list until it finds the requested number of playable replays (so missing early replays no longer shrink the list).
  - Greatest Hits UI now uses client-side navigation and normalizes `snake_game_*.json` style IDs before linking to `/worm-arena?matchId=...`.
  - **Files Modified**: `server/services/snakeBenchHallOfFame.ts`, `server/services/snakeBenchService.ts`, `client/src/components/WormArenaGreatestHits.tsx`, `CHANGELOG.md`

### Version 6.3.0  Dec 16, 2025 (COMPLETED)

- **Johan_Land_Solver_V6 scoring: pair-aware ingestion + harness-aligned union accuracy** (Author: Cascade, Validation & Execution: Claude Code)
  - **Critical Fix**: Resolved fundamental data structure misunderstanding. Submission JSON is array of test pairs (not single puzzle with 2 attempts).
  - **Ingestion Logic**: Iterates through submission array; each element = one test pair with attempt_1 and attempt_2 solving the same pair_index.
  - **Per-Pair Validation**: Each attempt validated against `task.test[pair_index].output` (ground truth), not against solver's own `correct` flag.
  - **Union Scoring**: If ANY attempt solves a pair, that pair counts as solved (matches official ARC-AGI benchmarking harness).
  - **Backend Accuracy**: Changed from global averaging to per-puzzle averaging: `(sum of per-puzzle fractions) / num_puzzles * 100`.
  - **Validation Result**: Harness-style score 71.29% (84.83/119 tasks) matches DB/UI union score 71.29% (117/166 test pairs)
  - **Re-ingestion**: All 238 entries (119 puzzles × 2 attempts) successfully re-ingested with corrected pair-aware logic.
  - **Files Modified**: `server/scripts/ingest-johanland-results.ts`, `server/repositories/MetricsRepository.ts`, `server/types/johanland.ts`, `CHANGELOG.md`

### Version 6.2.0  Dec 16, 2025 (PENDING TESTING)

- **Worm Arena: align UI coordinate system with engine prompt (y increases upward)** (Author: Cascade)
  - Fixed Worm Arena board rendering to use the SnakeBench engine coordinate system (bottom-left origin).
  - Fixed snake head arrow orientation so vertical movement is no longer inverted.
  - ASCII replay preview now matches the engine coordinate orientation.
  - **Files Modified**: `client/src/components/WormArenaGameBoard.tsx`, `client/src/components/WormArenaGameBoardSVG.tsx`, `client/src/pages/WormArena.tsx`, `CHANGELOG.md`

### Version 6.1.63  Dec 16, 2025 (PENDING TESTING)

- **Johan_Land scoring: harness-aligned correctness + union aggregation** (Author: Cascade)
  - Ingestion now recomputes correctness against ground truth per test pair (treats `attempt.correct` as untrusted).
  - Ingestion stores one row per puzzle per attempt using `multi_test_*` fields so multi-pair puzzles are preserved.
  - Attempt union accuracy now matches ARC harness aggregation (average of per-task fractions).
  - **Files Modified**: `server/scripts/ingest-johanland-results.ts`, `server/repositories/MetricsRepository.ts`, `server/types/johanland.ts`, `CHANGELOG.md`

### Version 6.1.62  Dec 15, 2025 (PENDING TESTING)

- **Worm Arena: auto-publish SnakeBench replays to GitHub + persist replay_path** (Author: Cascade)
  - SnakeBench ingest now uploads completed replay JSONs to GitHub (main branch) so Railway can fetch them reliably.
  - After publish, the DB `public.games.replay_path` is updated to the GitHub raw URL.
  - GitHub raw replay fetch 404s are now logged as warnings (expected for older/unpublished games).
  - **Files Modified**: `server/services/snakeBenchIngestQueue.ts`, `server/services/snakeBenchGitHubPublisher.ts` (new), `server/repositories/SnakeBenchRepository.ts`, `server/services/snakeBenchService.ts`, `CHANGELOG.md`

- **Worm Arena: enable Nemotron 3 Nano 30B and add tournament script** (Author: Codex GPT-5)
  - Added `nvidia/nemotron-3-nano-30b-a3b:free` to the server-side OpenRouter allowlist so SnakeBench can actually run matches with it.
  - Updated the local OpenRouter catalog snapshot to include the model metadata (context, pricing, supported parameters).
  - Added a PowerShell tournament script that queues matches against the current top TrueSkill leaderboard models.
  - **Files Modified**: `server/config/openrouterModels.ts`, `server/config/openrouter-catalog.json`, `scripts/worm-arena-tournaments/nemotron3-nano-30b-vs-top-leaderboard.ps1`, `CHANGELOG.md`

### Version 6.1.61  Dec 15, 2025 (PENDING TESTING)

- **Worm Arena: show DB-imported OpenRouter models automatically** (Author: Codex GPT-5)
  - Models returned by `GET /api/models` now include active OpenRouter slugs imported via the Admin UI (SnakeBench DB), so Worm Arena dropdowns reflect imports without editing config files.
  - Admin OpenRouter page copy now clarifies that "Import" updates the DB roster used by Worm Arena, while "Sync to Config" is optional metadata curation.
  - **Files Modified**: `server/routes/models.ts`, `client/src/pages/AdminOpenRouter.tsx`, `CHANGELOG.md`

### Version 6.1.60  Dec 15, 2025 (PENDING TESTING)

- **/scoring page copy + scoring alignment with ARC harness (pair-based)** (Author: Codex GPT-5)
  - Backend: attempt union stats now compute per test pair (any attempt correct) and return total test pairs for accurate percentages.
  - Frontend: /scoring page now surfaces backend union stats, shows pair-based math, and updates explanatory text to match the official ARC harness.
  - Analytics UI: model comparison dialog/page now display test-pair counts and percentages.
  - Plan added in `docs/2025-12-15-scoring-fix-plan.md` to track remaining scoring follow-through.
  - **Files Modified**: `server/repositories/MetricsRepository.ts`, `client/src/pages/HuggingFaceUnionAccuracy.tsx`, `client/src/components/analytics/ModelComparisonDialog.tsx`, `client/src/pages/ModelComparisonPage.tsx`, `client/src/pages/AnalyticsOverview.tsx`, `docs/2025-12-15-scoring-fix-plan.md`, `CHANGELOG.md`

### Version 6.1.59  Dec 15, 2025 (PENDING TESTING)

- **Johan_Land ingestion: correct multi-test validation + schema-aligned storage** (Author: Cascade)
  - Fixed Johan_Land ingestion to validate puzzles with multiple test cases using `validateSolverResponseMulti` and store:
    - `multiplePredictedOutputs`
    - `multiTestPredictionGrids`
    - `multiTestResults`
    - `multiTestAllCorrect`
    - `multiTestAverageAccuracy`
  - Removed incorrect usage of trustworthiness/accuracy fields during ingestion.
  - Aligned Johan_Land ingestion TypeScript types to match repository `ExplanationData` expectations.
  - **Files Modified**: `server/scripts/ingest-johanland-results.ts`, `server/types/johanland.ts`, `CHANGELOG.md`

### Version 6.1.58  Dec 15, 2025 (COMPLETED)

- **Johan_Land_Solver_V6 evaluation results ingestion** (Author: Claude Code using Haiku 4.5)
  - Added comprehensive ingestion pipeline for 119 ARC-AGI evaluation results from Johan_Land_Solver_V6 solver.
  - Ingested 238 explanation entries (119 puzzles × 2 attempts each) with detailed judge feedback, reasoning summaries, token usage, and cost data.
  - Rich reasoning extraction: parses structured judge feedback sections (rule summary, audit summary, consistency) and example reasoning into database fields.
  - Reuses HuggingFace ingestion patterns for consistency and maintainability (~80% pattern reuse).
  - Comprehensive validation: grid validation, metadata structure validation, timestamp validation, token/cost field validation.
  - Performance: 84.83% success rate (101/119 puzzles correct on first attempt), total cost $2,841.49, comprehensive token tracking.
  - **Files Created**:
    - `server/types/johanland.ts` (200 lines) — Type definitions for submission format
    - `server/utils/johanlandValidator.ts` (200 lines) — Grid and submission validation utilities
    - `server/utils/johanlandExplanationExtractor.ts` (250 lines) — Reasoning extraction and text parsing
    - `server/scripts/ingest-johanland-results.ts` (700 lines) — Main ingestion script with CLI
  - **Files Modified**: `package.json` (added `ingest-johanland` npm script), `CHANGELOG.md`
  - **Prompt Template**: New entry "external-johan-land" for tracking ingestion source
  - **Database Entries**: All 238 entries successfully stored with complete metadata preservation in `provider_raw_response`

### Version 6.1.57  Dec 15, 2025 (PENDING TESTING)

- **Worm Arena Greatest Hits: show all 20 in a scroll box** (Author: Cascade)
  - Greatest Hits now renders the full curated set (20) inside a fixed-height scroll area so the page stays compact.
  - **Files Modified**: `client/src/components/WormArenaGreatestHits.tsx`, `CHANGELOG.md`

### Version 6.1.56  Dec 15, 2025 (PENDING TESTING)

- **Worm Arena Live: simplified setup UI with direct model selection** (Author: Sonnet 4.5)
  - Replaced overwhelming 15-card curated matchup selector with two clean alphabetically-sorted dropdowns for Model A and Model B.
  - Created `useWormArenaSetup` hook to encapsulate setup state (modelA, modelB, board settings, BYO API key), reducing page component from 19 state variables to 1 hook call.
  - Reordered controls layout: model dropdowns and Start button at top (prominent and immediately visible), advanced settings and BYO key collapsed by default at bottom.
  - Added smooth fade transitions between setup → live → completed states for polished UX.
  - Deleted `WormArenaMatchupSelector` component (no longer needed).
  - **Files Modified**: `client/src/hooks/useWormArenaSetup.ts` (new), `client/src/components/WormArenaRunControls.tsx`, `client/src/pages/WormArenaLive.tsx`, `client/src/components/WormArenaMatchupSelector.tsx` (deleted), `CHANGELOG.md`
