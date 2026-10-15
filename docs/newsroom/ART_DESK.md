# Native illustrations for the ARC Daily Digest

Author: GPT-6.1 Sol / Codex · updated 14 October 2026

## October 14 valley reserve commission and anonymous NVIDIA crew

Mark explicitly requested several new valley iterations and approved the shown
results. The three reviewed clean bases are now prepared stock: Walking Foundry,
Gyroscopic Siege and Aurora Skyworks. Follow [their exact native record and cast
handoff](2026-10-14-valley-reserve-art-plan.md). Select a suitable unused episode
before more generation, compose current issue overlays and manually verify the
full cast. The records request centered overlays.

Supporting NVIDIA teammates may be anonymous little human engineers covered in
GPUs with opaque visors. This is Mark's explicit October 14 character direction;
individual likenesses and named person IDs are unnecessary for this anonymous
crew. Keep Puget and Sorokin's existing individual characters. The clean bases,
native call chains and separate article/X/Discord dispositions are preserved.

## Required front-page illustration — Mark, October 14

Each Early/Late front page must have at least one appropriate illustration on its
published edition lead. This supersedes the quiet-board/no-new-art option below
for the edition as a whole; both contests do not need separate new images. Use
appropriate existing prepared artwork first, with exact issue score/time overlays.
Do not omit the picture merely because the ordinary move-trigger planner is empty
or the first queued scene was used. Explicit issue commissioning can select a matching
reviewed native scene on a quiet board. Keep all cast/source checks and stored stock.

The promoted valley native record requests `overlayPlacement: center`: the compact
score panel sits at bottom center and the paper chyron at top center, leaving Mark,
Son and the rabbits unobscured. The existing compositor records a distinct
`center-overlays-v1` identity; older corner compositions keep their original bytes.
This is layout on a copy of the reviewed native scene, with no image regeneration.
The main pair's score panel is separate from the broader cast saved in the native
record and the dated revision/cast handoff. Image-only human corrections preserve
original standings/reporting and archive separate revision evidence.

## High-ground forts and the chasing field — October 13 direction

Read [the valley strongholds episode plan](2026-10-13-valley-strongholds-art-plan.md)
before planning future new scenes. Mark wants Tufa and Chen's rabbits in separate GPU
forts on adjacent high ground, with towers about 20% taller than the chasing field's
towers as an artistic convention. Top-five/top-ten contenders bring GPU battering rams
and siege towers uphill. Use Sorokin and Puget's saved individual characters for NVARC,
with the explicitly requested NVIDIA-green branding; plan The Last Dance and other
reference-ready contenders as recurring supporting cast. Score tiers, cast and advances
must follow the fresh contest evidence. Preserve and use the prepared bridge/icebreaker
and all existing native originals; this direction does not commission more art now.
The linked plan explains cast-sheet preparation and the current two-team planner limit.

The Boss authorizes native Codex image generation as part of the Early and Late editions when a referenced competitor makes a consequential move. The Python helper plans and composes; the Codex journalist calls the built-in image tool. No paid image/model API, CLI image-generation fallback, model switching or new schedule is needed. One image per competition at most; a quiet issue can publish without art.

## References and editorial choice

The expanded, frozen reference library and upkeep procedure are in [CHARACTERS.md](CHARACTERS.md). It includes sixteen individual competitors plus Tufa’s mascot, with two pending references, and a browsable gallery at `/news-images/references/index.html`. Chen’s full-size owner photo and clean bunny reference govern the ear/coat details; the revised scene includes Dries when the fresh roster verifies him.

`content/news/visual-identities.json` holds curated character identities and reusable scenes. Chen’s two rabbits and Tufa’s friendly black spider are the first entries. Other contenders can use their own verified saved portrait through `people.json` and an exact handle in the fresh board roster. A portrait does not identify an unlisted teammate. Add new mascot identities only after human/editorial authorization and an inspected reference. Never guess an identity from a name or avatar.

The planner considers only teams covered by the manuscript, with saved references. It looks for a lead change, entry into the top ten, crossing above the gold score, a gain of at least three points in the top 25, or a climb of at least 20 places into the top 100. A recent score event can qualify when the net comparison is unknown; it remains an event, not a net daily gain. The contender named in the headline receives priority. The planner emits one job, with exact rows, reference roles and native tool arguments. Related contestants without references need no invented mascot.

The growing-bunnies scene requires Chen first, Tufa second and a verified increase in the gap. A rank-one score event can connect Chen to the prior-close board high when her individual comparison is unavailable; the rival’s earlier score must still be known. Unknown is not an increase. If the gap narrowed or the lead changed, prepare an appropriate new scene or publish without the old metaphor.

## Execute after writing the manuscript and before validating it

