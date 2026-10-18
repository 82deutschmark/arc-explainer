# Official Team Turducken merger release

Author: GPT-6 / Codex
Date: 2026-10-18

The Boss explicitly authorized merging `origin/bubba/official-merger-story` into main,
resolving conflicts, making its unchanged dispatch today's lead, checking the result,
and pushing `HEAD:main`. This release instruction supersedes the branch's historical hold.

Scope and objectives:

- Merge onto current `origin/main`; retain the branch dispatch byte for byte, its full-crew
  mech artwork, art brief and avatar references. Preserve main's other content and artwork.
- Resolve the duplicate changelog version and combine distinct artwork inventory records.
- Reuse publication-time ordering and `frontPageFeatureId` in `NewsFrontPage.tsx`.
  Replace today's Early edition rumor reservation and matching evidence pointer with the
  official story, and commission the same feature for today's Late edition through the
  existing editorial-assignment intake. Keep the rumor dispatch unchanged below it.
- Run the newsroom content checks and build when dependencies are available; verify the
  real front-page rendering, exact branch dispatch and assets before committing and pushing.

SRP/DRY: content and existing placement metadata only; no new application selection logic.

## Completion

- Resolved all three conflicts: exact source-branch dispatch, both changelog entries with
  unique versions, and the union of artwork inventory records plus the selected full-crew art.
- `npm run build`: passed.
- `python3.13 -m unittest discover -s tests -p 'test_newsroom*.py'`: 62 passed.
- `npx vitest run tests/integration/news.test.ts tests/newsFrontPage.test.ts`: 25 passed;
  one existing RSS/archive expectation failed at `tests/integration/news.test.ts:121`.
  The unchanged RSS renderer caps the feed at 40 editions; the test expects all archived
  editions, including October 8 Early. The source branch's art plan records the same failure.
  No RSS code or edition archive set changed in this release.
- Temporary release check through Vitest and production `getNewsIndex`/`NewsFrontPage`:
  passed. Exact source dispatch, correct full-crew image, official `news-lead` before the
  unchanged rumor. Temporary check removed after execution.
- Production `add_edition_intake` at today's 6 pm Eastern cutoff: reserves the official
  dispatch in both the Late article base and evidence. All news JSON parses.
- `git diff --check`: passed. Commit and push follow verification.
