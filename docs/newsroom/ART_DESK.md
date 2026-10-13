# Native illustrations for the ARC Daily Digest

Author: GPT-6.1 Sol / Codex · 12 October 2026

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

1. If `reuseBase` is present, inspect its public image and generation record. Reuse that reviewed same-day scene for the same verified story; redraw the score panel from this edition’s brief. Never use its old composed scoreboard.
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
