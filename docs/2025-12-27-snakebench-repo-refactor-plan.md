---
title: SnakeBench Repository Split Plan
author: Cascade (GPT-5)
date: 2025-12-27
purpose: Refactor SnakeBenchRepository.ts into focused modules with clear SRP, reusable helpers, and testable seams.
scope: Backend data layer for SnakeBench/Worm Arena (ingest, reads, analytics, curation, ratings).
---

## Context (why the file is 2.5k lines)
- Single class owns **all** SnakeBench persistence/reads: ingest, replay parsing, ratings (TrueSkill/Elo), analytics, search, curation, greatest hits, insights, run-length distributions, pairing history, replay path helpers, recent activity, leaderboards.
- Multiple domains mixed: write paths (ingest/backfill), read paths (recent/search/leaderboards), analytics (insights/distributions), curated features (greatest hits), infra helpers (path resolution).
- Result: poor SRP/DRY, high churn risk, hard to test or onboard, repetitive slug/date/where logic, and no modular ownership.

## Proposed module split (new files)
1) **GameWriteRepository**  
   - recordMatchFromResult, ingestReplayFromFile, parseReplayJson, getOrCreateModelId, updateAggregatesForGame, updateTrueSkillForGame, updateEloForGame, resetModelRatings, backfillFromDirectory, setReplayPath.
2) **GameReadRepository**  
   - getRecentGames, getReplayPath, searchMatches, getRecentActivity, getArcExplainerStats, getModelsWithGames, getModelMatchHistory, getModelMatchHistoryUnbounded.
3) **LeaderboardRepository**  
   - getModelRating, getTrueSkillLeaderboard, getBasicLeaderboard, getPairingHistory, shared slug normalization helpers.
4) **CurationRepository**  
   - getWormArenaGreatestHits (all dimensions), any future curated lists.
5) **AnalyticsRepository**  
   - getModelInsightsData, getRunLengthDistribution, future reporting aggregates.
6) **Shared utilities** (e.g., `snakebenchSqlHelpers.ts`)  
   - Slug normalization (`regexp_replace(..., ':free$', '')`), date parsing, safe limits, common WHERE fragments, error logging helpers, result mappers.

## Public API / service impact
- Preserve existing service/controller method names; route layer should switch to new repos without changing HTTP contracts.
- No auth changes (endpoints stay public per platform requirement).
- Keep type contracts from `shared/types.ts` unchanged to avoid frontend impact.

## Migration steps (incremental, low-risk)
1) **Utilities first:** Extract shared slug/date/limit helpers into a new util module. Update existing repository to use helpers (no behavioral change).
2) **Split write path:** Move ingest + rating update functions into `GameWriteRepository`; wire service to new class. Add unit tests for parseReplayJson and rating updates.
3) **Split read path:** Move recent/search/replay path helpers into `GameReadRepository`; update services/controllers; add integration tests for search filters.
4) **Split leaderboards:** Move rating/leaderboard/pairing methods into `LeaderboardRepository`; add coverage for TrueSkill defaults and win-rate ordering.
5) **Split curation:** Move greatest-hits logic into `CurationRepository`; reuse shared helpers; add tests for dedupe/category reasons.
6) **Split analytics:** Move insights and run-length distribution into `AnalyticsRepository`; add snapshot tests for summaries/bins.
7) **Delete old monolith:** Remove legacy methods after all call sites updated and tests passing.

## Testing plan
- Unit: helpers (slug/date/limits), parseReplayJson fixtures, TrueSkill/Elo math (golden outputs), greatest-hits categorization.
- Integration: searchMatches filters, recentActivity, replayPath, leaderboard ordering, insights aggregation, run-length distribution bins.
- Regression: ingest + recompute path on a sample replay; ensure aggregates/rating updates occur once; backfill dry-run in staging.

## Risks & mitigations
- Risk: Divergent SQL between new modules. Mitigate by copying queries verbatim, factoring shared fragments.
- Risk: Rating recompute differences (TrueSkill/Elo). Mitigate with golden-test fixtures using stored inputs/outputs.
- Risk: Service wiring bugs. Mitigate with integration tests against a seed DB and typed dependency injection (per repo).
- Risk: Behavior drift in greatest hits. Mitigate with fixture-based expectations per category and durable unit tests.

## Acceptance criteria (Definition of Done)
- Monolith removed; modules listed above exist with focused responsibilities.
- Services/controllers depend on specific repos; no cross-domain leakage.
- All existing endpoints unchanged and tested; frontend unaffected.
- New helper utilities reduce duplication (slug normalize, limits, date parsing).
- CI tests added for each module; backfill/ingest validated on sample replay.

## Sequencing checklist (developer handoff)
- [ ] Extract shared helpers.
- [ ] Introduce new repository classes and migrate write path.
- [ ] Migrate read path/search/replay helpers.
- [ ] Migrate leaderboards/ratings/pairing.
- [ ] Migrate curation (greatest hits).
- [ ] Migrate analytics (insights, run-length distribution).
- [ ] Remove legacy monolith class and run full test suite.

