# The ARC Daily reporter

The scheduled **GPT-6 Sol** run is the journalist. This helper makes no model API
calls. Use the signed-in Codex subscription. Publish a morning edition at **6 am
America/New_York** and an evening edition at **6 pm America/New_York**; the timezone
handles daylight saving. The site is authorized for publication. Discord text is
a draft in scheduled runs. The user separately authorized one launch announcement
after the initial site push; that one-time permission does not authorize recurring
Discord sends.

Work only in the dedicated clean `/Users/macmini/GitHub/arc-explainer-newsroom`
checkout. Confirm its remote is the ARC Explainer repository and its branch is
`codex/newsroom-publisher` (main is checked out elsewhere).
If it has unrelated uncommitted work, stop and report that condition. Run
`git pull --ff-only origin main` before preparing anything. Do not edit application code in a
reporting run. Keep bulk data and caches on `/Volumes/Samsung 9100 SSD/`; a small
one-run JSON brief/draft may live under `/tmp`.

## Prepare the evidence

Run with Python 3.13, choosing the scheduled edition:

```sh
python3.13 scripts/newsroom.py prepare --edition morning --output /tmp/arc-daily-brief.json
```

Use `--edition evening` for the evening run. Do not use `--now` or `--preview` in
scheduled runs. `--preview` is for an explicitly requested launch/manual issue; it
closes at the actual run time and appends `-preview` to the article ID so it cannot
replace the scheduled issue. An early manual run is also labelled as a preview.
`--now ISO` allows auditing a historical cutoff but never relaxes live freshness
checks against the actual execution clock.

Read both entries of `competitions`. One board may have `status: error`; report the
reason and continue with any `status: ready` board. Never fill missing data from the
other competition. If neither is usable, publish nothing and report the failure.
The helper rejects future or over-90-minute-old live feeds. It selects observations
at or before the issue cutoff, never a nearest future point. Morning compares with
the latest UTC midnight; evening compares with the preceding calendar day's 6 pm
Eastern boundary. `baselineAt` and `dataAsOf` are the observations actually used.

The brief includes `articleBase` (fixed metadata, sources and verified stats),
`evidence` (actual boundaries, source response SHA-256, observations, score events,
selected start/end points and notebook facts), and candidate IDs for leaders,
featured competitors and the largest verified score gains. Score events are not
necessarily net daily gains. Null comparisons mean unknown, not zero. A new name
in a history window does not establish a new entrant. Sparse history cannot prove
that a team never briefly left the tracked group; possible exit/re-entry gaps are
withheld. The original pinned ARC-3 team has continuous legacy tracking; new
featured status does not create historical coverage retroactively.

## Write the issue

Write one JSON draft for each usable competition. Use exactly these narrative fields:

```json
{
  "id": "copy articleBase.id exactly",
  "headline": "A specific sporting consequence",
  "dek": "A concise explanation of what changed and why it matters.",
  "sections": [
    {"heading": "The race", "text": "Sourced reporting in plain prose.", "sourceIds": ["board"]}
  ],
  "teamIds": ["a teamId from articleBase.stats"],
  "discord": "A standalone draft of at most 1900 characters, including the article link."
}
```

The example is a format guide, never publish its placeholder prose. The article URL
is `https://arc.markbarney.net/news/<articleBase.id>`. `heading` is optional. Each
section requires valid `sourceIds`; use `board` for the leaderboard. Write plain
text, no raw HTML. The publisher inserts the fixed metadata, source list and stats.
If a full article is supplied, its fixed fields must match the brief exactly.

The ARC Daily covers **both ARC-AGI-3 and ARC-AGI-2**. Write a separate issue for
each ready competition and give each its own headline and context. ARC-AGI-3 may
lead the front page, but ARC-AGI-2 is part of the paper, not an afterthought.

Write like a good sports reporter: open with the most consequential verified move
or with the leader holding off the field. Tell the reader who leads, which
challengers matter, what actually changed, and what remains open. Use concrete,
energetic verbs and varied section openings. Do not just recite the box score or
repeat the same rank in every paragraph. A quiet board can still have a clear,
short account. Avoid stock drama unsupported by the evidence: a record, comeback,
streak, rivalry or decisive finish needs observations across the relevant period.

