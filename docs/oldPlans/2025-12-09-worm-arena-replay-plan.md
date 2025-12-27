## Goal
Implement Worm Arena replay/visualization parity with upstream SnakeBench by storing completed game assets, exposing them via backend APIs, and rendering ASCII/MP4 replays in the local UI (no iframe).

## Scope (phased)
- **Storage parity**: Store full SnakeBench game JSON files in a `completed_games/` hierarchy compatible with upstream indexing; ensure server keeps indexes and metadata for quick listing.
- **Backend APIs**: Add endpoints to fetch game metadata list, individual game JSON payload, and available replay assets (ASCII frames, MP4 links). Keep `/api/snakebench/games` but enrich it with replay info; add `/api/snakebench/games/:id/replay`.
- **Renderer integration**:
  - **ASCII**: Reuse upstream ASCII renderer logic to stream frames or provide pre-rendered text blocks.
  - **MP4**: Trigger/use Phaser renderer outputs if present; surface URLs/paths to generated MP4s.
  - Ensure APIs gracefully handle missing assets.
- **Frontend (Worm Arena page)**:
  - Replace iframe usage with a local viewer that lists games, lets users select one, and plays back ASCII frames and/or loads MP4 if available.
  - Show metadata (models, score, rounds, timestamps) and basic controls (play/pause/step).
- **Resilience/observability**: Add health checks for asset presence and renderer readiness; ensure errors surface cleanly in UI.

## Tasks (unordered)
- Mirror upstream `completed_games` layout locally; ensure SnakeBench runner writes full game JSON to disk and updates an index file.
- Extend repository/service layer to read indexes and game JSON; compute lightweight summaries and frame pointers.
- Add API routes to serve game lists, single game details, ASCII frame streams, and MP4 locations (if generated).
- Evaluate upstream ASCII renderer; port/minimize needed logic into server or shared util.
- Integrate (or invoke) Phaser MP4 renderer when assets available; otherwise hide/disable video control.
- Update `client/src/pages/SnakeArena.tsx` (Worm Arena) to: list games, select one, view ASCII replay (with basic controls), and show MP4 when available; keep match-run controls minimal.
- Add loading/error states; avoid blank `SelectItem` issues; sanitize inputs.
- Document configuration/env expectations (paths, renderer availability).
- Update changelog per repo convention.

## Open questions
- Do we want on-demand MP4 generation via API, or only consume pre-rendered files?
- Where should completed game assets live (`server/python/completed_games` vs `external/SnakeBench/backend/completed_games`) and how to configure?
- Is streaming of ASCII frames required, or is paginated fetch acceptable for small boards?
