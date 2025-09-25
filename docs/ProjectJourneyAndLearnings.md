*
* Author: Cascade using `GPT-4.1`
* Date: 2025-09-23T23:35:40-04:00
* PURPOSE: Document the specific mistakes, poor decisions, and self-inflicted regressions chronicled in `CHANGELOG.md`, so future work avoids repeating them.
* SRP and DRY check: Pass. This file uniquely aggregates lessons about avoidable mistakes without duplicating other docs.

# Project Journey: Avoidable Mistakes and Repeating Circles

This document frames the `arc-explainer` history around the missteps that repeatedly burned development time. It extracts the lowlights from `CHANGELOG.md` to make the "idiotic mistakes and bad choices" unmistakable.

## 1. Architectural Overhauls that Backfired (August–September 2025)

Our largest refactors were supposed to clean things up. They did—but only after we broke core functionality in the process.

- **Multi-test system shattered (`v2.24.2`):** While chasing Single Responsibility Principle nirvana, we scattered validation across four services, renamed fields inconsistently, and silently dropped critical arrays. The result was a completely broken multi-test pipeline that required an emergency rewrite *after* deployment.
- **Repository split confusion (`v2.6.2`):** Splitting `FeedbackRepository` into four niche repositories sounded elegant. In reality we spent days rewiring controllers, debugging wrong imports, and documenting the same schema multiple times. The refactor was necessary, but the sequencing and lack of integration tests made it painful.
- **Batch refactor regressions (`v2.9.0`):** Dismantling a 633-line service into four files felt smart until we realized live updates stopped working (`v2.5.24`) and session state went missing (`v2.5.25`). We essentially rebuilt working features because we touched hot code without guard rails.

## 2. Data Integrity: Death by a Thousand Self-Inflicted Cuts

LLMs are sloppy, but most data leaks were caused by our own assumptions.

- **Silent raw response loss (`v2.20.4`):** The database schema already had `provider_raw_response`, yet our SQL INSERT ignored it. Months of expensive traces vanished because no one compared the query to the schema.
- **Reasoning log `[object Object]` saga (`v2.10.7` → `v2.10.10`):** We "fixed" the bug multiple times without checking fallback paths. The real culprit lived in helper functions we never inspected. We wasted weeks chasing ghosts because we kept assuming the fix had landed.
- **Multiple prediction grids discarded (`v2.5.21`, `v2.24.2`):** Base services and validators kept overwriting or collapsing arrays into booleans. Every new attempt to "simplify" the pipeline ignored an edge case, forcing yet another patch.
- **Processing time bug (`v2.20.5` + memory d8c16478):** We cheerfully stored `Date.now()` as "duration"—literally the current timestamp—because nobody reviewed the math. It took database audits to notice the nonsense.

## 3. Metrics and Leaderboards: How We Misled Ourselves

We proudly shipped dashboards that lied.

- **Accuracy vs. satisfaction conflation (`v2.5.13`):** Leaderboards labeled "accuracy" were actually user feelings. Models that charmingly hallucinated climbed to the top while reliable ones disappeared. We marketed fiction as analytics.
- **Phantom metrics (`v2.5.14`):** Queries referenced columns that never existed (`processing_time`, `accuracy`, `cost`). The UI showed zeros because the SQL was wrong, not because the models were bad. We trusted spreadsheets over inspecting the actual queries.
- **Default filters undone (`v2.5.20` vs `v2.24.1`):** After months of feedback, we finally defaulted the browser to "unexplained first"—then later changed the default back to "all" for a landing page experiment. Users immediately stopped seeing the work queue until we flipped it yet again.

## 4. UX & Ops: When the Experience Got Worse Before Better

- **50-minute client timeout (`v2.0.3`):** We extended the global fetch timeout to 50 minutes because Grok was slow. The changelog even admits "there are no non-AI requests"—yet the code creates a divergent timeout branch anyway. We complicated the stack to solve a problem that didnt exist.
- **Batch progress invisibility (`v2.5.24`):** The first batch refactor entirely broke live progress updates. Users saw nothing happening for hours. We only noticed after testers complained, because we were watching logs instead of the UI.
- **Overzealous logging spam (`v2.22.0`):** We logged entire 10,000-character reasoning blobs at info level, tanking readability and storage. Cleaning that up required writing a logger the size of a microservice.

## 5. Recurring Circles to Avoid

- **Fix-first, verify-never:** Nearly every critical regression boiled down to merging "surgical" fixes without regression tests, only to undo them later.
- **Schema knowledge gaps:** Despite multiple architecture docs, we repeatedly forgot which fields existed (`multi_test_prediction_grids`, `reasoning_items`). Every missed column cost hours of backfill scripts.
- **Optimistic assumptions about providers:** We kept expecting LLMs to follow JSON contracts, yet every sprint started with another parser rewrite. Trust but verify should have been our default from day one.

## Actionable Guidance

- **Codify regression tests before refactors.** If we cannot test multi-test storage end-to-end, we cannot afford to touch it.
- **Diff SQL against schema before deploying.** A single checklist item would have saved the raw response fiasco.
- **Treat UX telemetry as truth.** If the UI goes blank, stop refactoring until the user flow is restored.

Documenting these missteps is not self-flagellation—it is a reminder that the most expensive bugs were the predictable ones we ignored.
