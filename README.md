# ARC-AGI Explainer

[![Live](https://img.shields.io/badge/live-arc.markbarney.net-4f8ef7?style=flat-square)](https://arc.markbarney.net)
[![ARC Prize](https://img.shields.io/badge/ARC%20Prize-Community%20Recognition%202025-f97316?style=flat-square)](https://arcprize.org/blog/arc-prize-2025-results-analysis)
[![X / Twitter](https://img.shields.io/badge/X-%4082deutschmark-000000?style=flat-square&logo=x)](https://x.com/82deutschmark)
[![Discord](https://img.shields.io/badge/Discord-Weekly%20Event-5865F2?style=flat-square&logo=discord)](https://t.co/byuWsVrqhm)

> A personal research platform for ARC-AGI — built by a veteran game producer who isn't trying to solve the benchmark, just trying to understand it and make it easier for the people who are.

---

## Background

I'm a video game producer, not an engineer. I work with engineers. I'm not going to solve ARC-AGI — I just find it fascinating and wanted to build something that might be useful to the people who are actually working on it. Started in July 2025 as a curiosity project, grown into a full research suite. In late 2025, ARC Prize [recognized the effort](https://arcprize.org/blog/arc-prize-2025-results-analysis) — that meant a lot. The platform is live and actively maintained.

---

**Production:** https://arc.markbarney.net
**Staging:** https://arc-explainer-staging.up.railway.app/ (branch `ARC3`)
**Docs:** [CLAUDE.md](./CLAUDE.md) • [API Reference](./docs/reference/api/EXTERNAL_API.md) • [Routes & API list](./docs/reference/architecture/ROUTES_AND_API.md) • [Changelog](./CHANGELOG.md) • [License](./LICENSE)

---

## Quick Start (macOS/zsh)

```bash
# Clone and install
git clone https://github.com/82deutschmark/arc-explainer.git && cd arc-explainer
git submodule update --init --recursive
npm install

# Minimal .env (root)
OPENAI_API_KEY=your_key_here          # needed for OpenAI + Responses API
OPENROUTER_API_KEY=your_key_if_used   # optional; BYOK enforced in prod
DATABASE_URL=postgresql://...         # optional for local DB-backed features

# Run development server
npm run dev  # Allow ~10s to warm up, then open localhost:5000

# Or build and run the production server
npm run prod
```

More detail: [CLAUDE.md](./CLAUDE.md) and [docs/reference/architecture/DEVELOPER_GUIDE.md](./docs/reference/architecture/DEVELOPER_GUIDE.md).

## Environment & Keys (BYOK)

- Production enforces Bring Your Own Key for paid providers (OpenAI, xAI, Anthropic, Google, DeepSeek, OpenRouter). Keys are session-only, never stored.  
- Dev/staging: server keys may exist, but tests should work with your own keys too.  
- Worm Arena & Poetiq flows accept user-supplied keys via UI; backend injects them per session (see [docs/reference/api/EXTERNAL_API.md](./docs/reference/api/EXTERNAL_API.md) and [docs/reference/api/SnakeBench_WormArena_API.md](./docs/reference/api/SnakeBench_WormArena_API.md)).

## What's Here

- **ARC-AGI-3 game guides:** `/arc3/games` — level-by-level rules, pictures and commentary for all 25 public games; the whole set as one markdown file at `/arc3/games.md`.
- **Model attempts you can inspect:** `/task/:taskId` — each saved attempt's reasoning, predicted and expected grids, mismatches, cost and time.
- **Analytics:** `/analytics` — model performance across the ARC-AGI-1 and ARC-AGI-2 datasets, built from imported ARC Prize records.
- **Scoring and comparison:** `/scoring` (two attempts per test input, scored the official way) and `/model-comparison`.
- **Community ARC-3 games:** `/arc3/gallery` — playable games built on ARCEngine, credited to their authors.
- **RE-ARC:** `/re-arc` — generate fresh evaluation sets and validate submissions.
- **APIs:** start with `/api/health`, then `/api/puzzle/overview`; see [EXTERNAL_API.md](./docs/reference/api/EXTERNAL_API.md).

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
**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS, with shadcn/ui and DaisyUI components
**Backend:** Express.js + TypeScript + PostgreSQL (Drizzle ORM) + in-memory fallback
**AI Integration:** Unified BaseAIService pattern supporting 6+ providers
**Real-time:** Server-sent events and WebSocket streaming for solvers and batch progress
**Deployment:** Railway-ready with Docker support

### Key Design Patterns
- **Repository pattern** - Clean separation between data access and business logic
- **Provider abstraction** - Unified interface across OpenAI, Anthropic, xAI, etc.
- **Optimistic updates** - Instant UI feedback with server reconciliation
- **Response preservation** - Raw API responses saved before parsing for debugging
- **Conversation chaining** - Provider-aware context management with 30-day persistence

The full frontend route and backend API listing lives in [docs/reference/architecture/ROUTES_AND_API.md](./docs/reference/architecture/ROUTES_AND_API.md).

---

## For Researchers

- **Model comparison:** reasoning and results across GPT, o-series, Grok, Claude, Gemini and DeepSeek models.
- **Cost and performance:** token usage against accuracy for different providers.
- **Reasoning traces:** stored reasoning from models that release it.
- **Data access:** an open API over all stored attempts, Hugging Face imports of published ARC Prize results, and raw API responses preserved for custom analysis.

**API Documentation:** [docs/reference/api/EXTERNAL_API.md](./docs/reference/api/EXTERNAL_API.md)

---

## About ARC-AGI Puzzles

The Abstract Reasoning Corpus for Artificial General Intelligence (ARC-AGI) is a benchmark for testing fluid intelligence in AI systems.

### Dataset Structure
- **ARC-AGI-1**: 400 training + 400 evaluation puzzles
- **ARC-AGI-2**: 1,000 training + 120 evaluation puzzles (public)
- **Private test sets**: Semi-private (commercial) and fully-private (competition) sets calibrated to same difficulty

### Puzzle Format
Each puzzle consists of:
- **Training examples**: usually 3 input/output pairs (2 to 10 in the public sets) demonstrating the pattern
- **Test cases**: 1 to 4 input grids requiring output prediction
- **Grids**: Rectangular matrices (1x1 to 30x30) with integers 0-9 (visualized as colors or emojis)

### Success Criterion
- Predict **exact** output grid dimensions and all cell values
- 2 attempts allowed per test input
- Must work on **first encounter** with the puzzle

### Data Location
```
data/
├── training/      # 400 ARC-AGI-1 training tasks
├── evaluation/    # 400 ARC-AGI-1 evaluation tasks
├── training2/     # 1,000 ARC-AGI-2 training tasks
├── evaluation2/   # 120 ARC-AGI-2 evaluation tasks
├── arc-heavy/     # 300 ARC-Heavy (BARC) tasks
└── concept-arc/   # 179 ConceptARC tasks
```

**Read the ARC-AGI-2 paper:** [arxiv.org/pdf/2505.11831](https://www.arxiv.org/pdf/2505.11831)

- ARC puzzle GIF generator: `.claude/skills/slack-gif-creator/create_arc_puzzle_gif.py <puzzle_id>` → `arc_puzzle_<id>.gif` (requires `pillow`, `imageio`, `numpy`).  
- Feature flags and toggles: see `shared/utils/featureFlags.ts` and `shared/config/streaming.ts`.

## Contributing

Contributions welcome. Start with [CLAUDE.md](./CLAUDE.md) for coding standards, SRP/DRY expectations, and streaming requirements. Release notes live in [CHANGELOG.md](./CHANGELOG.md).

## License

ARC Explainer's own code, documentation and writing are released under the [MIT License](./LICENSE). The ARC datasets, borrowed solvers, community games and submodules in this repository belong to their authors and keep their own licenses; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

---

**Built by [Mark Barney](https://x.com/82deutschmark)** — video game producer, ARC Prize community member.
Join the weekly community discussion: [Discord event](https://t.co/byuWsVrqhm)

