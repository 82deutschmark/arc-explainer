# ARC Daily Digest social desk

The scheduled scans **enhance the journalism**. They supply announcements, research releases, reactions and respectful banter with original links to the morning/evening reporters, personal briefing and Sunday meeting workflow. Research shifts do not send public posts.

Mark's October 12 night direction: collect broadly and translate Japanese competitor
voices, but keep the newspaper balanced. Sasha's technical work is primarily background
for the desk/personal briefing. `content/news/social-editorial.json` can exclude selected
post IDs and research from specified accounts from the curated From X strip and edition
source subset. This changes editorial placement, not public visibility: the full public
archive and private source state keep those posts, and standings posts from a background
research account can still be news. Comment invitations and earlier-leader comparisons
are optional light material for a suitable or slower issue, not a daily required hook.

## Cadence and outputs

The same research and personal-briefing jobs include Kaggle discussion intake under [DISCUSSIONS.md](DISCUSSIONS.md). Full board scans run twice daily at 5 am and 5 pm Eastern, checking both new topics and recent replies; X research also includes the new 3 am overnight shift. The discussion desk keeps a broad topic/reply inventory and a separate personal digest, then exports only read public paper leads into edition evidence. The From X archive and its display remain X-specific.

All desk times are America/New_York: the existing research job now runs hourly. At 03:00, 05:00, 11:00, 17:00 and 23:00 it performs the broad research shift; other hours are focused François Chollet/Mike Knoop checks. Private briefings stay at 05:30 and 17:30; editions at 06:00 and 18:00; the existing public X recap at 14:00. Use GPT-6.1 Sol through the signed-in subscription and Chrome account 82deutschmark. No paid model or X API. The local computer and app need to be running.

## Capture every founder post — Mark, October 13 evening

François Chollet (`fchollet`) and Mike Knoop (`mikeknoop`) are mandatory priority sources.
Capture every new post, quote, reply and thread follow-up before deciding its newspaper
value. General AI commentary, product links, games and jokes still belong in the collected
archive. Keep predictions and jokes attributed; never turn them into contest results.
The full public archive carries every captured public item. The small front-page strip
and edition leads remain selected journalism. Subscriber items belong in Mark's private
archive/briefing. Do not omit a founder post just because it does not fit an ARC headline.

Select **Chrome explicitly**, using its extension and the existing signed-in profile.
Confirm the X account menu says `@82deutschmark`; the in-app browser is a separate session.
Read Posts, Replies and Reposts separately, plus Chollet's Subs feed. A logged-out search
snippet, web 403 or empty in-app browser is not a completed signed-in timeline scan.
Regular public posts and visibly labelled subscriber entries must be handled separately;
uncertain visibility remains private. Like/follow controls can be used through Chrome,
but the research schedule does not authorize automatic engagement or sends.

Maintain `/Users/macmini/bubba-workspace/reports/arc-daily-social/founder-coverage.json`
with independent `posts`, `replies`, `reposts` and (Chollet only) `subscriber` surfaces.
For chronological surfaces record actual check time, requested/covered interval,
`status`, `lastCompleteThrough` only on complete coverage, seen IDs and concrete limits.
Start one hour before that surface's last complete checkpoint, or use the ordinary plan
when none exists. Scroll newest through the older boundary, expanding posts and reading
thread context; pinned posts and quoted timestamps never set the checkpoint. Cross-check
with a focused Latest search for the handle/window when useful; search remains partial.
For reposts retain original author/ID/date and a seen-ID inventory with first observation;
do not invent a repost action time from the original publication date. Capture the read
original in the normal batch and the repost relationship in this private ledger.

One incomplete repost surface must not erase successful Posts/Replies checkpoints.
Keep the existing aggregate account status partial until all requested coverage is
complete; never advance its complete watermark on a partial run. Preserve previous
ledger data and delivery/send state. Save a dated founder handoff listing all new IDs,
public leads, private items and gaps. Edition reporters read it before selecting stories.
The October 13 catch-up recovered seven previously missing public founder posts; its
handoff is `reports/arc-daily-social/editorial/2026-10-13-founder-catchup/handoff.json`.
At midnight, prepare a candidate using fresh score/news evidence and the prepared GPU
bridge image; an extra public send still needs its separate human authorization.

The 3 am shift is Mark's October 13 overnight instruction, added to the existing research
automation. Check both boards for meaningful overnight score events and leaders/medal
moves, then read original X statements and relevant thread context. Save dated evidence,
public leads and access limits under `reports/arc-daily-social/overnight/YYYY-MM-DD/`,
with `editor-handoff.json` for the morning publisher. Keep unchanged overnight state quiet
and send no X/Discord post or direct ping from this shift. The full discussion scans stay
at 5 am and 5 pm. The 6 am issue prepares its own final-cutoff evidence.

