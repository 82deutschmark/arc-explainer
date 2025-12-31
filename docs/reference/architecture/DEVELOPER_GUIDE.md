# ARC Explainer Developer Onboarding Guide

* Author: Cascade (ChatGPT)
* Date: 2025-12-30
* PURPOSE: Canonical architectural overview for new contributors, synced with latest Responses API streaming, SnakeBench, ARC3, and repository refactors described in `CHANGELOG.md`, `docs/reference/api/EXTERNAL_API.md`, and Responses API reference docs.
* SRP/DRY check: Pass — Cross-checked against current API reference and changelog entries.

# ARC Explainer Developer Onboarding Guide

*Last Updated: December 30, 2025*

Welcome to the ARC Explainer project! This guide is designed to help new developers understand the project's architecture, locate key files, and contribute effectively. Our goal is to reuse existing components and maintain a clear, modular structure.

## Project Overview

ARC Explainer is a full-stack platform for analyzing ARC puzzles, streaming live SnakeBench matches, and curating encyclopedic explanations. The React (Vite) frontend and Node.js/Express backend share a strict “database-first” contract: everything rendered in the UI must already exist in PostgreSQL so refreshes and external consumers stay consistent.

The platform now spans four major domains:
1. **Puzzle Analysis** — single-turn solvers, Model Debate, conversation chaining, and streaming `/api/stream/analyze` runs.
2. **SnakeBench / Worm Arena** — Real-time match orchestration, insights dashboards, placement stats, and replay streaming.
3. **ARC3 Agent Playground** — Modular per-game resources backed by new shared `arc3Games/` registry files and real ARC-AGI-3 integrations.
4. **RE-ARC Bench** — Self-service dataset generation and evaluation for solver validation, contributed by David Lu (@conundrumer).

### 2025 Architecture Milestones

| Feature | Summary | Key References |
| --- | --- | --- |
| Model Debate & Rebuttals | Tracks `rebutting_explanation_id`, renders debate breadcrumbs, and exposes `/api/explanations/:id/{chain,original}` for recursion. | `client/src/pages/ModelDebate.tsx`, `server/repositories/ExplanationRepository.ts` |
| Conversation Chaining | Responses API `previousResponseId` support with eligibility endpoint and PuzzleDiscussion UI. | `docs/API_Conversation_Chaining.md`, `docs/Responses_API_Chain_Storage_Analysis.md`, `docs/reference/api/EXTERNAL_API.md` |
| Streaming Analyses | Two-step SSE handshake via `/api/stream/analyze` POST + GET, emitting `stream.*` events with OpenAI/xAI specific handlers. Enabled by default (`STREAMING_ENABLED`). | `docs/reference/api/EXTERNAL_API.md`, `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`, `client/src/lib/streaming/analysisStream.ts` |
| SnakeBench Refactor | Monolithic repository split into `GameReadRepository`, `LeaderboardRepository`, `AnalyticsRepository`, etc., plus dedicated prompt + report services. | `server/repositories/*`, `server/services/prompts/wormArenaInsights.ts`, `server/services/wormArena/WormArenaReportService.ts` |
| Model Insights Dashboards | Expanded TrueSkill metrics, run-length charts, and streaming insights for Worm Arena models. | `client/src/pages/WormArenaModels.tsx`, `client/src/components/wormArena/**/*` |
| ARC3 Modularization | `shared/arc3Games/` now stores per-game files with new replay resource type and enhanced spoilers UI. | `shared/arc3Games/index.ts`, `client/src/pages/Arc3GameSpoiler.tsx` |
| Dataset Performance Explorer | Dynamic dataset discovery and `/api/model-dataset/*` endpoints for arbitrary model/dataset combinations. | `docs/reference/api/EXTERNAL_API.md`, `client/src/pages/ModelDatasetPerformance.tsx` |
| RE-ARC Bench | Self-service dataset generation and evaluation platform. Stateless 120-task eval sets with XOR-based seed recovery, HMAC-SHA256 derivation, SSE streaming evaluation, and LRU caching. First major external contribution (David Lu @conundrumer). | `server/services/reArc/reArcService.ts`, `server/utils/reArcCodec.ts`, `client/src/pages/ReArc.tsx`, `docs/plans/2025-12-24-re-arc-interface-plan.md` |

## Core Philosophy: Database-First + SRP Everywhere

