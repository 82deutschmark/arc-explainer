# 2025-11-30 – Poetiq Phase I Transparency Completion Plan

## Objective
Finish the “Phase I” commitments from the Poetiq UI deep-dive by ensuring every backend event (prompting, evaluating, feedback, token/cost deltas, expert state) is surfaced in a clear human-readable narrative across both PoetiqSolver and PoetiqCommunity.

## Key Files / Touchpoints
- `client/src/hooks/usePoetiqProgress.ts`: add phase timing metadata, phase history, expert iteration tracking, derived metrics that power the dashboard UI.
- `client/src/components/poetiq/PoetiqPhaseIndicator.tsx`: new SRP component for rendering the prompting/thinking/evaluating/feedback timeline with elapsed timers.
- `client/src/components/poetiq/PoetiqExpertTracker.tsx`: new SRP component that shows per-expert progress, iteration counts, token/cost totals, and status badges.
- `client/src/components/poetiq/PoetiqTokenMetrics.tsx`: new SRP component summarizing live token usage and estimated cost (global + expert level).
- `client/src/components/poetiq/PoetiqProgressDashboard.tsx`: orchestration component that composes the indicator/tracker/metrics into a single “what’s happening now” pane.
- `client/src/pages/PoetiqSolver.tsx`: integrate the dashboard, reorganize layout during runs, expand copy so that logs/prompt inspectors remain optional panels.
- `client/src/pages/PoetiqCommunity.tsx`: add explanatory copy that the solver UI now exposes every backend operation, linking to PoetiqSolver for transparency.
- `docs/CHANGELOG.md`: document work under new semantic version.

## TODOs
1. Capture phase transitions & timing inside `usePoetiqProgress` (phaseStartTime, phaseDurations, aggregate token + iteration stats per expert) so downstream UI has structured data instead of parsing log strings.
2. Build the four new Poetiq components with small props interfaces and memoization to keep renders light; include accessible labels and human-readable text for each backend phase.
3. Embed the dashboard in PoetiqSolver above the existing inspector/log panels, hide the old placeholder hero text during runs, and surface toggles for prompts/reasoning/logs so casual users only see the narrative.
4. Update PoetiqCommunity intro copy + CTA to call out the transparency features (“every prompt, iteration, and cost is now viewable live”) so community testers know where to look.
5. Update CHANGELOG with new semantic version + author credit once implementation and manual smoke-tests (lint/build if feasible) pass.

_Owner: Codex / GPT-5_
