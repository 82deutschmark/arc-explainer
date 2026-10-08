# Audit examples and retired rankings

Author: Codex
Date: 2026-10-08

The user requested a directly linked audit example and removal of the obsolete trustworthiness leaderboard from public use. The follow-up makes downloadable ARC1/2 attempt publication the central request: without new public artifacts, ARC Explainer cannot ingest and expose comparable inspection tools for newer models. Include the supplied Opus 4.6 and historical Opus 4.5 attempts, plus The ARC Daily and curated synthetic ARC3 games as resources to review.

Replace the audit's empty-reasoning screenshot with actual browser captures of the supplied saved attempt, linking each image and caption to its exact highlight URL. Update the structured findings and evidence alongside the report.

Retire /leaderboards with HTTP 410 and noindex metadata, remove its navigation/discovery links, and replace its client component with a retirement notice that performs no ranking queries. Preserve the current Kaggle boards and historical puzzle records. No database deletion or alteration of saved explanations is required.

Also inspect and repair the reported broken Hardest Puzzles section on Analytics.

Validation: production client/server build; SEO integration tests for retired routes; targeted analytics regression checks based on the reproduced issue; live report, downloads and changed pages after publication.

Implemented: difficult-puzzle ranking uses scored all-tests-correct outcomes, excludes unknowns, aggregates feedback once per record, filters catalog membership before the SQL limit (including overlapping ARC editions), and returns catalog grid metadata. Cost/time sorting no longer depends on a display toggle; confidence uses stored percent units. Canonical links, retry and an accessible expand control are restored.

Validation completed before publication: client/server builds pass; 15 focused checks pass, including real queries against temporary PostgreSQL tables and real dataset membership. Whole-repository TypeScript checking has existing unrelated errors; edited files are checked separately in its output.
