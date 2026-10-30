# Competitor character reference library

Author: GPT-6.1 Sol / Codex · 12 October 2026; team-specific casting updated 19 October 2026

The Boss commissioned the expanded library on October 12. The registry is `content/news/visual-identities.json`; browse `/news-images/references/index.html`. It contains established individual characters, curated team casts and the Tufa team mascot. Mithil A Vakde and gromml remain pending because the saved ledger has no individual reference for them. The gallery is generated from the registry, so the desk and the review view use the same cast.

Every existing avatar/card reference is an exact, dated copy under `client/public/news-images/references/`. Its hash, original source path and source kind are recorded. The separate people-page portraits can refresh without changing the established character. Use a new versioned filename when deliberately changing a character. Individual avatars govern Franzen’s duck, Disselhoff’s orange cat, Hartmann’s fox, Findley’s detective cat, Keith’s cap-wearing yellow character, IsaiahP’s goose and the other inspected avatars. Puget, Sorokin and Cole use their own individual Hall of Fame characters. The shared ARChitects card does not identify which drawn face is whose and is excluded as an individual reference. Historical card scores and team labels are ignored during generation.

Chen’s exact full-size owner-provided photo is saved as `client/public/news-images/references/yi-chia-chen-bunnies-owner-2026-10-12.png`. Mark supplied it in this chat and identified it as her reference. Her grey lop has both ears down; the other bunny has upright dark ears and a broad white face blaze. The clean native reference and the Dries reference are:

- `client/public/news-images/references/2026-10-12-chen-bunnies-character-v1-base.webp`, with the actual native prompt and input roles in `content/news/artwork/2026-10-12-chen-bunnies-character-v1-base.json`.
- `client/public/news-images/references/2026-10-12-dries-smit-character-v1-base.webp`, with the prompt and provenance in `content/news/artwork/2026-10-12-dries-smit-character-v1-base.json`.
- Tonight’s revised scene: `client/public/news-images/2026-10-12-bunnies-dries-and-compute-v2-base.webp`; its generation/edit prompts and visual review are in `content/news/artwork/2026-10-12-bunnies-dries-and-compute-v2-base.json`.

Native Codex image generation made these three selected assets. The scene has exactly two corrected bunnies, one Dries and five spiders. An initial extra spider was removed with one targeted native edit. The existing raw art and earlier editions remain preserved.

## Required source for all commissions

