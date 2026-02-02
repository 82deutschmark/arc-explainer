# 2026-02-01 ARCEngine Official Game Auto-Discovery Plan (COMPLETED)

## Context
- The ARC3 Community UI exposes a set of built-in "official" games that ship in the `external/ARCEngine` git submodule (e.g., `ws01`, `gw01`).
- New official game files can be added to `external/ARCEngine/games/official/` (e.g., `ws02.py`, `ws03.py`).
- Previously, the Node server had to be updated in multiple places to make these new games appear and be runnable.

## Goal
Automatically discover and expose any official game file added to `external/ARCEngine/games/official/` without requiring hardcoded server whitelists.

## Scope
- Server-side discovery + metadata for official games
- Server routes that list/return official games
- Server game runner logic that starts official games
- Python helper for extracting runtime metadata (level counts / win score) from official games

## Non-Goals
- UI redesigns
- Database migrations
- Changing ARCEngine upstream conventions or requiring upstream registry updates

## Implementation
1. Add a server-side official-game catalog with caching
   - Source of truth is the filesystem: `external/ARCEngine/games/official/*.py`
   - Cache results to avoid spawning Python for every HTTP request
2. Add a Python helper that enumerates official games and extracts runtime metadata
   - Import each game file by path, instantiate ARCBaseGame subclass, emit JSON
3. Refactor ARC3 community routes and runner to use the catalog
   - List/featured/details endpoints use the catalog instead of hardcoded arrays
   - Session runner starts official games via file path from the catalog
   - Upload/submission endpoints reserve official IDs so users cannot collide with built-ins

## Status
- Implemented in `v7.2.4` (see `CHANGELOG.md` top entry for what/why/how and file pointers).

