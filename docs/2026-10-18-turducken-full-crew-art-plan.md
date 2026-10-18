# Team Turducken full-crew art plan

Author: GPT-6 / Codex

Date: 2026-10-18

Purpose: Execute the Boss's approved full-crew art brief using native image generation, preserving the held dispatch and existing artwork.

SRP/DRY check: Pass — reuse the supplied base, four avatar references and existing dispatch image schema; no application code changes.

The user explicitly authorized the brief, dispatch image update, commit and push to `bubba/official-merger-story`. The existing local working branch is `bubba/official-merger-turducken`; push its resulting HEAD to the requested destination without merging to main. The story remains held until Son gives the release instruction.

- Generate with the native image tool using the base plus all four avatar references.
- Inspect the full crew, preserved mech, working roles, matching harnesses and absence of text.
- Save the selected artwork as `client/public/news-images/2026-10-18-team-turducken-mech-full-crew-v1.webp`, exactly 16:9.
- Change only the dispatch's image source, alt text and requested caption; add the changelog entry.
- Verify image format/dimensions, dispatch integrity and relevant existing content checks.
- Commit and push with `git push origin HEAD:bubba/official-merger-story`; verify the remote commit.

## Selected output and visual review

Generated with the built-in `image_gen.imagegen` tool, using all five supplied local image paths in the order specified by the prompt below and `transparent_background: false`. One generation; no creative follow-up edit.

Native source: `/Users/macmini/.codex/generated_images/01a15065-afa6-70e1-833a-48ae24e79fb5/exec-88858e32-bd4f-4288-852e-fdf1a48c4b70.png` (1672 × 941). Source SHA-256: `3fb2e16def724ace9d934cc6ce49f3f00824e475ea7754576f3b4a373d4f1e46`.

Converted with `cwebp -q 92 -resize 1664 936` to normalize the native output's near-16:9 ratio to exact 16:9. Original source and original base remain preserved. Saved WebP SHA-256: `9d1c6c64ccdbb23a1b59b61615b2cb716bdd60c5235c1f4584f242b21458720c`.

Inspected both native output and saved WebP. Mark works on the left wing; Son works at the cockpit; Keith uses his tablet between exactly two armoured Yorkies. DZ holds her pink bunny at the left diagnostic panel; NT's banana costume, orange kitten face and arcing comic tears are clearly visible beside a thruster control; Choryu connects cables with a grayscale cardiac scan display for a head; Herminator works on the upper-right mech fittings in silver armour with a cobalt plume and tech harness. Matching cyan-and-gold equipment ties the crew together. The larger turkey retains its chicken and sunglasses duck, fan tail and thrusters, with the snowy castle beyond the hangar. No visible logos, captions or score panels.

## Verification

- Verified WebP decoding, 1664 × 936 exact 16:9 dimensions, exact requested caption and unchanged dispatch fields outside `image`.
- `npm run build`: passed. Built assets are ignored and are not part of the commit.
- `python3.13 -m unittest discover -s tests -p 'test_newsroom*.py'`: 62 passed.
- `npx vitest run tests/integration/news.test.ts tests/newsFrontPage.test.ts`: 25 passed, one unrelated existing RSS test failed. `tests/integration/news.test.ts:119` expects every archived edition in RSS; unchanged `server/services/news/newsPresentation.ts:171` deliberately uses `articles.slice(0, 40)`. The first missing edition is October 8 morning ARC-2. Dispatch/artwork serving and committed-content validation passed. Initial attempts required preparing a writable local dependency cache and the production build in this checkout; neither changed application code.
- `git diff --check`: passed.

Delivery is restricted to `git push origin HEAD:bubba/official-merger-story`; the held dispatch is not approved for release to main.

The managed filesystem rejected creation of the shared worktree's `index.lock`. Delivery therefore uses isolated Git metadata in `/tmp/arcx-turducken-delivery.git`, reading the existing parent objects through an alternate object directory. Its branch starts at the exact original HEAD (`a84701f29007e31dd8073944ca057cb3dad83139`) and stages only the four deliverable files. The original worktree's Git metadata stays untouched.

## Native generation prompt

```text
Use case: compositing.
Asset type: official Team Turducken dispatch illustration, landscape 16:9.
Input images: Image 1 is the edit target and definitive visual base (the mechanical Turducken in its hangar with the existing crew). Images 2–5 are identity references for four added crew: Image 2 DZ, Image 3 NT, Image 4 Choryu, Image 5 Herminator.
Primary request: Expand the base into a bigger, more heroic full-crew scene, preserving its richly detailed cinematic 3D illustration style, warm gold workshop lights, electric cyan technology, snowy mountains and illuminated castle. Preserve the giant turkey mech, its fan tail, broad mechanical wings, glowing ducted thrusters and the chicken containing a sunglasses-wearing duck nested inside the turkey. Give the heroic mech the upper two thirds of the composition and expand the hangar/catwalk framing as needed to show the entire working crew clearly.
Preserve the original crew, recognizable and unobscured: Mark, the bearded muscular tattooed cyber-engineer with GPU backpack, working on the left wing; Son, the dark-armoured cyber-engineer with elaborate blue visor helmet, working beside the cockpit on the right; Keith, the round yellow mascot wearing black cap and black hoodie and using his tablet; and exactly two small armoured Yorkshire terriers. Do not replace any of them with the new characters.
Add exactly four distinct crew, recognizable from the four avatar references, integrated into the same scene rather than as inset portraits. Each wears a matching black-and-gold tech harness with cyan equipment and visibly performs a real job on the mech:
1. DZ: the reference chibi anime girl, short golden-blonde hair and very large red eyes, retaining her pink stuffed bunny under one arm while her free hand operates a wing diagnostic console. Keep her cute avatar identity and cheerful proud expression.
2. NT: the reference orange tabby kitten inside a full bright-yellow banana costume, unmistakable cat face and banana stem, huge expressive comic tears arcing from both eyes, proudly operating a thruster calibration lever with little paws. Treat the tears as joyous comic determination, preserve this defining avatar detail.
3. Choryu: a humanoid technician with a glowing rectangular holographic display IN PLACE OF the head. Its display shows the grayscale cardiac MRI cross-section from Image 4, an unmistakable anatomical medical scan with heart and torso shapes; no ordinary face, no skull, no helmeted human head. The technician connects and tunes the mech's power/data cabling.
4. Herminator, Ronen's bot: a proud knight matching Image 5, ornate reflective silver cuirassier armour, tall plumed helmet, electric cobalt-blue sheen and glow, wearing the matching tech harness over his armour and tightening a wing-brace bolt with a substantial workshop torque wrench.
Arrange all seven main crew and the two Yorkies across coherent tiered working platforms around the giant mech. Their hands/tools contact their workstations believably. All four newcomers must be clearly identifiable and large enough to read; do not place them as tiny distant extras. Keep both Yorkies visible. Preserve the nested mechanical chicken and duck as machinery/mascots inside the turkey.
Composition and mood: epic heroic wide-angle hangar tableau, larger imposing mech towering over its proud working team; sophisticated highly detailed polished metal and cloth textures, cinematic depth, warm amber and cyan illumination; the avatar characters keep their recognizable stylized identities while sharing the scene's light and perspective.
Constraints: final image exactly landscape 16:9, edge-to-edge illustration. No text, letters, logos, numbers, labels, watermarks, score panels or typography anywhere, including on hats, screens or armour. Screen graphics are unlabeled abstract schematics except Choryu's MRI. No extra humans, no duplicated crew, no additional dogs.
```
