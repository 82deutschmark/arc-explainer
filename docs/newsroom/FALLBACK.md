# The ARC Daily Digest backup desk (Claude Haiku 5.5)

Author: Claude Opus 5.5 · 10 October 2026 · at the Boss's request.

Codex (GPT-6 Sol and GPT-6 Luna) writes the paper. If Codex is signed out or a run fails, the
backup desk covers it with **Claude Haiku 5.5, through the Boss's Claude Code subscription** (the
claude.ai sign-in; the runner unsets any API key so it can never bill the paid API).

## How it runs

A launchd agent, `~/Library/LaunchAgents/com.arcdaily.fallback.plist`, runs
`scripts/newsroom_fallback.sh` from the backup checkout `/Users/macmini/GitHub/arc-explainer-fallback`
(branch `claude/newsroom-fallback`, a worktree of the newsroom's own repository):

| When (Eastern) | Job | Runs Haiku only if |
|---|---|---|
| 6:50 am | `morning` | today's early edition is not on `main` |
| 6:50 pm | `evening` | today's late edition is not on `main` |
| 9:40 am, 12:40 pm, 3:40 pm, 9:40 pm | `wire` | Codex reports it is signed out |

It posts a Mac notification when it steps in and logs to `~/Library/Logs/arc-daily-fallback/`.
To run one by hand: `scripts/newsroom_fallback.sh morning` (it still does nothing if Codex delivered).

## Backup changes to the normal workflow (Haiku: read these first)

Follow `docs/newsroom/REPORTER.md` (editions) or `docs/newsroom/WIRE_DESK.md` (wire) exactly,
with these differences:

1. **Checkout.** Work in `/Users/macmini/GitHub/arc-explainer-fallback` on branch
   `claude/newsroom-fallback` instead of the Codex checkouts. Push with `git push origin HEAD:main`
   after the usual fetch/rebase; never force.
2. **Name yourself.** Editions: `python3.13 scripts/newsroom.py prepare --edition <morning|evening>
   --writer claude-haiku-5-5 --output /tmp/arc-daily-<edition>-brief.json`. Wire stories:
   `python3.13 scripts/newsroom_wire.py publish ... --writer claude-haiku-5-5`. The site credits
   the backup desk on those stories.
3. **No browser.** You run headless: skip the X and Kaggle browsing, the social archive refresh and
   the people portrait command. Use the existing public archive and notebook as they are, and say
   in the coverage that the social scan was not refreshed.
4. **No posting.** Do not post to X or Discord. For an edition, run
   `python3.13 scripts/newsroom_x.py --edition <morning|evening> --output
   /Users/macmini/bubba-workspace/reports/arc-daily-x/<date>-<early|late>-edition.json` so the post
   is drafted for the Boss, and save the Discord drafts as the reporter workflow says.
5. **If Codex already published** the edition while you were starting (the publish helper reports
   an existing ID), stop: never publish a second copy.
6. Every other rule stands: every figure from the brief, unknowns stay unknown, respect every
   contender, stage only the intended `content/news/` files.
