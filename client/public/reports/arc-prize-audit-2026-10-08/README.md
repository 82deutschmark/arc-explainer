# ARC Prize public website audit — October 8, 2026

[Read the hosted report](https://arc.markbarney.net/reports/arc-prize-audit-2026-10-08/audit.html). The report contains screenshots and a printable layout; no ZIP or login is required.

- [Structured fix list](fixes.json): 19 prioritized findings with reproduction and acceptance checks.
- [Coding-assistant brief](coding-assistant-handoff.txt): suggested order and owner decisions.
- [Compact evidence](evidence.json): observations, API controls, coverage and source checks.
- [URL-check inventory](url-checks.csv): reachability checks, including inconclusive responses.

This is an independent ARC Explainer review, checked on October 8, 2026. Confirm current behavior before implementing. Confirmed defects, external failures, publication decisions and product proposals are labeled separately. Full third-party HTML and datasets are not republished. No changes were made to ARC Prize.

The HTML is served unchanged from Vite’s public assets through the existing production static-file middleware. Its embedded screenshots make the report readable offline too.
