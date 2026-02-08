---
description: Prune obsolete ARC3 nav items after redesign
---

# 020726-prune-arc3-nav

## Objectives
- Remove outdated ARC3 navigation entries that no longer have active routes after redesign.
- Keep nav aligned with currently supported ARC3 pages.
- Record the change in changelog.

## Tasks
- [ ] Update ARC3 dropdown in navigation to remove deprecated links (client/src/components/layout/AppNavigation.tsx, nav items array around lines ~70-150).
- [ ] Ensure remaining entries map to active routes (client/src/App.tsx, verify ARC3 section lines ~138-148).
- [ ] Add changelog entry for nav pruning (CHANGELOG.md, top section lines ~1-15).
