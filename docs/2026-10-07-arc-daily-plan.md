# ARC Daily: the competition sports desk

Author: GPT-6.1 Sol / Codex
Date: 2026-10-07

Build a public newspaper at /news with permanent articles, a competitor notebook and twice-daily GPT-6 Sol editions through the signed-in Codex subscription. Keep the 6 pm Eastern roundup and add a 6 am Eastern morning edition. Commit/push invokes the existing deployment; do not poll deployments.

The morning desk emphasizes movement since the previous UTC midnight; the evening desk retains the prior 6 pm Eastern daily comparison. Both use America/New_York for calendar boundaries and record actual snapshots. Morning does not claim all submissions have finished evaluating. Prior editions remain accessible.

Architecture: committed, validated JSON under content/news is the durable small database. A Python 3.13 preparation tool computes evidence from the existing public board endpoints. The scheduled GPT-6 Sol run writes journalism from that evidence, maintains sourced competitor facts and publishes through a clean dedicated git worktree. Server API and initial search HTML read the same files; React gives them an old sports-page presentation. No paid model API is needed.

Articles are opinionated about sporting consequences, factual about scores and identities. No invented quotes, biographies, affiliation, motives, cheating allegations or secret methods. Rivalries/comebacks require evidence. Different competition team IDs remain distinct; cross-competition connections need sourced member/profile matches. An unfamiliar name in a new history window is not a new entrant. Record unknowns rather than guess. The user's Hartman/NVARC recollections are research leads, not publication sources.

Discord-ready copies remain drafts because no delivery channel was selected. Publishing the website is authorized by the newspaper request and the existing commit/push workflow.

## Delivery and validation

- Opening ARC-2 and ARC-3 launch preview issues were written by GPT-6 Sol from the prepared brief and edited for timing clarity. Both are committed with their immutable evidence. The competitor notebook includes dated primary-source background for Jan Disselhoff, David Hartmann and the NVARC lineage.
- Codex automations: `the-arc-daily-morning-edition` at 06:00 and `arc-agi-3-evening-leaderboard-recap` at 18:00, using GPT-6 Sol with medium reasoning. The host timezone is America/New_York, so these follow Eastern daylight saving changes. Morning baseline remains midnight UTC.
- Dedicated reporting checkout: `/Users/macmini/GitHub/arc-explainer-newsroom`, branch `codex/newsroom-publisher`, pushing `HEAD:main`. Instructions: `docs/newsroom/REPORTER.md`.
- Validation: client and server production bundles pass; 25 news/SEO tests and 9 Python newsroom tests pass. TypeScript has the same pre-existing diagnostics in unrelated files; none in changed files. No Railway deployment polling.
- Discord: the user authorized one launch announcement in #arc-3. Recurring posts remain drafts.
