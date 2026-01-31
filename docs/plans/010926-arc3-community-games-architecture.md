# 010926-arc3-community-games-architecture

**Author:** Cascade  
**Date:** 2026-01-09  
**PURPOSE:** Master architectural plan for transitioning ARC3 from "preview/browsing" to "community game authoring and gallery" platform.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Phase 1: Archive Preview Version](#phase-1-archive-preview-version)
5. [Phase 2: Community Game Storage Backend](#phase-2-community-game-storage-backend)
6. [Phase 3: ARCEngine Python Bridge](#phase-3-arcengine-python-bridge)
7. [Phase 4: Community Gallery Frontend](#phase-4-community-gallery-frontend)
8. [Phase 5: Game Editor/Workflow](#phase-5-game-editorworkflow)
9. [Database Schema Changes](#database-schema-changes)
10. [File Change Manifest](#file-change-manifest)
11. [Security Considerations](#security-considerations)
12. [Open Questions](#open-questions)

---

## 1. Executive Summary

### Vision
Transform ARC3 from a "preview viewer" (browsing official games, watching agent runs) into a **community game authoring and sharing platform**:

- **ARC3 = Community Game Hub** — The one-stop shop for all community-made ARC3 games
- **Game Editor Focus** — Users create games using ARCEngine (Python library)
- **Community Gallery** — Users upload, share, and play each other's games
- **Archive Historical Data** — Preserve all preview-era data (LS20 analysis, agent runs, etc.) but mark it as archived/outdated

### Key Technical Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Game Storage | PostgreSQL + File Storage | Store game metadata and Python source files |
| Game Execution | Python subprocess (ARCEngine) | Run user-uploaded games server-side |
| Python Bridge | Node.js ↔ Python via stdin/stdout NDJSON | Pattern from `Arc3OpenRouterPythonBridge.ts` |
| Frontend | React + Wouter + TanStack Query | Gallery, upload, play interfaces |

---

## 2. Current State Analysis

### 2.1 Current ARC3 Routes (to be archived)

```
/arc3                           → ARC3Browser.tsx (landing page)
/arc3/playground                → ARC3AgentPlayground.tsx (agent playground)
/arc3/openrouter-playground     → Arc3OpenRouterPlayground.tsx
/arc3/codex-playground          → Arc3CodexPlayground.tsx
/arc3/haiku-playground          → Arc3HaikuPlayground.tsx
/arc3/games                     → Arc3GamesBrowser.tsx (6 official games)
/arc3/games/:gameId             → Arc3GameSpoiler.tsx (spoiler pages)
```

### 2.2 Current Backend Structure

**Server Routes (`server/routes/`):**
- `arc3.ts` — Main ARC3 routes (games list, start-game, manual-action, streaming)
- `arc3Codex.ts` — Codex-specific endpoints
- `arc3Haiku.ts` — Haiku-specific endpoints
- `arc3OpenAI.ts` — OpenAI-specific endpoints
- `arc3OpenRouter.ts` — OpenRouter-specific endpoints

**Server Services (`server/services/arc3/`):**
- `Arc3ApiClient.ts` — HTTP client for `three.arcprize.org` official API
- `Arc3OpenRouterPythonBridge.ts` — Python subprocess management (key pattern)
- `Arc3HaikuPythonBridge.ts` — Haiku-specific bridge
- `Arc3StreamService.ts` — SSE streaming management
- `Arc3RealGameRunner.ts` — OpenAI Agents SDK runner
- `arc3GridImageService.ts` — Grid visualization
- `arc3ScreenshotService.ts` — Screenshot discovery

**Shared Data (`shared/arc3Games/`):**
- `types.ts` — TypeScript interfaces for game metadata
- `index.ts` — Game registry (ls20, as66, ft09, lp85, sp80, vc33)
- Individual game files (ls20.ts, etc.)

**Client Components (`client/src/components/arc3/`):**
- 18 components for game display, controls, streaming, etc.

**Database Tables:**
- `arc3_sessions` — Game session tracking
- `arc3_frames` — Frame-by-frame game state
- `scorecards` — Scorecard lifecycle management

### 2.3 Historical Data (arc3/ directory)

JSONL files with agent run data that is now outdated:
```
arc3/
├── as66-821a4dcad9c2.*.jsonl    (12MB)
├── ft09-b8377d4b7815.*.jsonl    (1.5MB)
├── lp85-d265526edbaa.*.jsonl    (7MB)
├── ls20-fa137e247ce6.*.jsonl    (6.6MB)
├── sp80-0605ab9e5b2a.*.jsonl    (26MB)
├── vc33-6ae7bf49eea5.*.jsonl    (6.5MB)
└── test files
```

### 2.4 ARCEngine Submodule (`external/ARCEngine/`)

**Key Files:**
- `arcengine/base_game.py` — `ARCBaseGame` class users subclass
- `arcengine/level.py` — `Level` class for game levels
- `arcengine/sprites.py` — `Sprite` class for game objects
- `arcengine/camera.py` — `Camera` class for viewport
- `arcengine/enums.py` — `GameAction`, `BlockingMode`, `InteractionMode`

**Game Structure:**
```python
from arcengine import ARCBaseGame, Level, Sprite, Camera, GameAction

class MyGame(ARCBaseGame):
    def __init__(self):
        levels = [Level(sprites=[...], grid_size=(8, 8))]
        super().__init__(game_id="my_game", levels=levels)
    
    def step(self):
        # Handle self.action, update game state
        self.complete_action()
```

**Key API:**
- `game.perform_action(ActionInput(id=GameAction.ACTION1))` → returns `FrameData`
- `FrameData` contains: `frame` (64x64 grid), `score`, `state`, `available_actions`

---

## 3. Target Architecture

### 3.1 New Route Structure

```
/arc3                           → NEW: Community Games Landing
/arc3/gallery                   → NEW: Browse community games
/arc3/gallery/:gameId           → NEW: Play a community game
/arc3/upload                    → NEW: Upload your game
/arc3/docs                      → NEW: How to create games (links to ARCEngine)

/arc3/archive                   → ARCHIVED: Old preview landing
/arc3/archive/playground        → ARCHIVED: Old agent playgrounds
/arc3/archive/games             → ARCHIVED: Old 6 official games browser
/arc3/archive/games/:gameId     → ARCHIVED: Old spoiler pages
```

### 3.2 New Backend Services

```
server/
├── routes/
│   ├── arc3Community.ts        → NEW: Community game routes
│   └── arc3Archive.ts          → RENAMED: Old arc3.ts (archived endpoints)
├── services/
│   ├── arc3Community/
│   │   ├── CommunityGameRunner.ts      → NEW: Run uploaded games
│   │   ├── CommunityGamePythonBridge.ts → NEW: Python bridge for ARCEngine
│   │   ├── CommunityGameStorage.ts     → NEW: File storage management
│   │   └── CommunityGameValidator.ts   → NEW: Validate uploaded Python files
│   └── arc3/ (existing, for archive)
├── python/
│   └── community_game_runner.py → NEW: Python runner for ARCEngine games
```

### 3.3 High-Level Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│   Browser   │────▶│  Express    │────▶│  Python Subprocess  │
│  (React)    │◀────│  Server     │◀────│  (ARCEngine)        │
└─────────────┘     └─────────────┘     └─────────────────────┘
      │                    │                      │
      │                    ▼                      │
      │            ┌─────────────┐                │
      │            │  PostgreSQL │                │
      │            │  - games    │                │
      │            │  - sessions │                │
      │            └─────────────┘                │
      │                    │                      │
      │                    ▼                      │
      │            ┌─────────────┐                │
      └───────────▶│ File Storage│◀───────────────┘
                   │ (game.py)   │
                   └─────────────┘
```

---

## Phase 1: Archive Preview Version

### Goal
Move all current ARC3 functionality under `/arc3/archive` prefix without breaking anything.

### Tasks

| ID | Task | Files to Change | Effort |
|----|------|-----------------|--------|
| 1.1 | Create `server/routes/arc3Archive.ts` | Copy from `arc3.ts` | S |
| 1.2 | Update `server/routes.ts` to mount archive routes | `server/routes.ts` | S |
| 1.3 | Create `Arc3ArchiveBrowser.tsx` page | New file | M |
| 1.4 | Move all existing ARC3 pages to archive | Rename/copy files | M |
| 1.5 | Update `App.tsx` with new route structure | `client/src/App.tsx` | M |
| 1.6 | Add "Archived" banner to all archive pages | Create shared component | S |
| 1.7 | Move JSONL data to `arc3/archive/` subdirectory | File system | S |
| 1.8 | Update `shared/arc3Games/` with archive flag | `shared/arc3Games/types.ts` | S |

### File Changes (Phase 1)

**New Files:**
```
server/routes/arc3Archive.ts
client/src/pages/arc3-archive/Arc3ArchiveLanding.tsx
client/src/pages/arc3-archive/Arc3ArchiveGamesBrowser.tsx
client/src/pages/arc3-archive/Arc3ArchiveGameSpoiler.tsx
client/src/pages/arc3-archive/Arc3ArchivePlayground.tsx
client/src/components/arc3/Arc3ArchiveBanner.tsx
arc3/archive/ (move all JSONL files here)
```

**Modified Files:**
```
server/routes.ts                  → Mount /api/arc3-archive/*
client/src/App.tsx                → New route structure
shared/arc3Games/types.ts         → Add isArchived flag
shared/arc3Games/index.ts         → Mark games as archived
```

---

## Phase 2: Community Game Storage Backend

### Goal
Create database schema and storage system for community-uploaded games.

### Database Schema

```sql
-- New table: community_games
CREATE TABLE community_games (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(100) NOT NULL UNIQUE,        -- e.g., "maze_master_v2"
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    author_name VARCHAR(100) NOT NULL,
    author_email VARCHAR(255),                   -- Optional, for contact
    
    -- Game metadata
    version VARCHAR(20) DEFAULT '1.0.0',
    difficulty VARCHAR(20) DEFAULT 'unknown',    -- easy/medium/hard/very-hard
    level_count INTEGER DEFAULT 1,
    win_score INTEGER DEFAULT 1,
    max_actions INTEGER,
    tags TEXT[] DEFAULT '{}',
    
    -- File storage
    source_file_path TEXT NOT NULL,              -- Path to Python file
    source_hash VARCHAR(64) NOT NULL,            -- SHA256 of source file
    thumbnail_path TEXT,                         -- Optional thumbnail
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',        -- pending/approved/rejected/archived
    is_featured BOOLEAN DEFAULT FALSE,
    is_playable BOOLEAN DEFAULT TRUE,
    
    -- Validation
    validated_at TIMESTAMP WITH TIME ZONE,
    validation_errors JSONB,
    
    -- Stats
    play_count INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    average_score FLOAT,
    
    -- Timestamps
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'archived'))
);

-- Indexes for community_games
CREATE INDEX idx_community_games_status ON community_games(status);
CREATE INDEX idx_community_games_game_id ON community_games(game_id);
CREATE INDEX idx_community_games_author ON community_games(author_name);
CREATE INDEX idx_community_games_featured ON community_games(is_featured) WHERE is_featured = true;
CREATE INDEX idx_community_games_play_count ON community_games(play_count DESC);

-- New table: community_game_sessions
CREATE TABLE community_game_sessions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES community_games(id) ON DELETE CASCADE,
    session_guid VARCHAR(255) NOT NULL UNIQUE,
    
    -- Session state
    state VARCHAR(50) NOT NULL DEFAULT 'NOT_PLAYED',
    final_score INTEGER DEFAULT 0,
    win_score INTEGER DEFAULT 0,
    total_frames INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_community_sessions_game ON community_game_sessions(game_id);
CREATE INDEX idx_community_sessions_guid ON community_game_sessions(session_guid);
```

### Tasks

| ID | Task | Files to Change | Effort |
|----|------|-----------------|--------|
| 2.1 | Add `community_games` table to DatabaseSchema.ts | `server/repositories/database/DatabaseSchema.ts` | M |
| 2.2 | Add `community_game_sessions` table | `server/repositories/database/DatabaseSchema.ts` | S |
| 2.3 | Create `CommunityGameRepository.ts` | New file | M |
| 2.4 | Create `CommunityGameStorage.ts` service | New file | M |
| 2.5 | Create file upload endpoint | `server/routes/arc3Community.ts` | M |
| 2.6 | Create game listing endpoints | `server/routes/arc3Community.ts` | S |

### File Changes (Phase 2)

**New Files:**
```
server/repositories/CommunityGameRepository.ts
server/services/arc3Community/CommunityGameStorage.ts
server/routes/arc3Community.ts
uploads/community-games/           (directory for uploaded .py files)
uploads/community-games/thumbnails/ (directory for thumbnails)
```

**Modified Files:**
```
server/repositories/database/DatabaseSchema.ts   → Add new tables
server/routes.ts                                 → Mount community routes
```

---

## Phase 3: ARCEngine Python Bridge

### Goal
Create Python bridge that can load and execute arbitrary ARCEngine games.

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Node.js Server                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           CommunityGamePythonBridge.ts               │  │
│  │  - Spawns Python subprocess                          │  │
│  │  - Sends game path + action via stdin (JSON)         │  │
│  │  - Receives frame data via stdout (NDJSON)           │  │
│  │  - Handles errors, timeouts, cleanup                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                               │
│                     stdin  │  stdout                       │
│                            ▼                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           community_game_runner.py                    │  │
│  │  - Reads game path from stdin                        │  │
│  │  - Dynamically imports the game module               │  │
│  │  - Instantiates the game class                       │  │
│  │  - Executes actions, returns FrameData as NDJSON     │  │
│  │  - Handles RESET, ACTION1-7                          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Python Runner Design (`community_game_runner.py`)

```python
#!/usr/bin/env python3
"""
Community Game Runner for ARCEngine games.
Reads commands from stdin, executes game actions, outputs NDJSON to stdout.
"""
import sys
import json
import importlib.util
from pathlib import Path
from arcengine import ActionInput, GameAction

def load_game_from_file(file_path: str):
    """Dynamically load a game class from a Python file."""
    spec = importlib.util.spec_from_file_location("community_game", file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    
    # Find the game class (subclass of ARCBaseGame)
    from arcengine import ARCBaseGame
    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if isinstance(attr, type) and issubclass(attr, ARCBaseGame) and attr != ARCBaseGame:
            return attr
    raise ValueError("No ARCBaseGame subclass found in file")

def main():
    # Read initial payload from stdin
    payload = json.loads(sys.stdin.readline())
    game_path = payload["game_path"]
    
    # Load and instantiate the game
    GameClass = load_game_from_file(game_path)
    game = GameClass()
    
    # Output initial frame
    emit_frame(game, "init")
    
    # Action loop
    for line in sys.stdin:
        try:
            cmd = json.loads(line.strip())
            action_str = cmd.get("action", "ACTION1")
            coords = cmd.get("coordinates")
            
            action_id = getattr(GameAction, action_str)
            action_input = ActionInput(id=action_id)
            if coords and action_str == "ACTION6":
                action_input.x, action_input.y = coords
            
            frame_data = game.perform_action(action_input)
            emit_frame(game, action_str, frame_data)
            
        except Exception as e:
            emit_error(str(e))

def emit_frame(game, action, frame_data=None):
    """Emit frame data as NDJSON."""
    if frame_data is None:
        frame_data = game.perform_action(ActionInput(id=GameAction.RESET))
    
    output = {
        "type": "frame",
        "game_id": game.game_id,
        "frame": frame_data.frame.tolist() if hasattr(frame_data.frame, 'tolist') else frame_data.frame,
        "score": frame_data.score,
        "state": frame_data.state,
        "action_counter": frame_data.action_counter,
        "max_actions": frame_data.max_actions,
        "win_score": frame_data.win_score,
        "available_actions": frame_data.available_actions,
        "last_action": action
    }
    print(json.dumps(output), flush=True)

def emit_error(message):
    print(json.dumps({"type": "error", "message": message}), flush=True)

if __name__ == "__main__":
    main()
```

### Tasks

| ID | Task | Files to Change | Effort |
|----|------|-----------------|--------|
| 3.1 | Create `community_game_runner.py` | New file | L |
| 3.2 | Create `CommunityGamePythonBridge.ts` | New file | M |
| 3.3 | Create `CommunityGameRunner.ts` service | New file | M |
| 3.4 | Add start-game endpoint | `server/routes/arc3Community.ts` | M |
| 3.5 | Add execute-action endpoint | `server/routes/arc3Community.ts` | M |
| 3.6 | Add streaming endpoint for game play | `server/routes/arc3Community.ts` | L |
| 3.7 | Create `CommunityGameValidator.ts` | New file | M |

### File Changes (Phase 3)

**New Files:**
```
server/python/community_game_runner.py
server/services/arc3Community/CommunityGamePythonBridge.ts
server/services/arc3Community/CommunityGameRunner.ts
server/services/arc3Community/CommunityGameValidator.ts
```

**Modified Files:**
```
server/routes/arc3Community.ts   → Add game execution endpoints
```

---

## Phase 4: Community Gallery Frontend

### Goal
Create the community games gallery UI — list, filter, and play community games.

### Pages

```
/arc3                   → CommunityGamesLanding.tsx
/arc3/gallery           → CommunityGamesGallery.tsx
/arc3/gallery/:gameId   → CommunityGamePlay.tsx
```

### Components

```
client/src/components/arc3-community/
├── CommunityGameCard.tsx         → Game card in gallery grid
├── CommunityGameFilters.tsx      → Filter by difficulty, tags, author
├── CommunityGameGrid.tsx         → Grid/list view of games
├── CommunityGamePlayer.tsx       → Play interface (grid + controls)
├── CommunityGameInfo.tsx         → Game details panel
├── CommunityGameStats.tsx        → Play count, win rate, etc.
└── CommunityFeaturedBanner.tsx   → Featured games carousel
```

### Tasks

| ID | Task | Files to Change | Effort |
|----|------|-----------------|--------|
| 4.1 | Create `CommunityGamesLanding.tsx` | New file | M |
| 4.2 | Create `CommunityGamesGallery.tsx` | New file | M |
| 4.3 | Create `CommunityGamePlay.tsx` | New file | L |
| 4.4 | Create `CommunityGameCard.tsx` | New file | S |
| 4.5 | Create `CommunityGamePlayer.tsx` | New file | L |
| 4.6 | Create `useCommunityGame.ts` hook | New file | M |
| 4.7 | Update `App.tsx` with gallery routes | `client/src/App.tsx` | S |

### File Changes (Phase 4)

**New Files:**
```
client/src/pages/arc3-community/CommunityGamesLanding.tsx
client/src/pages/arc3-community/CommunityGamesGallery.tsx
client/src/pages/arc3-community/CommunityGamePlay.tsx
client/src/components/arc3-community/CommunityGameCard.tsx
client/src/components/arc3-community/CommunityGameGrid.tsx
client/src/components/arc3-community/CommunityGamePlayer.tsx
client/src/components/arc3-community/CommunityGameFilters.tsx
client/src/components/arc3-community/CommunityGameInfo.tsx
client/src/components/arc3-community/CommunityGameStats.tsx
client/src/hooks/useCommunityGame.ts
```

**Modified Files:**
```
client/src/App.tsx   → Add community routes
```

---

## Phase 5: Game Editor/Workflow

### Goal
Provide tools and documentation for creating ARC3 games with ARCEngine.

### Approach
For first-pass, this is primarily documentation and upload workflow — not a full in-browser editor.

### Pages

```
/arc3/upload            → GameUploadPage.tsx
/arc3/docs              → GameCreationDocs.tsx (links to ARCEngine docs)
/arc3/docs/quickstart   → QuickStartGuide.tsx (embedded tutorial)
```

### Upload Flow

1. User visits `/arc3/upload`
2. User fills in metadata (name, description, author, difficulty, tags)
3. User uploads `.py` file containing their `ARCBaseGame` subclass
4. Server validates the file:
   - Parses Python AST (no dangerous imports)
   - Instantiates game in sandboxed subprocess
   - Runs a few test actions
   - Extracts metadata (win_score, level_count, etc.)
5. If valid, game is saved with status `pending`
6. Admin can approve/reject games (future feature)
7. Approved games appear in gallery

### Tasks

| ID | Task | Files to Change | Effort |
|----|------|-----------------|--------|
| 5.1 | Create `GameUploadPage.tsx` | New file | M |
| 5.2 | Create upload form component | New file | M |
| 5.3 | Create `GameCreationDocs.tsx` | New file | S |
| 5.4 | Create `QuickStartGuide.tsx` | New file | M |
| 5.5 | Add upload validation endpoint | `server/routes/arc3Community.ts` | M |

### File Changes (Phase 5)

**New Files:**
```
client/src/pages/arc3-community/GameUploadPage.tsx
client/src/pages/arc3-community/GameCreationDocs.tsx
client/src/pages/arc3-community/QuickStartGuide.tsx
client/src/components/arc3-community/GameUploadForm.tsx
client/src/components/arc3-community/GameValidationStatus.tsx
```

---

## Database Schema Changes

### Summary of New Tables

| Table | Purpose |
|-------|---------|
| `community_games` | Store game metadata and file references |
| `community_game_sessions` | Track play sessions for community games |

### Migration Strategy

Add new tables in `DatabaseSchema.ts` using the existing pattern:

```typescript
// In DatabaseSchema.ts, add:
private static async createCommunityGamesTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS community_games (
        -- schema from Phase 2
      )
    `);
    // Create indexes
}

private static async createCommunityGameSessionsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS community_game_sessions (
        -- schema from Phase 2
      )
    `);
}
```

---

## File Change Manifest

### Complete List of Files

**Phase 1 — Archive (8 files)**
```
NEW:  server/routes/arc3Archive.ts
NEW:  client/src/pages/arc3-archive/Arc3ArchiveLanding.tsx
NEW:  client/src/pages/arc3-archive/Arc3ArchiveGamesBrowser.tsx
NEW:  client/src/pages/arc3-archive/Arc3ArchiveGameSpoiler.tsx
NEW:  client/src/pages/arc3-archive/Arc3ArchivePlayground.tsx
NEW:  client/src/components/arc3/Arc3ArchiveBanner.tsx
MOD:  server/routes.ts
MOD:  client/src/App.tsx
MOD:  shared/arc3Games/types.ts
MOD:  shared/arc3Games/index.ts
```

**Phase 2 — Storage Backend (6 files)**
```
NEW:  server/repositories/CommunityGameRepository.ts
NEW:  server/services/arc3Community/CommunityGameStorage.ts
NEW:  server/routes/arc3Community.ts
MOD:  server/repositories/database/DatabaseSchema.ts
MOD:  server/routes.ts
DIR:  uploads/community-games/
DIR:  uploads/community-games/thumbnails/
```

**Phase 3 — Python Bridge (5 files)**
```
NEW:  server/python/community_game_runner.py
NEW:  server/services/arc3Community/CommunityGamePythonBridge.ts
NEW:  server/services/arc3Community/CommunityGameRunner.ts
NEW:  server/services/arc3Community/CommunityGameValidator.ts
MOD:  server/routes/arc3Community.ts
```

**Phase 4 — Gallery Frontend (12 files)**
```
NEW:  client/src/pages/arc3-community/CommunityGamesLanding.tsx
NEW:  client/src/pages/arc3-community/CommunityGamesGallery.tsx
NEW:  client/src/pages/arc3-community/CommunityGamePlay.tsx
NEW:  client/src/components/arc3-community/CommunityGameCard.tsx
NEW:  client/src/components/arc3-community/CommunityGameGrid.tsx
NEW:  client/src/components/arc3-community/CommunityGamePlayer.tsx
NEW:  client/src/components/arc3-community/CommunityGameFilters.tsx
NEW:  client/src/components/arc3-community/CommunityGameInfo.tsx
NEW:  client/src/components/arc3-community/CommunityGameStats.tsx
NEW:  client/src/components/arc3-community/CommunityFeaturedBanner.tsx
NEW:  client/src/hooks/useCommunityGame.ts
MOD:  client/src/App.tsx
```

**Phase 5 — Upload/Docs (5 files)**
```
NEW:  client/src/pages/arc3-community/GameUploadPage.tsx
NEW:  client/src/pages/arc3-community/GameCreationDocs.tsx
NEW:  client/src/pages/arc3-community/QuickStartGuide.tsx
NEW:  client/src/components/arc3-community/GameUploadForm.tsx
NEW:  client/src/components/arc3-community/GameValidationStatus.tsx
```

### Total: ~36 new/modified files

---

## Security Considerations

### 1. Python Code Execution

**Risk:** Users upload malicious Python code.

**Mitigations:**
- **AST Validation:** Parse Python file and reject dangerous imports (`os`, `subprocess`, `socket`, etc.)
- **Sandboxed Execution:** Run games in isolated subprocess with restricted permissions
- **Timeout Limits:** Kill processes that exceed time/resource limits
- **No Network Access:** Block network access from game subprocess
- **Read-Only File Access:** Game can only read its own file, no write access

### 2. File Upload

**Risk:** Malicious file uploads, path traversal, denial of service.

**Mitigations:**
- **File Type Validation:** Only accept `.py` files
- **Size Limits:** Max 100KB per game file
- **Sanitized Filenames:** Generate safe filenames (UUID-based)
- **Rate Limiting:** Limit uploads per IP/session

### 3. Database

**Risk:** SQL injection, data integrity issues.

**Mitigations:**
- **Parameterized Queries:** Use pg parameterized queries (already in place)
- **Input Validation:** Zod schemas for all inputs
- **Hash Verification:** SHA256 hash stored for file integrity

---

## Open Questions

### For User Decision

1. **Curation Model:** Should games require admin approval before appearing in gallery, or auto-approve after validation?
   - *Recommendation:* Start with auto-approve for MVP, add manual review later.

2. **User Accounts:** Should users create accounts to upload, or allow anonymous uploads with author name field?
   - *Recommendation:* Anonymous with author name for MVP, add accounts later.

3. **Game Versioning:** Allow multiple versions of the same game, or replace on re-upload?
   - *Recommendation:* Replace on re-upload for MVP, add versioning later.

4. **Thumbnail Generation:** Auto-generate thumbnails from game frames, or require user upload?
   - *Recommendation:* Auto-generate from initial frame for MVP.

5. **Game Deletion:** Allow authors to delete their games?
   - *Recommendation:* Not in MVP — mark as archived instead.

### Technical Decisions

1. **File Storage Location:** Local filesystem or cloud storage (S3/GCS)?
   - *Recommendation:* Local filesystem for MVP, easy to migrate later.

2. **ARCEngine Installation:** Install in main Python environment or separate venv?
   - *Recommendation:* Main environment, managed via requirements.txt.

3. **Subprocess Pool:** Single process per request or pool of warm processes?
   - *Recommendation:* Single process for MVP, pool for performance later.

---

## Implementation Priority

| Phase | Priority | Dependencies | Estimated Effort |
|-------|----------|--------------|------------------|
| Phase 1: Archive | P0 | None | 2-3 days |
| Phase 2: Storage | P0 | Phase 1 | 3-4 days |
| Phase 3: Python Bridge | P0 | Phase 2 | 4-5 days |
| Phase 4: Gallery UI | P1 | Phase 3 | 5-7 days |
| Phase 5: Upload/Docs | P1 | Phase 4 | 3-4 days |

**Total Estimated Time: 17-23 developer days**

---

## Next Steps

1. **User Approval:** Review this plan and provide feedback on open questions
2. **Phase 1 Start:** Begin archive migration once approved
3. **ARCEngine Setup:** Ensure `external/ARCEngine` is properly installed and importable
4. **Prototype:** Build minimal Python bridge proof-of-concept

---

*End of Master Plan*