Every commission begins with the [Card Cabinet](https://arc.markbarney.net/news/cards) and
[TEAM_PLAYBOOK.md](TEAM_PLAYBOOK.md). Look up the exact person/account or competition-specific
team and use its registered character images as actual generation inputs. This governs existing
artwork reuse and all newly commissioned episodes. Preserve references, character mappings and
originals; record and resolve a missing mapping before reuse rather than guessing a likeness.
Include the Cabinet URL and exact reference paths in every art-desk handoff.

## Casting and upkeep

October 13 expanded-scene direction: follow the
[two strongholds and chasing valley plan](2026-10-13-valley-strongholds-art-plan.md).
Puget and Sorokin already have separate frozen Hall of Fame character references;
use both when their exact handles match NVARC3's fresh ARC-3 roster. Mark requests
NVIDIA-green GPU siege equipment and accents for them. Add reference-ready top-five
and top-ten competitors to future scenes, including Son/Mark's saved cyber-engineer
avatars where their current entry belongs. The Last Dance now has three verified individual
references and a fictional fourth-account stand-in (October 29), described below.
Ronen has no verified human likeness;
use only the explicitly approved fictional stand-ins described below. Preserve the
existing characters and prepared scenes while filling gaps.

A `personId` follows that person’s verified Kaggle handle in the fresh observed roster, including new team IDs. All matched individual references remain available on multi-person teams. A curated team mascot takes priority; its `includePeople` lists explicit optional companions. Tufa currently requests Dries. He is included only when his exact verified handle is observed in that contest’s current roster. The revised growing-lead scene also requires Dries, Chen first, Tufa second, a widening verified gap and matching reference hashes. If those conditions fail, the desk must use an appropriate scene or sourced text.

Reference roles are combined when the same image serves multiple identities. Artwork job IDs include the reference versions, cast, scene, prompt and overlay version. Changing a reference does not overwrite an earlier composition. The planner checks selected reference hashes before providing native-tool arguments.

Validate the complete library and rebuild its gallery after a deliberate reference update:

```sh
python3.13 scripts/newsroom_artwork.py library --gallery client/public/news-images/references/index.html
```

Inspect each new input and native output. A character-reference registration uses the existing `register` command with a plan job containing `purpose: character-reference` and its exact `subjectId`, actual `toolArguments` and reference roles. Record the final selected call if an edit was needed. Register a new version, update its registry reference, inspect the gallery and commit the intended assets and records together. Add newly verified people through the normal people ledger; an unlisted person or default avatar supplies no character.

## Choose the competition before casting

These are separate 2026 entries, confirmed by Mark and the public boards on 19 October.
Refresh the roster before a new news illustration; this dated map is not a permanent roster.
Overlapping people do not make the teams interchangeable.

| Competition | Team / ID | Observed Kaggle handles | Approved illustrated crew and visual setting |
|---|---|---|---|
| ARC-AGI-2 | **ARC Mutants**, `17023174` | `jcole75`, `markbarney`, `scizical`, `sonphamorg` | Jack Cole, Mark Barney, Ronen and Son Pham. Digital university, original gifted-hero academy, floating ARC input/output grids; Jack the cerebral mentor, Mark the GPU brawler, Son the visor-equipped energy specialist, Ronen the opaque-helmet grid-shield architect. |
| ARC-AGI-3 | **Team Turducken**, `15605182` | `dzjiann`, `keithtyser`, `markbarney`, `mitubant`, `ngyzly`, `scizical`, `sonphamorg` | Mark, Son, Keith’s yellow mascot, DZ, NT, Choryu’s MRI-display character and Herminator standing in for Ronen, plus exactly two Yorkies. Mechanical turkey/chicken/duck, workshop/hangar and established snowy GPU Valley setting. Avatar names here describe the approved cast; they do not independently prove an exact Kaggle-to-Discord identity match. |

Roster evidence: `client/public/reports/arc-daily-gossip/2026-10-19-arc-mutants-public-rosters.json`.
Owner confirmation: `client/public/reports/arc-daily-gossip/2026-10-19-arc2-mutants-team-note.json`.
Use exact competition and team IDs to select current people from `content/news/people.json`
and `competitors.json`. Earlier ARC2 history called `17023174` Team Turducken; keep
that historical alias without importing the ARC3 cast. Jack joined ARC2 ARC Mutants;
he is not on the recorded ARC3 Team Turducken roster. Do not add him to that crew.

### Individual input images

All paths below are relative to `client/public/news-images/references/` in the designated
newsroom checkout. Inspect selected images before native generation; preserve their bytes.

| Subject / role | Frozen reference |
|---|---|
| Jack, ARC2 cerebral mentor | `2026-10-12-jack-cole-reference-1-v1.png` — his individual card; ignore old labels, scores and team names. |
| Mark, either contest | `2026-10-12-mark-barney-reference-1-v1.webp` — bearded cyber-engineer with GPU rig and multicolored screens. |
| Son, either contest | `2026-10-12-son-pham-reference-1-v1.webp` — wide visor and dense black GPU headgear. |
| Ronen, ARC2 | No human portrait. Use the Boss-approved opaque-helmet character in the ARC Mutants academy scene below, not Herminator. |
| Keith, ARC3 | `2026-10-12-keith-tyser-reference-1-v1.webp` — established yellow mascot, black cap. |
| DZ, ARC3 | `2026-10-18-turducken-dzj-avatar-v1.png` — blonde chibi, red eyes, pink bunny. |
| NT / `mitubant`, ARC3 | `2026-10-18-turducken-nt-avatar-v1.png` — orange kitten in banana costume with comic tears. Boss confirmed the exact Kaggle handle on October29; dedicated avatar `2026-10-29-nt-mitubant-avatar-v1`. |
| Choryu, ARC3 | `2026-10-18-turducken-choryu-avatar-v1.png` — grayscale cardiac-MRI display head; no health claim. |
| Ronen’s Herminator stand-in, ARC3 | `2026-10-18-turducken-herminator-avatar-v1.png` — silver/cobalt knight with blue plume. |
| ARC2 aesthetic reference | `2026-10-19-arc-mutants-owner-aesthetic-v1.png` — ARC grids and dense GPU equipment; ignore old ARC Raiders branding. |

The approved academy scene supplies original superhero roles, not franchise costume
designs or actor likenesses. Keep ARC2’s digital campus separate from ARC3’s snowy
Turducken setting. All equipment and powers are editorial fantasy, not evidence of
hardware, methods or team headcount. Generation alone does not authorize publication.

## The Last Dance’s commissioned dancers — 29 October 2026

Use `2026-10-29-last-dance-character-sheet-v1-base.webp` for the four distinct costumes.
Left to right: Lukas Aichberger in navy/blue ARC grids; Florian Sestak (`fses91`) in
orange/red grids, black cap and sunglasses; Mykyta Ielanskyi (`dwellement0baser`) in
cyan/green grids with his reddish beard; a fictional purple/yellow dancer with an opaque
helmet for `gklambauer`. The first three follow their own frozen Kaggle portraits.
The fourth account has no confirmed real name or individual portrait: **the generic Kaggle
goose supplies no character identity**. Do not identify its owner as Günter Klambauer
without a direct account link, and do not turn the helmet into a claimed human likeness.

The compact adult scale, ARC-grid streetwear and breakdance moves are editorial fantasy.
The scoring-hall feature is `2026-10-29-last-dance-scoring-hall-v1-base.webp`; it has been
used for the October 29 team profile. Reuse the character references for new episodes,
not that published composition. Check the exact four handles against ARC3 team `16021367`
before casting the full team. The registry, native records and individual source pictures
are saved with the gallery.

## Team Turducken’s commissioned crew

The October 18 full-crew commission uses Son’s supplied Discord avatars directly: DZ is the blonde, red-eyed chibi with a pink plush bunny; NT is the orange kitten in a banana suit with comic tears; Choryu uses a grayscale cardiac-MRI display as a head; Herminator, the silver/cobalt plumed knight, stands in for Ronen’s bot. These are approved editorial characters, not claims about real faces or health. Preserve Mark, Son, Keith’s black-capped yellow mascot and exactly two Yorkies. The four frozen inputs are `client/public/news-images/references/2026-10-18-turducken-{dzj,nt,choryu,herminator}-avatar-v1.png`; the full-crew generation record preserves their hashes and roles.

**NT = Kaggle `mitubant` (Boss, October29).** The exact profile is
`https://www.kaggle.com/mitubant`, headed NT. His dedicated individual illustration and
P066 card retain the orange banana-suit kitten, blue comic tears and Turducken's snowy
brass/cobalt engineering world. Preserve its exact native PNG, original community avatar
and full crew style reference. This account is on ARC3 Turducken, not ARC2 ARC Mutants.
This direct confirmation resolves NT's mapping; it does not establish the other Discord
names' exact handles by elimination.
His separate ARC2 entry is team `15526034`, この遥かなる旅路に祝福を, alongside
`keithtyser`, `dzjiann` and `ngyzly` in the dated October29 snapshot. Keep that record
while leading his Turducken character card with the ARC3 entry.

The seven-character hangar is `2026-10-18-turducken-full-crew-codex-v1-base`; the expanded ten-camp panorama is `2026-10-18-top-ten-siege-full-crew-v1-base`. Their records and clean assets live in the normal artwork folders. Earlier three-character hangar and first-flight episodes remain intact; a pictured subset is not a roster headcount.

## ARC Mutants Academy (ARC2)

The Boss approved the **ARC Mutants Academy** illustration on 19 October 2026 for
Jack Cole joining the ARC2 team (`17023174`). Its image is
`client/public/news-images/2026-10-19-arc-mutants-academy-v1.png`; its generation record
is `content/news/artwork/2026-10-19-arc-mutants-academy-v1.json`. Jack uses his frozen
individual card, Mark and Son their frozen cyber-engineer avatars. Ronen is an
original opaque-helmet grid-shield character, not a verified likeness or a replacement
for Herminator's separate ARC3 role. The university, powers and GPU machinery are
editorial fantasy. Preserve the digital campus and ARC grids when developing this
ARC2 identity. Team Turducken (`15605182`) remains the separate ARC3 team: do not
transfer its snowy setting, crew or team name into the ARC Mutants announcement.

**Boss reaffirmed this direction on 29 October:** retain this exact academy original
and build future episodes around the X-Men / Professor Charles Xavier lore. Jack
occupies the cerebral mentor role; preserve his established own character rather than
replacing him with an actor. Keep Mark as the GPU brawler, Son as the visor-equipped
energy specialist and Ronen as the opaque-helmet grid-shield architect. Archive each
new iteration separately, retaining this base and all four individual references.
Only Mark, Son and the `scizical` account overlap the two current rosters; ARC3's other
four accounts do not inherit ARC Mutants membership or Jack's historical honors.

The Boss commissioned **three additional finished episodes** on October 29: **The
Danger Grid**, **The Pattern Observatory** and **Above the Academy**. Their exact native
originals, references and reviews are archived under `2026-10-29-arc-mutants-*` in the
normal artwork folders. See [the reserve](2026-10-29-arc-mutants-art-reserve.md) and its
JSON manifest. They supplement the approved original; T016 retains its original binding.

## Darren’s individual two-dog collectible — 29 October 2026

The dedicated individual illustration is
`2026-10-29-darren-individual-avatar-v1-base`, retained as its exact native PNG with
prompt, owner-reference photograph, full team style reference and review in the normal
artwork archive. Both dogs together represent Darren's one account: cream floppy-eared
retriever and dark/white husky, matching the Domdolus Tolus scene. This is a separately
generated illustration rather than a group crop. Preserve the photograph and original
team picture. The five dated card proofs and their exact public inputs are in
`docs/newsroom/card-proofs/2026-10-29/`.

## Programmed corner graphics

The compositor now draws a compact lower-left team/rank/score chart and an upper-right ARC Daily Digest / ARC Explainer chyron directly onto a copy of the approved scene. It uses the existing favicon and newsroom fonts. Both bars share a 0–100 score scale. The exact scores and observation time come from the edition brief. It keeps the scene’s aspect ratio and source bytes, and archives `corner-overlays-v1` with the image hash. Generation prompts reserve those corners for the code-drawn graphics. Overlays require no new native image generation. The headline remains bound to the composition record and appears in the article; the image carries the small statistics and branding requested by the Boss.


## October 29 contender-team avatar reserve

The Boss commissioned these nine finished illustrations to be preserved even while their
features remain held. All nine are curated **team/account references**, with no new invented
personal portrait entries and no automatic reusable scenes. The NVIDIA/ARC2 duo is artwork
only; no NVIDIA article is commissioned. Browse the regenerated reference gallery for all
nine. Exact native PNGs, WEBP gallery copies, actual input images, native prompts and
unchanged identity mappings are saved in the registry and generation records. The machine
manifest is `docs/newsroom/2026-10-29-team-avatar-archive.json`.

| Curated subject ID | Team reference and identity rule |
|---|---|
| `yktori-team` | yktori — Silver Comet: Original fictional account mascot: opaque mirrored silver helmet, orange visor, cobalt/silver racer suit, ARC-grid panels and pixel scarf. No real human face. The generic Kaggle goose is not a personal identity. Preserve this as the newspaper’s fictional Silver Comet, not an owner-selected avatar. |
| `mtg-team` | mtg / Michael — Two-board Rook: Original fictional account mascot with two ARC grids, representing the same handle’s separate entries. Preserve its rook-like silhouette and fantasy costume. Own profile supplies Michael only. The mascot is not his human likeness; no surname or career biography is inferred from michaeltgao. |
| `grigoriy-team` | Grigoriy Zatravkin & co — quartet: Left-to-right: red opaque-helmet Grigoriy stand-in; gold library-headed mascot for aizealotwu; dark-blue-haired anime owner-avatar adaptation for deepdreamer; violet opaque-helmet Florencia stand-in. The two helmets are fictional account stand-ins, and the scholarly mascot is an original adaptation of the owner graphic. The anime face is an avatar, not a claimed human likeness. Dated four-account roster: grigoriyzatravkin, aizealotwu, deepdreamer, florenciasolange. Refresh exact current roster before a new team scene. |
| `kontext-team` | 復活の混テキスト — eight-avatar ensemble: Upper row, left-to-right: isakatsuyoshi cup-holder; konbu17 seaweed; pompom555 orca; refv00 green dinosaur. Lower row: tanakaai24 glasses/scarf/book; tk256ailab opaque stairway explorer; ttyn4519 white/navy/red/yellow robot; yuto0712 blue whale. Preserve all eight separate motifs. The orca and whale are different characters. TK256’s masked explorer is fictional and respects a rear-view source without inventing a human face. Owner-selected cartoons and mascot graphics are account avatars, not verified human appearances. Refresh all eight exact roster handles before later team scenes. |
| `artificial-agency-team` | Artificial Agency Lab — Richard and Côme: Richard Csaky left: short textured dark hair, clean-shaven face, blue/violet ARC suit. Côme Chevalier right: longer tousled brown hair, moustache/stubble, orange/teal ARC suit and raised glove. Their separately labelled own-lab portraits establish the two faces and documented lab roles. Costumes and grid staging are editorial fiction. The exact cmechevalier-to-Côme account mapping remains unresolved. This team illustration credits the independently documented lab members, not an inferred account mapping. |
| `majkel1337-team` | Majkel1337 — copper fox: Original fictional copper fox account mascot: peach geometric brow markings, charcoal/copper ARC blazer, one tail and three abstract square-backed cards. The owner’s GitHub identicon supplies a graphic motif only. The fox is the newspaper’s invention, not an owner-selected fox or a human likeness of Michał Gromadzki. No franchise characters or implied gambling. |
| `aquaursa-team` | AquaUrsa Research — aqua polar bear: Original fictional white/aqua polar bear mascot, goggles on forehead, navy ARC jacket, held puzzle tile and visible boots. The generic Kaggle goose is not a personal avatar. The bear is an original newspaper mascot, not a verified individual, company emblem or owner-selected likeness. |
| `nvbanana-arc2-team` | nvbanana — ARC2 duo artwork: Jean-François Puget at left: established bearded cyan-lit cyber-engineer from his own individual Hall-of-Fame character. Darragh Hanley’s account at right: original opaque blue/gold spiral celestial figure adapted from his own painting avatar. Hanley’s painting is not his human face. Keep the celestial figure completely opaque, with no invented facial features; preserve Puget’s established individual character. Exactly two characters and a tiny banana ornament. This is ARC2 team 15486939, not NVARC3 or the full NVIDIA staff. No NVIDIA article has been commissioned; preserve artwork only. |
| `domdolus-tolus` | DomdolusTolus: EXACTLY FIVE accounts shown by SIX figures: four adult humanoids plus Darren’s TWO dogs together. Never count the dogs as two people or substitute an invented human Darren. Left-to-right: Billy Anggara = fictional opaque blue/cyan helmet; Alwin Theodoric = own face/glasses, beige/green; Darren Amadeus Martin = cream floppy-eared dog AND dark/white husky together at center; Muhammad Yassir Ramadhan = own face, navy/copper; Tri Ardian Rinalda = fictional opaque amber/red helmet. Billy and Tri have generic Kaggle default avatars, so both helmeted figures are explicit newspaper fiction rather than personal likenesses. Alwin and Yassir follow their separate own photos. Dogs follow Darren’s own avatar. DomdolusTolus has separate ARC2 team16559402 and ARC3 team16534961. Recheck the exact current five-account roster in the intended contest before later scenes; no current score or method is encoded by the fantasy clothing or background. |

The first registry reference is the gallery WEBP; the second is the exact native PNG.
Additional references preserve actual generation inputs and the underlying individual
owner avatars used in contact sheets. A generic Kaggle goose remains absence of a likeness.
Silver Comet, Two-board Rook, the copper fox, aqua bear and all named opaque-helmet stand-ins
are newspaper fiction; do not turn them into owner-selected avatars or human faces.
Current competition rosters must be checked before casting any complete team again.
