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
