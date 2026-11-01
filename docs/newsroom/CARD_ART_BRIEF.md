# Card Cabinet artwork brief

Author: Claude Sonnet 5.5 · 30 October 2026 · from the Boss's own words that day. Read this before generating any card art. It overrides earlier card art habits in [ART_DESK.md](ART_DESK.md) and [CHARACTERS.md](CHARACTERS.md) where they differ.

Companion files: [CARD_ART_NEEDS.md](CARD_ART_NEEDS.md) (who needs what, with the photo to build from) and [card-art-template.png](card-art-template.png) (the zones, 1500 × 2100, transparent: lay it over your work to check).

## Boss's overriding corrections, 30 October 2026

- **Hard limit: at most TWO image generations between editor feedback, including revisions.** Show the finished images, explicitly report completion, then stop. Never silently continue into another batch. A later narrowing instruction controls the current work: the latest assignment is Jeroen only; another assistant owns the full Tufa crew.
- **Glamour character design, not a pasted photographic face.** Use the person's recognisable features as inspiration for a handsome, idealized, polished illustrated character. Redraw the whole face with flattering proportions, groomed hair and smooth painted skin; remove snapshot imperfections. Face and equipment must share one coherent illustration style. Literal photo-face preservation is a failed result.
- **Story before equipment.** Decide what makes this competitor special and express it through pose, costume, setting and machinery. Jeroen is the editor's Tufa mastermind: keep his wry expression and cerebral command pose, place him inside the established **Tufa Citadel** with enormous GPU racks, friendly black spiders and the spider emblem. Charcoal/ivory/copper with a little crimson distinguishes him from Jack's navy/gold academy role. He is a respected formidable rival, never an evil villain; Professor X/Magneto is a rivalry analogy, not an actor likeness or costume to copy.
- **Reuse good art first.** Existing individual cards and identified team characters can supply usable cuts; the Boss explicitly authorized extraction. Preserve originals. Do not regenerate a good established character merely because its individual card binding is absent.
- **No anime.** Approved anime conversions use adult, human-proportioned 1950s retro-futuristic/pulp characters with varied equipment. The other portrait repairs retain the established cyberpunk aesthetic. No scarves in new space costumes. Avoid repeated bubble helmets, twin GPU pillars, poses, uniforms and generic backgrounds.
- **Glamour preserves age, build and signature hair.** CPMP is a senior mastermind: visibly in his sixties, fuller face/build, long swept-back ponytail, salt-and-pepper beard and spectacles. Do not make every competitor a slim young hero. Weird open cyber helmets are welcome when most of the face remains visible. The Boss explicitly requested **CPMP engraved into helmet metal**; this stable character inscription is an exception to the no-text rule. Names, ranks, scores, borders and baseball-card graphics still belong to the other assistant's compositor.

These direct corrections supersede any older literal-likeness wording below. The source still establishes identity; it does not require reproducing the photographic face.

## What the cards are

The Card Cabinet is a collection of trading cards in the spirit of the 1980s baseball cards the Boss grew up on: an illustrated front with badges and a banner, a cardboard-style back full of small, dense statistics, a numbered set for each season, and every old card kept. Last year's ARC Hall of Fame cards are the model for the pictures.

**Every card is our own ARC Hall of Fame rendering of a real person**: a glamour shot of the competitor in cyberpunk gear, built from a real photo of them (their Kaggle avatar, X avatar, ARC Prize or team page, a talk, anywhere we can get one) so it looks vaguely like them. The photo is the *input*. The photo is never the card.

**They are competitors, not "players"**, and this is Kaggle. Everything is framed inside Kaggle competitions. Kaggle ranks people in tiers, in this order: Novice, Contributor, Expert, Master, Grandmaster. Each person's tier is on their card and earns its own border. The two ARC Prize co-founders are competition sponsors, not competitors. Teams get team cards.

## What changed from last year, and why

Last year's art has the name, handle, rank and achievement text painted into the picture, plus the series wordmark and a frame. Those numbers go stale and cannot change with the leaderboard. From now on **the picture carries no text at all and the code draws everything that can change**:

