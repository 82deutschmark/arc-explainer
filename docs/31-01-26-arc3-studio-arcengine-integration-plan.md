# 2026-01-31 ARC3 Studio (Official) + ARCEngine Integration Plan

## What Mark (the owner) explicitly wants (source of truth)

1. **Archive everything ARC3-preview-related that is currently on the site** because it is now out of date (example: **LS20 is no longer the same game**), and our existing ARC3 pages/metadata are now “historical preview” content.
2. **Replace the ARC3 section with the official direction**: ARC3 becomes a one-stop shop for **community-made ARC3 games**.
3. The official ARC3 experience going forward must focus on:
   - **Making ARC3 games** (authoring/editing workflow)
   - **Sharing community-made games**
   - **Cataloging all community games in our database**
4. **First-pass implementation priority**: ship the **community showcase** (a simple list UI is fine). The critical part is the **backend architecture** so games are:
   - uploadable (Python ARCEngine games)
   - loadable
   - playable (interactive)
   - curatable (minimal curation is fine for v1)
5. We already have patterns for Node <-> Python bridging (ex: Saturn solver). We must reuse/extend those patterns efficiently.

This document is a master plan for the dev team. It includes: routes to archive, architecture changes, backend contracts, and a phased file-by-file execution plan.

---

## Executive summary (recommended approach)

### Recommendation (pragmatic + safe)

Build ARC3 Studio as two parallel “tracks”:

1. **Official ARC3 Studio (new)**: community game catalog, submission flow, and a runtime that can play ARCEngine games.
2. **ARC3 Preview Archive (old)**: move current ARC3 pages and their metadata under clearly labeled “Preview (Archived)” routes. Keep them accessible, but de-emphasized.

For the runtime:

- **Use a Python runner per session** (spawned from Node) that loads an ARCEngine game and processes actions (RESET, ACTION1-6, ACTION7) to return 64x64 frames.
- **Keep the Python process alive for the session** so the game is truly interactive without replaying history.
- Communicate using a **line-delimited JSON protocol (NDJSON)**. This matches existing patterns in this repo:
  - `server/services/pythonBridge.ts` (Saturn / Beetree)
  - `server/services/arc3/Arc3OpenRouterPythonBridge.ts` (NDJSON parsing)

For submissions:

- Accept user uploads into a “submission” queue.
- Publish games into the catalog after minimal review.
- **Security note (important):** executing arbitrary user-uploaded Python code inside the production server process is dangerous. For v1, we can still ship a working “playable catalog” by:
  - starting with curated games (internal / admin-approved) that are known-safe, and
  - implementing submissions as “stored + pending review” (and only executed after approval).
  - adding hard sandboxing later as a Phase 2/3 hardening project.

---

## ARCEngine deep dive (what it is, and why it matters)

ARCEngine in `external/ARCEngine/` is a **Python 3.12+** library (MIT license) with:

- **Core classes**
  - `ARCBaseGame`: subclass and implement `step()`
  - `Level`: list of `Sprite`s, optional `grid_size`, optional `placeable_areas`
  - `Sprite`: 2D palette pixels, transform (x/y/scale/rotation/mirror), collision behaviors, tags
  - `Camera`: renders a fixed **64x64** output frame with auto-scaling and letterboxing
- **Actions**
  - `RESET` (0)
  - `ACTION1`-`ACTION5` (simple actions)
  - `ACTION6` (complex: `x`, `y` in **display space** 0-63, like official ARC3 clicks)
  - `ACTION7` exists (used for undo by convention), but is not in the default `available_actions` list.
- **Output**
  - `FrameData.frame` is a list of frames: `list[list[list[int]]]` (N frames, each 64x64)
  - `GameState` is `NOT_PLAYED | NOT_FINISHED | WIN | GAME_OVER`
  - Scoring is expressed as `levels_completed` and `win_levels` (map cleanly to score and win_score)
- **Important engine conventions**
  - Negative pixels are treated as transparent in rendering; `-1` is special for pixel-perfect collision transparency.
  - `Camera` always outputs 64x64, regardless of internal grid size (auto upscaling + letterboxing).
  - Tags influence behaviors:
    - `sys_static`: pixel-perfect sprites can be merged at Level construction for performance.
    - `sys_click` / `sys_place`: used by internal valid-action enumeration for ACTION6.
    - `sys_every_pixel`: every visible pixel becomes clickable.
  - `ActionInput.reasoning`: optional JSON-serialisable blob, capped at 16 KB. This lines up well with our existing ARC3 “reasoning blob” conventions.

Takeaway:

- ARCEngine gives us the exact “ARC3-like” interaction model we need (actions + 64x64 frames).
- But it is **a library**, not a server. We must build the runtime + API surface ourselves.

If upstream ARCEngine moves quickly, a quick web search for breaking changes or official usage notes may be necessary before implementation.

