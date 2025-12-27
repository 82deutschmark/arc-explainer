# ARC-AGI Explainer Platform

Hobby platform for analyzing ARC puzzles with multi-provider LLMs, reasoning capture, conversation chaining, and performance analytics.

**Production:** https://arc.markbarney.net  
**Staging:** https://arc-explainer-staging.up.railway.app/ (branch `ARC3`)  
**Docs:** [CLAUDE.md](./CLAUDE.md) • [API Reference](./docs/EXTERNAL_API.md) • [Changelog](./CHANGELOG.md)

---

## Quick Start (Windows/PowerShell)

```powershell
# Clone and install
git clone <repository-url> arc-explainer
cd arc-explainer
npm install

# Minimal .env (root)
OPENAI_API_KEY=your_key_here          # needed for OpenAI + Responses API
OPENROUTER_API_KEY=your_key_if_used   # optional; BYOK enforced in prod
DATABASE_URL=postgresql://...         # optional for local DB-backed features

# Run development server
npm run dev  # Allow ~10s to warm up, then open localhost:5173

# Or build and run dev server
npm run build-dev
```

More detail: [CLAUDE.md](./CLAUDE.md) and [docs/reference/architecture/DEVELOPER_GUIDE.md](./docs/reference/architecture/DEVELOPER_GUIDE.md).

## Environment & Keys (BYOK)

- Production enforces Bring Your Own Key for paid providers (OpenAI, xAI, Anthropic, Google, DeepSeek, OpenRouter). Keys are session-only, never stored.  
- Dev/staging: server keys may exist, but tests should work with your own keys too.  
- Worm Arena & Poetiq flows accept user-supplied keys via UI; backend injects them per session (see [docs/reference/api/EXTERNAL_API.md](./docs/reference/api/EXTERNAL_API.md) and [docs/reference/api/SnakeBench_WormArena_API.md](./docs/reference/api/SnakeBench_WormArena_API.md)).

## What to Try First

- **Puzzle Analyst:** `/task/:taskId` — high-density grid of analyses.  
- **Worm Arena:** `/worm-arena` (replays), `/worm-arena/live/:sessionId` (live), `/worm-arena/stats` (leaderboard).  
- **ARC3 playground:** `/arc3/playground` — watch agents solve real ARC-AGI-3 games.  
- **APIs:** start with `/api/health`, then `/api/puzzle/overview`; see EXTERNAL_API.md for the full surface area.

## Working in This Repo

- **Architecture & patterns:** [Developer Guide](./docs/reference/architecture/DEVELOPER_GUIDE.md) (SRP, repositories, services, streaming).  
- **Hooks reference:** [frontend hooks](./docs/reference/frontend/HOOKS_REFERENCE.md).  
- **SnakeBench/Worm Arena API:** [SnakeBench_WormArena_API.md](./docs/reference/api/SnakeBench_WormArena_API.md).  
- **BYOK details:** [EXTERNAL_API.md](./docs/reference/api/EXTERNAL_API.md).  
- **Data:** ARC puzzles under `data/`; SnakeBench replays under `external/SnakeBench/backend/completed_games`.  
- **Streaming contract:** see Responses API docs in `docs/reference/api/` (ResponsesAPI.md, OpenAI_Responses_API_Streaming_Implementation.md).

## Deployment Notes

- **Staging:** Railway at `arc-explainer-staging.up.railway.app`, tracking branch `ARC3`.  
- **Production:** auto-deploys from `main`. Use PRs into `ARC3`; do not push breaking changes directly to `main`.  
- **Env flags:** `ENABLE_SSE_STREAMING` (server), `VITE_ENABLE_SSE_STREAMING` (client).

## Architecture Overview

### Technology Stack
**Frontend:** React 18 + TypeScript + Vite + TailwindCSS + DaisyUI components
**Backend:** Express.js + TypeScript + PostgreSQL (Drizzle ORM) + in-memory fallback
**AI Integration:** Unified BaseAIService pattern supporting 6+ providers
**Real-time:** WebSocket streaming for Saturn solver and batch progress
**Deployment:** Railway-ready with Docker support

### Key Design Patterns
- **Repository pattern** - Clean separation between data access and business logic
- **Provider abstraction** - Unified interface across OpenAI, Anthropic, xAI, etc.
- **Optimistic updates** - Instant UI feedback with server reconciliation
- **Response preservation** - Raw API responses saved before parsing for debugging
- **Conversation chaining** - Provider-aware context management with 30-day persistence