## Detailed migration map (who moves where)
### GameWriteRepository
- recordMatchFromResult
- ingestReplayFromFile
- parseReplayJson
- getOrCreateModelId
- updateAggregatesForGame
- updateTrueSkillForGame
- updateEloForGame
- resetModelRatings
- backfillFromDirectory
- setReplayPath

### GameReadRepository
- getRecentGames
- getReplayPath
- searchMatches (all filters, sorting, pagination)
- getRecentActivity
- getArcExplainerStats
- getModelsWithGames
- getModelMatchHistory
- getModelMatchHistoryUnbounded

### LeaderboardRepository
- getModelRating
- getTrueSkillLeaderboard
- getBasicLeaderboard
- getPairingHistory

### CurationRepository
- getWormArenaGreatestHits (all dimensions and dedupe/priority rules)

### AnalyticsRepository
- getModelInsightsData
- getRunLengthDistribution

### Shared utilities (new module, e.g., `snakebenchSqlHelpers.ts`)
- Slug normalization: `regexp_replace(..., ':free$', '')`
- Safe limit/offset clamps
- Date parsing (string or ms to Date; nullable)
- Common WHERE fragments: completed games, rounds > 0, optional model/opponent filters
- Death reason parsing helpers
- Replay path resolution (filename <-> path helpers)
- Cost/score numeric guards (Number.isFinite, default 0)
- Sorting column resolver for searchMatches
- Error logging wrapper to keep logs consistent

## Test fixture and coverage plan
Unit fixtures
- parseReplayJson: happy path; missing death_reason; zero/negative rounds; :free suffix; missing start/end; custom gameTypeOverride; corrupted JSON error.
- Helper clamps: limits, offsets, date parsing edge cases.
- Slug normalization: paid vs :free treated same.
- Sorting resolver: each sortBy branch, default, invalid input.

Golden math tests
- updateTrueSkillForGame: small 2-player game set with expected mu/sigma/exposed/display outputs.
- updateEloForGame: deterministic delta for wins/losses/ties across 2-player grid.

Integration (DB) tests
- searchMatches: matrix over result, deathReason, min/max rounds/score/cost, from/to dates, sortBy variants, pagination.
- getRecentGames: respects limit, returns filename/path, orders by start_time.
- getRecentActivity: days>0 vs all-time path.
- getArcExplainerStats: counts and max score.
- getModelsWithGames: normalized slug grouping; winRate computed.
- getModelMatchHistory / Unbounded: ordering, result labels, death reasons, costs, date fields.
- getModelRating: sums cost, returns defaults when null.
- getTrueSkillLeaderboard: minGames filter, exposed fallback.
- getBasicLeaderboard: winRate vs gamesPlayed sorts.
- getPairingHistory: normalization A|||B, lastPlayedAt ISO.
- getWormArenaGreatestHits: each dimension returns category/reason; dedupe/priority order preserved; skips missing models/rounds.
- getModelInsightsData: summary fields, failure modes, loss opponents; early loss threshold; lossDeathReasonCoverage; unknown losses.
- getRunLengthDistribution: ties excluded, wins/losses binned, minGames threshold filter.

Replay/backfill fixtures
- Small set of snake_game_*.json in a test directory covering: normal game; zero rounds (should be filtered); missing replay_path; long duration; close match; high total score; monster apples; cost > 0; missing death reason.

## Wiring and rollout plan
1) Add shared helpers; refactor monolith to use them (behavior-neutral PR).
2) Introduce new repository classes; temporarily wrap monolith to delegate to new modules (adapter) to avoid breaking controllers.
3) Move write path first (GameWriteRepository); update services/controllers DI; run ingest/backfill tests.
4) Move read/search paths (GameReadRepository); verify recent/search/resolve flows.
5) Move leaderboards (LeaderboardRepository); verify leaderboard and pairing endpoints.
6) Move curation (CurationRepository); verify greatest-hits and categories.
7) Move analytics (AnalyticsRepository); verify insights and run-length endpoints.
8) Remove monolith and adapter after all modules wired and tests pass.

## Backfill and recompute notes
- Before recompute, run resetModelRatings once in staging; then ingest/backfill replays with forceRecompute=true to avoid double-counting.
- Order backfill chronologically (existing backfillFromDirectory behavior) to keep rating evolution stable.
- Ensure replay path resolution aligns with production storage (completed_games vs completed_games_local); include helper to swap roots if needed.

## Rollback plan
- Keep monolith class and adapter until final step; feature-flag DI binding to switch back quickly if regressions found.
- Preserve SQL text verbatim in new modules; if tests fail, revert to monolith binding without dropping data.

## File impact (expected edits)
- server/repositories/: new files GameWriteRepository.ts, GameReadRepository.ts, LeaderboardRepository.ts, CurationRepository.ts, AnalyticsRepository.ts, snakebenchSqlHelpers.ts
- server/services/snakeBenchService.ts (DI wiring)
- server/controllers/snakeBenchController.ts (constructor wiring if needed)
- server/services/snakeBench/helpers/matchupSuggestions.ts (pairing history consumer)
- Tests: new unit + integration suites under tests/ (mirror method coverage above)
- Docs: this plan file; changelog entry