---

## Target product behavior (v1)

### New official ARC3 section (what users see)

- A single landing page that is the community hub:
  - list of community games (simple list is fine)
  - “Submit your game” button (upload)
  - “Play” button on each published game

### Play experience (minimum viable)

- Click into a game:
  - Start a session
  - See the 64x64 grid
  - Use action buttons (RESET, ACTION1-6, ACTION7)
  - For ACTION6: click on the grid to send x,y (0-63)
  - Multi-frame actions should animate (ARCEngine supports 1-N frames per action)

### Submission experience (minimum viable)

- A user uploads a `.zip` (recommended) or single `.py` file.
- The server stores it as a “submission” with metadata and a status:
  - `pending_review` (default)
  - `published` (approved, shows in catalog)
  - `rejected` (optional)
  - `disabled` (optional)
- In v1, curation can be “admin only” and minimal (a straight list is fine).

---

## Non-negotiable technical constraints (explicit)

1. **Do not delete the preview archive**. Archive it, label it, keep it accessible.
2. **Do not present preview metadata as current.** We must clearly label it as historical/outdated.
3. **Reuse existing Node<->Python bridging patterns** and keep responsibilities separated (SRP).
4. **Do not create a complex UI in v1.** Simple list UI is fine; backend correctness is the priority.

---

## Route plan (what gets archived, what becomes official)

### Current ARC3 routes (today)

Frontend:
- `/arc3` (ARC3Browser informational landing)
- `/arc3/games` (preview/eval game metadata browser)
- `/arc3/games/:gameId` (spoiler pages)
- `/arc3/playground` (agent playground)
- `/arc3/openrouter-playground`
- `/arc3/codex-playground`
- `/arc3/haiku-playground`

Backend:
- `/api/arc3/*` (official ARC3 API integration)
- `/api/arc3-openrouter/*`
- `/api/arc3-codex/*`
- `/api/arc3-haiku/*`

### Proposed official ARC3 routes (new)

Frontend (official):
- `/arc3` becomes **ARC3 Studio** (Community Games hub)
- `/arc3/community/:slug` (Game detail + Play)
- `/arc3/submit` (Submit game)

Frontend (archived preview):
- `/arc3/preview` (old `/arc3`)
- `/arc3/preview/games` (old `/arc3/games`)
- `/arc3/preview/games/:gameId` (old `/arc3/games/:gameId`)
- `/arc3/preview/playground` (old `/arc3/playground`)
- `/arc3/preview/openrouter-playground`
- `/arc3/preview/codex-playground`
- `/arc3/preview/haiku-playground`

Backend:
- Keep existing `/api/arc3*` endpoints intact (they are useful, but now “preview track”).
- Add new endpoints for the community engine under a new prefix (example):
  - `/api/arc3-community/*`

This prevents breaking old functionality while giving the new system a clean separation.

---

## Backend architecture (recommended)

### Components to add

1. **Arc3CommunityRepository** (DB access)
   - CRUD for games and submissions
   - Separate tables for community content (do not overload existing `arc3_sessions`)

2. **Arc3CommunityService** (business logic)
   - list published games
   - handle submissions (store, validate, status transitions)
   - start play sessions
   - route actions to the runtime runner

3. **ArcEngineSessionManager** (in-memory session map)
   - sessionId -> running Python process + metadata + last activity timestamp
   - TTL cleanup + hard-kill on idle
   - per-session action queue to prevent concurrent writes to stdin

4. **Python runner: `arcengine_session_runner.py`**
   - long-lived process for one session
   - receives action requests over stdin (NDJSON)
   - returns FrameData over stdout (NDJSON)

### Why “one Python process per session”

Pros:
- True interactive experience (stateful game object)
- Simplest to implement and reason about
- Matches our existing “spawn a Python worker” patterns
- Easy to cap (max sessions) and kill (idle TTL)

Cons:
- Untrusted code risk (mitigate via curation and later sandboxing)
- More processes under load (acceptable for 4-5 users)

---

## Node <-> Python protocol (v1 spec)

Use NDJSON both directions (one JSON object per line).

### Node -> Python messages

- `init`
  - `{ "type": "init", "game": { "source": "curated" | "submission", "id": "...", "entrypoint": "module:ClassName", "files": {...} }, "seed": 0 }`
- `action`
  - `{ "type": "action", "action": { "id": 0-7, "data": { "x": 0-63, "y": 0-63 }, "reasoning": <optional json> } }`
- `close`
  - `{ "type": "close" }`

### Python -> Node messages

- `ready`
  - `{ "type": "ready", "game_id": "...", "available_actions": [1,2,3,4,5,6] }`
- `frame`
  - `{ "type": "frame", "frameData": { ...ARCEngine FrameData... }, "actionIndex": 12 }`
