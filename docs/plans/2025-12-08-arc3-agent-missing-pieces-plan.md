# ARC3 agent capability uplift plan
**Date:** 2025-12-08  
**Author:** Codex (GPT-5)  
**Goal:** Close gaps in exploration/plan/act loop: long-horizon memory, richer perception, explicit goal hypotheses, scratchpad, and guardrails.

## Targets
1) Stateful memory & scratchpad
   - Add per-run scratchpad stored server-side (session payload) that the agent can read/write (small text blocks). Persist across continuations via `previousResponseId` chain and session cache.
   - Add automatic short summaries every N turns (and at pause) to keep history compact; feed back as system/context when resuming.
2) Richer perception
   - Wire the analyze-grid tool (programmatic diff/feature extraction) into the streaming runner and timeline.
   - Ensure `inspect_game_state` continues to deliver PNG + color distribution + diff; add light rate limits if needed.
3) Goal hypothesis & validation
   - Prompt hook to require an explicit goal hypothesis list after first inspect, plus a mini plan (next 3 actions) and validation checkpoints after each tool result.
   - On low score progress, auto-trigger a “rethink” template before consuming remaining turns.
4) Guardrails against degenerate loops
   - Add simple loop detector: track last K actions and states; if repeating with no score change, inject a “try alternate” instruction.
   - Enforce a max “no-op streak” before pausing and requesting user input.
5) Integration & UX
   - Cache last frame and scratchpad server-side; make client frame optional on continuation (already partly done).
   - Expose scratchpad text in UI (read-only) and optionally allow user annotations.

## Steps
1) Data plumbing: extend session payload (Arc3StreamService) to hold scratchpad + summaries; propagate through run result/continuation.
2) Tools: register analyze-grid (if not already) in streaming runner; ensure timeline entries carry structured results.
3) Prompting: update ARC3 system/operator prompt to include goal-hypothesis and validation steps; add no-op loop breaker guidance.
4) Guardrails: implement simple repeat-state detector in runner; emit SSE event to surface “try alternate” message.
5) UI: display scratchpad/summaries; optional user note input to append to scratchpad.
6) Tests/manual: exercise start → run → pause → continue with cached frame + scratchpad; verify no missing-frame errors and no-op loop handling.
