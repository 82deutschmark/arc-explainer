# 2025-12-10 WormArena SnakeBench Parity Plan

**Author:** Codex (OpenAI / ARC Explainer)  
**Goal:** Achieve end-to-end SnakeBench parity for WormArena ingestion, persistence, aggregates, and ratings exactly as Greg’s Python pipeline, using the real replay JSONs and the shared Postgres schema (no mocks or stubs).

---

## Scope & Success Criteria
- Schema parity: `models`, `games`, `game_participants` must include all columns Greg’s code reads/writes (TrueSkill fields, costs, state, etc.).
- Ingestion parity: For each completed replay JSON, upsert models, insert/update game row (status, start/end, rounds, replay_path, costs, scores), and insert participants with score/result/death/cost exactly matching the JSON.
- Aggregate parity: Update per-model aggregates (wins/losses/ties/apples_eaten/games_played/last_played_at) identically to `update_model_aggregates` in Greg’s repo.
- Ratings parity: Run TrueSkill with Greg’s parameters (mu=25, sigma=25/3, beta=25/6, tau=0.5, draw_probability=0.1) and fallback Elo identical to his `update_elo_ratings`.
- Runtime parity: `snakeBenchService.runMatch` must trigger full ingestion automatically (no-ops are not allowed); backfill script must reprocess all `completed_games/*.json` to rebuild parity state.
- No placeholders: All data must come from real replay JSONs; no simulated rows.

---

## Work Plan
1) Schema alignment
   - Update `DatabaseSchema` to add missing SnakeBench fields (TrueSkill columns, timestamps, indexes) so Greg-compatible queries work without errors.
2) Replay ingestion (deterministic)
   - Add a replay parser that reads `snake_game_<id>.json` and produces normalized game/participant payloads matching Greg’s `save_history_to_json` output.
   - Upsert models (provider/name/model_slug) and insert/update games (status completed, start/end, rounds_played, board dims, num_apples, replay_path relative to `completed_games`, total_score, total_cost).
   - Insert/merge participants with score/result/death_round/death_reason/cost per player_slot.
3) Aggregate + ratings parity
   - Implement `updateModelAggregates` mirroring Greg’s per-game aggregate increments.
   - Implement TrueSkill update with Greg’s constants; on error, fall back to Elo identical to his pairwise formula.
4) Runtime wiring
   - Extend `snakeBenchService.runMatch` to require ingestion of the completed replay (fire-and-forget but real) with error logging.
   - Add a backfill CLI/job to sweep `completed_games/*.json` in chronological order and rebuild games/participants + aggregates + ratings.
5) Verification hooks
   - Ensure repository helpers surface the inserted data (recent games, leaderboard) from DB, matching Greg’s query shapes.
6) Documentation & changelog
   - Document the ingestion flow and update `CHANGELOG.md` with the semantic version bump summarizing schema + ingestion changes.

---

## Risks / Mitigations
- Replay path variance (absolute vs relative): normalize to `completed_games/<filename>` for DB parity.
- Missing models in DB: enforce model upsert before participant insert.
- DB unavailable: ingestion must log but not block match completion (mirrors Greg’s tolerance), yet still attempts full parity when DB is up.
- TrueSkill library parity: match Greg’s parameters exactly; ensure fallbacks keep Elo in sync if TrueSkill errors.
