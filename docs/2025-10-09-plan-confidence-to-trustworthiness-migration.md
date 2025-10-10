Author: Codex using GPT-4.1
Date: 2025-10-09 21:03:10
PURPOSE: Assess problems in client/src/hooks/useConfidenceStats.ts and propose a clean SRP/DRY-compliant migration to trustworthiness-first analytics, including backend confidence normalization fixes and frontend hook alignment.
SRP/DRY check: Pass — This doc introduces no code; it outlines single-purpose changes and reuse of existing repositories and utils.
shadcn/ui: Pass — No UI code in this document.


Overview
- Confidence is NOT trustworthiness. Our primary metric is trustworthiness (confidence reliability), not raw confidence or accuracy. The hook useConfidenceStats currently sends the wrong signal and is inconsistent with the project’s analytics architecture.
- The bigger, systemic issue: backend confidence normalization is incorrect. Values in [0,1] are being rounded to integers 0 or 1, not scaled to [0,100]. That corrupts downstream trustworthiness and calibration metrics.

Key Findings
- Naming/semantics: useConfidenceStats implies a leaderboard by confidence. We reward trustworthiness; confidence-only displays are at best calibration analysis, not rankings.
- Endpoint correctness: /api/puzzle/confidence-stats exists and is implemented via TrustworthinessRepository.getConfidenceStats(). So the hook’s comment that it’s “useless” is inaccurate; the endpoint is real and valuable for calibration analysis.
- Project standards violations in the hook:
  - Bypasses TanStack Query; uses useState/useEffect with raw fetch. No caching, no dedupe, no retries, no cancelation.
  - Bypasses shared apiRequest wrapper, leading to inconsistent headers and error handling.
  - Performs no AbortController cancellation on unmount.
  - Error typing is string-only; inconsistent with other hooks’ error models.
- Systemic backend bug: server/utils/CommonUtilities.ts: normalizeConfidence() only clamps/rounds to 0–100. It does NOT scale 0.85 → 85. That means provider confidences in [0,1] get rounded to 0 or 1 and stored in DB as 0% or 1%, corrupting:
  - TrustworthinessRepository SQL aggregates (AVG(confidence))
  - responseValidator trustworthiness calculations (uses confidence/100)
  - Any calibration or overconfidence analysis

Risk/Impact
- Trustworthiness, calibration, and over/underconfidence analytics are distorted wherever providers return fractional confidences.
- UI charts and leaderboards built on these numbers are misleading.

Decisions
- Treat “Confidence Analysis” as its own diagnostic panel, not a leaderboard signal; primary ranking remains trustworthiness.
- Fix normalization at the source (backend write path), not in frontend hooks. Hooks should never “fix” data semantics.

Action Plan (SRP, DRY)
1) Backend normalization — single source of truth
- Update server/utils/CommonUtilities.ts:normalizeConfidence to handle 0–1, 0–100, and strings.
  - If 0 < x <= 1 and x is non-integer: scale x*100.
  - If x > 1: clamp to [0,100], preserve decimals.
  - Accept strings like "0.85", "85", "85.3%".
- Ensure ExplanationRepository uses normalizeConfidence on both insert and select mapping (already wired, just fix logic).
- Align responseValidator to assume DB confidence is integer percent 0–100 (already implied). No logic change needed once normalization is correct.

2) Data repair (optional but recommended)
- Backfill script to repair clearly corrupted records:
  - Heuristic 1: Rows with confidence in {0,1} and provider_raw_response shows a fractional confidence field (e.g., 0.XX). Recompute to percent.
  - Heuristic 2: Rows with trustworthiness_score high but confidence extremely low (≤1) — inspect provider_raw_response for recoverable original values.
- Guarded, idempotent migration — log-only dry run first; then apply with backups.

3) Frontend hooks alignment
- Deprecate useConfidenceStats in favor of:
  - useConfidenceAnalysis: a TanStack Query hook for /api/puzzle/confidence-stats used only in diagnostic/calibration views.
  - Keep trustworthiness leaderboards using existing useModelLeaderboards (already calls /api/puzzle/performance-stats).
- Implementation rules for new hook:
  - Use apiRequest, TanStack Query, staleTime 5m, abort on unmount.
  - Strong typing with shared ConfidenceStats.
  - No client-side normalization.

4) Copy and doc updates
- Update docs/HOOKS_REFERENCE.md: add useConfidenceAnalysis; mark useConfidenceStats deprecated.
- Brief note in EXTERNAL_API.md under /api/puzzle/confidence-stats: “Calibration-only; not a ranking metric.”

5) Monitoring/validation
- Add a one-off validation endpoint or admin query to sample recent confidences and display histograms to confirm values cluster sensibly (not at 0/1). Remove tool once verified.

Minimal, Surgical Changes (proposed)
- Backend: fix normalizeConfidence (single function) — root-cause repair.
- Frontend: replace useConfidenceStats with useConfidenceAnalysis using TanStack Query and apiRequest for consistency.

Rollout Steps
- Implement normalizeConfidence fix.
- Deploy and verify new entries’ confidence distributions.
- Run backfill script dry run; review logs; execute repair.
- Replace hook and update UI imports where used; keep old hook for a release behind a deprecation warning if necessary.
- Update docs.

Open Questions
- Do any providers emit confidence in textual forms like "95%" or "~0.9"? The parser will handle common cases; confirm edge cases.
- Do we want to hard-fail on malformed confidences (e.g., NaN) instead of defaulting to 50?

@todo Checklist
- [ ] Fix backend normalizeConfidence scaling
- [ ] Add unit tests for normalization edge cases (0.0, 0.85, 1, 42, 101, "85%", "0.85")
- [ ] Optional: backfill repair script + dry run
- [ ] Create useConfidenceAnalysis hook with TanStack Query
- [ ] Deprecate useConfidenceStats and update references
- [ ] Update HOOKS_REFERENCE.md and EXTERNAL_API.md

@srp Compliance
- Normalization: single util; repositories consume it; hooks do not.
- Analytics domains remain separated: trustworthiness vs confidence (calibration) vs accuracy.

@dry Compliance
- Reuse existing RepositoryService endpoints and apiRequest. No duplicate normalization logic in frontend.

@deployment Note
- Safe to deploy backend normalization first; UI changes are orthogonal. Backfill can run post-deploy.

@owner Suggestion
- Assign: Backend normalization + backfill (1 person), Frontend hook deprecation (same person), Docs (same person). Hobby-scope friendly.
