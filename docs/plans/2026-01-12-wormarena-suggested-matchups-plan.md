# 2026-01-12 Worm Arena Suggested Matchups Plan

## 1. Context
- Current `suggestMatchups` helper (server/services/snakeBench/helpers/matchupSuggestions.ts) simply filters by `minGames` and model allowlist, so low-ranked or rarely played models dominate suggestions despite the UI being intended for prestige fights.
- The user wants suggestions to emphasize head-to-head pairings that improve the upper leaderboard while avoiding noise from models ranked below 30th place.

## 2. Objectives
1. Only consider unplayed pairings where **both models are ranked 1–30**, with strong preference for 1–20.
2. Within that pool, **prioritize pairings that include at least one top-20 model**, ordering by a rank-aware score layered on top of the existing ladder/entertainment metrics.
3. Keep existing UX intact (toggle, reasons list, run button) but ensure data reflects the new prioritization.

## 3. Constraints & Requirements
- Respect SRP/DRY: enhance existing helper/service rather than duplicating logic elsewhere.
- Leaderboard ranks derive from the already-fetched TrueSkill leaderboard array; no extra queries should be introduced if avoidable.
- Still only surface **unplayed** pairings (history.matchesPlayed === 0) and models meeting `minGames`.
- Do not suggest models outside the approved OpenRouter allowlist (`getSnakeBenchAllowedModels`).

## 4. Proposed Changes
### 4.1 Backend ranking filters
- Compute ordinal `rank` while iterating leaderboard results (sorted by exposure already); stash in a `rankBySlug` map (normalized slugs).
- In `suggestMatchups`:
  - Skip any candidate where `rank > 30` for either model.
  - Tag whether each model is `isTop20` (rank ≤ 20).
- Adjust scoring to include rank-aware bonuses:
  - Base bonus if **both** models ≤ 20 (highest priority).
  - Slightly lower bonus if exactly one model ≤ 20 and the other ≤ 30 (fallback tier).
  - Apply penalty (or zero score) if both models are 21–30 to prevent crowding; only allow them when not enough tier-A combos exist.
- Maintain existing ladder vs entertainment scoring layers but add the rank bonus to the final `score` before sorting.
- Preserve variety penalty logic so popular top models do not monopolize the list.

### 4.2 Service safeguards
- When building `approvedModels`, intersect with the `rankBySlug` map to ensure downstream helper never sees <30th ranks.
- Consider capping `safeLimit` fallback so the API can still return results even if the number of qualifying pairs is small (e.g., degrade gracefully if there are fewer than requested pairs).

### 4.3 Frontend & UX
- No UI changes expected; verify the hook continues to parse the same response shape.
- Optionally add a short tooltip or subtitle clarifying "Top-20 priority" if desired (confirm with user after backend change if copy tweak is needed).

### 4.4 Verification
- Unit-style check: add targeted test (e.g., lightweight helper test) ensuring low-ranked models (rank > 30) never appear in the returned `matchups`.
- Manual QA steps:
  1. Seed or mock leaderboard data to include at least 35 entries with varying ranks.
  2. Hit `/api/snakebench/suggest-matchups` both modes; ensure every model slug maps to rank ≤ 30 and that top-20 models appear in most rows.
  3. Confirm UI renders meaningful pairings on WormArena page and "Run" still opens matches.

## 5. Risks & Mitigations
| Risk | Mitigation |
| --- | --- |
| Too few qualifying pairings (e.g., limited top-tier models) leading to empty suggestions | Allow fallback inclusion of 21–30 rank pairings but only after exhausting top-20 combos; log warning when totalCandidates drops unexpectedly. |
| Rank drift if leaderboard ordering logic changes | Document that rankings derive from `getTrueSkillLeaderboard`; add inline comment near rank map creation. |
| Performance regression due to extra filtering | Work within existing O(n^2) pairing generation; the rank map lookup is O(1) per pair. |

## 6. TODO Checklist
- [ ] Implement leaderboard rank mapping + filtering in helper/service.
- [ ] Layer rank-aware scoring bonuses/penalties atop existing ladder + entertainment calculations.
- [ ] Add regression test (helper-level) ensuring matches never include rank > 30 and that top-20 bias works.
- [ ] Re-run manual verification via API + WormArena UI.
- [ ] Update CHANGELOG (top entry) summarizing the behavior shift once code ships.

## 7. Open Questions for User
1. Should we completely forbid 21–30 rank models, or allow them only as opponents when paired with a top-20 model? (Current plan takes the latter, but confirm preference.)
2. Any appetite for surfacing rank context in the UI (e.g., badges like "#5 vs #8")? Not necessary but could reinforce the change.