Work from the clean reporting checkout `/Users/macmini/GitHub/arc-explainer-newsroom` after checking origin/branch and pulling main with `--ff-only`. Research does not edit app code or send messages. State and private summaries live at `/Users/macmini/bubba-workspace/reports/arc-daily-social/`, outside public content. This archive is small text; bulk downloads belong on the external SSD.

```sh
python3.13 scripts/newsroom_social.py plan --directory /Users/macmini/bubba-workspace/reports/arc-daily-social
```

Read the complete plan, the public watch list `content/news/social-watch.json` and the verified person ledger. Use the signed-in browser to read each account's posts since `after`, including threads and linked primary releases. The initial window is seven days; subsequent windows start one hour before the last completely scanned time. Search the competition names and significant current contenders too. The watch list is a starting point, not favored editorial treatment. Never infer an account from a similar name. Add a new verified identity or source only in the authorized edition publication workflow.

## Discover competitors across X — Boss instruction, 12 October 2026

Every research shift and the 2 pm X desk must search beyond the watch list for people
posting their own ARC Prize Kaggle standings, score improvements or medal-band milestones.
Use the Latest view from anyone, exact competition names and terms such as `Kaggle`,
`leaderboard`, `rank`, `medal`, `順位` and `メダル`; include native Kaggle share wording
such as “Moved up to rank” and “Rank … on #kaggle.” Read the actual post and context,
then follow its competition/profile links. Search coverage remains partial and never
advances an account's complete timeline watermark.

Verify identity through a direct link on the person's Kaggle profile, X profile, or owned
professional page. A matching display name, avatar, screenshot rank or score is a lead,
not identity proof. The Kaggle roster handle may differ from the team/display name.
On 12 October, the Kaggle account **ffsscf**, displayed as **fshindo**, directly linked
to **@crysis44k**; the two 2026 team IDs are ARC-3 `16992721` and ARC-2 `17019785`.
Those are separate contest entries connected to one verified person.

Save dated discovery handoffs under
`/Users/macmini/bubba-workspace/reports/arc-daily-social/identity-leads/`, including the
exact post/profile links, check time, claim's observation time, verified cross-links,
competition/season/team ID and roster handle where established, plus unresolved gaps.
Keep unverified matches in this private handoff. The edition reporter reads new handoffs
before preparation, persists verified people/roster facts and watch entries, and exports
only verified public posts. Re-prepare after identity/source changes. Do not guess joining
dates, individual responsibility for a score, or present standings from an old post.

Newly verified competitors join the watch list so subsequent shifts revisit them. The
fshindo account now does; @iiiiitsu_ne and @menphim were also found sharing ARC standings
and remain discovery leads until their exact Kaggle identities are directly linked.

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

This writes at most 20 recent validated public posts to `content/news/social.json` and the entire dated public thirty-day archive to `content/news/social-archive.json`. Stage both files with the edition. `/news/community#tweet-archive` shows the full archive newest first, with search and competition filters; the front page’s From X strip places four useful posts below the ticker, before lead stories, with related releases or threads sharing one slot and a clear link to the collected archive. Preparation inserts relevant `social-ID` citations. Useful social leads become reporting, not an automatic wall of tweets. Re-prepare after public person/notebook/social changes. Keep person source IDs and roster citations in sections that use them. The front page remains the consequential scheduled recap; extra coverage branches into supporting pages or a separate sourced dispatch.

Bubba's `arc-weekly-announcement` skill reads the same seven-day **public** archive, groups related stories, refreshes sources and shows the full digest for the user's choice of meeting bullets. It retains Sunday 18:00 UTC and the existing event/Discord format. The daily archive does not authorize recurring Discord sends. The 2 pm X workflow consumes the archive plus fresh board evidence; it remains the one authorized routine public recap. Additional alerts are drafts.

## People research notebook

`content/news/people.json` stores verified identities, narrow cited facts, exact account handles, competition/season/team memberships with first/last observation times, explicit historical Hall of Fame honors/artwork and each person's portrait (see `VISUALS.md`). `competitors.json` remains the team notebook. Internal unknowns and research questions stay in `reports/arc-daily-social/people-notes.md`, not public facts. Update the reusable competition-reporter skill only when a real lesson changes reporting decisions; keep ARC-specific paths and schedules in these adapter docs.
