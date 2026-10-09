# Daily ARC Daily posts on X

## Schedule and scope

Run after the evening newsroom edition, at **6:30 pm America/New_York**. Use
GPT-6 Sol through the signed-in Codex subscription and the existing signed-in
Chrome account `82deutschmark`. No paid model or X API is needed. The computer
and app must be running for this local workflow. This separate task does not
change the article publisher or send recurring Discord messages.

Prepare one public post covering the available published evening editions for
today. Include the article links, current recorded leaders and a meaningful
verified net score gain when space allows. Missing movement remains unknown.
Use neutral, lively sporting language. Keep the combined post under 280
characters, with no private information, unsupported allegations, inferred
methods, fabricated quotes or final-medal claims.

## Prepare and check

1. In the dedicated newsroom checkout, confirm the expected origin and branch,
   check for unexpected work and pull main with `--ff-only`.
2. Run `python3.13 scripts/newsroom_x.py --output
   /Users/macmini/bubba-workspace/reports/arc-daily-x/YYYY-MM-DD-evening.json`,
   replacing the filename with today's Eastern date. Scheduled runs omit
   `--date`. The helper reads published articles through `/api/news` and never
   sends a post. The helper's historical `--date` mode is only a manual draft audit.
3. If it returns `waiting`, post nothing and report that today's editions were
   unavailable. One missing competition can be omitted; do not replace it with
   yesterday's issue or a preview.
4. Personally check every figure and named competitor against that edition's
   stored stats and evidence. A score event is not necessarily a net daily gain.
5. Confirm the signed-in X account and inspect its recent posts for today's
   article links. An existing matching post completes the run without another send.

## Send once and record the result

Before the final browser Post action, save the exact text and set the outbox
`state` to `posting`. Use the existing browser tools to post the authorized
routine leaderboard recap. Do not post under another account. After sending,
visibly verify the text on the user's profile, save its permanent X URL and
completion time, and set `state` to `posted`.

If a previous run has `posting` state, or the send result is ambiguous, inspect
the actual profile before doing anything else. If its outcome cannot be
established, preserve the outbox and report the uncertainty; do not send a second
copy. The helper refuses to overwrite an existing send attempt or completed post.
Login or CAPTCHA interruptions require user attention; preserve the draft.

## Tested behavior

- Historical draft audit produced one short post linking both real October 8
  evening articles and using their recorded leaders and available score gain.
- Today's pre-evening data correctly returns `waiting` and excludes preview
  issues. No X post was sent as part of that audit.
