# The ARC Daily Digest backup desk (Claude Sonnet 5.5)

Author: Claude Opus 5.5 · 10 October 2026, at the Boss's request · rewritten by Claude Opus 5.5 Max,
15 October 2026 (Sonnet 5.5, Discord reports, self-recovery, picture rule)

Codex (GPT-6.1 Sol for editions, GPT-6 Luna for the wire) writes the paper. When Codex misses a
job, the backup desk covers it with **Claude Sonnet 5.5 through the Boss's Claude Code
subscription** (the claude.ai sign-in; the runner unsets any API key so it can never bill the paid
API). It has its own checkout and never touches the Codex checkouts.

## When it runs

launchd `com.arcdaily.fallback` runs `scripts/newsroom_fallback.sh` from
`/Users/macmini/GitHub/arc-explainer-fallback` (branch `claude/newsroom-fallback`):

| When (Eastern) | Job | Steps in only if |
|---|---|---|
| 6:50 am | `morning` | a contest's Early edition is not on `main` and no Codex edition run is in progress |
| 6:50 pm | `evening` | a contest's Late edition is not on `main` and no Codex edition run is in progress |
| 9:40 am, 12:40, 3:40, 9:40 pm | `wire` | Codex is signed out, or has not started a wire run for two and a half hours |

It covers only the missing contests. Every step-in and every outcome is posted to the Digest's
Discord channel through the desk relay (`~/bubba-workspace/tools/arc_daily_announce.py --alert`),
with a Mac notification if the relay cannot post. Logs and the run's working files are in
`~/Library/Logs/arc-daily-fallback/`. If an earlier backup run left unfinished changes, the runner
saves them to a dated `rescue-…` folder there, reports it, and starts clean.

By hand: `scripts/newsroom_fallback.sh morning` (still does nothing if Codex delivered), or
`scripts/newsroom_fallback.sh morning --rehearse` to run the whole job without publishing anything.

## Backup changes to the normal workflow (read these first)

Follow `docs/newsroom/REPORTER.md` (editions) or `docs/newsroom/WIRE_DESK.md` (wire) exactly, with
these differences:

1. **Checkout and files.** Work in `/Users/macmini/GitHub/arc-explainer-fallback` on branch
   `claude/newsroom-fallback`. Keep every brief, draft and art plan in the working folder the task
   names (under `~/Library/Logs/arc-daily-fallback/`), never in `/tmp` (Codex uses it) or the
   repository. Push with `git push origin HEAD:main` after the usual fetch/rebase; never force.
2. **Name yourself.** Editions: `python3.13 scripts/newsroom.py prepare --edition <morning|evening>
   --writer claude-sonnet-5-5 --output <working folder>/brief.json`. Wire stories:
   `python3.13 scripts/newsroom_wire.py publish ... --writer claude-sonnet-5-5`. The site credits
   "Claude Sonnet 5.5, backup desk" on those stories.
3. **Only the missing contests.** Check `content/news/articles/` after pulling: never write a contest
   whose edition already exists. If the publish helper reports an existing ID, stop that contest.
4. **No browser.** You run headless: skip the X and Kaggle browsing, the social and discussion
   refresh and exports, and the people portrait commands. Use the committed public archive and
   notebook as they are, and say in the coverage that the social scan was not refreshed.
5. **Pictures: approved stock only.** The paper wants an illustration on every front page, but you
   cannot generate images. After writing the lead contest's draft, run the art planner as
   `docs/newsroom/ART_DESK.md` describes. If the plan returns a job with `reuseBase`, compose from
   that exact approved base with the fresh brief, look at the finished image, attach it and validate.
   If it returns no job, or a job that needs new generation, publish without an image. Never pick a
   scene the planner did not approve, and never reuse a finished image from an earlier issue.
   State the picture outcome in your final OUTCOME line so the Boss sees it.
6. **No posting.** Do not post to X or Discord yourself: the desk relay announces the live edition
   in Discord. For an edition, draft the X post with `python3.13 scripts/newsroom_x.py --edition
   <morning|evening> --output /Users/macmini/bubba-workspace/reports/arc-daily-x/<date>-<early|late>-edition.json`
   so the Boss can send it; never overwrite an outbox already in a `posting` or `posted` state.
7. **Assignments.** Account for every intake item and editorial assignment as REPORTER.md requires.
   Pictures you cannot make are `held` with the reason, never silently dropped.
8. Every other rule stands: every figure from the brief, unknowns stay unknown, respect every
   contender, stage only the intended `content/news/` files.

## Where the model and writer list live

The allowed writer IDs are in `shared/newsWriters.json`, read by the site and both newsroom
scripts. Changing the backup's model means changing `MODEL` in `scripts/newsroom_fallback.sh`,
the writer ID in that file, and its byline in `shared/news.ts` and `shared/newsStaff.ts`, together.
