# The ARC Daily Digest — people, teams and the Card Cabinet

Author: Codex · 29 October 2026
Purpose: A durable reporting and collection map for every newsroom job.

The Boss wants intelligent sports coverage: introduce the people, recognize impressive
results, follow their public voices and explain what makes the next contest move matter.
Call him Boss. A fifth-place finish in a field of thousands deserves serious billing.
Write lively copy supported by evidence; invent neither quotes nor motives, rivalries,
budgets, methods or future plans. Read the subject's record before writing about them.

## Required notice for every desk and artwork commission

The permanent shared page is **[The ARC Daily Card Cabinet](https://arc.markbarney.net/news/cards)**.
Every Codex, Claude, OpenClaw, wire, backup, research, manual and scheduled newsroom run must
consult this playbook and the selected subject’s Cabinet records before reporting or commissioning
art. Include this exact page link in desk handoffs and commission briefs so the next assistant
uses the same characters. The newsroom README, repository AGENTS and automation prompts point here.

All existing artwork and every new commission belongs to this reference system: look up the
exact competition, team ID and verified handles; inspect the registered character image files;
attach those actual files to the native generation call; preserve the character’s face, mascot,
full team cast and explicit fictional stand-ins. A card is a lookup, not permission to invent a
likeness or crop one person from a group. Existing scenes remain preserved as dated episodes;
use them as identity references only where documented, not as silently reused news covers.
If older artwork lacks a complete mapping, record that gap and hold its reuse until reconciled;
do not delete originals or silently remake the cast. Save the actual input roles, paths, hashes,
prompt and visual review with each new artwork record. Follow [CHARACTERS.md](CHARACTERS.md)
and [ART_DESK.md](ART_DESK.md) for generation and publication.

Late artwork is prepared in the 5 pm prepress pass before the 6 pm release. The edition’s
headline, permanent link and reviewed image form one X announcement. Missing art blocks that
announcement; it does not authorize a text-only send. See [SCHEDULED_EDITIONS.md](SCHEDULED_EDITIONS.md)
and the guarded posting command in [X_POSTING.md](X_POSTING.md).

## Where to look

| Place | What it supplies |
|---|---|
| `/news/cards` | The permanent ARC Daily Card Cabinet: individual and team collectibles. |
| `/api/news/cards` | The Cabinet's validated card data and sourced statistics. |
| `content/news/cards.json` | Stable card identities/numbers, curated artwork bindings and explicit dated current snapshots. |
| `content/news/card-results.json` | Explicitly sourced official final results and awards; separate from public standings. |
| `shared/newsCollection.ts` | Shared collection types and presentation rules. |
| `server/services/news/newsCollection.ts` | Validated collection projection used by the API and card renderer. |
| `content/news/people.json` | Stable person IDs, verified accounts, sourced facts, individual portraits and historical honors. |
| `content/news/competitors.json` | Contest-specific team dossiers, observed names, exact handles and dated facts. |
| `content/news/visual-identities.json` | Curated character identities and their frozen reference images. |
| `content/news/artwork-inventory.json` | Finished art, permitted cast, reservations and actual article/social uses. |
| `content/news/artwork/<artworkId>.json` | Exact native generation arguments, input references, hashes and visual review. |
| `docs/newsroom/feature-reserve/<date>/index.json` | Committed held manuscripts, editorial priority and release conditions. |
| `content/news/editorial-assignments.json` | Current one-off commissions, reservations, expiry and delivery scope. |

The programmatic card-image endpoint, `/api/news/cards/:id/image.png`, draws names, dated
statistics and confirmed honors from collection data over the approved artwork. Do not
paint mutable names, ranks, scores or medals into the native illustration. Keep the
clean original and result revisions. The current registry stores dated current snapshots;
refreshing it does not create immutable files for every card edition.

Private research lives under
`/Users/macmini/bubba-workspace/reports/arc-daily-social/`, especially dated `editorial/`
handoffs and `state.json`. Read the subject's handoff when relevant. Never stage private
research, subscriber material or unknown-visibility discussion bodies into the public
repository. Do not alter another desk's coverage watermarks or delivery receipts.

For the current reserve, start at
[the October 29 index](feature-reserve/2026-10-29/index.json), then the selected subject's
`feature.txt`, `feature-draft.json` and private research path. A Cabinet card or a shared
cheat sheet does not publish that manuscript or authorize an X post. Preserve existing
edition reservations and release holds; assign publication time only when publishing.

## Before writing or updating a card

1. Establish the exact competition slug and team ID, then match the exact roster handles.
   If Boss supplies a profile, start with that exact handle. A rank clue may describe an
   earlier observation; never substitute another team just because it occupies that place now.
   A matching team name is insufficient. A person can have distinct entries in both ARC
   contests. A renamed entry retains its team ID; a new team ID requires separate evidence.
2. Read the competitor dossier, relevant people records, held manuscript and earlier
   coverage. Check past results on primary sources and distinguish a team's finish from
   each member's credited participation. Do not infer a medal from a top-ten placing.
3. Read the actual relevant discussions/posts and their replies, including corrections.
   Record original links, authors, source dates, check dates and visibility. A title,
   snippet or unsuccessful scan does not establish the body or absence of activity.
4. Refresh the selected contest's board through the Kaggle CLI or
   `/api/kaggle/<competition-slug>/board`. Use the observation time, not retrieval time,
   for displayed statistics. Unknown comparisons stay unknown; public places stay public.
5. Read the character mapping and inspect the chosen source images. Verify every current
   cast handle before adapting a team scene. Fantasy equipment is not a disclosed method.
6. Lead with the strongest verified sporting consequence. Add biography, earlier honors,
   public comments and stated next steps where they help readers follow the contender.
   If the next plan is unknown, say so briefly instead of inventing one.

## Individual cards and team cards

An individual card follows one stable person/account identity. A team card follows a
specific competition entry and preserves its roster observation. Do not merge people,
teams, seasons or prize categories because their names, avatars or affiliations overlap.
Keep unresolved people under their verified handles and preserve explicit uncertainty.

Use an individual's verified own avatar, their own single-person Hall-of-Fame artwork,
or a documented identity reference approved for that commission. Never crop a human face
out of a group picture to create an individual reference. Make a separate individual
illustration when needed. A group scene can remain the team's collectible.

Kaggle's generic goose is a default, not a personal character. A fictional newspaper
mascot is permitted when commissioned, but label it as fiction and preserve that mapping.
Owner-selected cartoons, abstract paintings and dog avatars are not human photographs.
Do not replace them with an invented face or silently convert them into real appearance.

Concrete mappings that prevent repeat mistakes:

- **Darren / Domdolus Tolus:** five accounts, six figures. Darren's two dogs together
  represent `darrenamadeusmartin`; Alwin and Yassir use their own separate portraits;
  Billy and Tri use explicitly fictional opaque helmets. ARC2 `16559402` and ARC3
  `16534961` are separate entries. Six drawn figures do not mean six team members.
- **Turducken / ARC Mutants:** ARC3 Turducken has seven accounts. Its `markbarney`,
  `sonphamorg` and `scizical` accounts overlap ARC2 ARC Mutants, which also includes
  `jcole75`. Do not transfer the full ARC3 roster to ARC2. Preserve the approved academy
  original and the Boss's October 29 X-Men / Professor Xavier direction in CHARACTERS.md.
  Three additional finished academy episodes are saved in
  [the October 29 Mutants reserve](2026-10-29-arc-mutants-art-reserve.md); their four-person
  cast never authorizes adding Jack or the Mutants costumes to ARC3 Turducken.
- **NT = `mitubant`:** Boss directly confirmed the Discord/Kaggle mapping on October29,
  and the own Kaggle profile is headed NT. Use P066 and the dedicated orange banana-suit
  kitten avatar, with blue comic tears and Turducken's ARC3 setting. The character is
  recorded under `mitubant` in the visual registry. Do not assign NT to ARC2 ARC Mutants.
  The saved October29 ARC2 board instead places `mitubant`, `keithtyser`, `dzjiann` and
  `ngyzly` together on team `15526034`, この遥かなる旅路に祝福を. Preserve that separate
  membership. An individual's `entries` preference in cards.json orders existing verified
  records for its front; it cannot establish membership or transfer an award.
- **The Last Dance:** preserve the established four-account cast. `gklambauer` remains
  unresolved until a direct primary identity link is verified; a likely surname or
  research association is insufficient. Read its dossier before assigning a real name.
- **nvbanana:** ARC2 `15486939` is Puget/`cpmpml` and Hanley/`darraghdog`. NVARC3 is a
  separate, larger ARC3 entry. Puget's 2025 NVARC championship with Ivan Sorokin does not
  confer that honor on Hanley. The October 29 duo commission preserves artwork only.
- **Artificial Agency Lab:** Richard and Côme have independently documented lab roles
  and named lab portraits. The `cmechevalier`-to-Côme account mapping remains unresolved;
  do not turn a lab biography into verified ownership of that Kaggle handle.
- **yktori and mtg:** preserve the Silver Comet and Two-board Rook fictional mascots.
  yktori's real-world identity remains unresolved; Michael's profile supplies Michael
  only. Never infer his surname from `michaeltgao`. Use documented competition honors.

The full mapping for all nine October 29 commissions is in
[CHARACTERS.md](CHARACTERS.md#october-29-contender-team-avatar-reserve) and
[the machine archive](2026-10-29-team-avatar-archive.json). Preserve all nine originals,
inputs and provenance even when an article remains held or an entry changes its name.

## Safe updates and eventual final honors

Use the collection helper in the newsroom checkout:

```sh
node --import tsx scripts/newsroom_cards.ts refresh
node --import tsx scripts/newsroom_cards.ts check
node --import tsx scripts/newsroom_cards.ts import-results <official.json>
```

`refresh` adds missing identities without renumbering existing cards and replaces current
snapshots from the dated boards. Preserve existing IDs, unrelated fields and source links
when making a curated registry edit as parsed JSON. Bind each card to the exact artwork
record and subject. Current roster/statistic snapshots may change; historical board
observations, published reporting and clean artwork remain their separate records.

Official final private standings and organizer awards belong in `card-results.json`.
Use official Kaggle/ARC Prize sources, explicit contest/stage and credited recipients.
Public medal bands, career medal totals, milestone awards, paper awards and final prizes
are different facts. A passed deadline or last public score does not finalize a result.
Leave unconfirmed honors unknown. Programmatic result imports must be repeatable without
duplicates; an official correction gets a new ID and `supersedesId`. Import an array of
records matching `finalCardResultSchema`; never rewrite an existing result ID in place.
Derive final card labels from these results while retaining original artwork and all
result revisions. Credit an individual only through the official credited roster; joining
a team later does not confer its earlier award.

Validate source/subject/roster references, artwork files and provenance, then inspect the
resulting card and its readable statistics. Run the collection's focused checks and the
normal newsroom checks documented in [README.md](README.md). Use the existing authorized
Git publication workflow; a successful push completes publication. Follow
[FINISHING.md](FINISHING.md): no deployment polling or repeated verification.

Do not create another automation to maintain this collection. Existing desks use this
playbook, the shared registries and their current authorization. Preserve the permanent
newsroom, wire, fallback and collector checkouts, the shared reports and commissioned art.
Distribution follows [X_POSTING.md](X_POSTING.md) and the existing send-once receipts;
collection maintenance alone supplies no new send permission.