1. **Database-first rendering** — Every surface (puzzle explanations, SnakeBench stats, ARC3 spoilers) reads from PostgreSQL or curated JSONs. Frontend components never assume temporary responses; they refetch after each mutation. See `docs/reference/api/EXTERNAL_API.md` and `docs/Analysis_Data_Flow_Trace.md` for request/response contracts.
2. **Strict SRP/DRY** — Repository split ensures each domain (accuracy, trust, cost, SnakeBench stats) owns its SQL. Shared helpers live under `shared/` or `server/utils/`.
3. **Public APIs** — All endpoints remain unauthenticated (do **not** wire `server/middleware/apiKeyAuth.ts`). Researchers rely on open access.
4. **Controlled streaming/state transitions** — Long-running tasks (analysis streaming, Worm Arena live sessions) collapse setup controls once a run starts and surface live telemetry via SSE.

## Directory Structure

The project is organized into three main parts: `client`, `server`, and `shared`.

### `client/` - Frontend Highlights

- **`pages/`** — Route-level surfaces (PuzzleExaminer, PuzzleBrowser, ModelDebate, PuzzleDiscussion, WormArena* pages, Arc3GameSpoiler, KaggleReadinessValidation, etc.).
- **`components/`** — Feature-scoped UI building blocks. Worm Arena now has dedicated subfolders (`wormArena`, `wormArena/stats`) for dashboards, insights reports, and run-length charts.
- **`hooks/`** — Data and state orchestration: `usePuzzle`, `useAnalysisResults`, `useExplanation`, `useWormArenaGreatestHits`, `useWormArenaStreaming`, etc.
- **`lib/streaming/analysisStream.ts`** — Typed handshake helper for SSE analysis sessions (auto POST + GET).
- **`contexts/`** — Shared state (e.g., `AnalysisContext`), plus BYO-provider contexts for SnakeBench live matches.
- **`constants/` & `config/`** — Model metadata, feature flags, streaming defaults.

### `server/` - Backend Highlights

- **`controllers/`** — HTTP entry points (puzzle, analysis stream, accuracy, admin, SnakeBench, ARC3, etc.).
- **`services/`** — AI providers (`services/openai/*`, `services/xai/*`), prompt builders (`services/prompts/*`), streaming orchestrators (`services/streaming/analysisStreamService.ts`), Worm Arena insight services, SnakeBench match runners, and Python bridge helpers.
- **`services/wormArena` & `services/prompts`** — House the new Worm Arena insights pipeline, separating prompt construction from report orchestration.
- **`repositories/`** — SRP-compliant data access: `ExplanationRepository`, `AccuracyRepository`, `TrustworthinessRepository`, `CostRepository`, `MetricsRepository`, plus the SnakeBench-specific repositories (`GameReadRepository`, `GameWriteRepository`, `LeaderboardRepository`, `CurationRepository`, `AnalyticsRepository`) and shared SQL helpers.
- **`routes.ts`** — Registers all public routes; ensure streaming and Worm Arena endpoints are wired here.
- **`storage.ts` / `config`** — Provider credentials, model catalogs, streaming flags.

### `shared/`

- **`types.ts`** — Core interfaces (puzzles, explanations, Worm Arena streaming types, provider metadata).
- **`arc3Games/`** — Modular ARC3 game definitions with dedicated resources, replays, and metadata.
- **`utils/`** — Formatters, correctness helpers, feature flags.
- **`config/streaming.ts` & `shared/modelGroups.ts`** — Shared tuning for streaming defaults and curated model buckets.

### `docs/` and Plans

- **`docs/reference/api/`** — Source of truth for external APIs, Responses API streaming, and conversation chaining.
- **`docs/reference/architecture/`** — This guide plus complementary diagrams.
- **`docs/plans/`** — Required for any multi-step implementation; older plans live under `docs/oldPlans/`.
- **`docs/local-game-insights-dec-2025.md`** — SnakeBench research dump referenced by Worm Arena dashboards.

### `data/`, `external/`, and Submodules

- **`data/`** — ARC datasets (training/evaluation/evaluation2/concept-arc) discovered dynamically by dataset endpoints.
- **`external/SnakeBench/`** — Embedded SnakeBench backend/frontend for local replay analysis; referenced by replay resolvers and CLI tooling.
- **`external/re-arc/`** — RE-ARC library (conundrumer/re-arc) for synthetic puzzle generation. Powers RE-ARC Bench dataset generation and evaluation via Python subprocess.
- **`beetreeARC/`, `poetiq-solver/`, `solver/`** — Python solvers invoked through `pythonBridge`.

## Repository Architecture & Domain Separation

**Status: Verified December 2025** — All repositories adhere to SRP with shared utilities for normalization and SQL fragments.

### Repository Design Principles