Use the fresh edition brief already prepared by the reporter. Re-prepare if it is over 90 minutes old. Substitute that run’s exact draft and brief paths below.

```sh
python3.13 scripts/newsroom_artwork.py plan --brief /tmp/arc-daily-evening-brief.json --article /tmp/arc-daily-arc3-draft.json --output /tmp/arc-daily-art-plan.json
```

Read the complete plan. With no jobs, continue normal publication. With a job:

1. If `reuseBase` is present, inspect its public image and generation record. Reuse that reviewed scene for the same verified story (approved reusable scenes may span days); redraw the score panel from this edition’s brief. Never use its old composed scoreboard.
2. Otherwise inspect every image in `toolArguments.referenced_image_paths` with `view_image`, then call the built-in `image_gen.imagegen` tool with the supplied arguments. Generate clean artwork without text, logos, ranks or scores. Inspect the result: correct subjects and requested counts, useful composition, respectful tone and no invented methods or hardware claims. A compute machine is a metaphor. If a repair is needed, make one targeted native edit and inspect it again. Before registering that selected output, save the exact final tool arguments back into the plan's `toolArguments`, including the edit prompt and its actual input references; retain the original plan with the run's private reporting files. The saved generation record must describe the selected output's actual call.
3. Save the selected native output with the existing helper. Preserve the original tool output. The review must describe what you actually inspected:

```sh
python3.13 scripts/newsroom_artwork.py register --source <native-output-path> --plan /tmp/arc-daily-art-plan.json --review '<actual visual review>'
```

The command returns `generationRecord` and the copied public `source` path. Native assets live in `client/public/news-images/`, and their prompt, references, review and hash live in `content/news/artwork/`.

4. Compose with those returned values, or the job’s existing `reuseBase.recordId` and public source:

```sh
python3.13 scripts/newsroom_artwork.py compose --source <reviewed-base-file> --generation-record <record-id> --brief /tmp/arc-daily-evening-brief.json --article /tmp/arc-daily-arc3-draft.json
```

The compositor draws the requested lower-left compact team/rank/score chart and upper-right ARC Daily Digest / ARC Explainer chyron in code, using repository fonts and the existing favicon. It keeps the scene’s aspect ratio and preserves the raw art. The headline is bound in the record and printed by the article. Scores and observation time come from the exact brief; both chart bars use the same 0–100 scale. Inspect that the corner graphics leave faces and essential action visible. A changed brief, headline, reference/cast, prompt or overlay version gets a new immutable asset. The old `--source --brief --output` entry still routes to compose; production editions use the explicit manuscript workflow.

5. Attach the returned artwork record to the draft:

```sh
python3.13 scripts/newsroom_artwork.py attach --brief /tmp/arc-daily-evening-brief.json --article /tmp/arc-daily-arc3-draft.json --artwork content/news/artwork/<artwork-id>.json
python3.13 scripts/newsroom.py validate --article /tmp/arc-daily-arc3-draft.json --brief /tmp/arc-daily-evening-brief.json
```

The publisher verifies the article ID, headline, brief checksum, observation time, score rows and final image bytes, then archives the composition alongside the edition’s evidence. A wrong edition, changed score, changed image or stale brief fails. Keep the article’s existing sources and intakeReview; artwork does not replace reporting.

If native generation is unavailable or fails, preserve the reason and publish the verified text without `image`. Do not silently use a paid API or stale illustration. Include the art outcome in the final report. Scheduled runs do not edit application code or this workflow.

## Reusable approved editions — October 13 editor instruction

Latest October 13 evening clarification: treat each illustrated edition as a new
comic-strip episode. Character identities persist; the composition should evolve.
Compare the previous published images and `content/news/artwork-inventory.json`
before selecting a base. Use a suitable prepared variant before generating more.
Track competition-specific article appearances separately from X attachments. Repeated art with
different statistics, a mirrored camera, or another near-identical close-up is not
enough. This supersedes routine statistics-only reuse, while keeping older approved
originals as references and preserving all cast, source and composition checks.
Mark selected the EXISTING GPU citadel he attached for October 13 Late ARC-3's
repeated-looking close-up. This article-only correction preserves the original
reporting and score observation, with a separate artwork-revision archive. Reserve
the new GPU viaduct for October 14 Early and the GPU icebreaker for October 14 Late,
if their current leader/cast conditions hold. No more native generation is needed
while these suitable prepared scenes remain. The original X announcement stays intact.

