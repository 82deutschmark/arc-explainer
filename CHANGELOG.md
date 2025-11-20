## ARC Explainer  
- Use proper semantic versioning (MAJOR.MINOR.PATCH) for all changes!! Add new changes at the top!!!

### Version 5.14.1

- Bug fixes
  - Fixed Jeremy Berman contributor card to display "High Score" badge without rank indicator
  - Removed rank display from 2024 ARC Prize winner cards (Daniel Franzen, Guillermo Barbadillo) for cleaner card presentation

- Refactoring
  - Renamed `/human-cards` endpoint to `/hall-of-fame` for better semantic clarity
  - Updated navigation, routes, and sitemap to reflect new endpoint URL

- Docs
  - Added `docs/reference/database/MULTI_TEST_CORRECTNESS_GUIDE.md` describing the multi-test correctness pipeline, field semantics, and UI/display patterns for future maintainers.

### Version 5.14.0

- LLM Reasoning docs
  - Added `/llm-reasoning` explainer page and `/llm-reasoning/advanced` research-style article.
  - Linked advanced article from the basic explainer header.

- Top navigation refactor (ARC-3 & Misc)
  - Replaced hover-based `NavigationMenu` dropdowns with click-to-open `DropdownMenu` components.
  - Fixed dropdown alignment and viewport so ARC‑3 / Misc menus open directly under their tabs and are no longer clipped by header overflow.
  - Reorganized navigation into grouped menus for ARC‑3 experiences and Misc tools with clearer active‑route highlighting.

- Analytics, SEO & AEO
  - Added sitemap, robots, and `llms.txt` plus canonical metadata and JSON‑LD to improve web and LLM discoverability.
  - Introduced model origin badges and labels in Analytics to distinguish official ARC Prize leaderboard runs from community runs.
  - Clarified evaluation harness copy and how analytics are generated from the shared ARC‑AGI benchmarking harness.

- Correctness & metrics fixes
  - Overhauled correctness logic across Accuracy, Trustworthiness, ModelDataset, and Metrics query helpers to correctly handle single vs multi‑prediction runs, NULLs, and JOIN duplication.
  - Updated trading card win‑rate and difficulty display to use consistent correctness semantics and percentage formatting.

- Contributors backend
  - Refactored `ContributorRepository` to extend `BaseRepository` and integrated it via `RepositoryService` and a new `contributorController`, fixing crashes on `/api/contributors` endpoints and aligning with the standard repository/controller pattern.
