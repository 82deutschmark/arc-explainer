# ARC Daily Digest social desk

The six-hour scan **enhances the journalism**. It supplies announcements, research releases, reactions and respectful banter with original links to the morning/evening reporters, personal briefing and Sunday meeting workflow. It does not post four times a day.

## Cadence and outputs

All desk times are America/New_York: collection at 05:00, 11:00, 17:00 and 23:00; private briefings at 05:30 and 17:30; editions at 06:00 and 18:00; the existing public X recap at 14:00. Use GPT-6 Sol through the signed-in subscription and Chrome account 82deutschmark. No paid model or X API. The local computer and app need to be running.

Work from the clean reporting checkout `/Users/macmini/GitHub/arc-explainer-newsroom` after checking origin/branch and pulling main with `--ff-only`. Research does not edit app code or send messages. State and private summaries live at `/Users/macmini/bubba-workspace/reports/arc-daily-social/`, outside public content. This archive is small text; bulk downloads belong on the external SSD.

```sh
python3.13 scripts/newsroom_social.py plan --directory /Users/macmini/bubba-workspace/reports/arc-daily-social
```

Read the complete plan, the public watch list `content/news/social-watch.json` and the verified person ledger. Use the signed-in browser to read each account's posts since `after`, including threads and linked primary releases. The initial window is seven days; subsequent windows start one hour before the last completely scanned time. Search the competition names and significant current contenders too. The watch list is a starting point, not favored editorial treatment. Never infer an account from a similar name. Add a new verified identity or source only in the authorized edition publication workflow.

Read François Chollet's subscribed feed separately at `https://x.com/fchollet/subs`. Record subscriber posts only in the private archive. If visibility is uncertain, use `unknown`. Do not bypass access limits. A partial timeline, login prompt or inaccessible account must be recorded as partial/error, with an honest covered interval; it is not evidence of no news.

## Research batch contract

Write a dated UTC collection filename such as `collections/2026-10-09T170000Z.json`. The JSON has exactly `version: 1`, `researchedAt`, `posts` and `accounts`.

Each post has exactly:

- `id`, `author` (exact X handle), `authorName`, `url` (https://x.com/HANDLE/status/ID).
- `postedAt` (verified UTC ISO or null), `checkedAt` (actual UTC ISO), `visibility` (`public`, `subscriber`, `unknown`).
- `summary` (<=1200 characters), `whyItMatters` (<=700), `competitions` (array of `arc-2`/`arc-3`), `personIds` (verified ledger IDs, or empty).
- `category` (`standings`, `research`, `community`, `banter`), `importance` (3 consequential, 2 useful, 1 color).
- `threadId` (root post ID or null), `storyUrl` (shared primary release URL or null), `identitySourceUrl` (primary identity verification).

`accounts` maps each scanned handle to exactly `status` (`ok`, `partial`, `error`), `coveredFrom`, `coveredThrough`, `checkedAt` and `detail`. `ok` means the complete requested interval was checked. Partial/error scans preserve the prior fully checked watermark. Save separate coverage detail for public and subscriber feed limits within the account's detail; do not claim complete coverage if either requested feed failed.

```sh
python3.13 scripts/newsroom_social.py ingest --directory /Users/macmini/bubba-workspace/reports/arc-daily-social --batch <actual-batch-path>
```

This validates before writing, locks concurrent CLI writes and merges by post ID. `state.json` contains version 1 `posts`, `accounts`, `deliveries`; `public.json` contains only public posts with known publication dates from the past seven days. The archive retains checked posts for 30 days. Keep short summaries, not copied subscriber articles.

## Personal briefing

```sh
python3.13 scripts/newsroom_social.py brief --directory /Users/macmini/bubba-workspace/reports/arc-daily-social --edition morning
```

Use evening after noon. The dated file is `briefings/YYYY-MM-DD-morning.md` or `-evening.md`. The briefing selects up to eight new story groups, reserving two places for subscriber material if present. Public and subscriber sections are separate. Previously delivered stories are not repeated; distinct consequential follow-ups with new IDs can appear later. Repeating the same edition returns its saved file. Read and summarize the private file directly in the local task's result. Never link or copy its subscriber section into public content, X, or Discord. Report missing scan coverage honestly.

## Public editions and Sunday meeting

Before preparing an edition, refresh relevant source posts and run:

```sh
python3.13 scripts/newsroom_social.py export-public --directory /Users/macmini/bubba-workspace/reports/arc-daily-social
```

This writes at most 20 validated public posts to `content/news/social.json`. They appear on `/news/community`; preparation inserts relevant `social-ID` citations. Useful social leads become reporting, not an automatic wall of tweets. Re-prepare after public person/notebook/social changes. Keep person source IDs and roster citations in sections that use them. The front page remains the consequential scheduled recap; extra coverage branches into supporting pages or a separate sourced dispatch.

Bubba's `arc-weekly-announcement` skill reads the same seven-day **public** archive, groups related stories, refreshes sources and shows the full digest for the user's choice of meeting bullets. It retains Sunday 18:00 UTC and the existing event/Discord format. The daily archive does not authorize recurring Discord sends. The 2 pm X workflow consumes the archive plus fresh board evidence; it remains the one authorized routine public recap. Additional alerts are drafts.

## People research notebook

`content/news/people.json` stores verified identities, narrow cited facts, exact account handles, competition/season/team memberships with first/last observation times, explicit historical Hall of Fame honors/artwork and each person's portrait (see `VISUALS.md`). `competitors.json` remains the team notebook. Internal unknowns and research questions stay in `reports/arc-daily-social/people-notes.md`, not public facts. Update the reusable competition-reporter skill only when a real lesson changes reporting decisions; keep ARC-specific paths and schedules in these adapter docs.