1. **Single Responsibility Principle (SRP)**  
   - `AccuracyRepository` — Boolean correctness only (pure solver stats).  
   - `TrustworthinessRepository` — Confidence reliability (no cost math).  
   - `CostRepository` — Aggregated model cost calculations, normalization, and trend queries.  
   - `MetricsRepository` — Delegation aggregator for dashboards.  
   - `GameReadRepository` / `GameWriteRepository` / `LeaderboardRepository` / `AnalyticsRepository` / `CurationRepository` — Each handles a specific Worm Arena concern (recent games, ingestion writes, skill rankings, insights data, curated “greatest hits”).

2. **DRY Enforcement**  
   - Model normalization lives in `shared/utils/featureFlags.ts` + dedicated helpers.  
   - Cost logic centralized; other services depend on `repositoryService.cost`.  
   - SnakeBench SQL fragments live in `server/repositories/snakebenchSqlHelpers.ts` (e.g., `SQL_TRUESKILL_EXPOSED()`).

3. **Delegation Pattern**  
   - Always access repositories through `RepositoryService`.  
   - Example:
     ```typescript
     const accuracyStats = await repositoryService.accuracy.getPureAccuracyStats();
     const trust = await repositoryService.trustworthiness.getTrustworthinessStats();
     const costs = await repositoryService.cost.getModelCostMap();
     const dashboard = await repositoryService.metrics.getComprehensiveDashboard();
     ```

4. **Public API Contracts**  
   - Mirror `docs/reference/api/EXTERNAL_API.md` exactly; do not invent new response shapes without updating documentation + changelog.

## Key Component Reference (2025)

### Server-Side

| Area | Files | Notes |
| --- | --- | --- |
| Puzzle orchestration | `server/controllers/puzzleController.ts`, `server/services/puzzleAnalysisService.ts`, `server/services/streaming/analysisStreamService.ts` | Handles synchronous and streaming analysis flows. |
| Debate + conversation | `server/controllers/debateController.ts`, `server/services/puzzleDiscussionService.ts`, `server/repositories/ExplanationRepository.ts` | Powers ModelDebate & PuzzleDiscussion. |
| AI providers | `server/services/openai/*`, `server/services/xai/*`, `server/services/prompts/*` | Prompts separated from orchestration for SRP. |
| Streaming handshake | `/api/stream/analyze` routes, `analysisStreamService.ts`, `storage.ts` caching | Implements POST handshake + SSE GET contract. |
| SnakeBench | `server/services/snakeBench/*.ts`, `server/services/wormArena/*.ts`, repositories listed above | Match execution, replay resolution, insights streaming. |
| Cost & metrics | `server/controllers/costController.ts`, `repositoryService.cost`, `repositoryService.metrics` | Cost endpoints now rely solely on `CostRepository`. |

### Client-Side

| Area | Files | Notes |
| --- | --- | --- |
| Puzzle UX | `client/src/pages/PuzzleExaminer.tsx`, `client/src/components/puzzle/PuzzleViewer.tsx`, `client/src/hooks/useAnalysisResults.ts` | DB-first refresh cycle; uses SSE when enabled. |
| Debate & discussion | `client/src/pages/ModelDebate.tsx`, `client/src/pages/PuzzleDiscussion.tsx`, `client/src/components/debate/*` | Renders rebuttal chains and conversation history. |
| Streaming utilities | `client/src/lib/streaming/analysisStream.ts`, `client/src/hooks/useAnalysisStream.ts` | Wrap handshake + SSE event parsing. |
| Worm Arena dashboards | `client/src/pages/WormArena*.tsx`, `client/src/components/wormArena/**/*`, `client/src/hooks/useWormArenaStreaming.ts` | Includes live page, insights report, distributions, models, placement stats. |
| ARC3 | `client/src/pages/Arc3GameSpoiler.tsx`, `client/src/components/arc3/*` | Pulls metadata from `shared/arc3Games`. |

### Debate Repository Methods

- `ExplanationRepository.getRebuttalChain(explanationId)`
- `ExplanationRepository.getOriginalExplanation(rebuttalId)`
- `ExplanationRepository.getByPuzzle(puzzleId, correctness)`
- `ExplanationRepository.getEligibleForDiscussion({ limit, offset })` — backs `/api/discussion/eligible`.

## Analysis Streaming & Conversation Infrastructure

