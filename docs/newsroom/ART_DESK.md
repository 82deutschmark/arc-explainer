# Native illustrations for the ARC Daily Digest

Author: GPT-6.1 Sol / Codex · 12 October 2026

The Boss authorizes native Codex image generation as part of the Early and Late editions when a referenced competitor makes a consequential move. The Python helper plans and composes; the Codex journalist calls the built-in image tool. No paid image/model API, CLI image-generation fallback, model switching or new schedule is needed. One image per competition at most; a quiet issue can publish without art.

## References and editorial choice

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

The appended panel uses repository fonts, the manuscript headline, two verified contender rows when available, ranks, scores and the board observation time. It does not cover or redraw the artwork. The output is immutable; a different brief or headline produces a different asset and composition record. The old `--source --brief --output` entry still routes to compose; production editions use the explicit manuscript workflow.

5. Attach the returned artwork record to the draft:

```sh
python3.13 scripts/newsroom_artwork.py attach --brief /tmp/arc-daily-evening-brief.json --article /tmp/arc-daily-arc3-draft.json --artwork content/news/artwork/<artwork-id>.json
python3.13 scripts/newsroom.py validate --article /tmp/arc-daily-arc3-draft.json --brief /tmp/arc-daily-evening-brief.json
```

The publisher verifies the article ID, headline, brief checksum, observation time, score rows and final image bytes, then archives the composition alongside the edition’s evidence. A wrong edition, changed score, changed image or stale brief fails. Keep the article’s existing sources and intakeReview; artwork does not replace reporting.

If native generation is unavailable or fails, preserve the reason and publish the verified text without `image`. Do not silently use a paid API or stale illustration. Include the art outcome in the final report. Scheduled runs do not edit application code or this workflow.

## Publish together

Stage only the intended edition/evidence/notebook files, new `content/news/artwork/` records, new `client/public/news-images/` assets and any deliberately updated visual registry. Review and use the normal reporter commit/push procedure. The edition image appears with its headline on the front page and article page, with its dated caption, and in crawler HTML. Never overwrite an earlier edition or its images.

## October 12 evening commission

The raw native base is `/news-images/2026-10-12-bunnies-and-compute-base.webp`, with record `2026-10-12-bunnies-and-compute-base`. It has two enormous bunnies and five little spiders building a graphics-card machine. Five is the Boss’s artistic choice, not a team headcount. The noon score-panel preview is for inspection only. Tonight’s reporter must use tonight’s brief and actual headline, then compose and attach a new panel. Follow the pending Chen assignment in `editorial-assignments.json`; use “Chen continues to extend her lead over Tufa” only if the fresh comparison supports it.
