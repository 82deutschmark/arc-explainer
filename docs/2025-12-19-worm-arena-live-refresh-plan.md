## 2025-12-19 – Worm Arena Live refresh plan

### Goal
Move all non-essential chrome below the live board, surface the apple scoreboard at the very top, expose an obvious copy-friendly match ID control, and keep the user on the Live view when a match finishes (show final frame + inline summary).

### In-scope files
- `client/src/pages/WormArenaLive.tsx` – restructure layout, add scoreboard/session panels, keep board visible after completion.
- `client/src/components/WormArenaLiveScoreboard.tsx` (new) – compact apple score strip for the top of the view.
- `client/src/components/WormArenaLiveStatusStrip.tsx` – repurpose for under-board status/match context (no redundant scores/rounds).
- `client/src/components/WormArenaReasoning.tsx` – enforce fixed panel height + scrolling to keep layout stable.
- `client/src/components/WormArenaLiveBoardPanel.tsx` – ensure headers communicate live vs final board and stay mounted.
- `client/src/components/WormArenaLiveResultsPanel.tsx` – extend copy to summarize results inline.
- `CHANGELOG.md` – record the UX change with a new version entry.

### Tasks
1. Build the new scoreboard component with comments + Worm Arena palette.
2. Update live status strip component to drop score/round duplication and emphasize state + alive snakes.
3. Fix reasoning panel height/scrolling so their footprint is predictable.
4. Keep the board/result panels mounted for both live and completed modes; add session ID copy controls directly under the board.
5. Wire everything together inside `WormArenaLive.tsx`, ensuring `finalSummary` adds inline results without navigation.
6. Document the change in `CHANGELOG.md`.

### Follow-up adjustments (Dec 19 feedback)
- Restore taller reasoning columns (less cramped), shrink the top scoreboard by ~50%, and bring the round/score/alive stats back under the board.
- Clarify reconnect behavior: today’s `/api/wormarena/stream/:sessionId` sessions are single-use; if a viewer reloads they cannot reattach because the session is only created by `/api/wormarena/prepare`. Surface this via better UI messaging and changelog notes.
