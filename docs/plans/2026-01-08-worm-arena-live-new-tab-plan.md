# 2026-01-08 - WormArenaLive new-tab launch plan

## Scope
- Ensure starting a match from WormArenaLive opens the live session in a new browser tab.
- Preserve existing behavior for suggested matchups and replay redirects.

## Objectives
- Update the live match launch flow to use a new-tab navigation.
- Keep setup page state intact after launching a match.
- Verify no impact to session resolution or replay links.

## TODOs
- Locate the WormArenaLive match start handler.
- Switch navigation from same-tab redirect to `window.open` with safe options.
- Update TypeScript header metadata and CHANGELOG entry if behavior changes.

## Status
- Implemented on 2026-01-09 (opens new tab on manual start; autoStart links remain same-tab to avoid pop-up blockers).