### Routes

#### Frontend routes (wouter)

- **Home / puzzles**
  - `/`
  - `/browser`
  - `/task/:taskId` (new default - Puzzle Analyst)
  - `/puzzle/:taskId` (legacy - PuzzleExaminer)
  - `/examine/:taskId`
  - `/puzzles/database`
- **Discussion**
  - `/discussion`
  - `/discussion/:taskId`
- **Analytics / rankings**
  - `/analytics`
  - `/leaderboards`
  - `/elo`
  - `/elo/leaderboard`
  - `/elo/:taskId`
  - `/compare`
  - `/compare/:taskId`
- **Feedback / debate**
  - `/feedback`
  - `/test-solution`
  - `/test-solution/:taskId`
  - `/debate`
  - `/debate/:taskId`
- **Models**
  - `/models`
  - `/model-config`
  - `/model-comparison`
- **Solvers**
  - `/puzzle/saturn/:taskId`
  - `/puzzle/grover/:taskId`
  - `/puzzle/beetree/:taskId?`
  - `/puzzle/poetiq/:taskId`
  - `/poetiq`
- **ARC3**
  - `/arc3`
  - `/arc3/playground`
  - `/arc3/games`
  - `/arc3/games/:gameId`
- **Worm Arena / SnakeBench**
  - `/snakebench`
  - `/snake-arena` (redirect)
  - `/worm-arena`
  - `/worm-arena/live`
  - `/worm-arena/live/:sessionId`
  - `/worm-arena/matches`
  - `/worm-arena/stats`
  - `/worm-arena/models` (new - model match history)
  - `/worm-arena/rules` (new - rules & prompt transparency)
- **Admin**
  - `/admin`
  - `/admin/models`
  - `/admin/ingest-hf`
  - `/admin/openrouter`
- **Other**
  - `/trading-cards`
  - `/hall-of-fame`
  - `/human-cards` (redirect)
  - `/kaggle-readiness`
  - `/scoring`
  - `/about`
  - `/llm-reasoning`
  - `/llm-reasoning/advanced`
  - plus a catch-all 404

#### Backend API routes (Express)

- **Health**
  - `GET /api/health`
- **Models**
  - `GET /api/models`
  - `GET /api/models/:modelKey`
  - `GET /api/models/provider/:provider`
- **Model management (GUI)**
  - `GET /api/model-management/list`
  - `GET /api/model-management/stats`
  - `GET /api/model-management/search`
  - `POST /api/model-management/validate`
  - `POST /api/model-management/toggle-active`
  - `POST /api/model-management/create-alias`
  - `POST /api/model-management/add`
  - `PUT /api/model-management/notes`
  - `DELETE /api/model-management/delete`
  - `GET /api/model-management/openrouter-models`
- **ARC puzzles**
  - `GET /api/puzzle/list`
  - `GET /api/puzzle/overview`
  - `GET /api/puzzle/task/:taskId`
  - `POST /api/puzzle/bulk-status`
  - `POST /api/puzzle/analyze/:taskId/:model`
  - `POST /api/puzzle/analyze-list`
  - `GET /api/puzzle/:puzzleId/has-explanation`
  - `POST /api/puzzle/reinitialize`
  - `POST /api/puzzle/validate` (returns 501)
  - Stats:
    - `GET /api/puzzle/accuracy-stats`
    - `GET /api/puzzle/general-stats`
    - `GET /api/puzzle/raw-stats`
    - `GET /api/puzzle/performance-stats`
    - `GET /api/puzzle/performance-stats-filtered`
    - `GET /api/puzzle/trustworthiness-stats-filtered`
    - `GET /api/puzzle/confidence-stats`
    - `GET /api/puzzle/worst-performing`
    - `GET /api/puzzles/stats`
- **Generic analysis SSE**
  - `POST /api/stream/analyze`
  - `GET /api/stream/analyze/:taskId/:modelKey/:sessionId`
  - `DELETE /api/stream/analyze/:sessionId`
  - `POST /api/stream/cancel/:sessionId`
- **Discussion**
  - `GET /api/discussion/eligible`
- **Metrics & cost**
  - `GET /api/metrics/reliability`
  - `GET /api/metrics/comprehensive-dashboard`
  - `GET /api/metrics/compare`
  - `GET /api/metrics/costs/models`
  - `GET /api/metrics/costs/models/map`
  - `GET /api/metrics/costs/models/:modelName`
  - `GET /api/metrics/costs/models/:modelName/trends`
  - `GET /api/metrics/costs/system/stats`
