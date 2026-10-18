# Competitor character reference library

Author: GPT-6.1 Sol / Codex · 12 October 2026

The Boss commissioned the expanded library on October 12. The registry is `content/news/visual-identities.json`; browse `/news-images/references/index.html`. It contains sixteen individually identified competitors plus the Tufa team mascot. Mithil A Vakde and gromml remain pending because the saved ledger has no individual reference for them. The gallery is generated from the registry, so the desk and the review view use the same cast.

Every existing avatar/card reference is an exact, dated copy under `client/public/news-images/references/`. Its hash, original source path and source kind are recorded. The separate people-page portraits can refresh without changing the established character. Use a new versioned filename when deliberately changing a character. Individual avatars govern Franzen’s duck, Disselhoff’s orange cat, Hartmann’s fox, Findley’s detective cat, Keith’s cap-wearing yellow character, IsaiahP’s goose and the other inspected avatars. Puget, Sorokin and Cole use their own individual Hall of Fame characters. The shared ARChitects card does not identify which drawn face is whose and is excluded as an individual reference. Historical card scores and team labels are ignored during generation.

Chen’s exact full-size owner-provided photo is saved as `client/public/news-images/references/yi-chia-chen-bunnies-owner-2026-10-12.png`. Mark supplied it in this chat and identified it as her reference. Her grey lop has both ears down; the other bunny has upright dark ears and a broad white face blaze. The clean native reference and the Dries reference are:

- `client/public/news-images/references/2026-10-12-chen-bunnies-character-v1-base.webp`, with the actual native prompt and input roles in `content/news/artwork/2026-10-12-chen-bunnies-character-v1-base.json`.
- `client/public/news-images/references/2026-10-12-dries-smit-character-v1-base.webp`, with the prompt and provenance in `content/news/artwork/2026-10-12-dries-smit-character-v1-base.json`.
- Tonight’s revised scene: `client/public/news-images/2026-10-12-bunnies-dries-and-compute-v2-base.webp`; its generation/edit prompts and visual review are in `content/news/artwork/2026-10-12-bunnies-dries-and-compute-v2-base.json`.

Native Codex image generation made these three selected assets. The scene has exactly two corrected bunnies, one Dries and five spiders. An initial extra spider was removed with one targeted native edit. The existing raw art and earlier editions remain preserved.

## Casting and upkeep

October 13 expanded-scene direction: follow the
[two strongholds and chasing valley plan](2026-10-13-valley-strongholds-art-plan.md).
Puget and Sorokin already have separate frozen Hall of Fame character references;
use both when their exact handles match NVARC3's fresh ARC-3 roster. Mark requests
NVIDIA-green GPU siege equipment and accents for them. Add reference-ready top-five
and top-ten competitors to future scenes, including Son/Mark's saved cyber-engineer
avatars where their current entry belongs. The Last Dance's current roster is known,
but its members have no mapped individual character references in the saved ledger
yet; obtain their own verified references first. Ronen also needs an individual
reference. Preserve the existing characters and prepared scenes while filling gaps.

A `personId` follows that person’s verified Kaggle handle in the fresh observed roster, including new team IDs. All matched individual references remain available on multi-person teams. A curated team mascot takes priority; its `includePeople` lists explicit optional companions. Tufa currently requests Dries. He is included only when his exact verified handle is observed in that contest’s current roster. The revised growing-lead scene also requires Dries, Chen first, Tufa second, a widening verified gap and matching reference hashes. If those conditions fail, the desk must use an appropriate scene or sourced text.

Reference roles are combined when the same image serves multiple identities. Artwork job IDs include the reference versions, cast, scene, prompt and overlay version. Changing a reference does not overwrite an earlier composition. The planner checks selected reference hashes before providing native-tool arguments.

Validate the complete library and rebuild its gallery after a deliberate reference update:

```sh
python3.13 scripts/newsroom_artwork.py library --gallery client/public/news-images/references/index.html
```

Inspect each new input and native output. A character-reference registration uses the existing `register` command with a plan job containing `purpose: character-reference` and its exact `subjectId`, actual `toolArguments` and reference roles. Record the final selected call if an edit was needed. Register a new version, update its registry reference, inspect the gallery and commit the intended assets and records together. Add newly verified people through the normal people ledger; an unlisted person or default avatar supplies no character.

## Team Turducken’s commissioned crew

The October 18 full-crew commission uses Son’s supplied Discord avatars directly: DZ is the blonde, red-eyed chibi with a pink plush bunny; NT is the orange kitten in a banana suit with comic tears; Choryu uses a grayscale cardiac-MRI display as a head; Herminator, the silver/cobalt plumed knight, stands in for Ronen’s bot. These are approved editorial characters, not claims about real faces or health. Preserve Mark, Son, Keith’s black-capped yellow mascot and exactly two Yorkies. The four frozen inputs are `client/public/news-images/references/2026-10-18-turducken-{dzj,nt,choryu,herminator}-avatar-v1.png`; the full-crew generation record preserves their hashes and roles.

The seven-character hangar is `2026-10-18-turducken-full-crew-codex-v1-base`; the expanded ten-camp panorama is `2026-10-18-top-ten-siege-full-crew-v1-base`. Their records and clean assets live in the normal artwork folders. Earlier three-character hangar and first-flight episodes remain intact; a pictured subset is not a roster headcount.

## Programmed corner graphics

The compositor now draws a compact lower-left team/rank/score chart and an upper-right ARC Daily Digest / ARC Explainer chyron directly onto a copy of the approved scene. It uses the existing favicon and newsroom fonts. Both bars share a 0–100 score scale. The exact scores and observation time come from the edition brief. It keeps the scene’s aspect ratio and source bytes, and archives `corner-overlays-v1` with the image hash. Generation prompts reserve those corners for the code-drawn graphics. Overlays require no new native image generation. The headline remains bound to the composition record and appears in the article; the image carries the small statistics and branding requested by the Boss.