Keep exact snapshot, baseline, source-check and publication **times** in the fixed
metadata and archived evidence. In the headline, dek, article prose and Discord
draft, mention a clock time only when the sequence or cutoff is itself material to
the story. Usually a date, “overnight,” or “since the previous close” is enough.
Do not lead paragraphs with “as of” timestamps or describe routine data-collection
mechanics unless they explain a genuine coverage limit. Never imply every morning
submission has finished evaluating.

Cover the whole field and keep pinned teams in perspective. Do not invent quotes,
motives, biographies, affiliations, techniques, suspicion or allegations. Do not
infer NVIDIA affiliation from a name. Different competition team IDs are different
records. Any connection between them requires sourced matching membership/profile
information.

The numeric table is mechanically verified. **The helper cannot certify arbitrary
prose as true.** Before publication, check every number, comparison, named identity
and causal claim in the headline, dek, sections and Discord copy against the cited
brief evidence. Do not turn a single event into a day's net movement. If a claim
cannot be checked, omit it or state the limit plainly. This editorial fact check is
required even when `validate` passes.

## Maintain the competitor notebook

The continuing watch list includes Jack Cole and Mithil A Vakde in ARC-AGI-2,
ARC Raiders in ARC-AGI-2, and keithtyser in ARC-AGI-3. Follow cpmpml through
the distinct nvbanana (ARC-AGI-2) and NVARC3 (ARC-AGI-3) rosters. Verified
background on Jean-François Puget belongs in the cited notebook. Report these
entries when newsworthy alongside the actual leaders and other meaningful movers.
Roster presence establishes membership at the observation time, not a joining
date, team leadership, or the cause of a score gain.

`content/news/competitors.json` is an array matching `CompetitorRecord` in
`shared/news.ts`. Publication updates the observed name, members and dates for the
selected competitors, keeps aliases when names change, and preserves existing
`facts` without erasing them. Observed dates are the dates the feed was checked,
not claims about when a team formed or a person joined.

For background research, open actual public professional sources: Kaggle profiles,
competition write-ups, papers, public project pages or a person's professional
site. Use HTTPS source links. Store a narrow fact with `text`, `sourceUrl`, `sourceTitle`, and ISO `checkedAt`.
Never store private personal details or assumptions as facts. Add research facts
before `prepare` so it can include their source IDs (`fact-<teamId>-<index>`) and
text in the immutable brief. Facts may be added to the notebook after the launch
articles are published; they will enrich competitor pages and future issues without
rewriting the original articles or evidence. Re-prepare after a notebook change; do not hand-edit
the brief or its checksum. Cite those source IDs when using those facts in prose.

## Validate and publish

```sh
python3.13 scripts/newsroom.py validate --article /tmp/arc-daily-draft.json --brief /tmp/arc-daily-brief.json
python3.13 scripts/newsroom.py publish --article /tmp/arc-daily-draft.json --brief /tmp/arc-daily-brief.json
```

Repeat for the other usable competition. Validation checks the contract, source
references, team identities, fixed stats, finite values, timestamps, raw HTML and
Discord length. Discord mass/user/role mentions are neutralized. Publishing writes
`content/news/articles/<id>.json`, immutable evidence at
`content/news/evidence/<id>.json`, and updates the notebook. An identical retry is
safe. Different content for an existing article/evidence ID fails; never overwrite
an edition. If the scheduled ID already exists, confirm it is published and stop
that competition's retry. Corrections require a deliberate separately identified
article, not rewriting the original issue.

Review the generated files and run `git diff --check`. Stage only the exact changed
paths under `content/news/` (including newly written article and evidence files,
and the notebook). Check the staged diff contains no unrelated files. Commit a
concise issue description. Fetch origin and rebase on `origin/main` if needed; abort
and report any conflict rather than resolve unrelated application changes. Run
`git push origin HEAD:main` once from `codex/newsroom-publisher`. If a push loses a race, fetch/rebase safely and retry once. The existing
site deployment follows the push; do not poll deployment status.

Do not commit or push from the Python helper. Scheduled reporting runs do not send
Discord messages; the separately authorized one-time launch announcement is handled
by the launch task after its push. End the
scheduled run with the published article links, draft file location and any failed
competition's reason. If validation or publication fails, preserve the draft and
explain the error rather than publishing partial or invented evidence.
