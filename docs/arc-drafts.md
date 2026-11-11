# ARC draft retirement

Author: GPT-6.1 Sol
Date: 11-November-2026

The Boss explicitly requested removal and merge on November 11: old drafts must not remain searchable or findable. This supersedes the earlier unlisted archive/desk approach.

Removed from public hosting: 25 essay previews, technical layout/review/export alternatives and paragraph pickers from the earlier desk, the desk itself, the older Turducken desloppifier, and 32 editable draft/source/build files. The exact 59-file URL inventory is `server/data/retiredArcDrafts.json`. Old writing is recoverable from Git history, not a public archive. Do not restore it under another public path.

`server/middleware/retiredArcDrafts.ts` runs before static hosting, runtime overlays and SPA fallbacks, responding HTTP 410 with `X-Robots-Tag: noindex, nofollow`. The retired technical draft's comments API is also blocked, including writes, so stored quoted draft text does not remain a public alternative. Durable comment logs are not destroyed. Search engines must recrawl old URLs before cached listings disappear; this change cannot immediately erase external caches.

The evidence pages, paper figures, chart/media assets, games and unrelated published articles remain available. The evidence page no longer links to the removed engineering draft. No indexed navigation/sitemap entries pointed to the removed drafts. Shared chart builders and factual evidence under `arc3-solution-draft/charts/` remain intact.

Future writing should use one non-public working source, not numbered public preview URLs. The simpler intelligence/slop/creativity direction remains the brief; no new essay is represented as finished or approved by this cleanup.