- **Model dataset performance**
  - `GET /api/model-dataset/performance/:modelName/:datasetName`
  - `GET /api/model-dataset/models`
  - `GET /api/model-dataset/datasets`
  - `GET /api/model-dataset/metrics/:modelName/:datasetName`
- **Prompts**
  - `POST /api/prompt/preview/:provider/:taskId`
  - `GET /api/prompts`
  - `POST /api/prompt-preview`
- **Explanations**
  - `GET /api/puzzle/:puzzleId/explanations/summary`
  - `GET /api/puzzle/:puzzleId/explanations`
  - `GET /api/puzzle/:puzzleId/explanation`
  - `GET /api/explanations/:id`
  - `POST /api/puzzle/save-explained/:puzzleId`
  - Rebuttal chain:
    - `GET /api/explanations/:id/chain`
    - `GET /api/explanations/:id/original`
- **Feedback + solutions**
  - `POST /api/feedback`
  - `GET /api/feedback`
  - `GET /api/feedback/stats`
  - `GET /api/feedback/accuracy-stats`
  - `GET /api/feedback/accuracy-stats-filtered`
  - `GET /api/feedback/overconfident-models`
  - `GET /api/feedback/debate-accuracy-stats`
  - `GET /api/explanation/:explanationId/feedback`
  - `GET /api/puzzle/:puzzleId/feedback`
  - `GET /api/puzzles/:puzzleId/solutions`
  - `POST /api/puzzles/:puzzleId/solutions`
  - `POST /api/solutions/:solutionId/vote`
  - `GET /api/solutions/:solutionId/votes`
- **ELO**
  - `GET /api/elo/comparison`
  - `GET /api/elo/comparison/:puzzleId`
  - `POST /api/elo/vote`
  - `GET /api/elo/leaderboard`
  - `GET /api/elo/models`
  - `GET /api/elo/stats`
- **Saturn**
  - `POST /api/saturn/analyze/:taskId`
  - `GET /api/stream/saturn/:taskId/:modelKey`
  - `POST /api/saturn/analyze-with-reasoning/:taskId`
  - `GET /api/saturn/status/:sessionId`
- **Grover**
  - `POST /api/puzzle/grover/:taskId/:modelKey`
  - `GET /api/stream/grover/:taskId/:modelKey`
  - `GET /api/grover/status/:sessionId`
- **Poetiq**
  - `POST /api/poetiq/solve/:taskId`
  - `POST /api/poetiq/batch`
  - `GET /api/poetiq/batch/:sessionId`
  - `GET /api/poetiq/status/:sessionId`
  - `GET /api/poetiq/models`
  - `GET /api/poetiq/community-progress`
  - `GET /api/poetiq/stream/:sessionId`
  - `POST /api/poetiq/stream/solve/:taskId`
  - `POST /api/poetiq/stream/start/:sessionId`
- **Beetree**
  - `POST /api/beetree/run`
  - `GET /api/beetree/status/:sessionId`
  - `POST /api/beetree/estimate`
  - `GET /api/beetree/history/:taskId`
  - `GET /api/beetree/cost-breakdown/:explanationId`
  - `POST /api/beetree/cancel/:sessionId`
  - `GET /api/stream/analyze/beetree-:sessionId`
- **SnakeBench**
  - `GET /api/snakebench/models-with-games` (new)
  - `GET /api/snakebench/model-history-full` (new)
  - `GET /api/snakebench/model-insights` (new)
  - `GET /api/snakebench/llm-player/prompt-template` (new)
  - `POST /api/snakebench/run-match`
  - `POST /api/snakebench/run-batch`
  - `GET /api/snakebench/games`
  - `GET /api/snakebench/games/:gameId`
  - `GET /api/snakebench/matches`
  - `GET /api/snakebench/health`
  - `GET /api/snakebench/recent-activity`
  - `GET /api/snakebench/leaderboard`
  - `GET /api/snakebench/stats`
  - `GET /api/snakebench/model-rating`
  - `GET /api/snakebench/model-history`
  - `GET /api/snakebench/greatest-hits`
  - `GET /api/snakebench/trueskill-leaderboard`
- **Worm Arena Live SSE**
  - `POST /api/wormarena/prepare`
  - `GET /api/wormarena/stream/:sessionId`
