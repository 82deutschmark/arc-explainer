# Scheduled editions: publish from the feeds and archive

Author: GPT-6.1 Sol / Codex · 22 October 2026 · requested by Mark after the usage audit.

This is the complete route for the scheduled Early and Late edition jobs. It takes precedence
over the browser, new-art and X-send steps in REPORTER.md, ART_DESK.md and X_POSTING.md. Those
guides still define the reporting, evidence, artwork and send-once contracts. Manual research
commissioned by Mark is separate work. The recurring research desk remains paused.

## Bound the work

- Use the signed-in Codex subscription, the existing model and one agent. No browser, web search,
  social or discussion discovery, new portraits, ImageGen, paid API or deployment polling.
- Read this guide, the edition's short memory note and the prepared brief. Open other guides only
  for a specific command or contract you need. Do not read entire research directories or replay
  old browser sessions. The brief's public sources, notebook and intake are the reporting archive.
- Aim to finish in twelve minutes. After eight minutes, drop optional artwork and X preparation
  that has not started; finish the validated articles and push. Do not begin optional work after
  twelve minutes. A real evidence or Git failure is reported; never bypass a gate to meet a clock.
- Prepare once, then perform one final fixed-endpoint freshness check. If the eligible cutoff
  observation changed, re-prepare once and revise the affected copy and artwork. If it keeps
  changing, report that contest's failure and publish the other ready contest. No refresh loop.

## Publish both contests

1. Verify the designated newsroom checkout, branch, origin and clean state, then pull ff-only as
   the job instruction says. Preserve unexpected work and stop on a conflict.
2. Run `python3.13 scripts/newsroom.py prepare --edition morning --writer gpt-6.1-sol --output
   /tmp/arc-daily-morning-brief.json` (use `evening` for Late). Never use `--preview` or `--now` in
   a scheduled run. Follow REPORTER.md sections 3 and 4: read the complete brief, respect its fixed
   cutoff, use each ready contest's own evidence, and account for every intake item and assignment.
3. Write one sourced article per ready contest. Use the fresh board feeds and committed public
   sources in the brief. Date any reused research; do not call an old post a fresh announcement.
   State that social/discussion research was not refreshed. An unverified lead is held with its
   reason, not researched inside this job. One contest's error does not block the other.
4. Optional picture: one art-plan call for the lead article. Use only a returned `reuseBase` with
   an already approved generation record and valid current cast. Compose, inspect and attach once
   using ART_DESK.md. If no reusable job is returned, generation would be needed, or a condition
   cannot be established from the brief and saved record, publish the text and report the reason.
   Do not create a stock commission, hunt for another scene or generate new art in a scheduled run.
5. Do the single final freshness check against the board endpoints already used by `prepare`.
   Follow REPORTER.md sections 6 and 7 for validation, immutable publication, exact-file staging,
   `git diff --check`, commit and safe fetch/rebase/push to `origin HEAD:main`. One race retry is
   allowed. Preserve immutable editions and evidence; never rewrite a published issue.

## Finish independently of X or a deployment

After the push, optional X preparation uses `python3.13 scripts/newsroom_x.py --edition morning
--draft-only --output /Users/macmini/bubba-workspace/reports/arc-daily-x/YYYY-MM-DD-early-edition.json`
(Late: `--edition evening`, `YYYY-MM-DD-late-edition.json`). Use the current Eastern date.
This saves the normal text and exact edition artwork attachment without an HTTP link check or
deployment wait. An outbox already present is left alone, especially `posting` or `posted`.
The draft has not been sent; report that plainly. A future explicitly authorized sender must
check the link, account, compose attachment and send-once state under X_POSTING.md before sending.

The scheduled edition does not open X, post, retry an older outbox, send Discord messages or
wait for Railway. The existing relay handles Discord after the article is live. An optional
draft or image failure never blocks publication of verified articles. No extra retry task is created.

Finish with each pushed article URL (or exact failure), picture outcome, X draft path or protected
outbox state, and each assignment's outcome. Replace memory.md with a short current note of at
most forty lines. Report Git publication separately from live-site availability; this job does
not check the deployment.
