# Scheduled editions: prepare the picture, then publish the edition

Author: GPT-6.1 Sol / Codex · updated 29 October 2026 at Mark's direction.

This is the route for scheduled Early and Late editions. Read [TEAM_PLAYBOOK.md](TEAM_PLAYBOOK.md)
and the [Card Cabinet](https://arc.markbarney.net/news/cards) before reporting or commissioning
art. All existing and new art uses the actual registered reference characters, exact contest/team
IDs and verified roster handles. [ART_DESK.md](ART_DESK.md), [CHARACTERS.md](CHARACTERS.md) and
[X_POSTING.md](X_POSTING.md) define the reference, review and send-once contracts.

A successful push finishes publication; no deployment check follows it. Distribution is a
separate required step. An edition announcement is one reviewed package: headline, permanent
article link and attached illustration. **There is no text-only edition X fallback.**

## Work limits and checkout

- Use the signed-in GPT-6.1 Sol subscription and one agent. No paid API, model switching,
  subagents, web search, social discovery or deployment polling. Use fresh fixed board feeds
  and saved public research. Native image generation from the registered references is authorized
  when suitable unused artwork is unavailable; this supersedes the former no-generation rule.
- Browser access is only for the routine X account/duplicate check, upload, compose review,
  one send and one success result. Keep that step within six minutes and ten browser calls.
- Work only in `/Users/macmini/GitHub/arc-explainer-newsroom`, branch `codex/newsroom-publisher`,
  origin `https://github.com/82deutschmark/arc-explainer.git`. Inspect status and in-progress Git
  operations; preserve unrelated work, including untracked `output/` PDFs. Pull ff-only from main.
  Stop for actual overlapping-file conflicts, wrong origin/branch or an in-progress operation,
  rather than resetting, stashing or deleting another writer's work. Use the automation's narrow
  missing-checkout repair when necessary; never repurpose other checkouts.
- Read the short memory and current brief, not whole research directories or old browser sessions.
  Respect assignments, held features and publication permissions. An unverified research lead is
  held with its reason, not investigated inside this job. Check README.md's execution-access
  recovery before describing a local DNS/permission failure as unavailable board evidence.

## Late artwork prepress — 5 pm Eastern, finished before 6

The existing Late automation wakes at both **5 pm and 6 pm America/New_York**. These are two
passes of the same job, not a new desk or a reason to publish early. Before 6 pm, do only prepress:

1. Pull safely and read the Cabinet, playbook, saved handoffs and editorial assignments. Prepare
   `python3.13 scripts/newsroom.py prepare --edition evening --preview --writer gpt-6.1-sol
   --output <private-art-folder>/prepress-brief.json`. Preview evidence is for art planning only;
   never publish it as the scheduled closing edition. Use the normal private folder
   `/Users/macmini/bubba-workspace/reports/arc-daily-social/art-planning/YYYY-MM-DD-late-edition/`.
2. Choose the strongest verified news and its exact reference cast. A podium overtake or other
   consequential move deserves its own episode, even if the automatic stock plan is empty.
   Read the Cabinet dossiers and inspect the actual registered character images before generation.
   Include the Cabinet URL, identities, reference paths/roles/hashes and story in the commission.
3. Use suitable unused approved stock first. Otherwise commission one native clean illustration
   under ART_DESK.md using the real reference inputs; no paid API or invented likenesses. A reserved
   feature's commissioned cover retains its hold, source dates and reuse permission. Do not
   republish a previous episode just by changing its scores or crop.
4. Visually review and register the clean base. Save public assets, native provenance and the
   intended edition reservation together; commit/push those exact paths if prepared here. Save
   `manifest.json` in the private art folder with `targetEditionId`, story, selected generation
   record, exact reference cast, reuse/hold conditions, `preparedAt`, visual review and ready/error
   status. Aim to finish by **5:45 pm**. Save the concrete blocker if preparation fails.
5. Finish this pass. Do not send an edition announcement, publish a preview, sleep until 6, create
   another automation or start a monitoring loop. The existing 6 pm invocation reads the manifest.

Early editions use their prepared reserves or commissioned feature cover under the same image
and character rules; this change does not alter another desk's schedule or send permissions.

## Publish both contests — 6 pm Late / 6 am Early

1. Recheck the checkout and pull safely. For Late, read the prepress manifest and clean base;
   a saved file is not proof its story or cast still fits. Read relevant saved public handoffs.
2. Run `python3.13 scripts/newsroom.py prepare --edition evening --writer gpt-6.1-sol
   --output /tmp/arc-daily-evening-brief.json` (Early uses `morning`). **No `--preview` or `--now`
   for this closing pass.** Read the complete brief; use each ready contest's own fixed-cutoff
   evidence and account for every wire item, dispatch and assignment under REPORTER.md.
3. Write one sourced article per ready contest. Lead with the news and stakes; assume expert
   readers. Date reused public reporting and state once that social/discussion research was not
   refreshed. A board failure blocks only that contest. Keep opaque or unresolved identities honest.
4. Make the lead article illustrated before preparing X. Check the prepared scene against the
   final news and exact roster, then compose current score/date graphics, inspect, attach and
   validate under ART_DESK.md. If prepress failed or the story/cast materially changed, create or
   correct the required native episode from registered references now; do not silently drop art
   to meet a twelve-minute text deadline. Target twelve minutes for closing copy, excluding an
   actual required artwork repair. One targeted image correction is allowed; no optional variants.
5. Perform one final fixed-endpoint freshness check. If the eligible cutoff observation changed,
   re-prepare once and revise affected copy, citations, artwork and intake decisions. If it keeps
   changing, report that contest's failure and publish the other ready contest; no refresh loop.
6. Validate, publish, stage exact intended paths, run `git diff --check`, commit, safely fetch/rebase
   only your commits and push `origin HEAD:main` per REPORTER.md. One push-race retry is allowed.
   Never rewrite an existing edition. If it already exists, preserve it and continue from its
   protected distribution state. A real art failure may leave verified articles published, but
   **X remains blocked**. Report the exact failure; never claim illustration or sending completed.

## Send the single illustrated edition announcement

After the push, run `python3.13 scripts/newsroom_x.py --edition evening
--output /Users/macmini/bubba-workspace/reports/arc-daily-x/YYYY-MM-DD-late-edition.json`
(Early uses `morning` / `early-edition`). Preserve existing `posting` and `posted` outboxes and
human confirmations. The helper saves `blocked` and exits nonzero without reviewed artwork;
a generic link preview, a text-only draft or artwork on a different story does not satisfy this.
It never checks deployment or sends to X itself.

Deliver the finished exact attachment and edition link to Discord under ART_DESK.md and save
the receipt. Check for a person's reaction once, unless the editor explicitly waived the wait
for this release. No approval means `draft` / `awaiting-discord-approval`; no loops or retry job.
The relay's text-only notice does not deliver the image.

Confirm @82deutschmark and check for an existing announcement. Upload `media.path`, add its alt
text, and review the headline, link and actual attached illustration together in the X composer.
Then run the **required `--begin-posting` handoff in X_POSTING.md** with the reviewed attachment
hash and `--attachment-reviewed`. A failed check blocks Post. Never write `posting` directly into
JSON, remove the media, substitute a link card, or send text first. After a successful handoff,
post once, verify one result showing text and image, save its URL and `posted`, and stop.
An uncertain send gets the single duplicate check in X_POSTING.md; never resend blindly.

Discord's existing relay owns routine edition text notices and its ledger. Do not duplicate them.
The separate finished-image delivery is required. Necessary desk failure/status notices may use
`python3.13 /Users/macmini/bubba-workspace/tools/arc_daily_announce.py --alert "<status>"` in
`#arc3-rollout-feed` (`channel:1550165647911034940`). Do not send routine success alerts every run.

Finish with each article link or exact failure; picture and reference-cast outcome; X URL or
concrete blocker/protected state; Discord delivery/relay result; and every assignment's outcome.
Replace memory.md with a current note of at most forty lines. Do not backfill old X posts or
check deployment. In prepress, report only the prepared art/reservation or its exact blocker.