- the tier border (Novice, Contributor, Expert, Master, Grandmaster each look different, and the Boss wants masters and grandmasters to look special);
- the badges, name banner, rank, score, medals and tier;
- the series wordmark ("ARC Raiders" or whatever the year's series is called), season and card number.

So the artwork needs **room**. A good glamour shot of the competitor, with calm space where the code puts its elements.

## The composition contract

- **Format:** portrait, **5:7**, exactly. Deliver **1500 × 2100** pixels or larger at that ratio, sRGB, lossless WebP or PNG. The renderer draws the card at 750 × 1050, so it needs the extra pixels for crisp edges.
- **Full bleed, no frame.** The picture runs to all four edges. Do not paint a border, rounded corners, a glow at the edges, a card frame or a panel; the code draws the tier border over the outer 3.5 percent.
- **No text of any kind.** No names, handles, ranks, scores, URLs, captions, logos, the ARC Raiders wordmark, watermarks, or readable screen text. Fake gibberish on a monitor is fine if it is clearly not lettering.
- **Zones** (all measured on the 1500 × 2100 canvas; the template shows them):
  - Top 200 px: calm and uncluttered, for the tier medallion, season and number.
  - The subject lives between y 200 and y 1450 and between x 150 and x 1350. The whole head, face, hands and any prop must be inside it.
  - Eyes between y 560 and y 780.
  - Bottom 650 px (below y 1450): the name banner, stats and footer sit here. The picture may continue underneath (torso, floor, background), but nothing essential, and keep it darker and simpler than the subject so the overlays read.
- **A glamour shot, three-quarter length at most.** Head to waist, facing the camera or turned a little. A full-length figure does not fit the zone; if you want one, make it a separate smaller-figure variant.
- **Recognisable inspiration with an illustrated glamour transformation.** Retain signature hair, glasses, beard and broad character cues, then idealize and redraw the face and body as a coherent, handsome cyberpunk character. Add GPUs, cables, mechanically fitted facial optics, armour and ARC grids. Do not paste the actual photographic head, retain incidental blemishes or borrow a stranger's likeness.
- **Various poses are welcome**, up to three per person (a "hero" front-facing portrait first, then an action pose such as typing on a laptop, then a profile). They are for different seasons and for the card back. All must obey the zones.
- **Optional, very welcome:** a second file with the same figure cut out on a transparent background, so the code can put a tier-coloured aura behind it. Same size, same position.

## Teams and sponsors

- **Team cards:** a portrait-format group glamour shot of the whole roster, same ratio and zones. Up to four people stay large and recognisable; for bigger rosters show the four best known and suggest the rest with silhouettes, mascots or machines. Keep the team's mascot or running gag if it has one (Turducken, the rabbits, the cat). Landscape scenes made for the front page stay as they are; the card needs its own portrait composition.
- **The co-founders** (François Chollet and Mike Knoop) each get an individual rendering built from their official ARC Prize team photos. Today they share last year's two-person founders card.

## Rules that do not bend

1. **Never edit or overwrite an existing card or artwork file.** Last year's cards stay exactly as they are and stay on the Hall of Fame page. New work gets a new file.
2. **Name files** `client/public/news-images/cards/<season>/<person-or-team-id>-<variant>-v<n>.webp` (for example `2026/ivan-sorokin-hero-v1.webp`) and write the usual provenance record in `content/news/artwork/` with the prompt, the reference photo path and where the photo came from.
3. **Bind it** by setting the card's `art` in `content/news/cards.json`. Change nothing else about the card, and do not touch the card code, the layout, or the wording.
4. **Likeness comes from a real photo of that person.** Record the photo's source page. If no photo of the actual person can be found, say so in the provenance record and do not guess.
5. **Plain labels in anything you write**: competitors, not players; tiers by their Kaggle names.

## Order of work

The competition closes on 2 November. Start with the competitors and teams near the top of the ARC-AGI-3 and ARC-AGI-2 leaderboards, then work down [CARD_ART_NEEDS.md](CARD_ART_NEEDS.md) section 1 (photo on file), then the clean 2026 versions for people who have last year's card (section 3), then the photo hunt (section 2), then teams (section 5). Regenerate the list with `python3.13 scripts/card_art_needs.py` as cards get art.
