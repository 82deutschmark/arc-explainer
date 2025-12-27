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

# Run dev server (Vite + API)
npm run test   # warm-up ~10s, then open http://localhost:5173
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

## Utilities

- ARC puzzle GIF generator: `.claude/skills/slack-gif-creator/create_arc_puzzle_gif.py <puzzle_id>` → `arc_puzzle_<id>.gif` (requires `pillow`, `imageio`, `numpy`).  
- Feature flags and toggles: see `shared/utils/featureFlags.ts` and `shared/config/streaming.ts`.

## Contributing

Contributions welcome. Start with [CLAUDE.md](./CLAUDE.md) for coding standards, SRP/DRY expectations, and streaming requirements. Release notes live in [CHANGELOG.md](./CHANGELOG.md); feature history previously in README now lives there.

