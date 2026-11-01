# Focus search discovery on Mark's work

Author: GPT-6.1 Sol / Codex
Date: 2026-10-27

The owner explicitly requested removal of individual game and puzzle URLs from the
sitemap. Promote research, explanations, original-game collections and authored
coverage through their existing pages. This supersedes the per-game sitemap portion
of `2026-10-27-public-trainable-seo-plan.md`.

1. Remove automatic puzzle, official-game and approved-play URL enumeration from the
   sitemap. Retain the existing research, reference, collection and editorial registry.
2. Remove the unused approved-game sitemap helper and its live-feed dependency from
   sitemap delivery. Gameplay and gallery links continue using the approved catalog.
3. Make the homepage metadata identify Mark's research and explanations, and retain
   the original-game collection as the public play destination.
4. Update existing HTTP regressions to reject individual game/puzzle sitemap entries,
   retain the intended landing pages, and verify direct game/puzzle access still works.
5. Run focused tests and production build, update the changelog, commit and push.

Browser plan: none required. Validate generated XML and actual local HTTP responses
through the existing integration suite; deployment follows the user's Git workflow.

Validation completed: production build passes; 21 tests pass across SEO HTTP delivery,
approved-game source/catalog delivery and leaderboard metadata. The sitemap regression
rejects every individual puzzle/official-game/play path and retains the research,
reference, collection, human-records and editorial landing pages. Existing official
guides, a puzzle address, approved play pages and source payloads remain accessible.
`git diff --check` passes. No browser or production-verification session was opened.