October 13 evening: Mark requested distinct varieties of his chosen GPU-citadel style.
The new ARC-3 reusable scene `tufa-arc-3-gpu-viaduct-v1` uses the registered native base
`2026-10-13-tufa-arc3-gpu-viaduct-v1-base`: a horizontal GPU crawler on a snowy viaduct
at dusk, with two owner-photo-consistent rabbits, five spiders and one Dries. It requires
Tufa first ahead of Chen and Dries in the current ARC-3 roster. The next Early edition's
explicit assignment selects it. The ARC-2 citadel remains its own separate approved scene.
Future appropriate variants should change setting, camera, machine silhouette and poses;
do not treat updated statistics alone as a new illustration. Preserve the cast and inspect
every new output. The October 13 Late ARC-3 article now has Mark's explicitly requested
replacement; earlier artwork remains archived and the existing X send state stays protected.

Mark explicitly approved retaining good native images and changing their daily statistics.
`visual-identities.json` now has `reusableScenes`: the ARC-2 Tufa GPU citadel and the
ARC-3 digital giant bunnies. These approvals persist across Early/Late editions, including
quiet boards, when both pictured teams receive sourced coverage and the current
competition, leader/score and Dries roster conditions match. They do not dictate the
headline. The giant bunnies return only when Chen is first on ARC-3; the citadel remains
ARC-2 artwork while Tufa is first there. Recheck each competition independently.

The planner returns the exact reviewed `reuseBase`, so use the normal compose/attach
workflow without generating the scene again. Always start from the clean native original;
never paint over a screenshot's old statistics or reuse a composed edition image. Fresh
ranks, scores, full Eastern observation date/time and any observed-history chart come from
that edition's brief. The base remains unchanged and each finished overlay is immutable.
A lead/cast change prevents reuse even when another score event would qualify for artwork.
Approvals dated after an older issue's evidence do not change its archived composition.
The library approval is separate from dated assignment intake; old held commissions still
receive normal editorial decisions. Keep the current X attachment/send-once workflow.

## Edition-specific human commissions and score history — October 12

An assignment may name an approved `artworkGenerationRecord`, exact `targetEditionId`,
and `artworkConditions` with `leaderTeamId`, `rivalTeamId` and `requiredPersonIds`.
The planner permits this explicitly commissioned scene on a quiet board only while the
named leader remains first with a higher score than the rival and the required people
still match the fresh roster. It selects those two teams rather than an unrelated mover.
The scene may have been generated the previous evening; publication overlays always use
the actual fresh edition brief. A changed leader or cast requires an explicit hold/carry.
`allowArtworkPreview: true` permits a separately identified manual preview using current
observations; its image is never tomorrow's edition evidence.

`artworkHistoryChart: true` uses selected `evidence.scoreHistory` trails archived by
preparation, appends the exact closing scores and draws an observed-score step chart in
the lower-left panel. The chart names its vertical scale, dates and the first recorded
rank change into first place; that timestamp is an observation, not an exact submission
time. It also prints both current ranks/scores and the full Eastern observation date/time.
Missing history supplies no invented flat line. The composition stores the chart's exact
data, and attachment validation rejects a historical-score mutation. Older artworks stay
immutable. ARC-3's Chen/Tufa crossover says nothing about ARC-2, where the separate
commission pictures Tufa's leading GPU machine and smaller digital rabbits.

Mark approved GPU/pixel-grid accents on the cute fluffy rabbits, using Son Pham's avatar
as equipment-style inspiration only. Son is not added to either scene. Preserve the
owner-photo ear/coat identities; the gear, mascot counts and compute machines are metaphors.

## Publish together

Stage only the intended edition/evidence/notebook files, new `content/news/artwork/` records, new `client/public/news-images/` assets and any deliberately updated visual registry. Review and use the normal reporter commit/push procedure. The edition image appears with its headline on the front page and article page, with its dated caption, and in crawler HTML. Never overwrite an earlier edition or its images.

## October 12 evening commission

The preferred revised base is `/news-images/2026-10-12-bunnies-dries-and-compute-v2-base.webp`, with record `2026-10-12-bunnies-dries-and-compute-v2-base`. It has the owner-photo-corrected two bunnies, exactly five little spiders and Dries helping install a GPU. Dries must appear in the fresh Tufa roster before this scene is reused. Five is the Boss’s artistic choice, not a team headcount. Earlier images remain preserved. The afternoon overlay preview is for inspection; tonight must use tonight’s brief and actual headline to draw and attach fresh corner graphics. Follow the pending Chen assignment; use “Chen continues to extend her lead over Tufa” only if the fresh comparison supports it.

The Boss reconfirmed the October 12 evening illustration. The assignment’s `artworkGenerationRecord` names the reviewed v2 base; marking that assignment covered requires a valid edition-bound composition made from that base. Text mentioning Chen alone cannot close this commission. If fresh evidence warrants holding or carrying the metaphor, preserve the assignment and report the concrete reason.
