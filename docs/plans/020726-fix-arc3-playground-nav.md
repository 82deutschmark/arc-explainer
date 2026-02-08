---
description: Fix broken ARC3 playground nav link routing
---

# 020726-fix-arc3-playground-nav

## Objectives
- Restore working navigation to the ARC3 playground page from the main nav.
- Align router paths with existing nav link and page component.
- Capture change in changelog.

## Tasks
- [ ] Add missing wouter route for `/arc3/playground` pointing to `ARC3AgentPlayground` (`client/src/App.tsx`, near existing ARC3 routes ~138-151).
- [ ] Verify imports remain accurate and dedupe if necessary (`client/src/App.tsx`, top import section lines ~10-90).
- [ ] Update changelog with patch entry noting restored nav route (`CHANGELOG.md`, add to top section lines ~1-30).
