# GPU Valley: handoff for another image model

Author: GPT-6.1 Sol / Codex · October 14, 2026

Use the three images posted in **#arc3-rollout-feed** as examples. This is an
ongoing illustrated comic of the ARC competition: stable characters, a different
inventive engineering episode each time. The machinery is playful metaphor.

## Brief for the image model

> Create one polished 16:9 landscape episode in the attached GPU Valley world:
> intricate snowy fantasy engineering, brass rails, glowing electronics, physical
> graphics cards, fan arrays and atmospheric mountain depth. Keep the recognizable
> cast, but invent a new coherent machine and action. Change the camera, poses,
> lighting and machine silhouette; a recolor or mirrored old composition is not a
> new episode. Give the pursuing teams increasingly wild siege equipment: walking
> foundries, folding bridges, gyroscopes, trebuchets, scissor lifts, cableways or
> fan-powered airships. They build and climb rather than injure or destroy.
>
> Where the supplied current race brief supports it, Tufa and Chen occupy TWO
> SEPARATE GPU forts on adjacent high ridges. Tufa has exactly FIVE fluffy black
> spiders and one reference-matched Dries. Chen has exactly TWO owner-reference
> rabbits: a grey-brown lop with both ears down, and a dark-and-white rabbit with
> upright dark ears and a broad irregular white facial blaze. Do not mix their
> forts or add extra animals. Lead towers are about one-fifth taller than the
> tallest challenger tower in comparable perspective, an artistic convention.
>
> NVIDIA/NVARC uses green-and-black GPU equipment, tasteful accurate NVIDIA
> branding, and the separate recognizable Puget and Sorokin reference characters.
> Add little supporting engineers covered in GPUs and opaque helmets; they can be
> anonymous. Other teams get their own distinct machines. Use Mark and Son's
> separate supplied avatars only where their current team belongs in the field.
> Place the actual top-five/top-ten contenders according to the supplied race
> brief. Let a closing challenger approach the ridge; adapt the geography if the
> leading tier changes.
>
> Keep faces readable. Leave quieter space at top center and bottom center for
> later publication overlays. Generate CLEAN ART: no scores, ranks, dates,
> newspaper branding, watermarks or trading-card borders. Small requested team
> pennants and NVIDIA branding are the lettering exceptions. Preserve reference
> identities; ignore historical scores/text printed on reference cards.

Append this short episode specification before generating:

```
Current competition and observation date:
Current leaders, chasing tiers and roster-matched pictured cast:
Verified new development, or explicit editor commission:
New machine / main action:
Different camera, lighting, poses and supporting-team activities:
Attached reference images and the exact role of each:
```

## Reference images to supply

Attach the actual images, not just their descriptions. These links pin the saved
references to the reviewed repository version:

