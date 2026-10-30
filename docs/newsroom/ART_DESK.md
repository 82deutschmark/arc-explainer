# Native illustrations for the ARC Daily Digest

Every assistant follows the [head editor’s completion order](FINISHING.md): verify once, accept human completion, and stop; no deployment polling.

Authors: GPT-6.1 Sol / Codex (12–14 October 2026); reorganized by Claude Opus 5.5 Max on
15 October 2026 at the Boss's request. The dated art directions that used to sit on top of this
file are folded into the principles below. What pictures exist, where each has run and which are
held in reserve is tracked in data, not prose: `content/news/artwork-inventory.json` and the
`reusableScenes` in `content/news/visual-identities.json`.

Scheduled editions follow [SCHEDULED_EDITIONS.md](SCHEDULED_EDITIONS.md). The Late automation
prepares artwork at 5 pm, before the 6 pm release. Use a suitable unused approved scene first;
when none fits the news, commission one native illustration using the actual registered
reference characters. The [Card Cabinet](https://arc.markbarney.net/news/cards),
[TEAM_PLAYBOOK.md](TEAM_PLAYBOOK.md) and [CHARACTERS.md](CHARACTERS.md) govern every existing
artwork reuse and new commission. Save a reviewed clean base before 6; bind final score/time
graphics to the closing brief. Artwork is required for the edition X announcement. A genuine
art failure may leave verified articles published, but must leave X blocked, never text-only.

Before casting a contender, read [TEAM_PLAYBOOK.md](TEAM_PLAYBOOK.md) and the corresponding
Card Cabinet/character record. Preserve commissioned native originals, actual source inputs,
exact role mappings and existing usage receipts; card labels and statistics are drawn
separately. Curated team art never supplies an invented personal likeness or release permission.

## Principles (the Boss's standing art direction, 12–14 October 2026)

- **Every front page has a picture.** Each Early and Late issue publishes at least one finished
  illustration on a front-page edition article, normally the ARC-3 lead. Both contests need not
  get new art. A quiet leader, a used reserve or an empty move-trigger plan is not a reason to
  leave the front page bare. The headline stays the strongest news, not the picture.
- **An evolving comic strip.** The same recognizable characters return, but each illustrated issue
  is a new episode reflecting the verified race: a different setting, action, machine silhouette,
  camera, lighting or poses. Updated score panels, a mirrored camera or another near-identical
  close-up is not a new episode. Before choosing, look at the previous Early and Late images in
  both contests.
- **Stock first.** Read `artwork-inventory.json` before any image work and use a suitable unused
  prepared scene before generating. Do not generate ahead while suitable stock is ready.
- **No repeated illustrations.** Every illustrated edition gets a fresh episode. Do not reuse
  previously published artwork, including its clean base with new scores or a new crop. Check
  previous article uses and Discord shares in the inventory before posting. Character reference
  sheets may preserve identities; they are not permission to repeat an old scene.
- **Discord first, then any person’s reaction greenlights X.** Every illustrated edition or commissioned feature,
  including manual afternoon specials and finished stock compositions, delivers its reviewed image
  and story link to `#arc3-rollout-feed` before its X post. A text-only relay notice does not deliver
  the illustration. Follow [Discord image delivery](#discord-image-delivery-before-x) below.
  Newly commissioned art can be shared before article publication as a labelled preview with its
  intended link. Before the X announcement, check for any person’s reaction as described below.
- **Captions describe the scene.** For the paper’s obvious fantasy illustrations, the editor
  asked on October 29 to omit repetitive “AI editorial illustration” disclaimers from captions
  and announcements. Date any pictured standings when needed; preserve native generation
  provenance internally.
- **Accurate cast.** Characters and their references are frozen in [CHARACTERS.md](CHARACTERS.md)
  and `visual-identities.json`: Chen's two rabbits follow her owner photo; Tufa Labs' friendly
  spiders (five is an artistic choice, not a headcount) and Dries Smit only while the fresh Tufa
  roster lists him; Puget and Sorokin as their own Hall of Fame characters for NVARC3, with
  NVIDIA-green gear; other NVIDIA teammates may appear as anonymous little GPU-covered engineers
  with opaque visors (no names, likenesses or headcount implied). Other contenders appear only with
  their own verified reference. Never guess a face from a name or avatar; never depict anyone not
  in the fresh roster; the machines are metaphors, not claims about hardware or spending.
- **Team Turducken pictures include the whole ARC3 crew.** For the team's current picture and
  future Turducken-focused illustrations, show Mark, Son, Keith, DZ, NT, Choryu and Herminator
  standing in for Ronen together on the mechanical turkey, with both Yorkies. Use the corrected
  `2026-10-29-turducken-nt-corrected-v2` for the current team picture: NT is his own yellow bird,
  not the previously misassigned banana kitten. Preserve the October18 original as historical art. The earlier
  three-character First Flight and hangar are historical episodes; do not select them as a
  current team picture. Check the full cast in [CHARACTERS.md](CHARACTERS.md) before publishing.
- **The future scene.** When new art is needed after stock is used, the Boss's concept is two GPU
  forts on neighbouring high ground (Tufa with Dries, Chen's rabbits) while top-five and top-ten
  challengers haul GPU siege towers, rams and carts uphill; the leaders' towers drawn about a fifth
  taller as an artistic convention. Follow [the strongholds plan](2026-10-13-valley-strongholds-art-plan.md)
  and [the portable image guide](GPU_VALLEY_IMAGE_GUIDE.md); the three October 14 reserves are in
  [the reserve plan](2026-10-14-valley-reserve-art-plan.md).
- **Native generation only.** Codex's built-in image tool, one image per contest at most. No paid
  image or model API, no CLI fallback.

## The stock

- `content/news/artwork-inventory.json`: every prepared image, the articles (per contest) it has
  run in, its X attachments and Discord preview shares. After publishing an illustrated issue,
  record the new article use (and later the X attachment) there.
- `content/news/visual-identities.json` → `reusableScenes`: approved clean bases and the conditions
  they need (leader, rival, required people, competition). `active` scenes are offered by the
  planner automatically when their conditions hold. `reserve` scenes are never picked
  automatically: commission one for a particular issue (below).
- `content/news/artwork/`: each native generation record (prompt, references, review, hash) and
  each immutable composition; images live in `client/public/news-images/`.

**Commissioning a reserve or a specific scene for an issue.** Add an entry to
`content/news/editorial-assignments.json` with `artworkGenerationRecord` (the exact native record),
`targetEditionId`, `artworkConditions` (`leaderTeamId`, `rivalTeamId`, `requiredPersonIds`),
optional `artworkHistoryChart: true` (an observed-score history chart in the panel) and an
`expiresAt` shortly after that issue, then prepare again. The planner allows that scene on a quiet
board only while the named leader stays first ahead of the rival and the required people are in
the fresh roster; a changed leader or cast means holding it with the reason. Check the full
background cast by hand (`supportingCastConditions` in the record): the planner verifies only the
two score-panel teams. `allowArtworkPreview: true` permits a separately identified manual preview,
never edition evidence.

## Procedure (after writing the manuscript, before validating)

Use the edition's own fresh brief (prepare again if it is over 90 minutes old) and its draft:

```sh
python3.13 scripts/newsroom_artwork.py plan --brief <brief.json> --article <draft.json> --output <art-plan.json>
```

Read the whole plan. The planner looks at teams covered by the manuscript that have saved
references: a lead change, a team entering the top ten or crossing the gold score, a gain of three
or more points in the top 25, or a climb of 20 or more places into the top 100 (a recorded score
event can qualify when the net comparison is unknown). The contender in the headline comes first.
It returns at most one job, with the exact rows, reference roles and native tool arguments.

1. **`reuseBase` present:** inspect its public image and generation record, then compose (step 4).
2. **New generation:** inspect every image in `toolArguments.referenced_image_paths`, call the
   built-in `image_gen.imagegen` tool with the supplied arguments (clean art, no text, logos, ranks
   or scores), and inspect the result: right subjects and counts, good composition, respectful tone,
   no invented methods or hardware. One targeted native edit is allowed if needed. Save the exact
   final tool arguments back into the plan's `toolArguments` (including any edit prompt and its
   inputs) before registering, and keep the original plan with the run's private files.
3. **Register** the selected native output, describing what you actually inspected:
   ```sh
   python3.13 scripts/newsroom_artwork.py register --source <native-output-path> --plan <art-plan.json> --review '<actual visual review>'
   ```
   It returns the `generationRecord` and the copied public `source`.
4. **Compose** from the clean base with this issue's evidence:
   ```sh
   python3.13 scripts/newsroom_artwork.py compose --source <clean-base-file> --generation-record <record-id> --brief <brief.json> --article <draft.json>
   ```
   The compositor draws the score panel (ranks, scores, full Eastern observation date and time,
   and any requested history chart) and the ARC Daily Digest / ARC Explainer chyron in code, in the
   corners or centered when the record asks for `overlayPlacement: center`. Look at the result and
   make sure the overlays leave faces and the action visible.
5. **Attach and validate:**
   ```sh
   python3.13 scripts/newsroom_artwork.py attach --brief <brief.json> --article <draft.json> --artwork content/news/artwork/<artwork-id>.json
   python3.13 scripts/newsroom.py validate --article <draft.json> --brief <brief.json>
   ```
   The publisher checks the article ID, headline, brief checksum, observation time, score rows and
   image bytes, then archives the composition with the edition's evidence.

If no job is returned and the front page still needs a picture, pick suitable unused stock from
the inventory and commission it for this issue as above. If generation is unavailable or fails,
or no accurate scene fits, publish the verified text and report the concrete art outcome,
with the edition X announcement blocked for missing artwork. Never use a paid API, a stale
illustration, or a text-only X fallback.

## Discord image delivery before X

This is the shared delivery procedure for illustrated editions and special features (Mark's
clarification, 29 October 2026). It is part of the commissioned publication, including when the
editor only says to publish the feature and post it on X. Keep the reporting and copy standards
in REPORTER.md; a good image does not replace a substantive, sourced story.

1. Inspect the finished selected image, including any required current score/time overlays.
   Send that image as an actual attachment, with a short useful summary, the permanent article
   link (label it intended if not yet pushed), and `<@293569238386606080>`, to
   `channel:1550165647911034940` (**#arc3-rollout-feed**). Use:
   `openclaw message send --channel discord --target channel:1550165647911034940 --message "<reviewed summary and article link>" --media "<absolute finished image path>" --json`.
   The relay's `--alert` sends text only; it cannot substitute for this image delivery.
2. Preserve a story-specific receipt in
   `/Users/macmini/bubba-workspace/reports/arc-daily-x/<story-id>-discord.json`: state,
   article ID, image path and SHA-256, destination, message ID, Discord link and actual send time.
   Link it from the X outbox's `discord` field and record the share in the artwork inventory's
   `discordShares`. Check existing receipts before sending. A confirmed delivery of the same
   image and story link is reused; an ambiguous send requires one destination-history check
   before retrying. A different clean-base preview does not deliver the finished composition.
3. Before X, check reactions on that exact Discord preview:
   `openclaw message reactions --channel discord --target channel:1550165647911034940 --message-id "<saved message ID>" --json`.
   Any emoji reaction by any person on that exact preview greenlights the X announcement;
   it need not be from the Boss or use a particular emoji. Silence and the posting bot’s own
   reaction do not count. Record the returned reaction evidence; if it cannot distinguish a
   person from the posting bot, inspect the reaction user list before treating it as approval.
4. Save `approval` in the X outbox with the preview message ID, image SHA-256, reacting user when exposed,
   emoji/reaction evidence or written confirmation, and actual check time. Only confirmed delivery plus this
   approval permits `draft` → `posting`. A changed image or materially changed story needs a new
   preview and approval. An explicit instruction from the Boss can waive the wait for that release.
   If no qualifying reaction is present, or Discord is unavailable, keep X in `draft` with
   `awaiting-discord-approval` and report it. Do not wait in a polling loop, create a monitor,
   repost the preview or interpret elapsed time as approval. Recheck on the next authorized
   publishing pass or when the Boss asks. Article publication may proceed; this gate controls
   its X announcement. No deployment polling is required.

The existing relay still owns routine edition text notices; do not duplicate those manually.
Its text-only success and the image-delivery receipt are separate. Preserve already posted X
announcements: if the editor reports a missed Discord image, deliver that missing image once
and record the recovery without reposting X or rewriting the article.

## Publish together

Finish manual commissions with a clean handoff before a publishing shift: put experimental
outputs and discarded variants in a dated private `reports/arc-daily-social/art-planning/`
folder, and commit the approved public bases and provenance with their inventory entries.
Do not leave untracked artwork or an `output/` directory in the publishing checkout. An
unpublished commission is prepared stock, with its leader/cast conditions recorded; it does
not require changing a published issue or sending a post. Preserve other people's unexpected
work and stop on a real conflict.

Stage the edition and evidence files with the new `content/news/artwork/` records, the new
`client/public/news-images/` assets, any deliberately updated `visual-identities.json` and the
updated `artwork-inventory.json`. Never overwrite an earlier edition or its images. The routine X
post attaches the finished picture ([X_POSTING.md](X_POSTING.md)). An image-only correction asked
for by the Boss archives a separate revision record and keeps the original reporting, scores and
time.
