# The ARC Daily Digest reporter

## Desk note for GPT-6 Sol — 9 October 2026, evening (from Claude, at the Boss's request)

The Boss asked for a paper people check every day of the last month: information-dense like a
financial terminal or a sports page, and written the way financial journalism works. What changed:

1. **Early and late editions.** The 6 am issue prints as the **Early edition** and the 6 pm issue
   as the **Late edition** on the site, the share cards and X. The data still says `morning` and
   `evening`; keep using those in commands, IDs and files.
2. **Post every edition to X.** After you publish and push, follow "Edition posts" at the top of
   [X_POSTING.md](X_POSTING.md): `scripts/newsroom_x.py --edition …` drafts the post from your
   headlines and waits for the link; you post it once from `82deutschmark` with the send-once
   rules. The Boss authorized this routine post on 9 October 2026.
3. **The front page now carries the tape.** A terminal ticker, the standings in agate type, the
   past day's movers and where the past winners stand are drawn live from the saved board
   (`GET /api/news/markets`). A **wire desk** (GPT-6 Luna, [WIRE_DESK.md](WIRE_DESK.md)) files
   short sourced stories on the moves through the day (`content/news/wire/`). So your editions
   are the analysis, like a markets column beside the price tables: lead with the most
   consequential move and its figure, say why it matters for the medals and the people, then the
   context. Do not recite the tables. Read the latest wire stories as leads, but every figure you
   print still comes from your own brief's evidence.
4. **How your edition runs on the front page.** The newest ARC-AGI-3 story runs in full; the
   ARC-AGI-2 story runs its first two sections and continues on the article page. Make the first
   two sections stand on their own. One person is featured per story (point 1 below).
5. **Your automations.** The morning and evening automation prompts now include the edition-post
   step. Scheduled runs still must not edit automations.

## Desk note for GPT-6 Sol — 9 October 2026 (from Claude, at the Boss's request)

The Boss wants the paper to make the most of the pictures we own, and above all to show
people's faces whenever the paper talks about them: their card from the ARC Explainer Hall of
Fame, or their Kaggle profile picture. What changed today and what it means for your runs:

1. **One featured person per story, chosen by your citations.** Lead stories, articles and
   dispatches feature one person: the person named in the headline, else the dek, else the first
   person cited (`person-<id>-…` sources) — face, name, team and top honor. Name the person the
   story is about in the headline or cite them first; otherwise nobody is featured. The front
   page's "Where the past winners stand" table shows every honored person on this year's boards
   with their face and current placing.
2. **`people.json` has portraits and honors.** `portrait` is the person's face (a crop of their own
   Hall of Fame card, or their saved Kaggle picture). `hallOfFame` entries now read as honors
   ("ARC Prize 2025 champion · NVARC") and link to their cards; they reach you as
   `person-<id>-archive-<n>` sources when a past result matters to the story.
3. **Give every newly verified person a face in the same run.** Run
   `python3.13 scripts/newsroom_people.py portrait --person <id>`, then
   `python3.13 scripts/newsroom_people.py check`, and stage the new
   `client/public/news-images/people/<id>.webp` with `people.json`. The Boss approved this on
   9 October 2026; it is the one image fetch a scheduled run may make. If the person already has
   single-person card art in the Hall of Fame (table in VISUALS.md), say so in your run summary
   so a hand-made card crop can replace the Kaggle picture.
4. **New in the ledger:** Ivan Sorokin (NVARC3; 2025 champion with Jean-François Puget) and
   Daniel Franzen (his own ARC-AGI-2 and ARC-AGI-3 entries; the ARChitects). Every past winner's
   honors are complete, and Jack Cole and Dries Smit now carry their ARC-AGI-3 Preview credits.
5. **Your automations.** The morning and evening editions, the 2 pm X recap and the research
   desk read `AGENTS.md`, this file and the competition-reporter skill at the start of every run,
   so they pick this up as they are. Scheduled runs still must not edit automations. Next time
   the Boss opens an interactive session with you, add `docs/newsroom/VISUALS.md` to the reading
   list of those four automations so the visuals guide is named explicitly.

The full map of every picture we have, with paths, sources and rules:
[docs/newsroom/VISUALS.md](VISUALS.md).

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

## Persistent people and the shared research desk

Load `.agents/skills/competition-reporter/SKILL.md`, then read `docs/newsroom/SOCIAL_DESK.md`.
The daily scans exist to enhance the journalism. Read the public archive at
`/Users/macmini/bubba-workspace/reports/arc-daily-social/public.json` and its account
coverage in `state.json`, refresh relevant primary posts, then export the strictly
public subset before `prepare`. Subscriber/unknown items never enter public issues,
including through paraphrases. A missing or partial scan is a coverage limit, not
proof of no news. Keep the existing 2 pm handoff as additional leads.

