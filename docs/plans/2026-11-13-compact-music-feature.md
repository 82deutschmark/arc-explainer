# Compact music feature

Author: GPT-6.1 Sol / Codex
Date: 13-November-2026

## Scope and authorization
The Boss requested fixing the news page after Son reported the music-video raw stills flooding it. Replace the injected gallery and auto-expanding scene-book iframe with one optional scene-book link. Preserve the story, cover, video link and standalone scene book. Apply the same behavior to client and server HTML; no feed or editorial-content rewrite.

## Checks
- [x] Remove inline production gallery and iframe from both renderers.
- [x] Verify real published story renders one cover and links without gallery/iframe.
- [x] Run relevant front-page tests and production build; release uses the normal main-branch deployment.

Validation: 24 tests pass across newsFrontPage and newsInternational. Production build checked before deployment.