- `error`
  - `{ "type": "error", "message": "...", "details": "...optional..." }`

### Mapping ARCEngine output to UI expectations

ARCEngine:
- `levels_completed` -> UI `score`
- `win_levels` -> UI `win_score`
- `frame` (list of 2D frames) -> UI expects `number[][][]` (works)
- `state` -> UI `state` (string)

Goal: reuse `client/src/components/arc3/Arc3GridVisualization.tsx` and the action button panel patterns.

---

## Database design (v1)

We need a persistent catalog and submission queue.

Recommended tables (names can vary, but keep them separate from official ARC3 tables):

1. `arc3_community_game_submissions`
   - `id` (string id, ex: nanoid)
   - `created_at`, `updated_at`
   - `status` (`pending_review` | `published` | `rejected` | `disabled`)
   - `title`, `description`, `author_name`, `license`, `tags` (optional)
   - `entrypoint` (module:Class or module:create_game factory)
   - `zip_bytes` (bytea) OR `source_text` (text) depending on upload type
   - `review_notes` (text)

2. `arc3_community_games`
   - `id`
   - `slug` (unique, for URLs)
   - `title`, `description`
   - `published_submission_id` (FK)
   - `created_at`, `updated_at`
   - `is_featured` (optional)

3. `arc3_community_sessions` (optional for v1, but recommended)
   - `id` (session id)
   - `game_id`
   - `started_at`, `ended_at`
   - `last_activity_at`
   - `action_count`
   - `state`, `score`, `win_score`

v1 can keep sessions in memory and skip session persistence, but we should still design the table so we can add persistence without rewrites.

Implementation note for this repo:
- Many tables are created via `server/repositories/database/DatabaseSchema.ts` (manual SQL).
- We should add new `createArc3Community...Table()` methods there and keep the initialization ordering clear.

---

## Frontend plan (v1)

### Pages to add (new official)

- `ARC3CommunityHub` (new `/arc3`)
  - fetch list of published games
  - simple list UI (title, short description, play button)
  - submit button

- `ARC3CommunityGame` (new `/arc3/community/:slug`)
  - start session
  - show grid + action panel
  - animate multi-frame actions

- `ARC3CommunitySubmit` (new `/arc3/submit`)
  - upload form
  - show “pending review” status after submit

### Pages to archive (preview)

Move the existing pages without deleting them:
- `client/src/pages/ARC3Browser.tsx` -> used at `/arc3/preview`
- `client/src/pages/Arc3GamesBrowser.tsx` -> used at `/arc3/preview/games`
- `client/src/pages/Arc3GameSpoiler.tsx` -> used at `/arc3/preview/games/:gameId`
- Playground pages -> `/arc3/preview/*`

Add clear “Preview (Archived)” banners and remove/soften claims that are now outdated.

---

## File-by-file execution plan (phased)

### Phase 0: Archive preview ARC3 (routing + labels)

Goal: keep everything working, but move it under `/arc3/preview/*` and remove the perception that it is current.

Primary files:
- `client/src/App.tsx` (route remap)
- `client/src/components/layout/AppNavigation.tsx` (nav labels and links)
- `client/src/pages/ARC3Browser.tsx` (banner copy: “Preview archive, outdated”)
- `client/src/pages/Arc3GamesBrowser.tsx`
- `client/src/pages/Arc3GameSpoiler.tsx`
- `shared/arc3Games/*` (treat as preview-only data; optionally move to `shared/arc3PreviewGames/`)
- `docs/arc3-game-analysis/*` (move or label as preview archive)
- `arc3/*.jsonl` and any linked replay assets (move under a preview archive namespace)

Acceptance criteria:
- Old pages reachable under `/arc3/preview/*`
- `/arc3` no longer points to preview content
- No preview metadata is presented as “current official”

### Phase 1: Add community catalog backend (DB + list endpoint)

Goal: the site can show an empty (or seeded) list of community games from DB.

Primary files:
- `server/repositories/database/DatabaseSchema.ts` (new tables)
- `server/repositories/Arc3CommunityRepository.ts` (new)
- `server/services/arc3CommunityService.ts` (new)
- `server/routes/arc3Community.ts` (new router)
- `server/routes.ts` (mount `/api/arc3-community`)
- `shared/types.ts` (add shared types for community games if needed)

Endpoints (v1):
- `GET /api/arc3-community/games` (published only)

Acceptance criteria:
- `/api/arc3-community/games` returns a stable typed payload
- frontend hub can render list

### Phase 2: Add ARCEngine runtime (playable sessions)

Goal: click “Play” and actually interact with an ARCEngine game.

