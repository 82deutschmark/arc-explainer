# ARC Daily Digest posts on X

Follow the [head editor's completion order](FINISHING.md) for every manual or scheduled post.
One success result ends an authorized send. The editor saying they posted ends it immediately;
record that confirmation locally without opening X, adding a reply or fetching the post URL.

The active afternoon recap posts once at 2:20 pm from the signed-in Chrome account
`82deutschmark`, using the browser only for account checks and sending (no X API). Scheduled
Early and Late editions send one routine announcement under SCHEDULED_EDITIONS.md, with browser
access limited to account/duplicate checks, composition, sending and one success result.
(Reorganized 15 October 2026 by Claude Opus 5.5 Max: the recap moved from 2 pm to 2:20 pm so it never
shares the browser with the hourly organizer scan, and it now reads the research archive rather than
repeating the research desk's searches.)

## Editorial review for every routine post

Lead with the current issue's strongest verified news, using fresh, concise copy.
Before saving the reviewed draft, compare the recent posted edition and afternoon
recap outboxes. Avoid repeating the same secondary feature teaser or framing across
successive posts. An evergreen team profile, unchanged roster background or familiar
character in the artwork does not supply a new news hook. Revisit a subject when a
new material development warrants it; a quiet issue can have a shorter announcement.

Competitor mentions are optional. Zero mentions is a complete post. Choose at most
one or two verified handles when they help identify a material result, statement or
contribution substantively reported in the linked article or recap. Check
`people.json` and the article's sources. Recurring background coverage alone does
not warrant repeatedly notifying the same person; a further mention needs a fresh
editorial reason. There is no standing person or team to tag,
no tag quota and no requirement to rotate handles. A table-only appearance or
incidental name does not call for a tag. Keep the strongest news, image/story lead,
permanent article link and 280-character limit; omit an optional mention if needed.

These rules apply to future drafts. Preserve every `posting`/`posted` outbox and
existing announcement; a copy preference does not authorize a replacement send.

## Scheduled edition handoffs

Scheduled editions follow [SCHEDULED_EDITIONS.md](SCHEDULED_EDITIONS.md): prepare the outbox with
`scripts/newsroom_x.py --edition <morning|evening> --output <outbox>`, then complete the authorized
edition-post procedure below. A draft is an intermediate state, not a finished announcement.
Preserve existing `posting`/`posted` outboxes and human send confirmations. The helper makes no
link check and never waits for deployment; a successful push is enough to proceed with the
announcement. `--draft-only` remains available for an explicitly requested draft-only task, not
the normal scheduled edition. The separate afternoon recap is unchanged.

## Edition posts (Early edition, Late edition)

The Boss asked on 9 October 2026 for a post whenever an edition comes out, labeled "Early
edition" (the 6 am issue) or "Late edition" (the 6 pm issue). Scheduled runs are authorized and
expected to send that announcement once. The same send-once rules apply as for the afternoon recap.

**Boss's artwork rule, 12 October 2026:** a good reviewed custom image should lead the
post. For an illustrated edition, upload the finished illustration as the post's image,
lead the text with that article's headline, and retain its permanent link. Use that exact
edition's composed image, including its current score/time overlays and branding. A
generic link preview, raw scene without the score panel, or earlier edition's image is not
a substitute. This image belongs in the existing routine announcement; it does not create
an extra post. An edition without custom artwork keeps the normal text/link announcement.

1. Run, with today's Eastern date in the file name:
   `python3.13 scripts/newsroom_x.py --edition morning --output /Users/macmini/bubba-workspace/reports/arc-daily-x/YYYY-MM-DD-early-edition.json`
   (the evening run uses `--edition evening` and `YYYY-MM-DD-late-edition.json`).
2. The helper drafts the post from the published editions: `The ARC Daily Digest · Early
   edition` (or `Late edition`), the ARC-AGI-3 and ARC-AGI-2 headlines when both fit in 280
   characters (otherwise the lead one), and the lead article's link. A published article
   with reviewed, evidence-bound custom artwork leads; ARC-3 leads when both have art or
   neither does. The helper validates that artwork against the archived edition and saves
   a PNG attachment beside the outbox. Its `media` object records the exact local `path`,
   attachment `sha256`, original asset/hash, artwork ID, `alt` and `caption`. It returns the
   draft immediately, with no live-link check, deployment wait or polling. A site build after
   a successful push is expected; it does not reopen the publishing assignment.
3. When the outbox state is `draft`: confirm the account is `82deutschmark` and look at its recent
   posts for this edition's post (an existing one completes the job; save its URL). If `media`
   is present, inspect its PNG, verify its saved hash, upload `media.path` through the browser's
   file picker and add `media.alt` as image description. Confirm the compose preview shows
   the intended illustration with readable current overlays before sending. Save the exact
   text and attachment metadata and set the state to `posting`, post it once, verify the text
   and attached illustration in one success result, then save its
   permanent URL and completion time and set the state to `posted`. An existing `posting` or
   `posted` state is never overwritten; an uncertain send gets one profile check before any retry.
   If the editor says they already posted, use `--record-human-post --output <outbox>` and stop
   without browser verification. Add `--post-url` only for a URL the editor supplied.
4. The helper supplies the initial text. Apply the editorial review above before moving
   a draft to `posting`: choose this issue's news, check recent copy and use mentions only
   when useful. Save the exact reviewed text and any chosen handles in the draft outbox;
   send that saved text exactly. No unsourced figures, guessed handles or unrelated tags.

An image-preparation, upload or preview failure leaves the draft and its concrete error for
the Boss; do not silently send an illustrated story without its image. Preserve the exact
reviewed attachment and send state across a retry. A previous text-only post for the same
edition is still an existing send, so this new policy never duplicates it.

A direct human request to correct an already-sent announcement is a separate authorization,
not a routine retry. Preserve the original outbox and record any image-led replacement in
a separately named correction outbox with the old and new URLs. Check the profile first:
if the human already posted the corrected image, verify it, record the existing result and
do not send another copy. Deleting an old post is a separate irreversible action requiring
the browser's action-time confirmation; it is not part of an unattended routine retry.

# The afternoon recap (2:20 pm)

## Schedule and scope

Run at **2:20 pm America/New_York**. Do both jobs: hand the 6 pm edition the afternoon's leads
and publish one short afternoon leaderboard recap on X.
Use GPT-6.1 Sol through the signed-in Codex subscription and the existing signed-in
Chrome account `82deutschmark`. No paid model or X API is needed. The computer
and app must be running. This task does not publish an evening edition or send
Discord messages.

Use lively, respectful sporting language for every contender, including Tufa Labs.
Report verified moves and attribute public comments in context. Keep the recap
under 280 characters and link to `https://arc.markbarney.net/news`. Do not invent
methods, motives, affiliations, quotes, hardware claims or final medals.

## Prepare board evidence and an afternoon draft

1. Confirm the dedicated newsroom checkout's origin and branch, check for
   unexpected work and pull main with `--ff-only`.
2. Use today's Eastern date for these files under
   `/Users/macmini/bubba-workspace/reports/arc-daily-x/`:
   - `YYYY-MM-DD-afternoon.json`: public-post outbox.
   - `YYYY-MM-DD-afternoon-board-brief.json`: complete observed board evidence.
   - `YYYY-MM-DD-afternoon-research.json`: source-backed evening-desk handoff.
3. Read an existing outbox before preparing. Do not overwrite `posting` or `posted`
   states. An existing send must be verified or treated as uncertain before retrying.
4. Run `python3.13 scripts/newsroom_x.py --output <outbox-path> --brief-output
   <board-brief-path>`. No `--preview`, `--now` or historical date override.
   The helper reads fresh board evidence through the existing newsroom preparation
   logic. Before 6 pm its article bases are automatically marked as previews; they
   are research evidence and are never published as editions by this task.
5. Read the full brief. Personally check the proposed post's numbers and names.
   Comparisons use the previous calendar day's 6 pm Eastern observation. Missing
   comparisons stay unknown. One failed board must not stop the other. If both
   fail, save the failure and stop without posting unverified standings.

## Keep the recap bounded

The research desk remains paused. This job publishes; it does not replace research collection.
Use the helper's current board brief and at most the newest saved public handoff when needed.
Do not open watched feeds, Replies, Reposts, search results, individual research posts, or other
people's profiles. Do not discover identities, ingest new research, generate artwork or follow
links out of X. Previously saved source dates stay visible; stale coverage is not evidence of quiet.

Prepare the board brief once. If both boards fail, save the failure and stop; do not substitute
research browsing. Read and fact-check only the sections needed for the short recap. No optional
mentions that require verification. Save the existing evening handoff format below from the brief
and already verified public sources only. Empty `posts` arrays with honest limitations are valid.

Aim to finish within six minutes, with no more than ten browser tool calls. Browser access is
only for confirming @82deutschmark, checking that the recap was not already sent, composing the
saved text, posting once and verifying the result. No timeline scrolling or search. If login,
CAPTCHA, repeated loading failure or the call/time limit prevents a verified send, preserve the
outbox and report the concrete failure; never loop or create a retry job. The intended result is
one confirmed X post, not a draft when posting is available.

## Save the evening handoff

Write the handoff even if the public recap is skipped or already posted. It is JSON with
`version: 1`, `date` (Eastern), `researchedAt` (actual UTC ISO time), `boardBriefPath`, `outboxPath`,
and `competitions`. Each separate competition entry has `posts` and `limitations`. A reused post
records `teamId` when verified, its exact `sourceUrl`, `sourceTitle`, `checkedAt`, `postedAt`,
`summary` and `identitySourceUrl`; unknown fields stay null. State that no new social collection
was performed because research is paused. The evening edition prepares its own cutoff evidence.

## Send once and record the result

Confirm the X account is `82deutschmark` and inspect recent profile posts for today's
ARC Daily afternoon recap. An existing matching post completes the send without
another copy. Before the final Post action, save the exact reviewed text and set
outbox `state` to `posting`. After sending, visibly verify the post on the profile,
save its permanent X URL and actual completion time, then set `state` to `posted`.

If a previous run has `posting` state or the send result is ambiguous, inspect the
actual profile. Preserve the attempt and report uncertainty if its outcome cannot
be established; do not send a second copy. Login or CAPTCHA interruptions require
user attention; preserve the draft and finish the saved-source handoff where possible.

## Verification

The helper can prepare fresh afternoon figures before any evening edition exists.
Draft-only audits and focused checks cover partial board failure, unknown baseline
movement and send-state protection. The research handoff is explicitly consumed by
the evening reporter. No X post is sent by the Python helper.
