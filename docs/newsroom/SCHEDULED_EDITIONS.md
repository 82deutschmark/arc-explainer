# Scheduled editions: publish from the feeds and archive

Author: GPT-6.1 Sol / Codex · 23 October 2026 · sending restored at Mark's direction.

This is the complete route for the scheduled Early and Late edition jobs. It takes precedence
over the research-browser and new-art steps in REPORTER.md and ART_DESK.md. X_POSTING.md defines
the authorized routine edition announcement. Those guides still define the reporting,
evidence, artwork and send-once contracts. Manual research
commissioned by Mark is separate work. The recurring research desk runs on its own schedule.

Follow the [head editor's completion order](FINISHING.md). A successful push finishes
publication; no deployment check follows it. Complete the authorized distribution below as a
separate step. Human send confirmation needs no browser proof.

## Bound the work

- Use the signed-in Codex subscription, the existing model and one agent. Browser access is only
  for the routine X account/duplicate checks, composition, send and one success result. No web
  search, social or discussion discovery, new portraits, ImageGen, paid API or deployment polling.
- Read this guide, the edition's short memory note and the prepared brief. Open other guides only
  for a specific command or contract you need. Do not read entire research directories or replay
  old browser sessions. The brief's public sources, notebook and intake are the reporting archive.
- Aim to finish publication in twelve minutes. After eight minutes, drop optional artwork that
  has not started; finish the validated articles and push. Do not begin optional work after
  twelve minutes. Then complete the required, bounded distribution step below. A real evidence
  or Git failure is reported; never bypass a gate to meet a clock.
- Prepare once, then perform one final fixed-endpoint freshness check. If the eligible cutoff
  observation changed, re-prepare once and revise the affected copy and artwork. If it keeps
  changing, report that contest's failure and publish the other ready contest. No refresh loop.
- Before treating a DNS/permission failure as unavailable board evidence, follow README.md's
  execution-access check. One recovery after restoring already authorized execution access is
  allowed; do not repeat unchanged restricted commands or label the site down from a local error.

## Publish both contests

1. Verify the designated newsroom checkout, branch and origin, then inspect Git status and any
   in-progress merge/rebase. Preserve unrelated local work in place, including untracked PDFs
   under `output/`; a nonempty status alone is not a blocker. Pull ff-only without resetting,
   deleting or stashing other work. Continue if Git can update safely and the intended news files
   do not overlap another writer’s changes. Stop only for an actual conflict, an in-progress Git
   operation, or changes to files this shift must edit whose ownership cannot be established.
   Stage exact intended paths, never `git add .` or another writer’s files.
2. Run `python3.13 scripts/newsroom.py prepare --edition morning --writer gpt-6.1-sol --output
   /tmp/arc-daily-morning-brief.json` (use `evening` for Late). Never use `--preview` or `--now` in
   a scheduled run. Follow REPORTER.md sections 3 and 4: read the complete brief, respect its fixed
   cutoff, use each ready contest's own evidence, and account for every intake item and assignment.
3. Apply [Writing for expert readers](REPORTER.md#writing-for-expert-readers): lead with the
   news and stakes, assume Kaggle/ARC knowledge, and cut repeated caveats and verification prose.
   Write one sourced article per ready contest. Use the fresh board feeds and committed public
   sources in the brief. Date any reused research; do not call an old post a fresh announcement.
   State in one short line that social/discussion research was not refreshed. An unverified lead
   is held with its reason, not researched inside this job. One contest's error does not block the other.
4. Optional picture: one art-plan call for the lead article. Use only a returned `reuseBase` with
   an already approved generation record and valid current cast. Compose, inspect and attach once
   using ART_DESK.md. If no reusable job is returned, generation would be needed, or a condition
   cannot be established from the brief and saved record, publish the text and report the reason.
   Do not create a stock commission, hunt for another scene or generate new art in a scheduled run.
5. Do the single final freshness check against the board endpoints already used by `prepare`.
   Follow REPORTER.md sections 6 and 7 for validation, immutable publication, exact-file staging,
   `git diff --check`, commit and safe fetch/rebase/push to `origin HEAD:main`. One race retry is
   allowed. Preserve immutable editions and evidence; never rewrite a published issue.
   If today's edition already exists, leave it unchanged and continue with its distribution
   state below; an existing article does not establish that its X announcement was sent.

## Send the edition announcements

After the push, prepare the routine X announcement with `python3.13 scripts/newsroom_x.py --edition morning
--output /Users/macmini/bubba-workspace/reports/arc-daily-x/YYYY-MM-DD-early-edition.json`
(Late: `--edition evening`, `YYYY-MM-DD-late-edition.json`). Use the current Eastern date.
This saves the normal text and exact edition artwork attachment without an HTTP link check or
deployment wait. Read an existing outbox first; preserve `posting` and `posted` states and any
human confirmation. A saved `draft` is preparation for sending, not completion of the job.

If the issue has custom artwork, complete the CLI-based
[Discord image delivery](ART_DESK.md#discord-image-delivery-before-x) before the X send and save
its receipt in the outbox. This applies to approved stock compositions too; it does not authorize
new generation. The relay's text-only notice is insufficient. A failed image delivery leaves X
in `draft` with the concrete error; publication remains complete.

Follow X_POSTING.md's edition-post procedure: confirm @82deutschmark and check for this edition's
existing post, review the copy and exact attachment, save `posting`, send once, verify one success
result, then record the URL and `posted`. Browser work is limited to six minutes and ten tool
calls; no research feeds, discovery or deployment wait. If login, CAPTCHA, attachment failure or
the bound prevents a confirmed send, preserve the outbox and report the concrete blocker. An
uncertain send gets the one duplicate check defined in X_POSTING.md; never resend blindly.

Discord sends are authorized in **#arc3-rollout-feed** (`channel:1550165647911034940`). The
existing desk relay owns routine edition text announcements and its send-once ledger; let that
path deliver them without a second manual text copy or deployment check. The separate finished
image delivery above is required before an illustrated X announcement. A necessary short desk status
or failure notice may be sent through
`python3.13 /Users/macmini/bubba-workspace/tools/arc_daily_announce.py --alert "<status>"`.
Do not send a routine status on every successful run. A distribution failure does not undo
publication or start a retry task. Do not backfill older edition posts as part of this shift.

Finish with each pushed article URL (or exact failure), picture outcome, X post URL or concrete
send blocker and protected outbox state, Discord relay/status outcome, and each assignment's
outcome. Replace memory.md with a short current note of at
most forty lines. Report Git publication separately from live-site availability; this job does
not check the deployment.
