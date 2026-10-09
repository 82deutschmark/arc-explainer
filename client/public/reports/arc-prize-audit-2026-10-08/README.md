# ARC Prize public website audit — October 8, 2026

[Read the short link guide and optional audit](https://arc.markbarney.net/feedback). The report contains screenshots and a printable layout; no ZIP or login is required.

- [Structured fix list](fixes.json): 20 prioritized findings with reproduction and acceptance checks.
- [Coding-assistant brief](coding-assistant-handoff.txt): suggested order and owner decisions.
- [Compact evidence](evidence.json): observations, API controls, coverage and source checks.
- [URL-check inventory](url-checks.csv): reachability checks, including inconclusive responses.

This is an independent ARC Explainer review, checked on October 8, 2026. Confirm current behavior before implementing. Confirmed defects, external failures, publication decisions and product proposals are labeled separately. Full third-party HTML and datasets are not republished. No changes were made to ARC Prize.

The HTML is served unchanged from Vite’s public assets through the existing production static-file middleware. Its embedded screenshots make the report readable offline too.

October 8 correction: the report now shows populated reasoning and output screenshots for task 221dfab4 attempt 73914, with exact links to it and historical Opus 4.5 attempt 56958. The main request is restoring downloadable ARC1/2 attempts or linking a successor source so downstream ingestion can continue. News and synthetic games are distinct curation candidates.

Task-hint follow-up: AP-20 records 16 equal-total/shape-count-change label mismatches across 10 ARC2 evaluation tasks, with a live screenshot and exact links for 13e47133. Reflection claims remain unconfirmed; these statistics are not verified puzzle rules.

October 9 presentation update: `/feedback` now leads with seven annotated resource links and the requests about useful task guidance, raw-attempt publication and hands-on curation. The full dated audit and comparison remain in an expandable section.
October 9 follow-up: adds Mark’s noncommercial motivation, direct original-author resources, and explicit questions about Hugging Face publication and Opus 5.5 ARC-3 status. New publication observations are dated separately from the original audit.

Clarification: the desired model comparison is Opus 4.5 versus 5.5, enabled by future access to the newer raw attempts. The existing Opus 4.5 link is an archive example, not an available 5.5 comparison. Resource feedback concerns curation quality even where ARC Prize already links the creator.
