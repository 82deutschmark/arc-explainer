# Art and cards for the Loose Goose: what to reuse, what to remake

Author: Claude Sonnet 5.5 Medium · 31 October 2026 · from [ART_DESK.md](../newsroom/ART_DESK.md), [CHARACTERS.md](../newsroom/CHARACTERS.md),
[VISUALS.md](../newsroom/VISUALS.md), [CARD_PLAYBOOK.md](../newsroom/CARD_PLAYBOOK.md), [CARD_ART_BRIEF.md](../newsroom/CARD_ART_BRIEF.md),
[GPU_VALLEY_IMAGE_GUIDE.md](../newsroom/GPU_VALLEY_IMAGE_GUIDE.md) and the Colosseum series made on 31 October.

## The look

### The Loose Goose mascot (31 October 2026)

The Boss's direction is a riff on Kaggle's default goose reference: a gritty 1950s
newspaper reporter in a PRESS hat, with a cigar or cigarette and a notebook. The
goose belongs in a cyberpunk, retrofuturist, comic-book Kaggleverse, with data
science, equations and computing imagery. Keep the bird recognizable as the supplied
goose. The art is for a sports tabloid covering the real Kaggle community and its
discussions.

**Never invent fictional stories, incidents, post numbers or headlines for the paper,
including in art concepts.** The Boss explicitly rejected the invented Post #47 cover.
Do not reuse that cover. Use sourced, real reporting when an image calls for a story.

The Boss liked the standalone original and both initial variations. No final mascot
has been selected. The two equation-rich versions are new concepts awaiting feedback.
These are preserved as concept originals, not yet approved publication assets:

| Image | Status |
|---|---|
| [Supplied goose reference](art/goose-reference.png) | Boss's reference |
| [Original reporter goose](art/goose-original-concept.png) | Liked |
| [Magenta variation](art/goose-magenta.png) | Liked |
| [Orange variation](art/goose-orange.png) | Liked |
| [Chalkboard data science variation](art/goose-chalkboard.png) | Awaiting feedback |
| [Neon data science variation](art/goose-data-neon.png) | Awaiting feedback |

The reporter concepts were generated with the built-in image tool. The initial
reporter used the supplied goose and the existing Lights Out and Colosseum v4 art
as references. The next pair used the supplied goose and original reporter. The
data science pair used the supplied goose and both liked variations. Equations and
diagrams in the concepts are decorative and have not been checked for correctness.

An evolving comic strip in a fantasy-industrial world: snowy valleys of glowing GPU strongholds, banners per team, mascots (rabbits for Chen, black friendly spiders for Tufa, the turkey airship and its crew for Team Turducken), crowds of small engineers under flashlights. Warm, bright, crowded, funny. Sports-page energy: the leaders are giants and the field is small on the sand.

## What carries over to every contest

- **The people.** A competitor's portrait, card and character are built once and reused in every contest. This is the biggest saving. Ledgers: `content/news/people.json`, `visual-identities.json`, `cards.json`, `careers.json`. Add a contest key; do not rebuild the person.
- **The world.** GPU Valley, the Colosseum, the Scoring Hall, the Hall of Fame are settings. A new contest changes which teams stand in them, not the world. The Scoring Hall series (lights out, the deadline clock, the xz entrance, the Last Dance cypher) is the model for "the scoring system" as a place.
- **The stock.** `content/news/artwork-inventory.json` lists every finished image, where it was used, and what is still unused. Read it before any image work. Unused prepared scenes come first.
- **Reference-first casting.** Every commission is built from real reference images (an owner photo, a verified avatar, a Hall of Fame portrait). Never guess a face from a name. Never depict someone who is not on the fresh roster. Anonymous little engineers with opaque visors stand in for people without a verified reference. See CHARACTERS.md.
- **The Colosseum series** (`client/public/news-images/colosseum/`, originals on the SSD): two giant rabbits beside a freestanding citadel in an arena, small teams on the sand. It is the template for "two leaders, everyone else small". Son Pham's pick is v4. Reuse the layout with new leaders.

## What to remake for a new contest

- The cast of top teams (one new character or mascot per team, from fresh references).
- The scoring-hall scenes if the contest has a different scoring story.
- Score overlays (dated score panels built by `scripts/newsroom_artwork.py`; they print only the dated score line, never an "illustration" disclaimer).
- Team banners and machine silhouettes (the machines are metaphors, never claims about hardware or spending).

## The rules that keep art cheap and good

1. **At most two native image generations, including revisions, between editor feedback.** Show the results, say when finished, stop. No silent third batch (the Boss, 30 October).
2. **Every front page has a picture,** and each illustrated issue is a new episode (different setting, action, camera). A new crop of an old scene is not new.
3. **Discord first.** Deliver the finished picture with the story link to the feed channel before any X post; a reaction clears it (X_PLAYBOOK.md).
4. **Captions describe the scene.** No "editorial illustration", "fantasy", "metaphor" or "not anybody's real equipment" anywhere in captions, alt text or editor's notes.
5. **Alt text** says what is in the picture, in plain words.
6. **Web copies only on pages.** Make a 1400 or 1600 pixel webp for the page; keep the originals on the Samsung SSD. Never point a page at a 2 to 4 MB original.
7. **Keep what Son and Bubba make.** Anything they produce in the feed channel is saved with its version name and a note about which one was picked.

## The cards

- One card per competitor and per team, plus sponsors. A numbered set per contest and season: P-numbers for people, T-numbers for teams. Name the set after the contest ("ARC Prize"). Never print an internal development name.
- Look: 80s baseball cards. Front: a portrait rendering, tier border and medallion in Kaggle's ladder (Novice, Contributor, Expert, Master, Grandmaster), contest mark, number, LIVE or FINAL stamp with one date, and standing. Back: career table, season standings, teammates, a "did you know" strip. Art is 5:7, no text in the picture, room for the code-drawn border.
- Facts on a card come from sourced highlights (profile pages, write-ups, employer pages) with check dates. A card is a lookup, not permission to invent a motive or a rivalry.
- Before naming anyone in a post or story, look their card up and link it: `/news/cards/<card id>`. The share image for a card is `/api/news/cards/<card id>/share.png`.
- Use cards for context inside stories, not as the story. Standalone "card of the day" posts were rejected (X_PLAYBOOK.md).
- Do not commission card art during a news run unless ordered. Art is bound into `cards.json` only after review, with a provenance record in `content/news/artwork/`.

## Where things are

| Thing | Place |
|---|---|
| Finished images and inventory | `client/public/news-images/`, `content/news/artwork-inventory.json` |
| Colosseum series | `client/public/news-images/colosseum/` and the SSD folder `arc-daily-artwork/2026-10-31-colosseum` |
| Card art and proofs | `client/public/news-images/cards/`, `docs/newsroom/card-proofs/` |
| Character library | `docs/newsroom/CHARACTERS.md`, `content/news/visual-identities.json` |
| Image-model handoff | `docs/newsroom/GPU_VALLEY_IMAGE_GUIDE.md` |
| Optimised page copies | `client/public/specials/img/` |
