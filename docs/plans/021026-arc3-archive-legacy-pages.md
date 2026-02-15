---
description: Restore legacy ARC3 games browser/spoiler pages under archived root
---

# 021026-arc3-archive-legacy-pages

Goal: Move the original ARC3 games browser + per-game spoiler pages (pre-archive redesign) to the archived root without altering their content/structure, and ensure legacy links keep working.

## Tasks
- [ ] Update client routing to mount the legacy browser and spoiler components under /arc3/archive (keep UI identical to the old pages).
  - File: client/src/App.tsx (routes section around current ARC3 archive entries)
- [ ] Wire the legacy games browser component to the archived path (index page) without changing its layout/content.
  - File: client/src/pages/Arc3GamesBrowser.tsx (ensure canonicalPath + links use /arc3/archive/games)
- [ ] Wire the legacy per-game spoiler page to the archived path, preserving its full layout and data usage.
  - File: client/src/pages/Arc3GameSpoiler.tsx (ensure canonicalPath + links use /arc3/archive/games/:gameId)
- [ ] Add client-facing redirects so old /arc3/games/* links forward to the archived root (and to new /arc3 if needed for community links).
  - File: client/src/App.tsx (lightweight redirect components near ARC3 routing)
- [ ] Consider server-level redirect coverage for direct bookmarked URLs.
  - File: server/routes.ts (optional 301/302 express route mapping /arc3/games/:gameId -> /arc3/archive/games/:gameId)

## Notes/Assumptions
- Legacy components to preserve: Arc3GamesBrowser.tsx and Arc3GameSpoiler.tsx (current visuals are the old pages).
- Do not replace archived UI (Arc3Archive*); just ensure the legacy pages live under the archived root and are reachable.
- Keep data source the same (shared/arc3Games) to avoid content drift.