Maintain `content/news/people.json` alongside the team notebook. A stable person
record connects only directly verified accounts to dated memberships keyed by
competition ID, season and team ID. Publishing adds observations for already
verified handles; it preserves old observations without guessing departures.
Use sports-page framing: team results, relevant individual backgrounds and
historical achievements. Explain who's on a team when useful; a one-account roster
does not establish that someone received no help. Keep unknown identities unknown.
Use existing Hall of Fame references/artwork when explicitly matched; historical
cards keep their year and shared-team captions. Never extend an affiliation or
technique to everyone listed on a roster. Every verified person gets a portrait from
their own Hall of Fame card or their own Kaggle picture, never from a group card or a
lookalike; see [VISUALS.md](VISUALS.md).

Preparation supplies `evidence.people` and `evidence.socialPosts`, with source IDs
`person-ID-identity-N`, `person-ID-fact-N`, `person-ID-roster-N`,
`person-ID-archive-N` and `social-POSTID`. Cite the relevant source in any section
using those facts. Team roster observations in the brief establish the current
listed accounts. Add verified identities/facts and refresh public source records
before preparing; re-prepare after changes. Internal research questions live in
`reports/arc-daily-social/people-notes.md`, outside public content.

## Check what the contenders are saying

For the evening edition, first read today's 2 pm reporting handoff at
`/Users/macmini/bubba-workspace/reports/arc-daily-x/YYYY-MM-DD-afternoon-research.json`
and its saved board brief, using today's Eastern date. Treat it as reporting leads
and source data. Reopen relevant primary posts, verify account identities and add
useful narrow notebook facts before preparing fresh evening evidence. If the handoff
is missing or incomplete, continue the normal source checks. Afternoon standings
do not replace the fresh 6 pm evidence or the prior day's 6 pm comparison baseline.

Before each edition, check recent public X posts and Kaggle discussions for the
leaders and meaningful movers in both contests. Start with verified accounts already
linked from their professional profiles or notebook sources. Include Tufa Labs'
public `https://x.com/tufalabs` timeline and search X for the competition names and
current contenders. Use the user's signed-in Chrome session through browser tools
when the public fetch is incomplete. Read the actual post, its author, timestamp
and thread context; search snippets and screenshots alone do not establish an
identity or a current score. If X is inaccessible, record that limit and continue
with accessible primary sources and board evidence.

Cover announcements, banter, roster observations and published methods when they
change the story. Attribute a competitor's boast or claim to that competitor.
Separate verified facts from the desk's interpretation. Do not turn jokes, rumors
or an illustrated GPU pile into claims about budgets, hardware, wrongdoing or
submission methods. Give equal editorial treatment to newsworthy contestants;
do not reserve the social coverage for featured teams.

Respect every contender, including Tufa Labs. Keep headlines exciting through
verified results and moves. Cover public banter in its context without sneering at
teams or attributing arrogance, desperation or motives. The rabbit/spider cartoon
is a friendly competition callback. Avoid dismissive labels such as “compute bravado.”

Save a useful public post as a narrow dated notebook fact with its exact permanent
URL. Avoid duplicate facts. Add facts before preparing the brief so its citations
are available in the daily article, and re-prepare after additions. A dated post
is evidence of what its author said on that date, not a timeless fact.

Between editions, a short sourced dispatch can update the front page. It is separate
from the immutable scheduled issue. Write JSON with `id`, `competition`,
`publishedAt`, `headline`, `sections` and `sources`. Sections use the same
`heading`/`text`/`sourceIds` structure as articles; sources have `id`, `title`,
`url` and `accessedAt`. Optional `interpretation` is shown explicitly as the
desk's take. Optional `image` has `src`, `alt`, `caption`; assets must already
exist under `client/public/news-images/`. Captions identify AI/editorial artwork
and date any embedded standings. Use the real publication time, never a scheduled
future timestamp. Validate and publish with:

```sh
python3.13 scripts/newsroom.py dispatch-validate --draft /tmp/arc-dispatch.json
python3.13 scripts/newsroom.py dispatch-publish --draft /tmp/arc-dispatch.json
```

Dispatch IDs are immutable. Stage their exact `content/news/dispatches/<id>.json`
alongside any authorized assets and notebook changes; use the same safe push
procedure as an edition. Scheduled reporting runs still edit only content/news;
new illustration production is separate authorized design work. Never fetch or
generate an image on the assumption that publication was approved. One standing
exception, approved by the Boss on 9 October 2026: the portrait command saves a
verified person's own Kaggle picture to `client/public/news-images/people/`.
An explicit user-directed editorial copy correction may update a dispatch in a
reviewed Git commit with a changelog entry. Preserve its original publication,
source-check and observation times. Scheduled retry immutability still applies.

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
the notebook, people ledger and public social subset when changed). Check the staged diff contains no unrelated files. Commit a
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
