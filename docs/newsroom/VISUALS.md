# The ARC Daily Digest — pictures and people visuals

Author: Claude Opus 5.5 · 9 October 2026 · for GPT-6 Sol, GPT-6 Luna (the wire desk) and any assistant working on the newspaper.
Updated the same evening: the front page's Hall of Fame band became the past-winners table, and wire stories pick a picture from their brief.

The Boss wants the most out of the pictures we already own, especially for people: when the paper
talks about someone, readers should see their face. A face is either **their card from the ARC
Explainer Hall of Fame** (last year's illustrated winner cards) or **their own Kaggle profile
picture**. This page lists every picture, where it lives, and how the pages choose them.

## How faces reach the page (nothing to lay out by hand)

| Where | Whose faces | Driven by |
|---|---|---|
| Front page story, dispatch, article page | **one** featured person: the person named in the headline, else the dek, else the first person the sections cite (face, name, team, top honor). | `StoryFeature`, `featuredPerson()` |
| Front page "Where the past winners stand" | every person with an honor whose ledger team is on a 2026 board, best placing first: face, top honor (links to their card), team now, rank, score, day's change | `PastWinners` in `client/src/components/news/NewsMarkets.tsx` |
| Wire stories (What's News, `/news/wire`) | the picture the story chose from its brief (the person's face or their Hall of Fame card art), else the first person in `personIds` | `scripts/newsroom_wire.py` (offers `visuals`), `NewsWire.tsx` |
| Front page "Around the contests" | the post's author when the X handle is a verified person | `AroundTheContests`, `personForXHandle()` |
| Competitor notebook cards, team rosters, "Names in this edition" | verified people on that team | `peopleForTeam()` |
| Community desk | the post's author when the X handle is a verified person, plus people in `personIds` | `personForXHandle()` |
| People directory and profiles | everyone in `content/news/people.json`, with honors | `PersonCard`, profile header |

**So the daily layout follows the reporting.** Cite a person's brief sources
(`person-<id>-identity|fact|archive|roster-<n>`) in the sections where you write about them and
the person your headline names (else your dek, else the first person you cite) is featured on that story with their face. Only one person is featured
per story (Boss: a row of faces read like a staff list). Cite first the person the story is really
about; a story that cites nobody features nobody.

## Portraits: `content/news/people.json` → `portrait`

One square face per person, saved under `client/public/news-images/people/<person-id>.webp`.

```json
"portrait": {
  "src": "/news-images/people/jan-disselhoff.webp",
  "alt": "Jan Disselhoff’s Kaggle profile picture",
  "kind": "kaggle",
  "sourceUrl": "https://www.kaggle.com/insanitycheck",
  "sourceTitle": "Jan Disselhoff — Kaggle profile picture",
  "checkedAt": "2026-10-09T21:36:04Z"
}
```

Rules, enforced by `scripts/newsroom_people.py` and `server/services/news/newsStore.ts`:

- `kind: "kaggle"` — `sourceUrl` must be one of the person's **verified** Kaggle account URLs.
- `kind: "hall-of-fame"` — `sourceUrl` must be `https://arc.markbarney.net` + one of the person's own
  `hallOfFame[].path` anchors. The file is a crop of that card.
- Hall of Fame art wins over a Kaggle picture. A person with neither shows their initials.
- Never crop a face out of a group card (the ARChitects card shows three people and nothing says
  which face is whose). Group cards stay as Hall of Fame thumbnails; the members get their Kaggle
  pictures. The founders crop shows both founders and is used for both, with both names in the alt text.
- Kaggle's default avatar (`default-thumb.png`) is not a picture: no portrait.

### Saving a Kaggle picture (one command)

```sh
python3.13 scripts/newsroom_people.py portrait --person <person-id>   # repeat --person for several
python3.13 scripts/newsroom_people.py check                           # ledger valid, every file present
```

It reads the person's verified Kaggle profile, refuses a page for any other handle, saves a
320×320 webp and writes the `portrait` record. It keeps Hall of Fame portraits. If the person has
removed their Kaggle picture since, it deletes our copy too. Stage the `.webp` file together with
`people.json`.

### Current portraits (9 Oct 2026)

| Person | File | Source |
|---|---|---|
| Jack Cole | `jack-cole.webp` | crop of `/jackCole2.png` (2025 MindsAI card, `#contributor-9`) |
| Dries Smit | `dries-smit.webp` | crop of `/dries.png` (ARC-AGI-3 Preview card, `#contributor-25`) |
| Jean-François Puget | `jean-francois-puget.webp` | crop of `/jfPuget3.png` (2025 NVARC card, `#contributor-7`) |
| Ivan Sorokin | `ivan-sorokin.webp` | crop of `/ivanARC2.png` (2025 NVARC card, `#contributor-7`) |
| François Chollet, Mike Knoop | `arc-founders.webp` | crop of `/arc founders.png` (founders card, `#contributor-19`) |
| Yi-Chia Chen, Keith Tyser, Jeroen Cottaar, Jan Disselhoff, David Hartmann, Daniel Franzen | `<id>.webp` | Kaggle profile pictures |
| IsaiahP, Lonnie, alijs | `<id>.webp` | Kaggle profile pictures (past prize winners added 9 Oct; no Hall of Fame cards, so their wins are their first fact) |
| Mithil A Vakde, gromml | — | default Kaggle avatar; initials |

## Honors: `people.json` → `hallOfFame`

Each entry links one past result or role to its Hall of Fame card and to the official result page.
Labels read like a sports almanac and keep the year and team: `ARC Prize 2025 champion · NVARC`,
`ARC Prize 2024 champion · the ARChitects`, `ARC-AGI-3 Preview 2025 winner · StochasticGoose @ Tufa Labs`.
They appear under the person's name on cards, profiles and rosters, and the brief hands them to you
as `person-<id>-archive-<n>` sources. Only give a person an honor their own roster or credit
supports: David Hartmann was not on the 2024 Kaggle roster, so his honors start in 2025.

Official result pages: [2025](https://arcprize.org/competitions/2025),
[2024](https://arcprize.org/competitions/2024),
[2024 note on MindsAI](https://arcprize.org/blog/arc-prize-2024-winners-technical-report),
[ARC-AGI-3 Preview](https://arcprize.org/competitions/arc-agi-3-preview-agents).

## The Hall of Fame itself

- Page: `/hall-of-fame`. Every card has an anchor `#contributor-<id>`; a link with that hash
  scrolls to the card once the cards load.
- Records: `GET /api/contributors` (database). Seed and the single source for names, years,
  achievements and image files: `server/scripts/seedContributors.ts`.
- Team cards with two images (`/jfPuget3.png,/ivanARC2.png`) split into one card per member on the page.

### Card art in `client/public/` (848×1264 or 1024×1024)

| File | Shows | Record | Used |
|---|---|---|---|
| `jfPuget3.png` | Jean-François Puget | #7 NVARC, 2025 champion | portrait crop, card |
| `ivanARC2.png` | Ivan Sorokin | #7 NVARC, 2025 champion | portrait crop, card |
| `ARChitechts.png` | Franzen, Disselhoff, Hartmann | #5 2025 runner-up, #6 2024 champion | card only (group) |
| `jackCole2.png` | Jack Cole | #9 MindsAI & Tufa Labs, 2025 third | portrait crop, card |
| `jackcole.jpeg` | Jack Cole | #10 MindsAI 2024 | card |
| `dries.png` | Dries Smit | #25 ARC-AGI-3 Preview winner, #9 | portrait crop, card |
| `jfPuget2.png` | Jean-François Puget | #15 2024 paper award runner-up | card |
| `arc founders.png` | François Chollet and Mike Knoop | #19 founders | portrait crop, card |
| `guillermo.png` | Guillermo Barbadillo | #8 2025 fifth, 2024 second | Hall of Fame |
| `alexiaJM4.png` | Alexia Jolicoeur-Martineau | #1 2025 top paper award | Hall of Fame |
| `julienPourcel.png` | SOAR team (Pourcel, Colas, Oudeyer) | #2 2025 paper award | Hall of Fame (group) |
| `isaacliao.png` | Isaac Liao | #3 2025 paper award | Hall of Fame |
| `jberARC.png` | Jeremy Berman | #4 researcher | Hall of Fame |
| `simonS.png`, `simonS1.png` | Simon Strandgaard (neoneye) | #20 | Hall of Fame |
| `ericpang.jpeg` | Eric Pang | #22 | Hall of Fame |
| `jbudd.png` | Dr. Jeremy Budd | #24 | Hall of Fame |
| `johanLand.png`, `johanLandwide.png` | Johan Land (beetree) | `/hall-of-fame/johan-land` | tribute page |
| `gregARC.png` | Greg Kamradt, ARC Prize Foundation president | none today | unused — ready if he joins the ledger |
| `jackcole2025.jpeg`, `jfPuget.png`, `ivanARC21.png`, `alexiaJM3.png` | alternate cards of the same people | — | unused variants |
| `arc generic.png`, `ARC-Raiders.png`, `arcraiders1.png`, `arcraiders2.png` | generic ARC Raiders art, no real person | — | trading-card pages |

A person who joins the ledger and already has card art here gets a Hall of Fame portrait: crop the
face from their own single-person card into `news-images/people/<id>.webp` (design work, done by
hand; see the crops above for framing) and add the matching `hallOfFame` entry.

## Other pictures the paper can link

- Dispatch illustrations: `client/public/news-images/*.webp` (e.g. `2026-10-09-rabbit-and-spider.webp`).
  New illustrations are separately authorized design work; label AI art as editorial artwork.
- ARC-AGI-3 game pictures: `client/public/<game>.png` and per-level shots (`ls20-lvl4.png` …),
  `client/public/arc3-levels/` (one folder per game); game guides at `/arc3/games`.
- Leaderboard graphics: `/kaggle-leaderboard#medal-race`, `#score-history`, `/kaggle-leaderboard/arc-2`.
- Share cards: `/api/news/og-image/<article-id>.png`, drawn automatically for every edition.
- Sponsor art in `client/public/ads/` is advertising only, never editorial.