1. **Handshake Flow**  
   - `POST /api/stream/analyze` accepts the same payload as synchronous analysis plus `{ taskId, modelKey }`. It caches the payload (with TTL) and returns `{ sessionId, expiresAt }`.  
   - `GET /api/stream/analyze/:taskId/:modelKey/:sessionId` opens the Server-Sent Events channel and replays cached payload data through provider-specific streaming handlers. Event types: `stream.init`, `stream.chunk`, `stream.status`, `stream.complete`, `stream.error`.

2. **Client Utilities**  
   - `createAnalysisStream` automatically performs the POST handshake, then attaches event listeners (including `text.verbosity: "high"` deltas).  
   - UI components collapse setup controls and show live output per `AGENTS.md` “state transitions” rule.

3. **Conversation Chaining**  
   - Store `provider_response_id` (column + `ExplanationData.providerResponseId`).  
   - Pass `previousResponseId` for follow-up calls (same provider only).  
   - `/api/discussion/eligible` filters explanations created within 30 days with response IDs.  
   - Documentation: `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`, `docs/Responses_API_Chain_Storage_Analysis.md`.

4. **Testing**  
   - `tests/analysisStreamService.test.ts` + `.streaming.test.ts` cover chaining, SSE, and fallback handling.  
   - Set `STREAMING_ENABLED=false` in `.env` to disable SSE globally.

## SnakeBench & Worm Arena Stack

1. **Repositories** — Game read/write separation, leaderboard math, curated “greatest hits,” insights analytics, and SQL helper utilities.
2. **Services** — `snakeBenchService.ts` as thin facade; `SnakeBenchMatchRunner` / `SnakeBenchStreamingRunner` for live play; `WormArenaReportService` for LLM insights; `wormArenaStreaming` stack (controller + SSE) for live sessions.
3. **Frontend** — Pages for Stats & Placement, Models, Distributions, Model Insights, Live stream, Greatest Hits, Match search. Components include `WormArenaMatchCard`, `WormArenaRunLengthChart`, `WormArenaModelInsightsReport`, etc.
4. **Streaming Live Matches** — `WormArenaLive` page uses `useWormArenaStreaming` to subscribe to backend SSE statuses (`WormArenaStreamStatus`, `WormArenaFrameEvent`, `WormArenaFinalSummary` in `shared/types.ts`).
5. **Greatest Hits & Replays** — Backed by `SnakeBenchReplayResolver` scanning both `external/SnakeBench/backend/completed_games` and local dirs. API: `/api/snakebench/greatest-hits`, `/api/snakebench/games/:id`.
6. **Insights Enhancements (Dec 2025)** — TrueSkill rankings, run-length filters, streaming insights with Twitter-ready summaries. Check `CHANGELOG.md` 6.16.7–6.16.18 entries for context.

## Python Solvers & External Integrations

Specialized solvers (Saturn, Beetree, Poetiq, Grover, SnakeBench) run as subprocesses launched via `server/services/pythonBridge.ts`.

### Key Files

- `server/services/pythonBridge.ts` — `runBeetreeAnalysis()`, `runPoetiqAnalysis()`, etc., streaming NDJSON back to Node.
- `server/python/beetree_wrapper.py` — Connects to `beetreeARC/src/solver_engine.py`, enriches logs with cost metadata.
- `server/services/beetreeService.ts` — Orchestrates Beetree runs inside the AI service factory.
- `client/src/pages/BeetreeSolver.tsx`, `client/src/hooks/useBeetreeRun.ts` — Frontend entry points.
- `external/SnakeBench/backend/cli/analyze_local_games.py` — Local analytics for Worm Arena “greatest hits.”

### Setup Checklist

1. Initialize submodules (`git submodule update --init --recursive`).
2. Install Python deps (`python -m pip install -r requirements.txt`), which cascades into Beetree requirements.
3. Provide provider keys in `.env` (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, etc.).
4. Optional: run SnakeBench CLI scripts for local replay insights (see `docs/local-game-insights-dec-2025.md`).

## Onboarding Tips

1. **Read the API reference first** — `docs/reference/api/EXTERNAL_API.md` is the contract for every endpoint.
2. **Check the changelog** — Always add a top-level entry when behavior changes; use semantic versioning.
3. **Create plan docs for large tasks** — Store them under `docs/plans/` unless explicitly instructed otherwise.
4. **Respect state transitions** — Collapsible controls + live streaming view patterns apply across PuzzleExaminer, Worm Arena, and forthcoming ARC3 UIs.
5. **Test streaming & fallback paths** — Run `npm run test analysisStreamService` and, when applicable, start local SnakeBench servers for end-to-end validation.

By following this guide and the linked references, new contributors can ramp up quickly while preserving ARC Explainer’s SRP, DRY, and database-first guarantees.
