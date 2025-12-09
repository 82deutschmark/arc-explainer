# 2025-12-08 – ARC3 per-run scorecard + action metadata normalization

## Goal
Align ARC3 integration with official scorecard usage by opening a fresh scorecard for every new game run and ensuring action metadata is consumable by the UI/agents (stringified available_actions, resilient action_counter).

## Tasks
1) **Scorecard lifecycle per run**
   - Stop using the global bootstrap scorecard.
   - Open a new scorecard on each new game start/agent run (include tags/source_url/opaque if provided).
   - Pass the fresh `card_id` into RESET and subsequent actions for that session.
   - Handle auto-expiry by reopening if missing/expired.
2) **Available actions & counters**
   - Normalize `available_actions` to string names before returning to the UI/agent.
   - Gracefully handle null/undefined `action_counter` in runner logic so UI doesn’t treat it as “no-op”.
3) **Plumbing & tests**
   - Update REST endpoints/runners to carry per-session card IDs.
   - Add quick local API checks to confirm actions mutate frames and that card IDs are per-session.
4) **Docs/Changelog**
   - Note behavior change in CHANGELOG with version bump.