- **ARC3**
  - `GET /api/arc3/default-prompt`
  - `GET /api/arc3/system-prompts`
  - `GET /api/arc3/system-prompts/:id`
  - `GET /api/arc3/games`
  - `POST /api/arc3/start-game`
  - `POST /api/arc3/manual-action`
  - `POST /api/arc3/real-game/run`
  - `POST /api/arc3/stream/prepare`
  - `GET /api/arc3/stream/:sessionId`
  - `POST /api/arc3/stream/cancel/:sessionId`
  - `POST /api/arc3/stream/:sessionId/continue`
  - `GET /api/arc3/stream/:sessionId/continue-stream`
- **Batch**
  - `POST /api/batch/start`
  - `GET /api/batch/status/:sessionId`
  - `POST /api/batch/pause/:sessionId`
  - `POST /api/batch/resume/:sessionId`
  - `GET /api/batch/results/:sessionId`
  - `GET /api/batch/sessions`
- **Admin**
  - `GET /api/admin/quick-stats`
  - `GET /api/admin/recent-activity`
  - `POST /api/admin/validate-ingestion`
  - `POST /api/admin/start-ingestion`
  - `GET /api/admin/ingestion-history`
  - `GET /api/admin/hf-folders`
  - OpenRouter admin:
    - `GET /api/admin/openrouter/catalog`
    - `GET /api/admin/openrouter/discover`
    - `POST /api/admin/openrouter/import`
    - `GET /api/admin/openrouter/sync-config`
  - Recovery helpers:
    - `GET /api/admin/recovery-stats`
    - `POST /api/admin/recover-multiple-predictions`

---

## For Researchers

This platform enables systematic study of AI reasoning capabilities on abstract visual patterns:

### Research Use Cases
- **Model comparison** - Evaluate reasoning across GPT-5, o-series, Grok-4, Claude, Gemini, DeepSeek
- **Cost-performance analysis** - Token usage vs. accuracy trade-offs for different providers
- **Confidence calibration** - Study overconfidence patterns and trustworthiness scoring
- **Reasoning depth** - Analyze structured thinking from models with reasoning token support
- **Conversation dynamics** - Track how context affects progressive reasoning refinement
- **Batch evaluation** - Large-scale systematic testing across 1,000+ puzzles

### Data Access
- **Unrestricted API** - Full programmatic access to all analyses and metrics
- **HuggingFace integration** - Import external predictions for comparative analysis
- **Raw response storage** - Complete API payloads preserved for custom analysis
- **Custom prompts** - Design specialized evaluation frameworks

**API Documentation:** [docs/EXTERNAL_API.md](./docs/EXTERNAL_API.md)

---

## About ARC-AGI Puzzles

The Abstract Reasoning Corpus for Artificial General Intelligence (ARC-AGI) is a benchmark for testing fluid intelligence in AI systems.

### Dataset Structure
- **ARC-AGI-1**: 400 training + 400 evaluation puzzles
- **ARC-AGI-2**: 1,000 training + 120 evaluation puzzles (public)
- **Private test sets**: Semi-private (commercial) and fully-private (competition) sets calibrated to same difficulty

### Puzzle Format
Each puzzle consists of:
- **Training examples**: 3 input/output pairs demonstrating the pattern
- **Test cases**: 1-2 input grids requiring output prediction
- **Grids**: Rectangular matrices (1x1 to 30x30) with integers 0-9 (visualized as colors or emojis)

### Success Criterion
- Predict **exact** output grid dimensions and all cell values
- 2 attempts allowed per test input
- Must work on **first encounter** with the puzzle
- Human performance: ~66% on evaluation set

### Data Location
```
data/
├── training/      # 1000 tasks for algorithm training
├── evaluation/    # 120 tasks for testing (ARC-AGI-1)
├── evaluation2/   # 120 tasks for testing (ARC-AGI-2)
└── training2/     # Additional training tasks
```

**Read the ARC-AGI-2 paper:** [arxiv.org/pdf/2505.11831](https://www.arxiv.org/pdf/2505.11831)

- ARC puzzle GIF generator: `.claude/skills/slack-gif-creator/create_arc_puzzle_gif.py <puzzle_id>` → `arc_puzzle_<id>.gif` (requires `pillow`, `imageio`, `numpy`).  
- Feature flags and toggles: see `shared/utils/featureFlags.ts` and `shared/config/streaming.ts`.

## Contributing

Contributions welcome. Start with [CLAUDE.md](./CLAUDE.md) for coding standards, SRP/DRY expectations, and streaming requirements. Release notes live in [CHANGELOG.md](./CHANGELOG.md); feature history previously in README now lives there.