Primary files:
- `server/python/arcengine_session_runner.py` (new)
- `server/services/arc3/ArcEnginePythonBridge.ts` (new) OR extend `server/services/pythonBridge.ts` carefully
- `server/services/arc3CommunitySessionService.ts` (new; owns session map + TTL)
- `server/routes/arc3Community.ts` (add session endpoints)

Endpoints (v1):
- `POST /api/arc3-community/sessions` (start session by game slug)
- `POST /api/arc3-community/sessions/:sessionId/action` (send action id + optional coords)
- `POST /api/arc3-community/sessions/:sessionId/close` (end session)

Acceptance criteria:
- A curated game can be played end-to-end (RESET + actions + WIN/GAME_OVER)
- Multiple frames per action animate correctly
- Idle sessions are cleaned up (no zombie python processes)

### Phase 3: Submission pipeline (store uploads + minimal review)

Goal: users can submit games; admins can publish them.

Primary files:
- `server/routes/arc3Community.ts` (upload + admin publish endpoints)
- `server/services/arc3CommunityService.ts` (submission validation + status transitions)
- `client/src/pages/ARC3CommunitySubmit.tsx` (new)
- `client/src/pages/AdminHub.tsx` (optional: add a minimal “ARC3 submissions” section)

Endpoints:
- `POST /api/arc3-community/submissions` (upload)
- `GET /api/arc3-community/submissions` (admin-only)
- `POST /api/arc3-community/submissions/:id/publish` (admin-only)

Security stance for v1:
- Do not execute “pending” submissions.
- Only execute “published” submissions (approved).
- Keep published submissions limited to trusted reviewers until we add hard sandboxing.

### Phase 4 (post-v1): Hardening + authoring UX

Hardening (recommended):
- OS-level sandboxing for user code execution (container isolation, no network, CPU/memory limits)
- Deterministic runtime constraints (max frames per action already exists in ARCEngine; add per-action wall-clock timeout)
- Static checks of uploaded code (deny dangerous imports, large files, non-utf8)

Authoring UX (recommended):
- In-browser template generator (not full IDE):
  - choose template (maze, click-to-place, merge, etc.)
  - generate a zip + manifest for download
- Later: embedded code editor for advanced users

---

## Curated game strategy (how we get “playable” quickly)

To ship a working playable catalog fast and safely:

1. Start by publishing a small set of curated games:
   - Port (or wrap) a subset of `external/ARCEngine/examples/*.py` into our own curated folder.
2. Define a simple manifest format for curated games:
   - `title`, `slug`, `description`, `entrypoint`, `tags`, `recommended_actions`
3. The runtime loads only curated manifests in v1.
4. Submissions are accepted and stored, but only become runnable when published.

This satisfies:
- “community showcase” (list UI + catalog)
- “playable” (for curated games)
- “upload and curate” (pipeline exists)

---

## Risks and mitigations (read this before implementing)

### Risk: executing arbitrary user Python code

This is the largest risk. Without sandboxing, it is unsafe to run untrusted Python uploaded by the public.

Mitigations in this plan:
- v1 runs curated games; submissions are stored and reviewed before publish.
- Add sandboxing in Phase 4 before enabling “instant publish” or untrusted execution.

### Risk: performance (multi-frame animations)

Mitigations:
- Cap frames per action (ARCEngine already caps at 1000)
- Add a Node-side wall-clock timeout per action (example: 2 seconds)
- Cap concurrent sessions (example: 5)

### Risk: Python version and dependencies

Mitigations:
- ARCEngine requires Python 3.12+. Confirm in prod container.
- Ensure numpy + pydantic are installed in the runtime image.

---

## “Who does what” (suggested work split)

Backend developer:
- DB tables + repository + routes under `/api/arc3-community`
- Python runner + Node session manager bridge

Frontend developer:
- New `/arc3` hub page + `/arc3/community/:slug` player + `/arc3/submit`
- Route remap for preview archive and nav changes

Curator/admin (initially Mark or a trusted dev):
- Publish curated games
- Review submissions and publish when safe

---

## Appendix A: Code pointers (where to study existing patterns)

Node<->Python bridging patterns:
- `server/services/pythonBridge.ts` (Saturn/Beetree NDJSON protocol)
- `server/services/arc3/Arc3OpenRouterPythonBridge.ts` (spawn + NDJSON parsing + TTL cancel)
- `server/services/streaming/SSEStreamManager.ts` (if we choose to stream frames later)

Existing ARC3 UI components we can reuse:
- `client/src/components/arc3/Arc3GridVisualization.tsx` (renders 3D frame arrays)
- `client/src/components/arc3/Arc3GamePanel.tsx` (action buttons + animation patterns)
- `client/src/components/arc3/Arc3ReplayViewer.tsx` (replay playback; useful for preview archive)

Preview metadata that must be treated as archived:
- `shared/arc3Games/*`
- `docs/arc3-game-analysis/*`
- `arc3/*.jsonl`

