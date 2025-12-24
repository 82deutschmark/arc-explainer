# ARC-AGI Explainer Platform - A Fan Site for ARC-AGI-3

![ARC Puzzle 08573cc6](.claude/skills/slack-gif-creator/arc_puzzle_08573cc6.gif)

**Version 6.0.12** — December 10, 2025


A hobby platform for analyzing Abstract Reasoning Corpus (ARC-AGI) puzzles using state-of-the-art LLMs with reasoning capture, conversation chaining, and comprehensive performance analytics.

**[Live Production Environment](https://arc.markbarney.net) • [Technical Docs](./CLAUDE.md) • [API Reference](./docs/EXTERNAL_API.md) • [Changelog](./CHANGELOG.md)**

---

## What's New in v6.0

### Worm Arena 6.0 — SnakeBench-powered tournaments & stats
- **Real SnakeBench integration**: Worm Arena now logs matches to SnakeBench-compatible tables (`public.models`, `public.games`, `public.game_participants`) and uses real token-based pricing so costs and TrueSkill ratings are grounded in the same schema as Greg's project.
- **Replay viewer & live matches**: Dedicated Worm Arena pages let you browse recent games, deep-link into specific replays, and watch matches play out with reasoning panels and improved board layout—no more relying on the embedded upstream UI.
- **Stats & placement dashboards**: A new `/worm-arena/stats` page surfaces global Worm Arena KPIs, a large TrueSkill leaderboard, per-model placement progress, and recent match history so you can see how models are converging.
- **Tournament scripts & backfill tooling**: PowerShell helpers and a Python ingest/backfill path make it easy to run reproducible tournaments (e.g., Devstral vs GPT-5) and rebuild SnakeBench stats from local `completed_games` replays.
- **Replay auto-publishing**: Completed games automatically publish to our VoynichLabs/SnakeBench fork's public GitHub repo for Railway and other stateless deployments via GitHub API.

## Previous Highlights

### v5.1.0 - ARC3 Agent Playground & Backend Agent Runner

### ARC3 Agent Playground (In Development)
### 🎮 ARC3 Agent Playground (In Development)
- `/arc3/playground` introduces an interactive lab powered by the OpenAI Agents SDK where users can watch agents attempt to solve real ARC-AGI-3 competition games (like ls20 "LockSmith").
- Features real-time streaming, grid visualization, customizable agent instructions, and performance metrics.
- Integrates with the official ARC-AGI-3 API at three.arcprize.org for authentic game scenarios.
- Global navigation and the ARC3 landing page now link directly to the playground for quick access.

### 🧠 Backend Agent Runner
- Real ARC-AGI-3 game integration via `Arc3ApiClient` connects to the official competition API.
- OpenAI Agents SDK orchestration with Responses API for stateful reasoning across multi-turn puzzle solving.
- SSE-based streaming infrastructure (matching existing analysis streaming patterns) provides real-time agent progress.
- Express routes handle game listing, agent configuration, and streaming gameplay sessions.

### 🧹 Type Safety Improvements
- Hardened Saturn work table state transitions to satisfy strict TypeScript checks after the new build pass.

For additional release notes, see [Changelog](./CHANGELOG.md).

### Earlier Releases
- **v4.8.3**: Restored OpenAI service compilation, enhanced streaming event handling, and delivered the heuristic Python ARC solver with sub-second performance.
- **v4.8.2**: Introduced conversation chaining with 30-day reasoning persistence, batch analysis controls, and richer correctness filtering across the UI.

## Core Capabilities

### 🔗 Conversation Chaining & Progressive Reasoning
- **Multi-turn conversations** - GPT-5, o-series, and Grok-4 models maintain full context across refinement turns
- **30-day reasoning persistence** - Server-side encrypted storage (OpenAI/xAI) eliminates token re-sending costs
- **PuzzleDiscussion mode** - Models iteratively refine their own analyses with complete conversation history
- **Model Debate system** - Challenge incorrect explanations, track rebuttal chains, provider-aware context
- **Response chain visualization** - Complete conversation history with clickable navigation

### 📊 Batch Analysis & Automation
- **Web UI at `/models`** - Full-featured batch analysis interface with real-time progress
- **Parallel processing** - 10 puzzles concurrently with 2s stagger (10-20x faster than sequential)
- **Live activity logs** - Terminal-style feed showing validation results (CORRECT / INCORRECT) per puzzle
- **Resume mode** - Automatically detects and skips already-analyzed puzzles
- **Pause/resume/cancel** - Full session control for long-running batches
- **Click-to-analyze** - ModelBrowser supports instant analysis from "Not Attempted" lists

### 🤖 Multi-Provider AI Integration
- **OpenAI** - GPT-4, GPT-5, o3/o4 models with Responses API and reasoning token tracking
- **xAI** - Grok-4 variants with Responses API and structured outputs
- **Anthropic** - Claude models with Tool Use API for structured reasoning
- **Google** - Gemini models with thought process extraction
- **DeepSeek** - Reasoning models with human-readable thinking logs
- **OpenRouter** - 100+ additional models including Grok-3, uses Chat Completions API

### 🎯 Analysis & Comparison Tools
- **ELO rating system** - Anonymized pairwise comparisons for quality rankings beyond accuracy
- **Correctness filtering** - Show only correct/incorrect results with toggle UI
- **Trustworthiness scoring** - Confidence vs. accuracy to detect overconfidence
- **Cost tracking** - Token usage and API costs across all providers
- **Advanced sorting** - By cost, processing time, or composite difficulty scores
- **Deep linking** - Share specific analyses: `/puzzle/{id}?highlight={explanationId}`

### 🔬 Research & Data Access
- **HuggingFace ingestion** - Import external model predictions with full provenance tracking
- **Admin console** - `/admin` hub for model management, ingestion runs, and system stats
- **Unrestricted API** - Full dataset access for external applications (see `docs/EXTERNAL_API.md`)
- **Raw response storage** - Complete API responses preserved for debugging and analysis
- **Custom prompts** - Design domain-specific prompts for specialized research questions

### ⚡ User Experience
- **Optimistic UI** - Instant feedback with progressive status (ANALYZING → SAVING → COMPLETED)
- **Real-time updates** - WebSocket streaming for Saturn solver and batch progress
- **Skeleton loaders** - No "dead time" waiting for API responses
- **Data sanitization** - Resilient to non-compliant API responses and invalid characters

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd arc-explainer
npm install

# Configure API keys in .env file
OPENAI_API_KEY=your_key_here
DATABASE_URL=postgresql://...  # Optional

# Run development server
npm run test  # Allow ~10s to warm up, then open localhost:5173
```

**For detailed setup, deployment, and technical documentation, see [CLAUDE.md](./CLAUDE.md)**

## Utilities

### ARC Puzzle GIF Generator

Create animated GIFs for any ARC puzzle to share on Slack or other platforms:

```bash
# Navigate to the skill directory
cd .claude/skills/slack-gif-creator

# Generate a GIF for any puzzle
python create_arc_puzzle_gif.py <puzzle_id>

# Examples
python create_arc_puzzle_gif.py 08573cc6
python create_arc_puzzle_gif.py 6855a6e4
```

**Features:**
- Automatically finds puzzles in training or evaluation directories
- Shows all grids: training inputs/outputs + test inputs/outputs
- 2.5 seconds per grid with authentic ARC color palette
- Displays puzzle ID at bottom of each frame
- Output: `arc_puzzle_<puzzle_id>.gif` (validated for Slack's 2MB limit)

**Requirements:** `pip install pillow imageio numpy`

### Streaming feature flag values

- **Server:** `ENABLE_SSE_STREAMING`
- **Client:** `VITE_ENABLE_SSE_STREAMING`

Set either variable to any of the following case-insensitive truthy values to enable SSE streaming for analysis flows: `true`, `1`, `yes`, `y`, `on`, `enable`, `enabled`. All other values (including empty strings) disable streaming.

---

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
  - `/puzzle/:taskId`
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

---

## Contributing

Contributions welcome! This is a hobby project supporting research into AI reasoning capabilities. See [CLAUDE.md](./CLAUDE.md) for architecture details and development guidelines.

---

**Built for research and education in abstract reasoning • [Changelog](./CHANGELOG.md) • [Technical Docs](./CLAUDE.md)**