- [Original valley: world, geography and ensemble](https://raw.githubusercontent.com/82deutschmark/arc-explainer/c85b82a9/client/public/news-images/2026-10-13-valley-strongholds-v1-base.webp)
- [Puget's individual character](https://raw.githubusercontent.com/82deutschmark/arc-explainer/c85b82a9/client/public/news-images/references/2026-10-12-jean-francois-puget-reference-1-v1.png)
- [Sorokin's individual character](https://raw.githubusercontent.com/82deutschmark/arc-explainer/c85b82a9/client/public/news-images/references/2026-10-12-ivan-sorokin-reference-1-v1.png)
- [Mark's own avatar](https://raw.githubusercontent.com/82deutschmark/arc-explainer/c85b82a9/client/public/news-images/references/2026-10-12-mark-barney-reference-1-v1.webp)
- [Son's own avatar](https://raw.githubusercontent.com/82deutschmark/arc-explainer/c85b82a9/client/public/news-images/references/2026-10-12-son-pham-reference-1-v1.webp)
- [Chen's authoritative owner photo](https://raw.githubusercontent.com/82deutschmark/arc-explainer/c85b82a9/client/public/news-images/references/yi-chia-chen-bunnies-owner-2026-10-12.png)
- [Dries's frozen character](https://raw.githubusercontent.com/82deutschmark/arc-explainer/c85b82a9/client/public/news-images/references/2026-10-12-dries-smit-character-v1-base.webp)

Models with limited reference slots can use the ensemble for its already-reviewed
rabbits/Dries and reserve individual slots for faces that need to remain readable.
Inspect every reference yourself; never claim an unattached file was a model input.

## The newsroom's repeatable workflow

1. Read `REPORTER.md`, `ART_DESK.md`, the character registry and artwork inventory.
   Check actual article appearances and X attachments separately. Use suitable
   unused reserves first unless Mark specifically commissions new variations.
2. Refresh standings and rosters. Save a dated cast sheet with exact competition,
   team/person IDs, reference paths and each group's role. An observed rank change
   can move a machine uphill; no movement should be invented. Named recognizable
   people require their own verified references. Anonymous GPU-covered NVIDIA
   supporting crew are explicitly authorized, without assigning individual names
   or asserting that their count equals the roster.
   MTG and The Last Dance can be represented by labelled team machines; an
   individual likeness needs its own reference. Ronen has no frozen likeness yet.
3. Choose one coherent episode based on the news or Mark's request.
   The Boss’s expanded direction is to show all ten camps when the field supports it: the two rival citadels above eight separate workshops, NVARC3’s mysterious green machine, Turducken’s nested drone and alternative configurations, and distinct siege equipment elsewhere. Retain the recurring approved characters; anonymous crews do not invent missing likenesses. The wrong-way wrench can recur as affectionate, attributed artwork banter. For numerical comparisons, draw exact score-point gaps to both leaders in code from a dated board; keep the clean native scene and dated graphic separate.
   Do not let an
   older composition dictate the article headline. Give pictured contenders brief
   sourced race context in the manuscript.
4. Inspect inputs, generate clean art, and review the result: counts, ear/coat
   details, distinct faces, team separation, coherent machines and overlay space.
   Use a focused native edit when necessary. Save the ACTUAL selected call's
   prompt, input files, earlier call chain and visual review.
5. Our production desk uses built-in `image_gen.imagegen`, then
   `scripts/newsroom_artwork.py register`. Preserve the clean original and immutable
   provenance. For a future issue, run `plan`, `compose`, `attach`, then newsroom
   `validate` against that issue's fresh brief and manuscript. The existing
   compositor draws exact scores, full Eastern observation time and paper branding.
   Inspect its finished copy. Never repaint or reuse yesterday's score panel.
6. Record every actual article use, X attachment and Discord preview separately.
   The current two-row score planner does not check the entire background cast;
   the journalist must check all pictured teams and supporting roster conditions.

## Existing instructions and exact prompts

- [Full production workflow](ART_DESK.md)
- [Frozen character library](CHARACTERS.md)
- [Race-driven valley episode planning](2026-10-13-valley-strongholds-art-plan.md)
- [Three prepared reserves and their future-use conditions](2026-10-14-valley-reserve-art-plan.md)
- Exact selected prompts, input names/hashes, call chains and visual reviews live
  in `content/news/artwork/2026-10-14-valley-*-base.json`. The complete actual tool
  arguments, dated source board and cast handoff are also preserved in the shared
  art-planning reports. Each base has `overlayPlacement: center`.

The [Walking Foundry record](../../content/news/artwork/2026-10-14-valley-walking-foundry-v1-base.json),
[Gyroscopic Siege record](../../content/news/artwork/2026-10-14-valley-gyroscopic-siege-v1-base.json)
and [Aurora Skyworks record](../../content/news/artwork/2026-10-14-valley-aurora-skyworks-v1-base.json)
preserve the full `generationChain` and `supportingReferences`. For reconstruction,
start with the first full-scene prompt in that chain. The first two records' top-level
`prompt` describes the final targeted edit, so it is insufficient by itself to create
the scene from scratch.
